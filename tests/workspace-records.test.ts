import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { SeaesRecord, WorkbookSchema, WorkSession } from '../src/models/types';
import { consolidate } from '../src/services/consolidation';
import { deleteWorkspaceRecords, saveWorkspaceRecord, setPreviewValue, withRecords } from '../src/services/workspaceRecords';

const schema: WorkbookSchema = { version: 'test', inputFile: '', outputFile: '', demoFile: '', criteria: [], sections: [{
  id: 'q', sheet: 'Indicador', label: 'Cantidad', kind: 'quantitative', indicators: [1], anchors: [],
  fields: [{ id: 'n', label: 'Cantidad', type: 'number' }, { id: 'x', label: 'Inclusión', type: 'choice', choices: ['X'] }],
  rows: ['1', '2'].map(id => ({ id, label: `Fila ${id}`, fields: {
    n: { inputRef: `B${id}`, outputRef: `B${id}`, inputBaseline: null, outputBaseline: null },
    x: { inputRef: `C${id}`, outputRef: `C${id}`, inputBaseline: null, outputBaseline: null },
  } })),
}] };
const record = (id: string, sourceId: string, rowId: string, n: number): SeaesRecord => ({ id, sourceId, rowId, sectionId: 'q', values: { n }, originalValues: { n }, origins: { n: { sheet: 'Indicador', cell: `B${rowId}` } } });
const initial = (): WorkSession => ({ version: 1, sources: ['A', 'B'].map(id => ({ id, name: id, filename: `${id}.xlsx`, kind: 'real', importedAt: '', warnings: [], compatibility: 'compatible' })), records: [record('a', 'A', '1', 10), record('b', 'B', '1', 20), record('c', 'B', '2', 40)], decisions: {} });

test('agregar a una fuente conserva su identidad y sumar no crea captura manual adicional', () => {
  const state = saveWorkspaceRecord(initial(), schema, { sectionId: 'q', rowId: '1', values: { n: 7 } }, undefined, 'A');
  assert.equal(state.sources.length, 2);
  assert.equal(state.records.at(-1)?.sourceId, 'A');
  assert.equal(consolidate(state.records, schema)[0].resolved.values.n, 37);
  assert.throws(() => saveWorkspaceRecord(state, schema, { sectionId: 'q', rowId: '1', values: { n: 8 } }, undefined, 'missing'), /ya no existe/);
});
test('editar y quitar una aportación no altera originales ni decisiones de grupos ajenos', () => {
  let state = initial();
  state = setPreviewValue(state, schema, 'q:1', 'n', 31);
  state = setPreviewValue(state, schema, 'q:2', 'n', 49);
  state = saveWorkspaceRecord(state, schema, { sectionId: 'q', rowId: '1', values: { n: 12 } }, state.records[0]);
  assert.equal(state.records[0].originalValues.n, 10);
  assert.equal(state.records[1].values.n, 20);
  assert.equal(state.decisions['q:1'], undefined);
  assert.equal(consolidate(state.records, schema, state.decisions)[0].resolved.values.n, 32);
  assert.equal(consolidate(state.records, schema, state.decisions)[1].resolved.values.n, 49);
  state = deleteWorkspaceRecords(state, schema, new Set(['a']));
  assert.equal(consolidate(state.records, schema, state.decisions)[0].resolved.values.n, 20);
  assert.ok(state.decisions['q:2']);
});
test('Preview modifica solo el resultado, conserva cero, vaciado y sobrevive serialización', () => {
  const base = initial();
  let state = setPreviewValue(base, schema, 'q:1', 'n', 99);
  assert.deepEqual(state.records, base.records);
  assert.equal(consolidate(state.records, schema, state.decisions)[0].resolved.values.n, 99);
  state = setPreviewValue(state, schema, 'q:1', 'n', 0);
  assert.equal(consolidate(state.records, schema, state.decisions)[0].resolved.values.n, 0);
  state = setPreviewValue(state, schema, 'q:1', 'n', null);
  const restored = JSON.parse(JSON.stringify(state)) as WorkSession;
  assert.equal(consolidate(restored.records, schema, restored.decisions)[0].resolved.values.n, null);
  assert.throws(() => setPreviewValue(state, schema, 'q:1', 'n', -1), /no negativo/);
  assert.throws(() => setPreviewValue(state, schema, 'q:1', 'x', 'Y'), /permitido/);
});

