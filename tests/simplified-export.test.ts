import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import JSZip from 'jszip';
import { XMLParser } from 'fast-xml-parser';
import type { Scalar, SeaesRecord, WorkbookSchema } from '../src/models/types';
import { exportWorkbook } from '../src/services/excel/OutputWorkbookMapper';
import { formulaSignatures, openPackage, xmlEscape } from '../src/services/excel/package';
import { snapshotWorkbook } from './xlsx-oracles';

const ns = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const relNs = 'http://schemas.openxmlformats.org/package/2006/relationships';
const docRel = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/';
const sheetNames = ['Ejemplo inicial', 'Datos', 'Vacío', 'Apoyo', 'Ejemplo gráfico', 'EJEMPLO libre'];
const schemaFor = (names: string[]): WorkbookSchema => ({ version: 'test', inputFile: '', outputFile: '', demoFile: '', criteria: [],
  sections: names.map((sheet, i) => ({ id: `section-${i}`, sheet, label: sheet, kind: 'quantitative', indicators: [i + 1], anchors: [],
    fields: [{ id: 'value', label: 'Captura', type: 'number' }],
    rows: [{ id: 'row', label: 'Fila', fields: { value: { inputRef: 'A1', outputRef: 'A1', inputBaseline: null, outputBaseline: null } } }] })) });
const recordFor = (schema: WorkbookSchema, name = 'Datos', value: Scalar = 0): SeaesRecord => ({ id: 'record', sourceId: 'manual',
  sectionId: schema.sections.find(section => section.sheet === name)!.id, rowId: 'row', values: { value }, originalValues: {}, origins: {} });
interface FixtureOptions { formula?: string; names?: string; chartFormula?: string; supportFormula?: string; chain?: boolean; table?: boolean }

