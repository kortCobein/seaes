import type { DataSource, RecordGroup, WorkbookSchema } from '../../models/types';
import { coverage, hasValue, normalize } from '../../services/consolidation';

export type DashboardDimension = 'all' | 'indicators' | 'criteria' | 'examples' | 'programmes' | 'periods' | 'sources' | 'coverage' | 'conflicts' | 'duplicates';
export interface DashboardRecordFilter {
  indicator?: string;
  criterion?: string;
  source?: string;
  programme?: string;
  period?: string;
  status?: 'all' | 'unique' | 'duplicates' | 'conflicts';
  groupIds?: string[];
}
export interface AnalysisItem {
  id: string;
  label: string;
  description?: string;
  period?: string;
  value: number;
  hasData: boolean;
  groups: RecordGroup[];
  coverage: ReturnType<typeof coverage>;
}

const uniqueValues = (values: string[]) => [...new Set(values.filter(value => value.trim()))].sort((a, b) => a.localeCompare(b, 'es-MX'));

export function recordProgrammes(group: RecordGroup): string[] {
  return uniqueValues(group.section.fields
    .filter(field => field.type === 'text' && /programa|origen/i.test(field.label) && hasValue(group.resolved.values[field.id]))
    .map(field => String(group.resolved.values[field.id])));
}

export function recordPeriods(group: RecordGroup, schema: WorkbookSchema): string[] {
  const captured = group.section.fields
    .filter(field => field.type !== 'number' && /periodo|cohorte/i.test(field.label) && hasValue(group.resolved.values[field.id]))
    .map(field => String(group.resolved.values[field.id]));
  if (captured.length) return uniqueValues(captured);
  return uniqueValues(group.section.indicators.flatMap(id => {
    const period = schema.indicators?.find(item => item.id === id)?.period;
    return period ? [period.split('(')[0].trim()] : [];
  }));
}

export function indicatorDefinitions(schema: WorkbookSchema) {
  const ids = [...new Set([...(schema.indicators ?? []).map(item => item.id), ...schema.sections.flatMap(section => section.indicators)])].sort((a, b) => a - b);
  return ids.map(id => ({ id, ...schema.indicators?.find(item => item.id === id), label: schema.indicators?.find(item => item.id === id)?.label ?? `Indicador ${String(id).padStart(2, '0')}` }));
}

export function filterDashboardGroups(groups: RecordGroup[], schema: WorkbookSchema, filters: DashboardRecordFilter): RecordGroup[] {
  return groups.filter(group => {
    if (filters.groupIds && !filters.groupIds.includes(group.id)) return false;
    if (filters.indicator && !group.section.indicators.includes(Number(filters.indicator))) return false;
    if (filters.source && !group.sourceIds.includes(filters.source)) return false;
    if (filters.criterion && !group.section.fields.some(field => field.criterion === filters.criterion && hasValue(group.resolved.values[field.id]))) return false;
    if (filters.programme && !recordProgrammes(group).some(value => normalize(value) === normalize(filters.programme))) return false;
    if (filters.period && !recordPeriods(group, schema).some(value => normalize(value) === normalize(filters.period))) return false;
    if (filters.status === 'unique' && group.status !== 'unique') return false;
    if (filters.status === 'duplicates' && !['exact', 'possible'].includes(group.status)) return false;
    if (filters.status === 'conflicts' && !group.conflicts.some(conflict => !conflict.resolved)) return false;
    return true;
  });
}

export function dashboardMetrics(groups: RecordGroup[], sources: DataSource[], schema: WorkbookSchema) {
  const indicators = indicatorDefinitions(schema);
  return {
    records: groups.length,
    sources: sources.length,
    coverage: coverage(groups, schema),
    indicatorsWithData: indicators.filter(indicator => groups.some(group => group.section.indicators.includes(indicator.id))).length,
    indicatorsTotal: indicators.length,
    conflicts: groups.filter(group => group.conflicts.some(conflict => !conflict.resolved)).length,
    duplicates: groups.filter(group => ['exact', 'possible'].includes(group.status)).length,
  };
}

/** Categories retain the unfiltered universe. Hiding empty categories never changes coverage denominators. */
export function aggregateDashboard({ dimension, groups, universe = groups, sources, schema }: {
  dimension: Exclude<DashboardDimension, 'examples'>;
  groups: RecordGroup[];
  universe?: RecordGroup[];
  sources: DataSource[];
  schema: WorkbookSchema;
}): AnalysisItem[] {
  const item = (id: string, label: string, matches: RecordGroup[], options: { indicator?: number; criterion?: string; description?: string; period?: string } = {}): AnalysisItem => {
    const amount = coverage(matches, schema, options.indicator, options.criterion);
    return {
      id, label, groups: matches, coverage: amount,
      description: options.description, period: options.period,
      value: dimension === 'all' || dimension === 'coverage' ? amount.percentage : matches.length,
      // A captured numerical zero is information. Percentage alone cannot distinguish it from absence.
      hasData: matches.some(group => group.section.fields.some(field => hasValue(group.resolved.values[field.id]))),
    };
  };
  if (dimension === 'criteria') return schema.criteria.map(criterion => item(criterion.id, criterion.label,
    groups.filter(group => group.section.fields.some(field => field.criterion === criterion.id && hasValue(group.resolved.values[field.id]))), { criterion: criterion.id }));
  if (dimension === 'sources') return sources.map(source => item(source.id, source.name,
    groups.filter(group => group.sourceIds.includes(source.id)), { description: source.filename })).sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, 'es-MX'));
  if (dimension === 'programmes' || dimension === 'periods') {
    const values = (group: RecordGroup) => dimension === 'programmes' ? recordProgrammes(group) : recordPeriods(group, schema);
    const categories = uniqueValues(universe.flatMap(values));
    return categories.map(category => item(category, category, groups.filter(group => values(group).includes(category))))
      .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, 'es-MX'));
  }
  return indicatorDefinitions(schema).map(indicator => {
    const matches = groups.filter(group => group.section.indicators.includes(indicator.id)
      && (dimension !== 'conflicts' || group.conflicts.some(conflict => !conflict.resolved))
      && (dimension !== 'duplicates' || ['exact', 'possible'].includes(group.status)));
    return item(String(indicator.id), `Indicador ${String(indicator.id).padStart(2, '0')}`, matches,
      { indicator: indicator.id, description: indicator.label, period: indicator.period });
  });
}

export const visibleAnalysisItems = (items: AnalysisItem[], hideNulls: boolean) => hideNulls ? items.filter(item => item.hasData) : items;

/** Donuts are a distribution of real records or filled slots, never a sum of percentages. */
export function donutWeight(item: AnalysisItem, dimension: DashboardDimension) {
  return dimension === 'all' || dimension === 'coverage' ? item.coverage.filled : item.groups.length;
}
