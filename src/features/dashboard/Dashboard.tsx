import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, BarChart3, BookOpen, ChevronLeft, ChevronRight, Filter, FlaskConical, PieChart, Search, Upload, X } from 'lucide-react';
import { Dialog } from '../../components/Dialog';
import { ExcelIcon } from '../../components/ExcelIcon';
import type { DataSource, RecordGroup, WorkbookSchema } from '../../models/types';
import { normalize, recordLabel } from '../../services/consolidation';
import {
  aggregateDashboard, dashboardMetrics, donutWeight, filterDashboardGroups, indicatorDefinitions,
  recordPeriods, recordProgrammes, visibleAnalysisItems,
  type AnalysisItem, type DashboardDimension, type DashboardRecordFilter,
} from './analytics';
import './dashboard.css';
import { AnnexAccordion } from './AnnexAccordion';

export type { DashboardRecordFilter } from './analytics';

interface DashboardProps {
  schema: WorkbookSchema;
  groups: RecordGroup[];
  sources: DataSource[];
  busy?: string | boolean;
  onImport: () => void;
  onDemo: () => void;
  onRecord: (group: RecordGroup) => void;
  onRecords: (filters: DashboardRecordFilter) => void;
}

const dimensions: { value: DashboardDimension; label: string }[] = [
  { value: 'all', label: 'Todo' }, { value: 'indicators', label: 'Indicadores' },
  { value: 'criteria', label: 'Criterios SEAES' }, { value: 'examples', label: 'Ejemplos' },
  { value: 'programmes', label: 'Programas educativos' }, { value: 'periods', label: 'Periodos' },
  { value: 'sources', label: 'Archivos / fuentes' }, { value: 'coverage', label: 'Cobertura' },
  { value: 'conflicts', label: 'Conflictos' }, { value: 'duplicates', label: 'Duplicados' },
];
const preferenceKey = 'seaes:dashboard:hide-nulls';
const number = (value: number) => value.toLocaleString('es-MX');
// Windows native select expands to the longest option. Keep original values and compact only labels.
const shortOption = (value: string, limit = 42) => value.length > limit ? `${value.slice(0, limit - 1).trimEnd()}…` : value;

function readPreference() {
  try { return localStorage.getItem(preferenceKey) === 'true'; } catch { return false; }
}

const chartColor = (index: number) => `var(--analysis-color-${index % 7})`;

function AnalysisChart({ items, dimension, mode, onSelect }: {
  items: AnalysisItem[];
  dimension: DashboardDimension;
  mode: 'bars' | 'donut';
  onSelect: (item: AnalysisItem) => void;
}) {
  const percent = dimension === 'all' || dimension === 'coverage';
  const max = percent ? 100 : Math.max(1, ...items.map(item => item.value));
  const total = items.reduce((sum, item) => sum + donutWeight(item, dimension), 0);
  let cursor = -90;
  const segments = items.flatMap((item, index) => {
    const value = donutWeight(item, dimension);
    if (!value || !total) return [];
    const start = cursor;
    const angle = value / total * 360;
    cursor += angle;
    const angleEnd = start + Math.min(angle, 359.9999);
    const point = (degrees: number, radius: number) => [120 + Math.cos(degrees * Math.PI / 180) * radius, 120 + Math.sin(degrees * Math.PI / 180) * radius];
    const [x1, y1] = point(start, 100); const [x2, y2] = point(angleEnd, 100);
    const [x3, y3] = point(angleEnd, 70); const [x4, y4] = point(start, 70);
    const path = `M ${x1} ${y1} A 100 100 0 ${angle > 180 ? 1 : 0} 1 ${x2} ${y2} L ${x3} ${y3} A 70 70 0 ${angle > 180 ? 1 : 0} 0 ${x4} ${y4} Z`;
    return [{ item, index, path, value }];
  });
  if (!items.length) return <div className="analysis-no-results" role="status">Sin información para estos filtros.</div>;
  if (mode === 'bars') return <div className="analysis-bars" aria-label={percent ? 'Cobertura por categoría' : 'Registros por categoría'}>
    <div className="analysis-bar-scroll">{items.map((item, index) => <button key={item.id} className="analysis-bar" onClick={() => onSelect(item)} title={item.description ?? item.label}>
      <span className="analysis-bar-label">{item.label}</span>
      <span className="analysis-bar-track" aria-hidden="true"><span style={{ width: `${item.value / max * 100}%`, background: chartColor(index) }}/></span>
      <strong>{number(item.value)}{percent && '%'}</strong>
      <ArrowUpRight size={14} aria-hidden="true"/>
    </button>)}</div>
  </div>;
  return <div className="analysis-donut-layout">
    <div className="analysis-donut">
      <svg viewBox="0 0 240 240" aria-label={percent ? 'Distribución de campos capturados' : 'Distribución de registros'}>
        <circle cx="120" cy="120" r="85" fill="none" stroke="var(--line)" strokeWidth="30"/>
        {segments.map(({ item, index, path, value }) => <path key={item.id} d={path} fill={chartColor(index)} stroke="var(--surface)" strokeWidth="1.5" role="button" tabIndex={0}
          aria-label={`${item.label}: ${number(value)} ${percent ? 'campos capturados' : 'registros'}`}
          onClick={() => onSelect(item)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(item); } }}>
          <title>{item.label}: {number(value)} {percent ? 'campos capturados' : 'registros'}</title>
        </path>)}
        <text x="120" y="117" textAnchor="middle" className="analysis-donut-total">{number(total)}</text>
        <text x="120" y="138" textAnchor="middle" className="analysis-donut-unit">{percent ? 'campos capturados' : 'asignaciones'}</text>
      </svg>
      {!total && <span className="subtle">Sin aportaciones</span>}
    </div>
    <div className="analysis-legend" aria-label="Categorías del anillo">{items.map((item, index) => <button key={item.id} onClick={() => onSelect(item)} title={item.description ?? item.label}>
      <i style={{ background: chartColor(index) }} aria-hidden="true"/>
      <span>{item.label}</span><strong>{number(donutWeight(item, dimension))}</strong><ArrowUpRight size={13} aria-hidden="true"/>
    </button>)}</div>
  </div>;
}