async function fixture(options: FixtureOptions = {}) {
  const zip = new JSZip();
  const schema = schemaFor(['Datos', 'Vacío', 'Apoyo']);
  zip.file('_rels/.rels', `<Relationships xmlns="${relNs}"><Relationship Id="book" Type="${docRel}officeDocument" Target="xl/workbook.xml"/><Relationship Id="app" Type="${docRel}extended-properties" Target="docProps/app.xml"/></Relationships>`);
  zip.file('xl/workbook.xml', `<workbook xmlns="${ns}" xmlns:r="${docRel.slice(0, -1)}"><bookViews><workbookView activeTab="5" firstSheet="1"/></bookViews><sheets>${sheetNames.map((name, i) => `<sheet name="${xmlEscape(name)}" sheetId="${i + 1}" r:id="r${i + 1}"/>`).join('')}</sheets><definedNames>${options.names ?? ''}</definedNames><calcPr calcId="1"/></workbook>`);
  zip.file('xl/_rels/workbook.xml.rels', `<Relationships xmlns="${relNs}">${sheetNames.map((_, i) => `<Relationship Id="r${i + 1}" Type="${docRel}worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}${options.chain ? `<Relationship Id="chain" Type="${docRel}calcChain" Target="calcChain.xml"/>` : ''}</Relationships>`);
  const overrides = sheetNames.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`);
  for (const [i] of sheetNames.entries()) {
    const formula = i === 1 ? options.formula : i === 4 ? options.supportFormula : undefined;
    zip.file(`xl/worksheets/sheet${i + 1}.xml`, `<worksheet xmlns="${ns}" xmlns:r="${docRel.slice(0, -1)}"><sheetData><row r="1"><c r="A1"/>${formula ? `<c r="B1"><f>${xmlEscape(formula)}</f><v>0</v></c>` : ''}</row></sheetData>${i === 1 && options.chartFormula ? '<drawing r:id="drawing"/>' : ''}${i === 3 && options.table ? '<tableParts count="1"><tablePart r:id="table"/></tableParts>' : ''}</worksheet>`);
  }
  if (options.chartFormula) {
    zip.file('xl/worksheets/_rels/sheet2.xml.rels', `<Relationships xmlns="${relNs}"><Relationship Id="drawing" Type="${docRel}drawing" Target="../drawings/drawing1.xml"/><Relationship Id="external" Type="${docRel}hyperlink" Target="https://example.org/" TargetMode="External"/></Relationships>`);
    zip.file('xl/drawings/drawing1.xml', `<drawing xmlns:r="${docRel.slice(0, -1)}"><chart r:id="chart"/></drawing>`);
    zip.file('xl/drawings/_rels/drawing1.xml.rels', `<Relationships xmlns="${relNs}"><Relationship Id="chart" Type="${docRel}chart" Target="../charts/chart1.xml"/></Relationships>`);
    zip.file('xl/charts/chart1.xml', `<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart><c:plotArea><c:barChart><c:ser><c:val><c:numRef><c:f>${xmlEscape(options.chartFormula)}</c:f></c:numRef></c:val></c:ser></c:barChart></c:plotArea></c:chart></c:chartSpace>`);
    overrides.push('<Override PartName="/xl/charts/chart1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>');
  }
  if (options.chain) {
    zip.file('xl/calcChain.xml', `<calcChain xmlns="${ns}"><c r="B1" i="2"/><c r="B1" i="3"/></calcChain>`);
    overrides.push('<Override PartName="/xl/calcChain.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.calcChain+xml"/>');
  }
  if (options.table) {
    zip.file('xl/worksheets/_rels/sheet4.xml.rels', `<Relationships xmlns="${relNs}"><Relationship Id="table" Type="${docRel}table" Target="../tables/table1.xml"/></Relationships>`);
    zip.file('xl/tables/table1.xml', `<table xmlns="${ns}" name="TablaApoyo" displayName="TablaApoyo" id="1" ref="A1:A2" totalsRowShown="0"><tableColumns count="1"><tableColumn id="1" name="Valor"/></tableColumns></table>`);
    overrides.push('<Override PartName="/xl/tables/table1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.table+xml"/>');
  }
  zip.file('[Content_Types].xml', `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${overrides.join('')}</Types>`);
  zip.file('docProps/app.xml', '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Test</Application><HeadingPairs><vt:vector size="2" baseType="variant"><vt:variant><vt:lpstr>Worksheets</vt:lpstr></vt:variant><vt:variant><vt:i4>6</vt:i4></vt:variant></vt:vector></HeadingPairs><TitlesOfParts><vt:vector size="1" baseType="lpstr"><vt:lpstr>Ejemplo inicial</vt:lpstr></vt:vector></TitlesOfParts></Properties>');
  return { schema, bytes: await zip.generateAsync({ type: 'uint8array' }) };
}

test('simplificado omite ejemplos y hojas sin capturas, conserva un cero real y el completo sigue intacto', async () => {
  const { bytes, schema } = await fixture();
  const records = [recordFor(schema)];
  const full = await exportWorkbook(bytes, schema, records);
  const simplified = await exportWorkbook(bytes, schema, records, 'simplified');
  assert.deepEqual((await snapshotWorkbook(full.bytes)).sheets.map(sheet => sheet.name), sheetNames);
  const snapshot = await snapshotWorkbook(simplified.bytes);
  assert.deepEqual(snapshot.sheets.map(sheet => sheet.name), ['Datos']);
  assert.equal(snapshot.cells.get('Datos')!.get('A1')!.value, 0, 'Un cero capturado es información real');
  assert.equal(simplified.report.mode, 'simplified');
  assert.equal((simplified.report.removedSheets as string[]).length, 5);
  const zip = await JSZip.loadAsync(simplified.bytes);
  assert.equal(zip.file('xl/worksheets/sheet1.xml'), null);
  assert.doesNotMatch(await zip.file('[Content_Types].xml')!.async('string'), /sheet1\.xml/);
  assert.doesNotMatch(await zip.file('docProps/app.xml')!.async('string'), /Ejemplo inicial|TitlesOfParts|HeadingPairs/);
  const xml = await zip.file('xl/workbook.xml')!.async('string');
  assert.match(xml, /activeTab="0"/);
  assert.match(xml, /firstSheet="0"/);
});

test('las dependencias transitivas de gráficas y fórmulas conservan las hojas necesarias y sus relaciones', async () => {
  const { bytes, schema } = await fixture({ chartFormula: "'Ejemplo gráfico'!$A$1", supportFormula: "'Apoyo'!A1" });
  const result = await exportWorkbook(bytes, schema, [recordFor(schema, 'Datos', 12)], 'simplified');
  const snapshot = await snapshotWorkbook(result.bytes);
  assert.deepEqual(snapshot.sheets.map(sheet => sheet.name), ['Datos', 'Apoyo', 'Ejemplo gráfico']);
  assert.equal(snapshot.charts.length, 1);
  assert.deepEqual(result.report.retainedDependencySheets, ['Apoyo', 'Ejemplo gráfico']);
  const before = await JSZip.loadAsync(bytes), after = await JSZip.loadAsync(result.bytes);
  for (const path of ['xl/charts/chart1.xml', 'xl/drawings/drawing1.xml', 'xl/drawings/_rels/drawing1.xml.rels', 'xl/worksheets/_rels/sheet2.xml.rels']) {
    assert.deepEqual(await after.file(path)!.async('uint8array'), await before.file(path)!.async('uint8array'), path);
  }
});

test('los nombres definidos conservan dependencias y su ámbito local se remapea al índice final', async () => {
  const { bytes, schema } = await fixture({ formula: 'TotalBase', names: '<definedName name="TotalBase">\'Apoyo\'!$A$1</definedName><definedName name="LocalBase" localSheetId="3">$A$1</definedName>' });
  const result = await exportWorkbook(bytes, schema, [recordFor(schema)], 'simplified');
  assert.deepEqual((await snapshotWorkbook(result.bytes)).sheets.map(sheet => sheet.name), ['Datos', 'Apoyo']);
  const xml = await (await JSZip.loadAsync(result.bytes)).file('xl/workbook.xml')!.async('string');
  assert.match(xml, /name="LocalBase" localSheetId="1"/);
  assert.match(xml, /name="TotalBase">'Apoyo'!\$A\$1/);
});

test('las referencias tridimensionales conservan hojas vacías intermedias y eliminan la cadena de cálculo obsoleta', async () => {
  const { bytes, schema } = await fixture({ formula: "SUM('Datos:Apoyo'!A1)", chain: true });
  const result = await exportWorkbook(bytes, schema, [recordFor(schema)], 'simplified');
  assert.deepEqual((await snapshotWorkbook(result.bytes)).sheets.map(sheet => sheet.name), ['Datos', 'Vacío', 'Apoyo']);
  const zip = await JSZip.loadAsync(result.bytes);
  assert.equal(zip.file('xl/calcChain.xml'), null);
  assert.doesNotMatch(await zip.file('xl/_rels/workbook.xml.rels')!.async('string'), /calcChain/);
  assert.doesNotMatch(await zip.file('[Content_Types].xml')!.async('string'), /calcChain/);
});

test('las referencias estructuradas conservan la hoja propietaria de la tabla', async () => {
  const { bytes, schema } = await fixture({ formula: 'SUM(TablaApoyo[Valor])', table: true });
  const result = await exportWorkbook(bytes, schema, [recordFor(schema)], 'simplified');
  assert.deepEqual((await snapshotWorkbook(result.bytes)).sheets.map(sheet => sheet.name), ['Datos', 'Apoyo']);
  assert.ok((await JSZip.loadAsync(result.bytes)).file('xl/tables/table1.xml'));
});

test('INDIRECT conserva todas las hojas cuando no es seguro resolver las referencias dinámicas', async () => {
  const { bytes, schema } = await fixture({ formula: 'INDIRECT(A2&"!A1")' });
  const result = await exportWorkbook(bytes, schema, [recordFor(schema)], 'simplified');
  assert.deepEqual((await snapshotWorkbook(result.bytes)).sheets.map(sheet => sheet.name), sheetNames);
  assert.deepEqual(result.report.removedSheets, []);
});

test('sin registros conserva una hoja visible válida y no interpreta vacíos como capturas', async () => {
  const { bytes, schema } = await fixture();
  const result = await exportWorkbook(bytes, schema, [], 'simplified');
  const snapshot = await snapshotWorkbook(result.bytes);
  assert.deepEqual(snapshot.sheets.map(sheet => sheet.name), ['Datos']);
  assert.equal(snapshot.cells.get('Datos')!.get('A1')!.value, null);
});

test('plantilla SEAES real: elimina hojas irrelevantes sin perder valores, fórmulas, gráficas ni destinos internos', async () => {
  const schema: WorkbookSchema = JSON.parse(await readFile(new URL('../public/data/schema.json', import.meta.url), 'utf8'));
  const bytes = await readFile(new URL('../public/data/output.xlsx', import.meta.url));
  const section = schema.sections.find(section => section.kind === 'quantitative')!;
  const row = section.rows[0];
  const field = section.fields.find(field => row.fields[field.id])!;
  const record: SeaesRecord = { id: 'manual', sourceId: 'manual', sectionId: section.id, rowId: row.id, values: { [field.id]: 0 }, originalValues: {}, origins: {} };
  const result = await exportWorkbook(bytes, schema, [record], 'simplified');
  const original = await openPackage(bytes);
  const snapshot = await snapshotWorkbook(result.bytes);
  assert.ok(snapshot.sheets.length < original.sheets.length);
  assert.ok((result.report.removedSheets as string[]).some(name => /ejemplo/i.test(name)));
  assert.equal(snapshot.cells.get(section.sheet)!.get(row.fields[field.id].outputRef)!.value, 0);
  const after = await openPackage(result.bytes);
  for (const sheet of after.sheets) assert.deepEqual(formulaSignatures(sheet.xml), formulaSignatures(original.sheets.find(before => before.name === sheet.name)!.xml));
  const parser = new XMLParser({ ignoreAttributes: false });
  const contentTypes = parser.parse(await after.zip.file('[Content_Types].xml')!.async('string')).Types;
  for (const override of [contentTypes.Override].flat()) assert.ok(after.zip.file(override['@_PartName'].slice(1)), 'Content Types no apunta a una parte eliminada');
});
