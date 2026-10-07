import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { readFile, writeFile } from 'node:fs/promises';
import JSZip from 'jszip';
import type { DataSource, SeaesRecord, WorkbookSchema } from '../src/models/types';
import { parseWorkbook } from '../src/services/excel/InputWorkbookParser';
import { exportWorkbook } from '../src/services/excel/OutputWorkbookMapper';
import { buildDemo, consolidate, coverage, normalize } from '../src/services/consolidation';
import { assertPreserved, replaceCell, snapshotWorkbook } from './xlsx-oracles';

let schema: WorkbookSchema;
let input: Uint8Array;
let output: Uint8Array;
let demo: Uint8Array;
let demoRecords: SeaesRecord[];
const source = (id: string): DataSource => ({ id, name: `ORIGEN_INTERNO_${id}`, filename: `${id}.xlsx`, importedAt: '2026-10-07T12:00:00.000Z', kind: 'real', compatibility: 'compatible', warnings: [] });
const canonical = (records: SeaesRecord[]) => records.map(r => JSON.stringify([r.sectionId, Object.entries(r.values).sort(([a], [b]) => a.localeCompare(b))])).sort();

before(async () => {
  schema = JSON.parse(await readFile(new URL('../public/data/schema.json', import.meta.url), 'utf8'));
  [input, output, demo] = await Promise.all(['input', 'output', 'demo'].map(name => readFile(new URL(`../public/data/${name}.xlsx`, import.meta.url))));
});

test('la plantilla oficial de entrada intacta aporta cero registros, incluidos sus ejemplos y textos estructurales', async () => {
  const first = await parseWorkbook(input, schema, source('baseline-1'));
  const second = await parseWorkbook(input, schema, source('baseline-2'));
  assert.equal(first.source.compatibility, 'compatible');
  assert.equal(first.records.length, 0);
  assert.equal(second.records.length, 0);
  assert.equal(consolidate([...first.records, ...second.records], schema).length, 0);
  assert.ok(first.source.warnings.some(w => /no contiene datos capturados/i.test(w)));
  assert.equal(coverage([], schema).filled, 0);
  assert.ok(coverage([], schema).expected > 0, 'La cobertura vacía mantiene los campos esperados de la plantilla');
});

test('una copia parcial sólo aporta dos capturas; conserva origen y distingue los cambios de formato', async () => {
  const numberSection = schema.sections.find(s => s.kind === 'quantitative' && s.fields.some(f => f.type === 'number' && s.rows.some(r => r.fields[f.id]?.inputRef)))!;
  const numberField = numberSection.fields.find(f => f.type === 'number' && numberSection.rows.some(r => r.fields[f.id]?.inputRef))!;
  const numberRow = numberSection.rows.find(r => r.fields[numberField.id]?.inputRef)!;
  const textSection = schema.sections.find(s => s.kind === 'annex' && s.fields.some(f => f.type === 'text' && s.rows.some(r => r.fields[f.id]?.inputRef)))!;
  const textField = textSection.fields.find(f => f.type === 'text' && textSection.rows.some(r => r.fields[f.id]?.inputRef))!;
  const textRow = textSection.rows.find(r => r.fields[textField.id]?.inputRef)!;
  assert.ok(numberSection && textSection, 'El contrato incluye captura numérica y cualitativa');
  let fixture = await replaceCell(input, numberSection.sheet, numberRow.fields[numberField.id].inputRef, 37);
  fixture = await replaceCell(fixture, textSection.sheet, textRow.fields[textField.id].inputRef, 'Programa de prueba & evidencia <verificada>');
  const zip = await JSZip.loadAsync(fixture);
  const styles = await zip.file('xl/styles.xml')!.async('string');
  zip.file('xl/styles.xml', styles.replace(/rgb="[A-F0-9]{8}"/i, 'rgb="FF123456"'));
  fixture = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
  const result = await parseWorkbook(fixture, schema, source('parcial'));
  assert.equal(result.records.length, 2);
  assert.equal(result.records.reduce((n, r) => n + Object.keys(r.values).length, 0), 2);
  const numerical = result.records.find(r => r.sectionId === numberSection.id)!;
  const textual = result.records.find(r => r.sectionId === textSection.id)!;
  assert.equal(numerical.values[numberField.id], 37);
  assert.equal(textual.values[textField.id], 'Programa de prueba & evidencia <verificada>');
  assert.deepEqual(numerical.origins[numberField.id], { sheet: numberSection.sheet, cell: numberRow.fields[numberField.id].inputRef });
  assert.deepEqual(textual.originalValues, textual.values);
  assert.equal(textual.sourceId, 'parcial');
});

