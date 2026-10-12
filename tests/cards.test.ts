import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer, type ViteDevServer } from 'vite';
import type { DataSource, RecordGroup, SeaesRecord, SectionSchema, WorkbookSchema } from '../src/models/types';

let server: ViteDevServer;
let RecordFields: typeof import('../src/components/RecordCards').RecordFields;
let RecordCards: typeof import('../src/components/RecordCards').RecordCards;
let FilesScreen: typeof import('../src/features/files/FilesScreen').FilesScreen;
let DynamicCards: typeof import('../src/components/DynamicCards').DynamicCards;
let MarkedCriteria: typeof import('../src/components/MarkedCriteria').MarkedCriteria;

before(async () => {
  server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
  ({ RecordFields, RecordCards } = await server.ssrLoadModule('/src/components/RecordCards.tsx'));
  ({ FilesScreen } = await server.ssrLoadModule('/src/features/files/FilesScreen.tsx'));
  ({ DynamicCards } = await server.ssrLoadModule('/src/components/DynamicCards.tsx'));
  ({ MarkedCriteria } = await server.ssrLoadModule('/src/components/MarkedCriteria.tsx'));
});
after(async () => { await server?.close(); });

const section: SectionSchema = {
  id: 'indicador-1', sheet: 'Indicador 1', label: 'Estudiantes', indicators: [1], kind: 'quantitative', anchors: [],
  fields: [
    { id: 'cantidad', label: 'Cantidad capturada', type: 'number' },
    { id: 'texto', label: 'Descripción', type: 'text' },
    { id: 'vacio', label: 'Campo vacío', type: 'text' },
    { id: 'marcado', label: 'Inclusión', type: 'choice', choices: ['X'] },
    { id: 'no_marcado', label: 'Innovación', type: 'choice', choices: ['X'] },
  ],
  rows: [{ id: 'fila-1', label: 'Matrícula', fields: {} }],
};
const schema: WorkbookSchema = { version: 'test', inputFile: '', outputFile: '', demoFile: '', criteria: [], sections: [section] };
const source: DataSource = { id: 'fuente-a', name: 'Aportación del programa A', filename: 'entrada-a.xlsx', importedAt: '2026-01-15T12:00:00Z', kind: 'real', compatibility: 'compatible', warnings: [] };
const otherSource: DataSource = { ...source, id: 'fuente-b', name: 'Aportación del programa B', filename: 'entrada-b.xlsx' };
const record: SeaesRecord = { id: 'registro-a', sourceId: source.id, sectionId: section.id, rowId: 'fila-1', values: { cantidad: 0, texto: 'Valor exclusivo de A', vacio: null, marcado: 'X', no_marcado: '' }, originalValues: {}, origins: {} };
const otherRecord: SeaesRecord = { ...record, id: 'registro-b', sourceId: otherSource.id, values: { cantidad: 19, texto: 'Valor exclusivo de B' } };
const group: RecordGroup = { id: 'grupo-1', section, records: [record, otherRecord], resolved: { ...record, values: { cantidad: 19, texto: 'Resultado consolidado', marcado: 'X' } }, status: 'complementary', conflicts: [], sourceIds: [source.id, otherSource.id] };
const noop = () => {};

test('las tarjetas conservan ceros y muestran solo criterios marcados con X', () => {
  const html = renderToStaticMarkup(createElement(RecordFields, { record, section }));
  assert.match(html, /<dd>0<\/dd>/);
  assert.match(html, /Criterios marcados/);
  assert.match(html, /Inclusión/);
  assert.doesNotMatch(html, /Innovación|Campo vacío/);
});

test('no aparece lista vacía de criterios cuando no hay ninguna X', () => {
  const html = renderToStaticMarkup(createElement(MarkedCriteria, { fields: section.fields, values: { marcado: '', no_marcado: null } }));
  assert.equal(html, '');
  const marked = renderToStaticMarkup(createElement(MarkedCriteria, { fields: section.fields, values: { marcado: ' x ', no_marcado: '' } }));
  assert.match(marked, /Inclusión/);
  assert.doesNotMatch(marked, /Innovación/);
});

test('la tarjeta de una fuente muestra sus registros originales y no el consolidado ajeno', () => {
  const html = renderToStaticMarkup(createElement(FilesScreen, {
    schema, sources: [source, otherSource], records: [record, otherRecord], groups: [group], busy: '', globalQuery: '', filteredSourceId: source.id,
    onRename: noop, onDelete: noop, onEdit: noop, onDeleteRecords: noop, onAdd: noop,
  }));
  assert.match(html, /Valor exclusivo de A/);
  assert.match(html, /<dd>0<\/dd>/);
  assert.doesNotMatch(html, /Valor exclusivo de B|Resultado consolidado|<dd>19<\/dd>/);
  assert.equal(html.split(source.name).length - 1, 1, 'El nombre visible no debe duplicarse como subtítulo.');
  assert.doesNotMatch(html, /2026-01-15|entrada-a.xlsx|Fecha/);
  assert.match(html, /Agregar registro/);
  assert.match(html, /Eliminar fuente/);
  assert.match(html, /aria-label="Eliminar Matrícula"/);
});

test('consolidado con varias aportaciones dirige a elegir origen antes de editar o eliminar', () => {
  const html = renderToStaticMarkup(createElement(RecordCards, { schema, groups: [group], sources: [source, otherSource], kind: 'indicators', onDetail: noop, onEdit: noop, onDelete: noop }));
  assert.match(html, /Resultado consolidado/);
  assert.match(html, /Elegir aportación para editar Matrícula/);
  assert.doesNotMatch(html, /aria-label="Eliminar Matrícula"/);
  assert.match(html, /Aportación del programa A/);
  assert.match(html, /Aportación del programa B/);
});

test('un registro de origen único permite editar y eliminar su aportación', () => {
  const single: RecordGroup = { ...group, records: [record], resolved: record, sourceIds: [source.id], status: 'unique' };
  const html = renderToStaticMarkup(createElement(RecordCards, { schema, groups: [single], sources: [source], kind: 'indicators', onDetail: noop, onEdit: noop, onDelete: noop }));
  assert.match(html, /aria-label="Editar Matrícula"/);
  assert.match(html, /aria-label="Eliminar Matrícula"/);
  assert.match(html, /<dd>0<\/dd>/);
});

test('las tarjetas recuperan selección válida y no montan contenido de tarjetas cerradas', () => {
  const html = renderToStaticMarkup(createElement(DynamicCards, {
    label: 'Documentos', activeId: 'eliminado', items: [
      { id: 'a', title: 'Primera', content: createElement('p', null, 'Contenido abierto') },
      { id: 'b', title: 'Segunda', content: createElement('p', null, 'Contenido cerrado') },
    ],
  }));
  assert.equal((html.match(/aria-expanded="true"/g) ?? []).length, 1);
  assert.match(html, /Contenido abierto/);
  assert.doesNotMatch(html, /Contenido cerrado/);
  assert.match(html, /aria-controls=/);
  assert.match(html, /role="region"/);
});