function CategoryDetail({ item, schema, sources, onClose, onRecord, onRecords }: {
  item: AnalysisItem; schema: WorkbookSchema; sources: DataSource[];
  onClose: () => void; onRecord: (group: RecordGroup) => void; onRecords: () => void;
}) {
  const [page, setPage] = useState(0);
  const pageSize = 8;
  const pages = Math.max(1, Math.ceil(item.groups.length / pageSize));
  const current = item.groups.slice(page * pageSize, (page + 1) * pageSize);
  const sourceIds = new Set(item.groups.flatMap(group => group.sourceIds));
  const definition = schema.indicators?.find(indicator => String(indicator.id) === item.id && item.label.startsWith('Indicador'));
  return <Dialog title={item.label} onClose={onClose} wide>
    <div className="analysis-detail">
      {item.description && <p className="analysis-definition">{item.description}</p>}
      <div className="analysis-detail-counts"><span><strong>{number(item.groups.length)}</strong> registros</span><span><strong>{sourceIds.size}</strong> fuentes</span><span><strong>{item.coverage.percentage}%</strong> cobertura cuantitativa</span></div>
      <div className="analysis-capture-count">{number(item.coverage.filled)} / {number(item.coverage.expected)} campos cuantitativos capturados</div>
      {(definition?.description || item.period) && <details className="analysis-reference-details"><summary>Definición y periodo oficial</summary>{definition?.description && <p>{definition.description}</p>}{item.period && <p>{item.period}</p>}</details>}
      <div className="analysis-detail-table"><table aria-label={`Registros de ${item.label}`}><thead><tr><th scope="col">Registro</th><th scope="col">Fuentes</th><th scope="col">Estado</th></tr></thead><tbody>{current.map(group => <tr key={group.id}>
        <td><button className="record-title" onClick={() => { onClose(); onRecord(group); }}>{recordLabel(group.resolved, group.section)}</button><small className="cell-subtitle">{group.section.label}</small></td>
        <td>{group.sourceIds.map(id => sources.find(source => source.id === id)?.name ?? id).join(', ')}</td>
        <td><span className={`badge ${group.status}`}>{group.conflicts.some(conflict => !conflict.resolved) ? 'Conflicto' : group.status === 'conflict' ? 'Resuelto' : group.status === 'exact' ? 'Duplicado' : group.status === 'possible' ? 'Posible duplicado' : group.status === 'complementary' ? 'Complementario' : 'Único'}</span></td>
      </tr>)}</tbody></table>{!current.length && <div className="quiet-empty">Sin registros capturados.</div>}</div>
      <div className="analysis-detail-footer"><span>{item.groups.length ? page * pageSize + 1 : 0}–{Math.min((page + 1) * pageSize, item.groups.length)} de {number(item.groups.length)}</span><div className="button-row"><button className="icon-button" aria-label="Página anterior de registros relacionados" disabled={!page} onClick={() => setPage(page - 1)}><ChevronLeft size={17}/></button><button className="icon-button" aria-label="Página siguiente de registros relacionados" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}><ChevronRight size={17}/></button><button className="button primary small" disabled={!item.groups.length} onClick={onRecords}>Ver registros<ArrowUpRight size={15}/></button></div></div>
    </div>
  </Dialog>;
}

