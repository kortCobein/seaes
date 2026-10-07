import type { DataSource, GroupDecision, RecordGroup, Scalar, SeaesRecord, SectionSchema, WorkbookSchema } from '../models/types';

export const normalize = (value: unknown) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
export const hasValue = (value: Scalar | undefined): value is Exclude<Scalar, null> => value !== null && value !== undefined && String(value).trim() !== '';
export const fieldCount = (record: SeaesRecord) => Object.values(record.values).filter(hasValue).length;
const same = (a: Scalar, b: Scalar) => typeof a === typeof b && normalize(a) === normalize(b);

function identity(record: SeaesRecord, section: SectionSchema) {
  if (section.kind !== 'annex') return `${section.id}:${record.rowId}`;
  const keys = section.fields.filter(f => f.type === 'text' && !/observaci|comentario|evidencia|liga|url/i.test(f.label)).slice(0, 2);
  const values = keys.map(f => normalize(record.values[f.id]));
  return `${section.id}:${values.some(Boolean) ? JSON.stringify(values) : record.id}`;
}

export function consolidate(records: SeaesRecord[], schema: WorkbookSchema, decisions: Record<string, GroupDecision> = {}): RecordGroup[] {
  const sections = new Map(schema.sections.map(s => [s.id, s]));
  const buckets = new Map<string, SeaesRecord[]>();
  for (const record of records) {
    const section = sections.get(record.sectionId);
    if (!section || !fieldCount(record)) continue;
    const base = identity(record, section);
    const key = section.kind === 'annex' && decisions[base]?.separate ? `${base}:${record.id}` : base;
    buckets.set(key, [...(buckets.get(key) ?? []), record]);
  }
  const groups: RecordGroup[] = [];
  for (const [id, members] of buckets) {
    const section = sections.get(members[0].sectionId)!;
    const values: Record<string, Scalar> = {};
    const origins: SeaesRecord['origins'] = {};
    const conflicts: RecordGroup['conflicts'] = [];
    for (const field of section.fields) {
      const candidates = members.filter(r => hasValue(r.values[field.id])).map(r => ({ recordId: r.id, sourceId: r.sourceId, value: r.values[field.id] }));
      if (!candidates.length) continue;
      const different = candidates.some(c => !same(c.value, candidates[0].value));
      const decision = decisions[id]?.fields?.[field.id];
      let selected = candidates.find(c => decision?.recordId === c.recordId) ?? candidates[0];
      values[field.id] = selected.value;
      origins[field.id] = members.find(r => r.id === selected.recordId)?.origins[field.id] ?? { sheet: section.sheet, cell: '' };
      let resolved = decision?.mode === 'record' && candidates.some(c => c.recordId === decision.recordId);
      if (decision?.mode === 'sum' && candidates.every(c => typeof c.value === 'number')) {
        // Deliberate user decision, never automatic aggregation of overlapping populations.
        values[field.id] = candidates.reduce((sum, c) => sum + Number(c.value), 0);
        resolved = true;
      }
      if (decision?.mode === 'combine' && field.type === 'text') {
        values[field.id] = [...new Set(candidates.map(c => String(c.value)))].join('\n');
        resolved = true;
      }
      if (different) conflicts.push({ fieldId: field.id, candidates, resolved: !!resolved });
    }
    const exact = members.length > 1 && members.every(r => section.fields.every(f => same(r.values[f.id] ?? null, members[0].values[f.id] ?? null)));
    groups.push({ id, section, records: members, resolved: { ...members[0], values, origins }, sourceIds: [...new Set(members.map(r => r.sourceId))], conflicts,
      status: conflicts.length ? 'conflict' : exact ? 'exact' : members.length > 1 ? 'complementary' : 'unique' });
  }
  // Qualitative entries with the same programme but different descriptions remain independent.
  const programmeCounts = new Map<string, number>();
  const programmeKey = (g: RecordGroup) => `${g.section.id}:${normalize(g.resolved.values[g.section.fields.find(f => f.type === 'text')?.id ?? ''])}`;
  for (const group of groups.filter(g => g.section.kind === 'annex')) programmeCounts.set(programmeKey(group), (programmeCounts.get(programmeKey(group)) ?? 0) + 1);
  for (const group of groups) if (group.section.kind === 'annex' && group.status === 'unique' && (programmeCounts.get(programmeKey(group)) ?? 0) > 1) group.status = 'possible';
  return groups;
}

export function buildDemo(records: SeaesRecord[], schema: WorkbookSchema): { records: SeaesRecord[]; sources: DataSource[] } {
  const definitions: [string, number[]][] = [
    ['Perfiles de egreso', [1, 2]], ['Evaluación del aprendizaje', [3, 4]], ['Recursos humanos', [5]], ['Formación docente', [6]],
    ['Innovación docente', [7]], ['Servicios escolares', [8]], ['Trayectorias escolares', [9]], ['Oferta educativa', [10]],
    ['Desarrollo curricular', [11]], ['Mejora académica', [12]], ['Investigación', [13]], ['Producción académica', [14]],
    ['Vinculación académica', [15, 16]], ['Gestión institucional', [17, 18, 19, 20]],
  ];
  const sources = definitions.map(([name], index): DataSource => ({ id: `demo-${index + 1}`, name, filename: `Simulado_${index + 1}.xlsx`, importedAt: new Date().toISOString(), kind: 'demo', compatibility: 'compatible', warnings: [] }));
  const sections = new Map(schema.sections.map(s => [s.id, s]));
  return { sources, records: records.map((r, i) => {
    const indicator = sections.get(r.sectionId)?.indicators[0];
    const sourceIndex = Math.max(0, definitions.findIndex(([, indicators]) => indicators.includes(indicator ?? 1)));
    return { ...r, id: `demo-record-${i}`, sourceId: sources[sourceIndex].id };
  }) };
}

export function coverage(groups: RecordGroup[], schema: WorkbookSchema, indicator?: number, criterion?: string) {
  const sections = schema.sections.filter(s => (!indicator || s.indicators.includes(indicator)) && s.kind === 'quantitative');
  const expected = sections.reduce((n, s) => n + s.rows.reduce((m, r) => m + s.fields.filter(f => (!criterion || f.criterion === criterion) && r.fields[f.id]).length, 0), 0);
  const slots = new Set<string>();
  const counters = new Map<string, number>();
  for (const group of groups.filter(g => sections.some(s => s.id === g.section.id))) {
    const section = group.section;
    const rowIndex = counters.get(section.id) ?? 0;
    const row = section.kind === 'annex' ? section.rows[rowIndex] : section.rows.find(r => r.id === group.resolved.rowId);
    if (section.kind === 'annex') counters.set(section.id, rowIndex + 1);
    if (!row) continue;
    for (const field of section.fields) if ((!criterion || field.criterion === criterion) && row.fields[field.id] && hasValue(group.resolved.values[field.id])) slots.add(`${section.id}:${row.id}:${field.id}`);
  }
  return { expected, filled: slots.size, missing: expected - slots.size, percentage: expected ? Math.round(slots.size / expected * 100) : 0 };
}

export const recordLabel = (record: SeaesRecord, section: SectionSchema) => section.kind === 'annex'
  ? String(section.fields.map(f => record.values[f.id]).find(v => typeof v === 'string' && v.length > 1) ?? section.label)
  : section.rows.find(r => r.id === record.rowId)?.label ?? section.label;