test('editar un anexo conserva la identidad y el ajuste de las otras aportaciones', () => {
  const annexSchema: WorkbookSchema = { ...schema, sections: [{ ...schema.sections[0], kind: 'annex',
    fields: [{ id: 'programme', label: 'Programa educativo', type: 'text' }, { id: 'n', label: 'Cantidad', type: 'number' }],
  }] };
  const state = initial();
  state.records = state.records.slice(0, 2).map(item => ({ ...item, values: { ...item.values, programme: 'Mismo programa' } }));
  const separate = consolidate(state.records, annexSchema);
  assert.equal(separate.length, 2);
  const adjusted = setPreviewValue(state, annexSchema, separate[1].id, 'n', 99);
  const edited = saveWorkspaceRecord(adjusted, annexSchema, { sectionId: 'q', rowId: '1', values: { programme: 'Mismo programa', n: 12 } }, adjusted.records[0]);
  const result = consolidate(edited.records, annexSchema, edited.decisions);
  assert.equal(result.length, 2);
  assert.deepEqual(result.map(item => item.resolved.values.n), [12, 99]);
  assert.deepEqual(edited.decisions[separate[1].id], adjusted.decisions[separate[1].id]);
  const remaining = deleteWorkspaceRecords(edited, annexSchema, new Set(['a']));
  assert.equal(consolidate(remaining.records, annexSchema, remaining.decisions)[0].resolved.values.n, 99);
  const emptied = deleteWorkspaceRecords(remaining, annexSchema, new Set(['b']));
  assert.deepEqual(emptied.decisions, {});
});

test('importar nuevas aportaciones invalida el ajuste afectado y conserva los de otras filas', () => {
  let state = setPreviewValue(initial(), schema, 'q:1', 'n', 99);
  state = setPreviewValue(state, schema, 'q:2', 'n', 49);
  const imported = withRecords(state, [...state.records, record('imported', 'C', '1', 7)], schema);
  const groups = consolidate(imported.records, schema, imported.decisions);
  assert.equal(imported.decisions['q:1'], undefined);
  assert.deepEqual(groups.map(group => group.resolved.values.n), [37, 49]);
  assert.deepEqual(imported.records.slice(0, 3), state.records);
});

test('Preview rechaza un campo sin celda de destino para la fila exportada', () => {
  const withoutDestination: WorkbookSchema = { ...schema, sections: [{ ...schema.sections[0], rows: schema.sections[0].rows.map(row => ({ ...row, fields: { n: row.fields.n } })) }] };
  assert.throws(() => setPreviewValue(initial(), withoutDestination, 'q:1', 'x', 'X'), /destino/);
  const valid = setPreviewValue(initial(), schema, 'q:1', 'x', 'X');
  assert.equal(consolidate(valid.records, schema, valid.decisions)[0].resolved.values.x, 'X');
});

test('Preview protege institución y entidad, pero permite editar el periodo institucional', () => {
  const identitySchema: WorkbookSchema = { ...schema, sections: [{ ...schema.sections[0], kind: 'identity', fields: [
    { id: 'institution', label: 'Institución', type: 'text' },
    { id: 'entity', label: 'Entidad', type: 'text' },
    { id: 'period', label: 'Periodo', type: 'text' },
  ], rows: [{ id: '1', label: 'Institución', fields: Object.fromEntries(['institution', 'entity', 'period'].map((id, index) => [id, {
    inputRef: `${String.fromCharCode(65 + index)}1`, outputRef: `${String.fromCharCode(65 + index)}1`, inputBaseline: null, outputBaseline: null,
  }])) }] }] };
  const state = initial();
  state.records = [{ ...state.records[0], values: { institution: 'UTSJR', entity: 'Querétaro', period: '2025-2026' } }];
  const original = JSON.stringify(state);
  for (const field of ['institution', 'entity']) {
    assert.throws(() => setPreviewValue(state, identitySchema, 'q:1', field, null), /institucional fijo/);
    assert.throws(() => setPreviewValue(state, identitySchema, 'q:1', field, 'Otra institución'), /institucional fijo/);
  }
  assert.equal(JSON.stringify(state), original);
  const changed = setPreviewValue(state, identitySchema, 'q:1', 'period', '2026-2027');
  assert.equal(consolidate(changed.records, identitySchema, changed.decisions)[0].resolved.values.period, '2026-2027');
});
