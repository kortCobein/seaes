import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { RecordGroup, SeaesRecord, WorkbookSchema } from '../src/models/types';
import { consolidate } from '../src/services/consolidation';
import { exportWorkbook } from '../src/services/excel/OutputWorkbookMapper';
import { openPackage } from '../src/services/excel/package';
import { createWorkbookPreview, readWorkbookPreview } from '../src/services/excel/WorkbookPreview';
import type { WorkbookPreviewData } from '../src/services/excel/WorkbookPreview';
import { createWorkbookPdf, pdfCellValue } from '../src/features/preview/exportPdf';

let schema: WorkbookSchema, template: Uint8Array;
const fontPath = '../src/features/preview/assets/';
const fonts = Promise.all(['Vera.ttf', 'VeraBd.ttf'].map(name => readFile(new URL(fontPath + name, import.meta.url), 'base64'))).then(([regular, bold]) => ({ regular, bold }));
before(async () => {
  schema = JSON.parse(await readFile(new URL('../public/data/schema.json', import.meta.url), 'utf8'));
  template = await readFile(new URL('../public/data/output.xlsx', import.meta.url));
});

test('preview lee todas las hojas, valores y fórmulas del Excel real, conserva cero y admite captura vacía', async () => {
  const section = schema.sections.find(item => item.kind === 'quantitative')!;
  const row = section.rows[0];
  const field = section.fields.find(item => item.type === 'number' && row.fields[item.id])!;
  const record: SeaesRecord = { id: 'preview-real-zero', sourceId: 'test', sectionId: section.id, rowId: row.id, values: { [field.id]: 0 }, originalValues: {}, origins: {} };
  const groups = consolidate([record], schema);
  const result = await createWorkbookPreview(template, schema, groups);
  const source = await openPackage(template);
  assert.deepEqual(result.preview.sheets.map(sheet => sheet.name), source.sheets.map(sheet => sheet.name));
  assert.equal(result.report.verified, true);
  const written = result.preview.sheets.find(sheet => sheet.name === section.sheet)!.cells.find(cell => cell.ref === row.fields[field.id].outputRef)!;
  assert.equal(written.value, 0);
  assert.equal(written.binding?.groupId, groups[0].id);
  assert.equal(written.binding?.fieldId, field.id);
  const formulas = result.preview.sheets.flatMap(sheet => sheet.cells).filter(cell => cell.formula);
  assert.equal(formulas.length, result.report.formulas);
  assert.ok(formulas.every(cell => !cell.binding), 'Las fórmulas no se ofrecen como campos editables');
  assert.ok(formulas.some(cell => cell.formula?.startsWith('=')));
  assert.ok(result.preview.warnings.some(warning => /no recalcula/.test(warning)));
  assert.equal(result.preview.sheets.reduce((sum, sheet) => sum + sheet.charts, 0), result.report.charts);
  if (process.env.PREVIEW_QA_OUTPUT) {
    const pdf = createWorkbookPdf(result.preview, await fonts);
    await mkdir(process.env.PREVIEW_QA_OUTPUT, { recursive: true });
    await writeFile(resolve(process.env.PREVIEW_QA_OUTPUT, 'preview-real.pdf'), pdf.bytes);
    await writeFile(resolve(process.env.PREVIEW_QA_OUTPUT, 'preview-real.json'), JSON.stringify({ pages: pdf.pages, cells: pdf.cells, sheets: result.preview.sheets.length, formulas: formulas.length, charts: result.report.charts }));
  }
});

test('preview asocia anexos a su espacio de salida y omite selecciones vacías', async () => {
  const section = schema.sections.find(item => item.kind === 'annex' && item.fields.some(field => field.type === 'choice'))!;
  const field = section.fields.find(item => item.type === 'text')!;
  const record: SeaesRecord = { id: 'annex-last-slot', sourceId: 'test', sectionId: section.id, rowId: section.rows.at(-1)!.id, values: { [field.id]: 'Programa de verificación' }, originalValues: {}, origins: {} };
  const group = consolidate([record], schema)[0];
  const result = await createWorkbookPreview(template, schema, [group]);
  const sheet = result.preview.sheets.find(item => item.name === section.sheet)!;
  assert.equal(sheet.cells.find(cell => cell.ref === section.rows[0].fields[field.id].outputRef)?.binding?.groupId, group.id);
  assert.ok(!sheet.cells.some(cell => cell.binding?.field.type === 'choice' && cell.value === null));
});

test('limpiar una celda explícita elimina su contenido del Excel y de la vista previa', async () => {
  const section = schema.sections.find(item => item.kind === 'quantitative')!;
  const row = section.rows[0], field = section.fields.find(item => item.type === 'number' && row.fields[item.id])!;
  const record: SeaesRecord = { id: 'clear', sourceId: 'test', sectionId: section.id, rowId: row.id, values: { [field.id]: 28 }, originalValues: {}, origins: {} };
  const written = await exportWorkbook(template, schema, [record]);
  const clearedRecord = { ...record, values: { [field.id]: null } };
  const cleared = await exportWorkbook(written.bytes, schema, [clearedRecord]);
  const group: RecordGroup = { ...consolidate([record], schema)[0], resolved: clearedRecord };
  const preview = await readWorkbookPreview(cleared.bytes, schema, [group]);
  const target = preview.sheets.find(sheet => sheet.name === section.sheet)!.cells.find(cell => cell.ref === row.fields[field.id].outputRef)!;
  assert.equal(target.value, null);
  assert.equal(target.binding?.fieldId, field.id);
});

test('PDF conserva cero, falso y fórmulas, excluye vacíos y pagina textos largos completos', async () => {
  const longText = 'Texto largo de verificación con acentos: evaluación, Querétaro y género. '.repeat(170) + 'FIN_DE_CONTENIDO';
  const preview: WorkbookPreviewData = { warnings: [], sheets: [{ name: 'Anexo de verificación', merges: [], charts: 0, images: [], cells: [
    { ref: 'A1', value: 'Encabezado' }, { ref: 'A2', value: 0 }, { ref: 'B2', value: false }, { ref: 'C2', value: null },
    { ref: 'D2', value: '' }, { ref: 'E2', value: null, formula: '=SUM(A2)' }, { ref: 'A3', value: longText },
  ] }] };
  assert.equal(pdfCellValue(preview.sheets[0].cells[1]), '0');
  assert.equal(pdfCellValue(preview.sheets[0].cells[2]), 'Falso');
  assert.match(pdfCellValue(preview.sheets[0].cells[5]), /Sin resultado recalculado/);
  const result = createWorkbookPdf(preview, await fonts);
  assert.equal(result.cells, 5);
  assert.ok(result.pages >= 3, 'El texto largo necesita varias páginas');
  assert.equal(new TextDecoder().decode(result.bytes.subarray(0, 5)), '%PDF-');
  if (process.env.PREVIEW_QA_OUTPUT) {
    await mkdir(process.env.PREVIEW_QA_OUTPUT, { recursive: true });
    await writeFile(resolve(process.env.PREVIEW_QA_OUTPUT, 'preview-long-text.pdf'), result.bytes);
  }
});
