import { useMemo, useState } from 'react';
import { ArrowUpRight, BarChart3, ChevronLeft, ChevronRight, Upload } from 'lucide-react';
import { Dialog } from '../../components/Dialog';
import { DynamicCards } from '../../components/DynamicCards';
import type { DataSource, RecordGroup, WorkbookSchema } from '../../models/types';
import { recordLabel } from '../../services/consolidation';
import { aggregateDashboard, visibleAnalysisItems, type AnalysisItem, type DashboardDimension, type DashboardRecordFilter } from './analytics';
import './dashboard.css';

export type { DashboardRecordFilter } from './analytics';
const number = (value: number) => value.toLocaleString('es-MX');
const chartColor = (index: number) => `var(--analysis-color-${index % 7})`;

function AnalysisChart({ items, dimension, onSelect }: {
  items: AnalysisItem[];
  dimension: DashboardDimension;
  onSelect: (item: AnalysisItem) => void;
}) {
  const percent = dimension === 'all' || dimension === 'coverage';
  const max = percent ? 100 : Math.max(1, ...items.map(item => item.value));
  if (!items.length) return <div className="analysis-no-results" role="status">Sin información para estos filtros.</div>;
  return <div className="analysis-bars" aria-label={percent ? 'Cobertura por categoría' : 'Aportaciones por categoría'}>
    <div className="analysis-bar-scroll">{items.map((item, index) => <button key={item.id} className="analysis-bar" onClick={() => onSelect(item)} title={item.description ?? item.label}>
      <span className="analysis-bar-label">{item.label}</span>
      <span className="analysis-bar-track" aria-hidden="true"><span style={{ width: `${item.value / max * 100}%`, background: chartColor(index) }}/></span>
      <strong>{number(item.value)}{percent && '%'}</strong><ArrowUpRight size={14} aria-hidden="true"/>
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
      <div className="analysis-detail-counts"><span><strong>{number(item.groups.length)}</strong> aportaciones</span><span><strong>{sourceIds.size}</strong> fuentes</span><span><strong>{item.coverage.percentage}%</strong> cobertura cuantitativa</span></div>
      <div className="analysis-capture-count">{number(item.coverage.filled)} / {number(item.coverage.expected)} campos cuantitativos capturados</div>
      {(definition?.description || item.period) && <details className="analysis-reference-details"><summary>Definición y periodo oficial</summary>{definition?.description && <p>{definition.description}</p>}{item.period && <p>{item.period}</p>}</details>}
      <div className="analysis-detail-table"><table aria-label={`Registros de ${item.label}`}><thead><tr><th scope="col">Registro</th><th scope="col">Fuentes</th><th scope="col">Estado</th></tr></thead><tbody>{current.map(group => <tr key={group.id}>
        <td><button className="record-title" onClick={() => { onClose(); onRecord(group); }}>{recordLabel(group.resolved, group.section)}</button><small className="cell-subtitle">{group.section.label}</small></td>
        <td>{group.sourceIds.map(id => sources.find(source => source.id === id)?.name ?? id).join(', ')}</td>
        <td><span className={`badge ${group.status}`}>{group.conflicts.some(conflict => !conflict.resolved) ? 'Conflicto' : group.status === 'conflict' ? 'Resuelto' : group.status === 'exact' ? 'Duplicado' : group.status === 'possible' ? 'Posible duplicado' : group.status === 'complementary' ? 'Complementario' : 'Único'}</span></td>
      </tr>)}</tbody></table>{!current.length && <div className="quiet-empty">Sin registros capturados.</div>}</div>
      <div className="analysis-detail-footer"><span>{item.groups.length ? page * pageSize + 1 : 0}–{Math.min((page + 1) * pageSize, item.groups.length)} de {number(item.groups.length)}</span><div className="button-row"><button className="icon-button" aria-label="Página anterior de registros relacionados" disabled={!page} onClick={() => setPage(page - 1)}><ChevronLeft size={17}/></button><button className="icon-button" aria-label="Página siguiente de registros relacionados" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}><ChevronRight size={17}/></button><button className="button primary small" disabled={!item.groups.length} onClick={onRecords}>Ver aportaciones<ArrowUpRight size={15}/></button></div></div>
    </div>
  </Dialog>;
}


const dimensions: { id: Exclude<DashboardDimension, 'examples'>; label: string }[] = [
  { id: 'all', label: 'Cobertura por indicador' }, { id: 'indicators', label: 'Por indicador' },
  { id: 'criteria', label: 'Criterios SEAES' }, { id: 'programmes', label: 'Programas educativos' },
  { id: 'periods', label: 'Periodos' }, { id: 'sources', label: 'Por archivo' },
  { id: 'coverage', label: 'Cobertura' }, { id: 'conflicts', label: 'Conflictos pendientes' },
  { id: 'duplicates', label: 'Duplicados' },
];
export { dimensions as dashboardDimensions };

export function Dashboard({ schema, groups, sources, dimension, hideNulls, onDimension, onRecord, onRecords, onImport }: {
  schema: WorkbookSchema; groups: RecordGroup[]; sources: DataSource[];
  dimension: Exclude<DashboardDimension, 'examples'>; hideNulls: boolean;
  onDimension: (value: Exclude<DashboardDimension, 'examples'>) => void;
  onRecord: (group: RecordGroup) => void; onRecords: (filters: DashboardRecordFilter) => void; onImport: () => void;
}) {
  const [detail, setDetail] = useState<AnalysisItem>();
  const [showMissing, setShowMissing] = useState(false);
  const categories = useMemo(() => dimensions.map(category => {
    const analysis = aggregateDashboard({ dimension: category.id, groups, sources, schema });
    const populated = analysis.filter(item => item.hasData && item.value > 0);
    return {
      ...category,
      count: new Set(populated.flatMap(item => item.groups.map(group => group.id))).size,
      hasData: populated.length > 0,
    };
  }), [groups, sources, schema]);
  const available = useMemo(() => groups.length
    ? categories.filter(category => !hideNulls || category.hasData)
    : categories.slice(0, 1), [categories, hideNulls, groups.length]);
  const current = available.some(category => category.id === dimension) ? dimension : available[0]?.id ?? 'all';
  const allItems = useMemo(() => aggregateDashboard({ dimension: current, groups, sources, schema }), [current, groups, sources, schema]);
  const items = useMemo(() => visibleAnalysisItems(allItems, hideNulls), [allItems, hideNulls]);
  const missing = useMemo(() => aggregateDashboard({ dimension: 'indicators', groups, sources, schema }).filter(item => !item.hasData), [groups, sources, schema]);

  return <div className="analysis-dashboard">
    <DynamicCards label="Análisis SEAES" className="analysis-cards" activeId={current} onActiveChange={id => {
      const selected = dimensions.find(item => item.id === id);
      if (selected) onDimension(selected.id);
    }} items={available.map(category => ({
      id: category.id,
      title: category.label,
      icon: <span className="dynamic-card-record-count" aria-label={`${category.count} aportaciones`}>{category.count}</span>,
      content: category.id === current && <div className="analysis-card-content">
        {!groups.length ? <div className="analysis-empty"><div className="analysis-empty-mark"><BarChart3 size={28}/></div><h2>Sin aportaciones para los filtros seleccionados</h2><button className="button primary" onClick={onImport}><Upload size={16}/>Importar Excel</button></div> : <>
          <div className="analysis-card-chart dynamic-card-scroll"><AnalysisChart items={items} dimension={current} onSelect={setDetail}/></div>
          {!hideNulls && missing.length > 0 && <div className="analysis-footer"><button className="button text small" onClick={() => setShowMissing(true)}>Ver indicadores sin datos<ArrowUpRight size={14}/></button></div>}
        </>}
      </div>,
    }))}/>
    {detail && <CategoryDetail key={`${current}:${detail.id}`} item={detail} schema={schema} sources={sources} onClose={() => setDetail(undefined)} onRecord={onRecord} onRecords={() => { onRecords({ groupIds: detail.groups.map(group => group.id) }); setDetail(undefined); }}/>}
    {showMissing && <Dialog title="Indicadores sin información" onClose={() => setShowMissing(false)}><div className="analysis-missing-list">{missing.map(item => <button key={item.id} onClick={() => { setShowMissing(false); setDetail(item); }}><strong>{item.label}</strong><span>{item.description}</span><ArrowUpRight size={15}/></button>)}</div></Dialog>}
  </div>;
}
