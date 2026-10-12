import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { SeaesRecord, WorkbookSchema } from '../src/models/types';
import { consolidate } from '../src/services/consolidation';

const schema: WorkbookSchema = {
  version: 'consolidation-test', inputFile: '', outputFile: '', demoFile: '', criteria: [],
  sections: [
    {
      id: 'quantitative', sheet: 'Indicador 1', label: 'Tabla 1a', kind: 'quantitative',
      indicators: [1], anchors: [], rows: [],
      fields: [
        { id: 'total', label: 'Total de programas', type: 'number' },
        { id: 'comments', label: 'Comentarios', type: 'text' },
      ],
    },
    {
      id: 'identity', sheet: 'Indicador 1', label: 'Identificación y periodos', kind: 'identity',
      indicators: [1], anchors: [], rows: [],
      fields: [
        { id: 'entity', label: 'Entidad', type: 'text' },
        { id: 'institution', label: 'Institución', type: 'text' },
        { id: 'period', label: 'Periodo / cohorte', type: 'text' },
      ],
    },
    {
      id: 'annex', sheet: 'Anexo', label: 'Buenas prácticas', kind: 'annex',
      indicators: [1], anchors: [], rows: [],
      fields: [
        { id: 'programme', label: 'Programa educativo', type: 'text' },
        { id: 'description', label: 'Descripción', type: 'text' },
        { id: 'status', label: 'Estado', type: 'choice' },
        { id: 'observations', label: 'Observaciones', type: 'text' },
      ],
    },
  ],
};

function record(id: string, sectionId: string, values: SeaesRecord['values']): SeaesRecord {
  return {
    id, sourceId: id, sectionId, rowId: 'r1', values, originalValues: { ...values },
    origins: Object.fromEntries(Object.keys(values).map(fieldId => [fieldId, { sheet: `Fuente ${id}`, cell: fieldId }])),
  };
}

test('las aportaciones numéricas se suman aunque coincidan y no son duplicados ni conflictos', () => {
  const group = consolidate([
    record('A', 'quantitative', { total: 10 }),
    record('B', 'quantitative', { total: 10 }),
    record('C', 'quantitative', { total: 7 }),
  ], schema)[0];
  assert.equal(group.resolved.values.total, 27);
  assert.equal(group.status, 'complementary');
  assert.deepEqual(group.conflicts, []);
  assert.deepEqual(group.sourceIds, ['A', 'B', 'C']);
});

test('cero capturado sigue siendo un dato y no se confunde con ausencia ni No disponible', () => {
  const group = consolidate([
    record('A', 'quantitative', { total: 0 }),
    record('B', 'quantitative', { total: 'No disponible' }),
    record('C', 'quantitative', { total: null }),
    record('D', 'quantitative', { total: '  ' }),
  ], schema)[0];
  assert.equal(group.resolved.values.total, 0);
  assert.equal(group.records.length, 2);
  assert.deepEqual(group.conflicts, []);
  assert.deepEqual(consolidate([record('empty', 'quantitative', { total: null })], schema), []);
});

test('texto accidental no contamina la suma y los valores originales permanecen disponibles', () => {
  const records = [record('A', 'quantitative', { total: 'captura incorrecta' }), record('B', 'quantitative', { total: 12 })];
  const before = JSON.stringify(records);
  const group = consolidate(records, schema)[0];
  assert.equal(group.resolved.values.total, 12);
  assert.deepEqual(group.resolved.origins.total, { sheet: 'Fuente B', cell: 'total' });
  assert.deepEqual(group.conflicts, []);
  assert.equal(JSON.stringify(records), before);
});

test('cuando todas las aportaciones son No disponible se conserva ese marcador sin convertirlo a cero', () => {
  const group = consolidate([
    record('A', 'quantitative', { total: 'NO DISPONIBLE' }),
    record('B', 'quantitative', { total: ' No disponible ' }),
  ], schema)[0];
  assert.equal(group.resolved.values.total, 'No disponible');
  assert.deepEqual(group.conflicts, []);
});

test('la elección guardada de una aportación prevalece sobre la suma automática', () => {
  const records = [record('A', 'quantitative', { total: 10 }), record('B', 'quantitative', { total: 20 })];
  const group = consolidate(records, schema, {
    'quantitative:r1': { fields: { total: { mode: 'record', recordId: 'B' } } },
  })[0];
  assert.equal(group.resolved.values.total, 20);
  assert.deepEqual(group.resolved.origins.total, { sheet: 'Fuente B', cell: 'total' });
  assert.equal(group.conflicts.length, 1);
  assert.equal(group.conflicts[0].resolved, true);
  const summed = consolidate(records, schema, { 'quantitative:r1': { fields: { total: { mode: 'sum' } } } })[0];
  assert.equal(summed.resolved.values.total, 30);
  assert.equal(summed.conflicts[0].resolved, true);
});

test('identidad normaliza institución y entidad, sin agregar datos a los campos ausentes', () => {
  const group = consolidate([
    record('A', 'identity', { institution: 'san juan del río', entity: 'qro' }),
    record('B', 'identity', { institution: 'UNIVERSIDAD TECNOLÓGICA DE SAN JUAN DEL RÍO', entity: 'QUERETARO' }),
  ], schema)[0];
  assert.deepEqual(group.resolved.values, { entity: 'Querétaro', institution: 'Universidad Tecnológica de San Juan del Río' });
  assert.deepEqual(group.conflicts, []);
  const partial = consolidate([record('A', 'identity', { institution: 'UTSJR' })], schema)[0];
  assert.equal(Object.hasOwn(partial.resolved.values, 'entity'), false);
});