function References({ schema, hideNulls }: { schema: WorkbookSchema; hideNulls: boolean }) {
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('all');
  const [selected, setSelected] = useState<{ name: string; text: string }>();
  const input = useRef<HTMLInputElement>(null);
  const references = (schema.referenceSheets ?? []).filter(reference => (!hideNulls || reference.text.trim())
    && (kind !== 'examples' || /ejemplo|muestra|rasgos/i.test(reference.name))
    && (kind !== 'references' || !/ejemplo|muestra|rasgos/i.test(reference.name))
    && normalize(`${reference.name} ${reference.text}`).includes(normalize(query)));
  return <>
    <div className="analysis-reference-toolbar"><div className="analysis-search"><Search size={16} aria-hidden="true"/><input ref={input} aria-label="Buscar ejemplos y referencias" placeholder="Buscar en ejemplos y referencias" value={query} onChange={event => setQuery(event.target.value)}/>{query && <button className="icon-button" aria-label="Limpiar búsqueda de referencias" onClick={() => { setQuery(''); input.current?.focus(); }}><X size={15}/></button>}</div>
      <select aria-label="Tipo de referencia" value={kind} onChange={event => setKind(event.target.value)}><option value="all">Todas las referencias</option><option value="examples">Ejemplos y muestras</option><option value="references">Indicaciones y cambios</option></select>
    </div>
    <div className="analysis-reference-list">{references.map(reference => <button key={reference.name} onClick={() => setSelected(reference)}><BookOpen size={16} aria-hidden="true"/><span>{reference.name}</span><ArrowUpRight size={15} aria-hidden="true"/></button>)}{!references.length && <div className="quiet-empty">Sin referencias para esta búsqueda.</div>}</div>
    <div className="analysis-footer">{references.length} referencias</div>
    {selected && <Dialog title={selected.name} onClose={() => setSelected(undefined)} wide><div className="analysis-reference-text">{selected.text}</div></Dialog>}
  </>;
}

