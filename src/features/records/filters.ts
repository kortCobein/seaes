import type { DataSource, RecordGroup, WorkbookSchema } from '../../models/types';
import { fieldCount, hasValue, normalize, recordLabel } from '../../services/consolidation';
import { recordPeriods, recordProgrammes } from '../dashboard/analytics';

export interface Filters { source: string; indicator: string; criterion: string; section: string; kind: string; status: string; completeness: string; programme: string; period: string; groupIds?: string[] }
export const cleanFilters: Filters = { source: '', indicator: '', criterion: '', section: '', kind: '', status: '', completeness: '', programme: '', period: '' };
export function filterGroups(groups: RecordGroup[], schema: WorkbookSchema, sources: DataSource[], filters: Filters, query: string) {
  return groups.filter(g => {
    if (filters.groupIds && !filters.groupIds.includes(g.id)) return false;
    if (filters.source && !g.sourceIds.includes(filters.source)) return false;
    if (filters.kind && !g.sourceIds.some(id => sources.find(s => s.id === id)?.kind === filters.kind)) return false;
    if (filters.indicator && !g.section.indicators.includes(Number(filters.indicator))) return false;
    if (filters.criterion && !g.section.fields.some(f => f.criterion === filters.criterion && hasValue(g.resolved.values[f.id]))) return false;
    if (filters.section && g.section.id !== filters.section) return false;
    if (filters.status === 'duplicates' && !['exact', 'possible'].includes(g.status)) return false;
    if (filters.status === 'conflicts' && !g.conflicts.length) return false;
    if (filters.status === 'pending' && !g.conflicts.some(c => !c.resolved)) return false;
    if (filters.status && !['all', 'duplicates', 'conflicts', 'pending'].includes(filters.status) && filters.status !== g.status) return false;
    const row = g.section.rows.find(r => r.id === g.resolved.rowId) ?? g.section.rows[0];
    const expected = g.section.fields.filter(f => row?.fields[f.id]).length;
    if ((filters.completeness === 'complete' && fieldCount(g.resolved) < expected) || (filters.completeness === 'partial' && fieldCount(g.resolved) >= expected)) return false;
    if (filters.programme && !recordProgrammes(g).some(value => normalize(value).includes(normalize(filters.programme)))) return false;
    const periodText = recordPeriods(g, schema).map(normalize).join(' ');
    if (filters.period && !periodText.includes(normalize(filters.period))) return false;
    const text = normalize([recordLabel(g.resolved, g.section), g.section.sheet, g.section.label, ...Object.values(g.resolved.values), ...g.section.fields.map(f => f.label), ...g.sourceIds.flatMap(id => { const source = sources.find(s => s.id === id); return [source?.name, source?.filename]; }), ...g.section.indicators.map(i => schema.indicators?.find(v => v.id === i)?.label), ...g.section.fields.filter(f => f.criterion && hasValue(g.resolved.values[f.id])).map(f => schema.criteria.find(c => c.id === f.criterion)?.label)].join(' '));
    return normalize(query).split(' ').every(word => text.includes(word));
  });
}
