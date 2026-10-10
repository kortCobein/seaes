import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { DataSource, SeaesRecord, WorkbookSchema } from '../src/models/types';
import { consolidate } from '../src/services/consolidation';
import { aggregateDashboard, dashboardMetrics, donutWeight, filterDashboardGroups, recordPeriods, recordProgrammes, visibleAnalysisItems } from '../src/features/dashboard/analytics';

const schema: WorkbookSchema = {
  version: 'test', inputFile: '', outputFile: '', demoFile: '',
  criteria: [{ id: 'inclusion', label: 'Inclusión' }, { id: 'equidad', label: 'Equidad' }],
  indicators: [{ id: 1, label: 'Indicador 1', period: '2025-2026 (Periodo oficial)' }, { id: 2, label: 'Indicador 2', period: '2024-2025' }, { id: 3, label: 'Indicador 3' }],
  sections: [
    { id: 'i1', sheet: 'Indicador 1', label: 'Indicador 1', kind: 'quantitative', indicators: [1], anchors: [],
      fields: [{ id: 'count', type: 'number', label: 'Casos', criterion: 'inclusion' }, { id: 'equity', type: 'number', label: 'Equidad', criterion: 'equidad' }],
      rows: [{ id: 'r1', label: 'Nivel 1', fields: { count: { inputRef: 'A1', outputRef: 'A1', inputBaseline: null, outputBaseline: null }, equity: { inputRef: 'B1', outputRef: 'B1', inputBaseline: null, outputBaseline: null } } }] },
    { id: 'i2', sheet: 'Indicador 2', label: 'Indicador 2', kind: 'quantitative', indicators: [2], anchors: [],
      fields: [{ id: 'count', type: 'number', label: 'Casos', criterion: 'inclusion' }],
      rows: [{ id: 'r1', label: 'Nivel 1', fields: { count: { inputRef: 'A1', outputRef: 'A1', inputBaseline: null, outputBaseline: null } } }] },
    { id: 'annex', sheet: 'Anexo', label: 'Anexo', kind: 'annex', indicators: [1, 3], anchors: [],
      fields: [{ id: 'programme', type: 'text', label: 'Programa educativo' }, { id: 'period', type: 'text', label: 'Periodo' }, { id: 'description', type: 'text', label: 'Descripción' }], rows: [] },
  ],
};
const sources: DataSource[] = ['a', 'b', 'empty'].map(id => ({ id, name: id, filename: `${id}.xlsx`, kind: 'real', importedAt: '', compatibility: 'compatible', warnings: [] }));
const record = (id: string, sectionId: string, values: SeaesRecord['values'], sourceId = 'a'): SeaesRecord => ({ id, sourceId, sectionId, rowId: 'r1', values, originalValues: { ...values }, origins: {} });
const records = [record('zero', 'i1', { count: 0 }), record('text', 'annex', { programme: 'Ingeniería', period: '2026-2027', description: 'Descripción real' })];

test('Ocultar nulos conserva el cero capturado y los anexos con captura aunque su cobertura cuantitativa sea cero', () => {
  const groups = consolidate(records, schema);
  const items = aggregateDashboard({ dimension: 'coverage', groups, sources, schema });
  assert.equal(items.length, 3);
  assert.equal(items[0].coverage.filled, 1);
  assert.equal(items[0].coverage.percentage, 50);
  assert.equal(items[1].hasData, false);
  assert.equal(items[2].value, 0);
  assert.equal(items[2].hasData, true);
  assert.deepEqual(visibleAnalysisItems(items, true).map(item => item.id), ['1', '3']);
  assert.equal(visibleAnalysisItems(items, false).length, 3);
  assert.equal(groups[0].resolved.values.count, 0);
});

test('los KPIs y el universo de cobertura permanecen intactos al ocultar categorías', () => {
  const groups = consolidate(records, schema);
  const before = JSON.stringify({ groups, sources, schema });
  const metrics = dashboardMetrics(groups, sources, schema);
  const items = aggregateDashboard({ dimension: 'coverage', groups, sources, schema });
  visibleAnalysisItems(items, true);
  assert.equal(metrics.indicatorsWithData, 2);
  assert.equal(metrics.indicatorsTotal, 3);
  assert.equal(metrics.coverage.filled, 1);
  assert.equal(metrics.coverage.expected, 3);
  assert.deepEqual(dashboardMetrics(groups, sources, schema), metrics);
  assert.equal(JSON.stringify({ groups, sources, schema }), before);
});

test('criterios distinguen ausencia, null y texto vacío de cero capturado', () => {
  const groups = consolidate([record('zero', 'i1', { count: 0, equity: null }), record('blank', 'i2', { count: '  ' })], schema);
  const items = aggregateDashboard({ dimension: 'criteria', groups, sources, schema });
  assert.equal(items[0].value, 1);
  assert.equal(items[1].value, 0);
  assert.deepEqual(visibleAnalysisItems(items, true).map(item => item.id), ['inclusion']);
  assert.equal(filterDashboardGroups(groups, schema, { criterion: 'inclusion' }).length, 1);
  assert.equal(filterDashboardGroups(groups, schema, { criterion: 'equidad' }).length, 0);
});