test('una decisión heredada de identidad conserva el periodo y la procedencia elegidos en el dist', () => {
  const group = consolidate([
    record('A', 'identity', { institution: 'UTSJR', period: '2024-2025' }),
    record('B', 'identity', { institution: 'Universidad', period: '2025-2026' }),
  ], schema, {
    'identity:r1': { fields: {
      institution: { mode: 'record', recordId: 'B' },
      period: { mode: 'record', recordId: 'B' },
    } },
  })[0];
  assert.equal(group.resolved.values.institution, 'Universidad Tecnológica de San Juan del Río');
  assert.equal(group.resolved.values.period, '2025-2026');
  assert.deepEqual(group.resolved.origins.institution, { sheet: 'Fuente B', cell: 'institution' });
  assert.deepEqual(group.resolved.origins.period, { sheet: 'Fuente B', cell: 'period' });
  assert.deepEqual(group.conflicts, []);
});

test('comentarios y observaciones se reúnen una sola vez sin generar conflictos', () => {
  const quantitative = consolidate([
    record('A', 'quantitative', { comments: 'Primera observación' }),
    record('B', 'quantitative', { comments: 'Segunda observación' }),
    record('C', 'quantitative', { comments: 'Primera observación' }),
  ], schema)[0];
  assert.equal(quantitative.resolved.values.comments, 'Primera observación\nSegunda observación');
  assert.deepEqual(quantitative.conflicts, []);
  const annex = consolidate([
    record('A', 'annex', { programme: 'PE', description: 'Práctica', observations: 'Área A' }),
    record('B', 'annex', { programme: 'PE', description: 'Práctica', observations: 'Área B' }),
  ], schema);
  assert.equal(annex.length, 2);
  assert.deepEqual(annex.map(group => group.resolved.values.observations), ['Área A', 'Área B']);
  assert.ok(annex.every(group => group.status === 'unique' && !group.conflicts.length));
});

test('combinar textos con recordId heredado conserva la procedencia del dist', () => {
  const group = consolidate([
    record('A', 'quantitative', { comments: 'A' }),
    record('B', 'quantitative', { comments: 'B' }),
  ], schema, {
    'quantitative:r1': { fields: { comments: { mode: 'combine', recordId: 'B' } } },
  })[0];
  assert.equal(group.resolved.values.comments, 'A\nB');
  assert.deepEqual(group.resolved.origins.comments, { sheet: 'Fuente B', cell: 'comments' });
  assert.equal(group.conflicts[0].resolved, true);
});

test('los anexos iguales de distintas personas o archivos son aportaciones independientes', () => {
  const records = [
    record('A', 'annex', { programme: 'PE', description: 'Práctica', status: 'En curso' }),
    record('B', 'annex', { programme: 'PE', description: 'Práctica', status: 'Terminada' }),
  ];
  const groups = consolidate(records, schema);
  assert.equal(groups.length, 2);
  assert.deepEqual(groups.map(group => group.resolved.values.status), ['En curso', 'Terminada']);
  assert.ok(groups.every(group => group.records.length === 1 && group.status === 'unique' && group.conflicts.length === 0));
  const identical = consolidate([records[0], { ...records[1], values: { ...records[0].values } }], schema);
  assert.equal(identical.length, 2);
  assert.ok(identical.every(group => group.status === 'unique'));
});

test('regresión Posgrado: cuatro proyectos distintos de la misma especialidad nunca se convierten en conflicto', () => {
  // Caso observado en Anexo inds 7 y 12, filas 4, 5, 10 y 11 del Excel recibido.
  // Programa y tipo son los mismos, pero las investigaciones pertenecen a filas distintas.
  const titles = [
    'Proyecto de electroremediación de agua',
    'Proyecto de batería de flujo redox',
    'Proyecto de estructuras metal-orgánicas',
    'Proyecto de aceites esenciales',
  ];
  const records = titles.map((description, index) => ({
    ...record(`Posgrado-row-${[4,5,10,11][index]}`, 'annex', {
      programme: 'Maestría en Tecnología Aplicada – Procesos Químicos',
      description,
      status: 'Innovación disciplinar',
    }),
    sourceId: '7-JPFRC-Posgrado',
    rowId: String([4,5,10,11][index]),
  }));
  const groups = consolidate(records, schema);
  assert.equal(groups.length, 4);
  assert.deepEqual(groups.map(group => group.resolved.values.description), titles);
  assert.ok(groups.every(group => group.status === 'unique' && group.conflicts.length === 0));
  assert.equal(new Set(groups.map(group => group.id)).size, 4);
});

test('capturas manuales en la misma fila lógica también preservan cada aportación', () => {
  const records = [
    { ...record('manual-1', 'annex', { programme: 'PE', description: 'Proyecto X' }), sourceId: 'manual', rowId: 'r1' },
    { ...record('manual-2', 'annex', { programme: 'PE', description: 'Proyecto X' }), sourceId: 'manual', rowId: 'r1' },
  ];
  assert.equal(consolidate(records, schema).length, 2);
});
