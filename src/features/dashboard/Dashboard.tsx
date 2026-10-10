import { useMemo, useState } from 'react';
import { ArrowUpRight, BarChart3, ChevronLeft, ChevronRight, Upload } from 'lucide-react';
import { Dialog } from '../../components/Dialog';
import { ExcelIcon } from '../../components/ExcelIcon';
import type { DataSource, RecordGroup, WorkbookSchema } from '../../models/types';
import { recordLabel } from '../../services/consolidation';
import { aggregateDashboard, dashboardMetrics, donutWeight, visibleAnalysisItems, type AnalysisItem, type DashboardDimension, type DashboardRecordFilter } from './analytics';
import './dashboard.css';

export type { DashboardRecordFilter } from './analytics';
const number = (value: number) => value.toLocaleString('es-MX');
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


const dimensions: { id: Exclude<DashboardDimension, 'examples'>; label: string }[] = [
  { id: 'all', label: 'Cobertura por indicador' }, { id: 'indicators', label: 'Registros por indicador' },
  { id: 'criteria', label: 'Criterios SEAES' }, { id: 'programmes', label: 'Programas educativos' },
  { id: 'periods', label: 'Periodos' }, { id: 'sources', label: 'Archivos / fuentes' },
  { id: 'coverage', label: 'Cobertura' }, { id: 'conflicts', label: 'Conflictos pendientes' },
  { id: 'duplicates', label: 'Duplicados' },
];
export { dimensions as dashboardDimensions };

export function Dashboard({ schema, groups, sources, dimension, mode, hideNulls, onDimension, onRecord, onRecords, onImport }: {
  schema: WorkbookSchema; groups: RecordGroup[]; sources: DataSource[];
  dimension: Exclude<DashboardDimension, 'examples'>; mode: 'bars' | 'donut'; hideNulls: boolean;
  onDimension: (value: Exclude<DashboardDimension, 'examples'>) => void;
  onRecord: (group: RecordGroup) => void; onRecords: (filters: DashboardRecordFilter) => void; onImport: () => void;
}) {
  const [detail, setDetail] = useState<AnalysisItem>();
  const [showMissing, setShowMissing] = useState(false);
  const metrics = useMemo(() => dashboardMetrics(groups, sources, schema), [groups, sources, schema]);
  const allItems = useMemo(() => aggregateDashboard({ dimension, groups, sources, schema }), [dimension, groups, sources, schema]);
  const items = useMemo(() => visibleAnalysisItems(allItems, hideNulls), [allItems, hideNulls]);
  const missing = useMemo(() => aggregateDashboard({ dimension: 'indicators', groups, sources, schema }).filter(item => !item.hasData), [groups, sources, schema]);
  const title = dimensions.find(item => item.id === dimension)?.label ?? 'Análisis de indicadores';
  return <div className="analysis-dashboard">
    <div className="analysis-kpis" aria-label="Resumen del filtro actual">
      <button onClick={() => onRecords({})}><span>Registros</span><strong>{number(metrics.records)}</strong></button>
      <button onClick={() => onDimension('sources')}><span className="kpi-heading"><ExcelIcon size={24}/>Fuentes</span><strong>{number(metrics.sources)}</strong></button>
      <button onClick={() => onDimension('coverage')}><span>Cobertura</span><strong>{metrics.coverage.percentage}<small>%</small></strong></button>
      <button onClick={() => onDimension('indicators')}><span>Indicadores con datos</span><strong>{metrics.indicatorsWithData}<small> / {metrics.indicatorsTotal}</small></strong></button>
      <button onClick={() => onDimension('conflicts')}><span>Conflictos pendientes</span><strong className={metrics.conflicts ? 'analysis-attention' : ''}>{number(metrics.conflicts)}</strong></button>
      <button onClick={() => onDimension('duplicates')}><span>Duplicados</span><strong>{number(metrics.duplicates)}</strong></button>
    </div>
    <section className="panel analysis-panel" aria-label="Gráficas SEAES">
      {!groups.length ? <div className="analysis-empty"><div className="analysis-empty-mark"><BarChart3 size={28}/></div><h2>Sin registros para los filtros seleccionados</h2><button className="button primary" onClick={onImport}><Upload size={16}/>Importar Excel</button></div> : <>
        <div className="analysis-heading"><h2>{title}</h2><span className="subtle">{dimension === 'all' || dimension === 'coverage' ? mode === 'bars' ? '% de campos capturados' : 'Campos capturados' : 'Registros'}</span></div>
        <AnalysisChart items={items} dimension={dimension} mode={mode} onSelect={setDetail}/>
        <div className="analysis-footer"><span>{items.length} de {allItems.length} categorías{hideNulls ? ' · nulos ocultos' : ''}</span>{!!missing.length && !hideNulls && <button className="button text small" onClick={() => setShowMissing(true)}>Ver indicadores sin datos<ArrowUpRight size={14}/></button>}</div>
      </>}
    </section>
    {detail && <CategoryDetail key={`${dimension}:${detail.id}`} item={detail} schema={schema} sources={sources} onClose={() => setDetail(undefined)} onRecord={onRecord} onRecords={() => { onRecords({ groupIds: detail.groups.map(group => group.id) }); setDetail(undefined); }}/>}
    {showMissing && <Dialog title="Indicadores sin información" onClose={() => setShowMissing(false)}><div className="analysis-missing-list">{missing.map(item => <button key={item.id} onClick={() => { setShowMissing(false); setDetail(item); }}><strong>{item.label}</strong><span>{item.description}</span><ArrowUpRight size={15}/></button>)}</div></Dialog>}
  </div>;
}