test('programas, periodos y fuentes preservan categorías vacías del universo hasta activar el filtro visual', () => {
  const groups = consolidate([...records, record('other', 'annex', { programme: 'Licenciatura', period: '2024-2025', description: 'Otra captura' }, 'b')], schema);
  const scoped = filterDashboardGroups(groups, schema, { source: 'a' });
  for (const dimension of ['programmes', 'periods', 'sources'] as const) {
    const items = aggregateDashboard({ dimension, groups: scoped, universe: groups, sources, schema });
    assert.ok(items.some(item => !item.hasData), dimension);
    assert.ok(visibleAnalysisItems(items, true).every(item => item.hasData), dimension);
  }
  assert.deepEqual(recordProgrammes(groups.find(group => group.section.kind === 'annex')!), ['Ingeniería']);
  assert.deepEqual(recordPeriods(groups[0], schema), ['2025-2026']);
  assert.deepEqual(recordPeriods(groups.find(group => group.section.kind === 'annex')!, schema), ['2026-2027']);
  assert.equal(filterDashboardGroups(groups, schema, { programme: 'Ingenieria', period: '2026-2027' }).length, 1);
});

test('anillo usa capturas reales, no suma porcentajes ni inventa segmentos para categorías vacías', () => {
  const groups = consolidate(records, schema);
  const items = aggregateDashboard({ dimension: 'coverage', groups, sources, schema });
  assert.equal(donutWeight(items[0], 'coverage'), 1);
  assert.equal(donutWeight(items[1], 'coverage'), 0);
  assert.equal(donutWeight(items[2], 'coverage'), 0);
  assert.equal(items.reduce((sum, item) => sum + donutWeight(item, 'coverage'), 0), 1);
  assert.equal(donutWeight(items[2], 'indicators'), 1);
});

test('las aportaciones cuantitativas iguales se suman sin duplicados ni conflictos en el Dashboard', () => {
  const copies = [record('copy-a', 'i1', { count: 0 }), record('copy-b', 'i1', { count: 0 }, 'b')];
  const equalGroups = consolidate(copies, schema);
  assert.equal(equalGroups[0].status, 'complementary');
  assert.equal(dashboardMetrics(equalGroups, sources, schema).duplicates, 0);
  const groups = consolidate([...copies, record('additional', 'i1', { count: 5 }, 'b')], schema);
  assert.equal(groups[0].resolved.values.count, 5);
  assert.equal(dashboardMetrics(groups, sources, schema).duplicates, 0);
  assert.equal(dashboardMetrics(groups, sources, schema).conflicts, 0);
  assert.equal(aggregateDashboard({ dimension: 'duplicates', groups, sources, schema })[0].value, 0);
  assert.equal(aggregateDashboard({ dimension: 'conflicts', groups, sources, schema })[0].value, 0);
  assert.equal(filterDashboardGroups(groups, schema, { status: 'duplicates' }).length, 0);
  assert.equal(filterDashboardGroups(groups, schema, { status: 'conflicts' }).length, 0);
});

test('duplicados y conflictos de anexos respetan las decisiones de consolidación y el drilldown exacto', () => {
  const values = { programme: 'Ingeniería', period: '2026-2027', description: 'Descripción inicial' };
  const copies = [record('copy-a', 'annex', values), record('copy-b', 'annex', values, 'b')];
  const duplicateGroups = consolidate(copies, schema);
  assert.equal(dashboardMetrics(duplicateGroups, sources, schema).duplicates, 1);
  assert.equal(aggregateDashboard({ dimension: 'duplicates', groups: duplicateGroups, sources, schema })[0].value, 1);
  const conflicting = [...copies, record('different', 'annex', { ...values, description: 'Descripción distinta' }, 'b')];
  const conflictGroups = consolidate(conflicting, schema);
  const groupId = conflictGroups[0].id;
  assert.deepEqual(conflictGroups[0].conflicts.map(conflict => conflict.fieldId), ['description']);
  assert.equal(dashboardMetrics(conflictGroups, sources, schema).conflicts, 1);
  assert.equal(filterDashboardGroups(conflictGroups, schema, { status: 'conflicts' }).length, 1);
  const resolved = consolidate(conflicting, schema, { [groupId]: { fields: { description: { mode: 'record', recordId: 'copy-a' } } } });
  assert.equal(resolved[0].resolved.values.description, 'Descripción inicial');
  assert.equal(dashboardMetrics(resolved, sources, schema).conflicts, 0);
  assert.equal(aggregateDashboard({ dimension: 'conflicts', groups: resolved, sources, schema })[0].value, 0);
  const allGroups = consolidate([...conflicting, record('other', 'annex', { ...values, programme: 'Licenciatura' })], schema);
  const item = aggregateDashboard({ dimension: 'conflicts', groups: allGroups, sources, schema })[0];
  assert.deepEqual(item.groups.map(group => group.id), [groupId]);
  assert.equal(filterDashboardGroups(allGroups, schema, { groupIds: [] }).length, 0);
  assert.deepEqual(filterDashboardGroups(allGroups, schema, { groupIds: item.groups.map(group => group.id) }).map(group => group.id), [groupId]);
});

test('un recuento de ingreso por cohorte no se interpreta como un periodo', () => {
  const groups = consolidate(records, schema);
  const group = { ...groups[0], section: { ...groups[0].section, fields: [{ id: 'count', label: 'Ingreso cohorte', type: 'number' as const }] } };
  assert.deepEqual(recordPeriods(group, schema), ['2025-2026']);
});