export function Dashboard({ schema, groups, sources, busy, onImport, onDemo, onRecord, onRecords }: DashboardProps) {
  const [dimension, setDimension] = useState<DashboardDimension>('all');
  const [mode, setMode] = useState<'bars' | 'donut'>('bars');
  const [hideNulls, setHideNulls] = useState(readPreference);
  const [filters, setFilters] = useState<DashboardRecordFilter>({});
  const [advanced, setAdvanced] = useState(false);
  const [detail, setDetail] = useState<AnalysisItem>();
  const [showMissing, setShowMissing] = useState(false);
  const [activeAnnexSheet, setActiveAnnexSheet] = useState<string | null>(null);
  const metrics = useMemo(() => dashboardMetrics(groups, sources, schema), [groups, sources, schema]);
  const annexSectionIds = useMemo(() => activeAnnexSheet ? schema.sections.filter(section => section.kind === 'annex' && section.sheet === activeAnnexSheet).map(section => section.id) : undefined, [schema.sections, activeAnnexSheet]);
  const scoped = useMemo(() => filterDashboardGroups(groups, schema, { ...filters, sectionIds: annexSectionIds }), [groups, schema, filters, annexSectionIds]);
  const allItems = useMemo(() => dimension === 'examples' ? [] : aggregateDashboard({ dimension, groups: scoped, universe: groups, sources, schema }), [dimension, scoped, groups, sources, schema]);
  const items = useMemo(() => visibleAnalysisItems(allItems, hideNulls), [allItems, hideNulls]);
  const programmes = useMemo(() => [...new Set(groups.flatMap(recordProgrammes))].sort((a, b) => a.localeCompare(b, 'es-MX')), [groups]);
  const periods = useMemo(() => [...new Set(groups.flatMap(group => recordPeriods(group, schema)))].sort((a, b) => a.localeCompare(b, 'es-MX')), [groups, schema]);
  const indicators = indicatorDefinitions(schema);
  const missing = useMemo(() => aggregateDashboard({ dimension: 'indicators', groups: scoped, sources, schema }).filter(item => !item.hasData), [scoped, sources, schema]);
  const activeFilters = Object.values(filters).filter(value => value && value !== 'all').length + (activeAnnexSheet ? 1 : 0);
  const filter = (key: keyof DashboardRecordFilter, value: string) => setFilters(previous => ({ ...previous, [key]: value }));
  const resetFilters = () => { setFilters({}); setActiveAnnexSheet(null); };
  useEffect(() => { try { localStorage.setItem(preferenceKey, String(hideNulls)); } catch { /* Preference is retained in memory when storage is unavailable. */ } }, [hideNulls]);

  const title = dimension === 'all' || dimension === 'coverage' ? 'Cobertura por indicador'
    : dimension === 'conflicts' ? 'Conflictos pendientes por indicador'
    : dimension === 'duplicates' ? 'Duplicados por indicador'
    : dimension === 'indicators' ? 'Registros por indicador'
    : dimensions.find(item => item.value === dimension)?.label ?? '';
  const available = (list: string[], values: (group: RecordGroup) => string[]) => hideNulls ? list.filter(value => scoped.some(group => values(group).includes(value))) : list;

  return <div className="analysis-dashboard">
    {!!groups.length && <div className="analysis-kpis" aria-label="Resumen global">
      <button onClick={() => onRecords({})}><span>Registros</span><strong>{number(metrics.records)}</strong></button>
      <button onClick={() => setDimension('sources')}><span className="kpi-heading"><ExcelIcon size={24}/>Fuentes</span><strong>{number(metrics.sources)}</strong></button>
      <button onClick={() => setDimension('coverage')}><span>Cobertura</span><strong>{metrics.coverage.percentage}<small>%</small></strong></button>
      <button onClick={() => setDimension('indicators')}><span>Indicadores con datos</span><strong>{metrics.indicatorsWithData}<small> / {metrics.indicatorsTotal}</small></strong></button>
      <button onClick={() => { setDimension('conflicts'); setFilters({}); }}><span>Conflictos pendientes</span><strong className={metrics.conflicts ? 'analysis-attention' : ''}>{number(metrics.conflicts)}</strong></button>
      <button onClick={() => { setDimension('duplicates'); setFilters({}); }}><span>Duplicados</span><strong>{number(metrics.duplicates)}</strong></button>
    </div>}
    <AnnexAccordion schema={schema} groups={groups} activeSheet={activeAnnexSheet} onFilter={setActiveAnnexSheet} onRecords={ids => onRecords({ groupIds: ids })}/>

    <section className="panel analysis-panel" aria-label="Análisis SEAES">
      <div className="analysis-controls">
        <label className="analysis-dimension">Mostrar<select value={dimension} onChange={event => { setDimension(event.target.value as DashboardDimension); setDetail(undefined); }} aria-label="Mostrar información"><>{dimensions.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</></select></label>
        {dimension !== 'examples' && <><select className="analysis-period" aria-label="Filtrar Dashboard por periodo" value={filters.period ?? ''} onChange={event => filter('period', event.target.value)}><option value="">Todos los periodos</option>{available(periods, group => recordPeriods(group, schema)).map(period => <option key={period} value={period} title={period}>{shortOption(period)}</option>)}</select>
          <div className="analysis-chart-switch" role="group" aria-label="Visualización"><button className={mode === 'bars' ? 'active' : ''} aria-pressed={mode === 'bars'} onClick={() => setMode('bars')}><BarChart3 size={16}/>Barras</button><button className={mode === 'donut' ? 'active' : ''} aria-pressed={mode === 'donut'} onClick={() => setMode('donut')}><PieChart size={16}/>Anillo</button></div></>}
        <label className="analysis-hide-nulls"><input type="checkbox" checked={hideNulls} onChange={event => setHideNulls(event.target.checked)}/>Ocultar nulos</label>
        {dimension !== 'examples' && <button className="button secondary small" onClick={() => setAdvanced(true)}><Filter size={15}/>Filtros{activeFilters ? <span className="analysis-filter-count">{activeFilters}</span> : null}</button>}
        {activeFilters > 0 && dimension !== 'examples' && <button className="button text small" onClick={resetFilters}>Restablecer</button>}
      </div>
      {dimension === 'examples' ? <References schema={schema} hideNulls={hideNulls}/> : !groups.length ? <div className="analysis-empty"><div className="analysis-empty-mark"><BarChart3 size={28}/></div><h2>Sin información cargada</h2><div className="button-row"><button className="button primary" disabled={!!busy} onClick={onImport}><Upload size={17}/>Importar Excel</button><button className="button secondary" disabled={!!busy} onClick={onDemo}><FlaskConical size={17}/>Usar datos ficticios</button></div></div> : <>
        <div className="analysis-heading"><div><h2>{title}</h2>{activeFilters > 0 && <span className="subtle">{activeAnnexSheet ? `${activeAnnexSheet} · ` : ''}{number(scoped.length)} registros en la selección</span>}</div><span className="subtle">{mode === 'donut' && (dimension === 'coverage' || dimension === 'all') ? 'Campos capturados' : mode === 'bars' && (dimension === 'coverage' || dimension === 'all') ? '% de campos capturados' : 'Registros'}</span></div>
        <AnalysisChart items={items} dimension={dimension} mode={mode} onSelect={setDetail}/>
        <div className="analysis-footer"><span>{items.length} de {allItems.length} categorías{hideNulls && ' · nulos ocultos'}</span>{missing.length > 0 && !hideNulls && <button className="button text small" onClick={() => setShowMissing(true)}>Ver {missing.length} indicadores sin información<ArrowUpRight size={14}/></button>}</div>
      </>}
    </section>

    {advanced && <Dialog title="Filtros del Dashboard" onClose={() => setAdvanced(false)}>
      <div className="analysis-filter-grid">
        <label>Indicador<select value={filters.indicator ?? ''} onChange={event => filter('indicator', event.target.value)}><option value="">Todos los indicadores</option>{indicators.filter(indicator => !hideNulls || scoped.some(group => group.section.indicators.includes(indicator.id)) || filters.indicator === String(indicator.id)).map(indicator => <option key={indicator.id} value={indicator.id}>Indicador {String(indicator.id).padStart(2, '0')}</option>)}</select></label>
        <label>Criterio SEAES<select value={filters.criterion ?? ''} onChange={event => filter('criterion', event.target.value)}><option value="">Todos los criterios</option>{schema.criteria.filter(criterion => !hideNulls || filterDashboardGroups(scoped, schema, { criterion: criterion.id }).length || filters.criterion === criterion.id).map(criterion => <option key={criterion.id} value={criterion.id}>{criterion.label}</option>)}</select></label>
        <label>Fuente<select value={filters.source ?? ''} onChange={event => filter('source', event.target.value)}><option value="">Todas las fuentes</option>{sources.filter(source => !hideNulls || scoped.some(group => group.sourceIds.includes(source.id)) || filters.source === source.id).map(source => <option key={source.id} value={source.id}>{source.name}</option>)}</select></label>
        <label>Programa educativo<select value={filters.programme ?? ''} onChange={event => filter('programme', event.target.value)}><option value="">Todos los programas</option>{available(programmes, recordProgrammes).map(programme => <option key={programme} value={programme}>{programme}</option>)}</select></label>
        <label>Estado<select value={filters.status ?? 'all'} onChange={event => filter('status', event.target.value)}><option value="all">Todos los estados</option><option value="unique">Únicos</option><option value="duplicates">Duplicados</option><option value="conflicts">Conflictos pendientes</option></select></label>
      </div><div className="dialog-footer"><button className="button secondary" onClick={() => setFilters({})}>Restablecer</button><button className="button primary" onClick={() => setAdvanced(false)}>Ver resultados</button></div>
    </Dialog>}
    {detail && <CategoryDetail key={`${dimension}:${detail.id}`} item={detail} schema={schema} sources={sources} onClose={() => setDetail(undefined)} onRecord={onRecord} onRecords={() => { onRecords({ ...filters, groupIds: detail.groups.map(group => group.id) }); setDetail(undefined); }}/>}
    {showMissing && <Dialog title="Indicadores sin información" onClose={() => setShowMissing(false)}><div className="analysis-missing-list">{missing.map(item => <button key={item.id} onClick={() => { setShowMissing(false); setDetail(item); }}><strong>{item.label}</strong><span>{item.description}</span><ArrowUpRight size={15}/></button>)}</div></Dialog>}
  </div>;
}
