import type { DataSource, Scalar, SeaesRecord, WorkbookSchema, WorkSession } from '../models/types';
import { consolidate, normalize } from './consolidation';

export interface RecordData { sectionId: string; rowId: string; values: Record<string, Scalar> }

// La separación es una decisión estructural; cambiar valores solo invalida los ajustes de su propio grupo.
export function withRecords(session: WorkSession, records: SeaesRecord[], schema: WorkbookSchema): WorkSession {
  const before = consolidate(session.records, schema, session.decisions);
  const after = consolidate(records, schema, session.decisions);
  const matchingGroups = (groups: typeof before, id: string) => groups.filter(group => group.id === id || group.id.startsWith(`${id}:`));
  const signature = (groups: typeof before) => JSON.stringify(groups.flatMap(group => group.records.map(record => [record.id, record.values])));
  const decisions: WorkSession['decisions'] = {};
  for (const [id, decision] of Object.entries(session.decisions)) {
    const remaining = matchingGroups(after, id);
    if (!remaining.length) continue;
    if (signature(matchingGroups(before, id)) === signature(remaining)) decisions[id] = decision;
    else if (decision.separate) decisions[id] = { separate: true };
  }
  return { ...session, records, decisions };
}

export function saveWorkspaceRecord(session: WorkSession, schema: WorkbookSchema, data: RecordData, record?: SeaesRecord, sourceId?: string): WorkSession {
  if (record) {
    if (!session.records.some(item => item.id === record.id)) throw new Error('El registro ya no existe.');
    return withRecords(session, session.records.map(item => item.id === record.id
      ? { ...item, ...data, modifiedAt: new Date().toISOString() } : item), schema);
  }
  let source = sourceId ? session.sources.find(item => item.id === sourceId) : session.sources.find(item => item.kind === 'manual');
  if (sourceId && !source) throw new Error('La fuente ya no existe. Selecciona otra fuente.');
  source ??= { id: crypto.randomUUID(), name: 'Captura manual', filename: 'Captura en el sitio', importedAt: new Date().toISOString(), kind: 'manual', compatibility: 'compatible', warnings: [] } satisfies DataSource;
  const next: SeaesRecord = { ...data, id: crypto.randomUUID(), sourceId: source.id, originalValues: { ...data.values }, origins: {} };
  const result = withRecords(session, [...session.records, next], schema);
  return { ...result, sources: session.sources.some(item => item.id === source.id) ? session.sources : [...session.sources, source] };
}

export function deleteWorkspaceRecords(session: WorkSession, schema: WorkbookSchema, ids: Set<string>): WorkSession {
  return withRecords(session, session.records.filter(record => !ids.has(record.id)), schema);
}

export function setPreviewValue(session: WorkSession, schema: WorkbookSchema, groupId: string, fieldId: string, value: Scalar): WorkSession {
  const groups = consolidate(session.records, schema, session.decisions);
  const group = groups.find(item => item.id === groupId);
  const field = group?.section.fields.find(item => item.id === fieldId);
  if (!group || !field) throw new Error('El campo ya no existe en el consolidado. Vuelve a abrir Preview.');
  if (group.section.kind === 'identity' && /institucion|entidad/.test(normalize(field.label))) throw new Error(`«${field.label}» es un dato institucional fijo y no se puede modificar ni vaciar desde Preview.`);
  const row = group.section.kind === 'annex'
    ? group.section.rows[groups.filter(item => item.section.id === group.section.id).findIndex(item => item.id === groupId)]
    : group.section.rows.find(item => item.id === group.resolved.rowId);
  if (!row?.fields[fieldId]?.outputRef) throw new Error('El campo no tiene una celda de destino en la fila exportada. No se guardó el cambio.');
  if (typeof value === 'number' && (!Number.isFinite(value) || value < 0)) throw new Error('El valor debe ser un número no negativo.');
  if (typeof value === 'string' && value.length > 32767) throw new Error('El texto supera los 32 767 caracteres que admite Excel.');
  if (field.type === 'number' && value !== null && typeof value !== 'number' && !/^no (disponible|aplica)$/i.test(String(value))) throw new Error('Escribe un número no negativo, No disponible o No aplica.');
  if (field.type === 'choice' && value !== null && !(field.choices ?? ['X']).includes(String(value))) throw new Error('Selecciona un valor permitido.');
  return { ...session, decisions: { ...session.decisions, [groupId]: {
    ...session.decisions[groupId], fields: { ...session.decisions[groupId]?.fields, [fieldId]: { mode: 'value', value } },
  } } };
}