test('una fórmula con cache no se considera captura y una cadena que parece fórmula sí es texto', async () => {
  const section = schema.sections.find(s => s.kind === 'quantitative' && s.fields.some(f => s.rows.some(r => r.fields[f.id]?.inputRef)))!;
  const field = section.fields.find(f => section.rows.some(r => r.fields[f.id]?.inputRef))!;
  const row = section.rows.find(r => r.fields[field.id]?.inputRef)!;
  const ref = row.fields[field.id].inputRef;
  const calculated = await replaceCell(input, section.sheet, ref, 999, { formula: 'SUM(1,998)' });
  const result = await parseWorkbook(calculated, schema, source('formula'));
  assert.equal(result.records.length, 0);
  assert.ok(result.source.warnings.some(w => /fórmulas/i.test(w)));
  const literal = await replaceCell(input, section.sheet, ref, '=HYPERLINK("https://example.invalid","texto")');
  const parsedLiteral = await parseWorkbook(literal, schema, source('literal'));
  assert.equal(parsedLiteral.records.length, 1);
  assert.equal(parsedLiteral.records[0].values[field.id], '=HYPERLINK("https://example.invalid","texto")');
});

test('variaciones de nombre se reconocen; archivos ajenos o dañados no crean datos', async () => {
  const zip = await JSZip.loadAsync(input);
  const section = schema.sections.find(s => s.kind === 'quantitative')!;
  const book = await zip.file('xl/workbook.xml')!.async('string');
  zip.file('xl/workbook.xml', book.replace(`name="${section.sheet}"`, `name="${section.sheet.toUpperCase()} "`));
  const altered = await parseWorkbook(await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' }), schema, source('renombrado'));
  assert.equal(altered.source.compatibility, 'variations');
  assert.equal(altered.records.length, 0);
  await assert.rejects(() => parseWorkbook(new TextEncoder().encode('Esto no es Excel'), schema, source('roto')), /xlsx|archivo/i);
  const unrelated = new JSZip();
  unrelated.file('contenido.txt', 'Sin documento institucional');
  const unrelatedBytes = await unrelated.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
  await assert.rejects(() => parseWorkbook(unrelatedBytes, schema, source('ajeno')), /xlsx|archivo|estructura/i);
});

test('el entregable real se transforma en 14 fuentes sin inventar ni perder valores', async () => {
  demoRecords = (await parseWorkbook(demo, schema, source('entregable'), 'output')).records;
  assert.ok(demoRecords.length >= 14, 'La demo debe tener registros reales suficientes para sus fuentes');
  const distributed = buildDemo(demoRecords, schema);
  assert.equal(distributed.sources.length, 14);
  assert.equal(new Set(distributed.sources.map(s => s.id)).size, 14);
  assert.equal(new Set(distributed.sources.map(s => s.name)).size, 14);
  assert.deepEqual(canonical(distributed.records), canonical(demoRecords));
  assert.equal(new Set(distributed.records.map(r => r.id)).size, distributed.records.length);
  const counts = distributed.sources.map(s => distributed.records.filter(r => r.sourceId === s.id).length);
  assert.ok(counts.every(n => n > 0), 'Las 14 fuentes deben poder seleccionarse con aportaciones');
  assert.ok(new Set(counts).size > 1, 'Las fuentes no deben ser lotes artificiales del mismo tamaño');
  assert.ok(distributed.sources.every(s => s.kind === 'demo'));
  const actual = await snapshotWorkbook(demo);
  const baseline = await snapshotWorkbook(output);
  const extractedCells = new Set(demoRecords.flatMap(r => Object.values(r.origins).map(o => `${o.sheet}!${o.cell}`)));
  const omissions: string[] = [];
  for (const [sheet, cells] of actual.cells) for (const [ref, cell] of cells) {
    const prior = baseline.cells.get(sheet)?.get(ref);
    if (cell.formula !== undefined || cell.value === null || cell.value === '' || cell.value === prior?.value) continue;
    if (!extractedCells.has(`${sheet}!${ref}`)) omissions.push(`${sheet}!${ref} = ${String(cell.value).slice(0, 75)}`);
  }
  assert.deepEqual(omissions, [], 'El parser dejó diferencias literales del entregable sin representar');
});

test('consolidación distingue exactos, complementarios y conflictos con elección y suma explícita', () => {
  const section = schema.sections.find(s => s.kind === 'quantitative' && s.fields.filter(f => f.type === 'number' && s.rows.some(r => r.fields[f.id])).length >= 2)!;
  const row = section.rows.find(r => section.fields.filter(f => f.type === 'number' && r.fields[f.id]).length >= 2)!;
  const [a, b] = section.fields.filter(f => f.type === 'number' && row.fields[f.id]);
  const record = (id: string, values: Record<string, number>): SeaesRecord => ({ id, sourceId: id, sectionId: section.id, rowId: row.id, values, originalValues: { ...values }, origins: {} });
  const first = record('A', { [a.id]: 10 });
  const exact = consolidate([first, record('B', { [a.id]: 10 })], schema);
  assert.equal(exact[0].status, 'exact');
  assert.deepEqual(exact[0].sourceIds, ['A', 'B']);
  const complementary = consolidate([first, record('B', { [b.id]: 20 })], schema);
  assert.equal(complementary[0].status, 'complementary');
  assert.deepEqual(complementary[0].resolved.values, { [a.id]: 10, [b.id]: 20 });
  const conflictingRecords = [first, record('B', { [a.id]: 20 })];
  const conflict = consolidate(conflictingRecords, schema)[0];
  assert.equal(conflict.status, 'conflict');
  assert.equal(conflict.conflicts[0].resolved, false);
  assert.deepEqual(conflict.conflicts[0].candidates.map(c => c.value), [10, 20]);
  const selected = consolidate(conflictingRecords, schema, { [conflict.id]: { fields: { [a.id]: { mode: 'record', recordId: 'B' } } } });
  assert.equal(selected[0].resolved.values[a.id], 20);
  assert.equal(selected[0].conflicts[0].resolved, true);
  const summed = consolidate(conflictingRecords, schema, { [conflict.id]: { fields: { [a.id]: { mode: 'sum' } } } });
  assert.equal(summed[0].resolved.values[a.id], 30);
  assert.equal(coverage(complementary, schema).filled, 2);
  assert.equal(normalize('  ÁREA   Académica '), 'area academica');
});

test('regresión del entregable: exporta todos los valores y conserva fórmulas, formato, gráficas y relaciones', async () => {
  demoRecords ??= (await parseWorkbook(demo, schema, source('entregable-regresion'), 'output')).records;
  const groups = consolidate(demoRecords, schema);
  const result = await exportWorkbook(output, schema, groups.map(g => g.resolved));
  const before = await snapshotWorkbook(output);
  const after = await snapshotWorkbook(result.bytes);
  assertPreserved(before, after);
  assert.equal(result.report.sheets, before.sheets.length);
  assert.equal(result.report.charts, before.charts.length);
  assert.equal(result.report.formulas, [...before.formulas.values()].reduce((n, f) => n + f.length, 0));
  const reparsed = await parseWorkbook(result.bytes, schema, source('relectura'), 'output');
  assert.deepEqual(canonical(reparsed.records), canonical(groups.map(g => g.resolved)));
  const allCellValues = [...after.cells.values()].flatMap(cells => [...cells.values()].map(c => String(c.value ?? ''))).join('\n');
  assert.equal(allCellValues.includes('ORIGEN_INTERNO_'), false, 'Metadata de trazabilidad contaminó la salida');
  await writeFile(new URL('../work/regresion-demo.xlsx', import.meta.url), result.bytes);
  await writeFile(new URL('../work/regresion-reporte.json', import.meta.url), JSON.stringify({ ...result.report, parsedRecords: demoRecords.length, consolidatedRecords: groups.length, reimportedRecords: reparsed.records.length }, null, 2));
});

test('edición, captura manual y duplicados exportan; exceder capacidad produce error explícito sin truncar', async () => {
  const section = schema.sections.find(s => s.kind === 'annex' && s.rows.length > 1 && s.fields.some(f => f.type === 'text'))!;
  const field = section.fields.find(f => f.type === 'text')!;
  const original: SeaesRecord = { id: 'original', sourceId: 'importado', sectionId: section.id, rowId: section.rows[0].id, values: { [field.id]: 'Valor antes de edición' }, originalValues: { [field.id]: 'Valor antes de edición' }, origins: { [field.id]: { sheet: section.sheet, cell: section.rows[0].fields[field.id].inputRef } } };
  const edited: SeaesRecord = { ...original, values: { [field.id]: '=TEXTO("edición & <válida>")' }, modifiedAt: '2026-10-07T13:00:00Z' };
  const manual: SeaesRecord = { ...original, id: 'manual', sourceId: 'Captura manual', rowId: section.rows[1].id, values: { [field.id]: 'Registro manual con acentos: evaluación' }, originalValues: {}, origins: {} };
  const duplicate = { ...edited, id: 'duplicado', sourceId: 'segunda-fuente' };
  const consolidated = consolidate([edited, manual, duplicate], schema);
  assert.ok(consolidated.some(g => g.status === 'exact'));
  const result = await exportWorkbook(output, schema, consolidated.map(g => g.resolved));
  const reimported = await parseWorkbook(result.bytes, schema, source('edicion-exportada'), 'output');
  assert.deepEqual(canonical(reimported.records), canonical(consolidated.map(g => g.resolved)));
  assert.equal(edited.originalValues[field.id], 'Valor antes de edición');
  assert.equal(edited.origins[field.id].cell, original.origins[field.id].cell);
  const overflow = Array.from({ length: section.rows.length + 1 }, (_, i) => ({ ...manual, id: `exceso-${i}`, values: { [field.id]: `Entrada independiente ${i}` } }));
  await assert.rejects(() => exportWorkbook(output, schema, overflow), /espacios|capacidad|trunc/i);
  await assert.rejects(() => exportWorkbook(output, schema, [{ ...manual, values: { campo_inexistente: 'dato no descartable' } }]), /destino|descart/i);
  await assert.rejects(() => exportWorkbook(output, schema, [{ ...manual, values: { [field.id]: 'x'.repeat(32768) } }]), /32 767|caracteres/i);
});
