import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Download, Filter, LoaderCircle, Plus, Trash2, Upload, X } from 'lucide-react';
import type { SeaesRecord } from './models/types';
import { consolidate } from './services/consolidation';
import { useWorkspace } from './hooks/useWorkspace';
import { Dashboard } from './features/dashboard/Dashboard';
import type { DashboardDimension, DashboardRecordFilter } from './features/dashboard/analytics';
import { ReferenceScreen, type ReferenceKind } from './features/references/ReferenceScreen';
import { WorkbookPreview } from './features/preview/WorkbookPreview';
import { FilesScreen } from './features/files/FilesScreen';
import { ExportDialog, ExportResult } from './features/files/ExportDialog';
import { cleanFilters, filterGroups, type Filters } from './features/records/filters';
import { RecordCards } from './components/RecordCards';
import { Dialog } from './components/Dialog';
import { ImportDialog } from './components/ImportDialog';
import { RecordEditor } from './components/RecordEditor';
import { RecordDetail } from './components/RecordDetail';
import { SearchField } from './components/SearchField';
import { ExcelIcon } from './components/ExcelIcon';
import { SlidingNav } from './components/SlidingNav';
import { AnimatedScreen } from './components/AnimatedScreen';
import { WorkspaceContextMenu } from './components/WorkspaceContextMenu';

const nav = [{ id: 'dashboard', label: 'Dashboard' }, { id: 'examples', label: 'Ejemplos' }, { id: 'indicators', label: 'Indicadores' }, { id: 'annexes', label: 'Anexos' }, { id: 'rasgos', label: 'Rasgos' }, { id: 'preview', label: 'Preview' }] as const;
type View = typeof nav[number]['id'];
const stateKey = `seaes-ui-v5:${location.pathname}`;
function loadUI(): { view: View; query: string; filters: Filters } {
  try { const state = JSON.parse(sessionStorage.getItem(stateKey) ?? '{}'); return { view: nav.some(n => n.id === state.view) ? state.view : 'dashboard', query: typeof state.query === 'string' ? state.query : '', filters: { ...cleanFilters, ...state.filters } }; } catch { return { view: 'dashboard', query: '', filters: { ...cleanFilters } }; }
}
const initialUI = loadUI();

export function App() {
  const workspace = useWorkspace(); const { schema, session, busy, ready, error, notice } = workspace;
  const [view, setView] = useState<View>(initialUI.view); const [query, setQuery] = useState(initialUI.query); const [filters, setFilters] = useState<Filters>(initialUI.filters);
  const [importing, setImporting] = useState(false); const [editor, setEditor] = useState<{ record?: SeaesRecord; sourceId?: string }>(); const [detailId, setDetailId] = useState<string>();
  const [exporting, setExporting] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [referenceKind, setReferenceKind] = useState<ReferenceKind>('all');
  const [indicatorMode, setIndicatorMode] = useState<'all' | 'masters'>('all');
  const [chartDimension, setChartDimension] = useState<Exclude<DashboardDimension, 'examples'>>('all');
  const [hideNulls, setHideNulls] = useState(() => { try { return localStorage.getItem('seaes-hide-nulls') !== 'false'; } catch { return true; } });
  useEffect(() => { try { localStorage.setItem('seaes-hide-nulls', String(hideNulls)); } catch { /* Optional display preference. */ } }, [hideNulls]);
  const [showSearch, setShowSearch] = useState(false);
  const [confirmation, setConfirmation] = useState<{ title: string; text: string; action: () => void; label: string }>();
  useEffect(() => { try { sessionStorage.setItem(stateKey, JSON.stringify({ view, query, filters })); } catch { /* UI preferences are optional; session data has its own error feedback. */ } }, [view, query, filters]);
  const groups = useMemo(() => schema ? consolidate(session.records, schema, session.decisions) : [], [schema, session.records, session.decisions]);
  const filtered = useMemo(() => schema ? filterGroups(groups, schema, session.sources, filters, query) : [], [groups, schema, session.sources, filters, query]);
  const detail = groups.find(g => g.id === detailId);
  const pending = groups.filter(g => g.conflicts.some(c => !c.resolved)).length;
  const reset = () => { setFilters({ ...cleanFilters }); setQuery(''); setIndicatorMode('all'); setReferenceKind('all'); setHideNulls(true); };
  const updateFilter = (key: keyof Filters, value: string) => setFilters(previous => ({ ...previous, [key]: value, groupIds: undefined }));
  const source = session.sources.find(item => item.id === filters.source);
  const scopedSources = session.sources.filter(item => !filters.source || item.id === filters.source);
  const isMaster = (g: (typeof groups)[number]) => /maestr[ií]a|posgrado/i.test([g.section.sheet, g.section.label, g.section.rows.find(row => row.id === g.resolved.rowId)?.label ?? '', ...g.section.indicators.map(id => schema?.indicators?.find(v => v.id === id)?.label ?? '')].join(' '));
  const indicatorGroups = filtered.filter(g => g.section.kind !== 'annex' && (indicatorMode === 'all' || isMaster(g)));
  const openFiltered = (next: DashboardRecordFilter) => { setFilters(previous => ({ ...previous, groupIds: next.groupIds, source: next.source ?? previous.source, indicator: next.indicator ?? previous.indicator, status: next.status && next.status !== 'all' ? next.status : previous.status })); setView(next.groupIds?.length && next.groupIds.every(id => groups.find(g => g.id === id)?.section.kind === 'annex') ? 'annexes' : 'indicators'); setIndicatorMode('all'); };
  const clearSession = () => setConfirmation({ title: 'Limpiar sesión', text: 'Se eliminarán todas las fuentes, capturas y decisiones del navegador. No se puede deshacer.', label: 'Limpiar sesión', action: () => { void workspace.clearSession(); reset(); setView('dashboard'); } });
  const openRecords = (next: Partial<Filters>) => { setFilters({ ...cleanFilters, ...next }); setQuery(''); setView('indicators'); setIndicatorMode('all'); };
  const deleteRecords = (records: SeaesRecord[]) => setConfirmation({ title: 'Eliminar registros', text: `Se eliminarán ${records.length} aportaciones de la sesión. Los archivos originales se conservan.`, label: 'Eliminar registros', action: () => { workspace.deleteRecords(records); setDetailId(undefined); } });
  const importAction = () => setImporting(true);
  const activeFilters = Object.values(filters).filter(value => Array.isArray(value) ? value.length : !!value).length + (indicatorMode !== 'all' ? 1 : 0) + (referenceKind !== 'all' ? 1 : 0);
  if (!schema || !ready) return <div className="loading-screen"><div className="brand-mark"><ExcelIcon size={46}/></div><h1>SEAES · UTSJR</h1>{busy && <LoaderCircle className="spin"/>}<p role={error ? 'alert' : 'status'}>{busy || error}</p>{!busy && <button className="button primary" onClick={() => location.reload()}>Volver a cargar</button>}</div>;
  return <div className="app-shell"><header className="app-header unified-navbar compact-navbar">
    <a className="brand" href="#dashboard" onClick={e => { e.preventDefault(); setView('dashboard'); }}><img className="ut-navbar-logo" src={`${import.meta.env.BASE_URL}ut-logo.svg`} width={180} height={34} alt="Universidad Tecnológica de San Juan del Río"/><span className="brand-name">SEAES</span></a>
    <SlidingNav items={nav} activeId={view} onSelect={id => setView(id as View)}/>
    <div className="nav-utilities">
      {showSearch && view !== 'preview' && <SearchField value={query} onChange={setQuery} label="Buscar en sección" placeholder="Buscar…"/>}
      {view !== 'preview' && <button className={`nav-tool ${activeFilters ? 'has-filters' : ''}`} onClick={()=>setAdvanced(true)} title="Filtros" aria-label="Abrir filtros"><Filter size={18}/>{!!activeFilters && <span className="filter-dot"/>}</button>}
      <button className="nav-tool" disabled={!!busy} onClick={importAction} title="Importar Excel" aria-label="Importar Excel"><Upload size={18}/></button>
      <button className="nav-tool" disabled={!!busy} onClick={()=>setExporting(true)} title="Exportar" aria-label="Exportar"><Download size={18}/></button>
      <button className="nav-tool" disabled={!!busy} onClick={()=>setEditor({ sourceId: filters.source || undefined })} title="Agregar registro" aria-label="Agregar registro"><Plus size={18}/></button>
      <button className="nav-tool danger-tool" disabled={!!busy || !(session.sources.length || session.records.length || Object.keys(session.decisions).length)} onClick={clearSession} title="Limpiar toda la sesión" aria-label="Limpiar toda la sesión"><Trash2 size={18}/></button>
    </div></header>
    <main className="workspace" id="main">
      <div className="feedback" aria-live="polite">{busy && <div className="message processing" role="status"><LoaderCircle size={18} className="spin"/>{busy}</div>}{error && <div className="message error" role="alert"><span>{error}</span><button className="icon-button" aria-label="Cerrar error" onClick={() => workspace.setError('')}><X size={17}/></button></div>}{notice && <div className="message success" role="status"><CheckCircle2 size={17}/><span>{notice}</span><button className="icon-button" aria-label="Cerrar aviso" onClick={() => workspace.setNotice('')}><X size={17}/></button></div>}</div>
      <AnimatedScreen screen={view}>
      {view === 'dashboard' && <><Dashboard schema={schema} groups={filtered} sources={scopedSources} dimension={chartDimension} onDimension={setChartDimension} hideNulls={hideNulls} onImport={importAction} onRecord={group=>setDetailId(group.id)} onRecords={openFiltered}/>
      <FilesScreen schema={schema} sources={session.sources} records={session.records} groups={groups} busy={busy} globalQuery={query} filteredSourceId={filters.source} onEdit={record=>setEditor({record})} onDeleteRecords={deleteRecords} onAdd={sourceId=>setEditor({sourceId})} onRename={(old,name)=>workspace.setSession(s=>({...s,sources:s.sources.map(item=>item.id===old.id?{...item,name}:item)}))} onDelete={old=>setConfirmation({title:'Eliminar fuente',text:`Se eliminarán «${old.name}» y sus aportaciones de la sesión.`,label:'Eliminar fuente',action:()=>{void workspace.removeSources([old.id]);if(filters.source===old.id)reset();}})}/></>}
      {(view === 'examples' || view === 'rasgos') && <ReferenceScreen schema={schema} kind={referenceKind} query={query} indicator={filters.indicator} sourceName={source?.name} isRasgos={view === 'rasgos'} relatedRecords={filtered.length}/>}
      {view === 'indicators' && <RecordCards schema={schema} groups={indicatorGroups} sources={session.sources} kind="indicators" onDetail={g=>setDetailId(g.id)} onEdit={record=>setEditor({record})} onDelete={deleteRecords}/>}
      {view === 'annexes' && <RecordCards schema={schema} groups={filtered} sources={session.sources} kind="annexes" onDetail={g=>setDetailId(g.id)} onEdit={record=>setEditor({record})} onDelete={deleteRecords}/>}
      {view === 'preview' && <WorkbookPreview schema={schema} groups={groups} onEditCell={workspace.editPreview} onExportExcel={()=>setExporting(true)}/>}
      </AnimatedScreen>
    <footer className="workspace-footer">© 2026 Kurt Cobain Vazquez Sanchez. All rights reserved. | Software Engineering Student</footer></main>
    <WorkspaceContextMenu hideNulls={hideNulls} setHideNulls={setHideNulls}
      onFilters={()=>setAdvanced(true)} onReset={reset} onImport={importAction} onExport={()=>setExporting(true)}
      onAdd={()=>setEditor({ sourceId: filters.source || undefined })} onClear={clearSession}
      canClear={!!(session.sources.length || session.records.length || Object.keys(session.decisions).length)}
      onSearch={()=>{setShowSearch(true);requestAnimationFrame(()=>document.querySelector<HTMLInputElement>('.app-header input[type="search"]')?.focus());}}/>
    {advanced && <Dialog title="Filtros" onClose={()=>setAdvanced(false)}><div className="dialog-body filter-grid">
      <label>Fuente<select value={filters.source} onChange={e=>updateFilter('source',e.target.value)}><option value="">Todos los archivos</option>{session.sources.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      <label>Indicador<select value={filters.indicator} onChange={e=>updateFilter('indicator',e.target.value)}><option value="">Todos los indicadores</option>{[...new Set(schema.sections.flatMap(s=>s.indicators))].sort((a,b)=>a-b).map(id=><option key={id} value={id}>Indicador {String(id).padStart(2,'0')}</option>)}</select></label>
      <label>Estado<select value={filters.status} onChange={e=>updateFilter('status',e.target.value)}><option value="">Todos los estados</option><option value="unique">Únicos</option><option value="duplicates">Duplicados</option><option value="conflicts">Conflictos</option><option value="pending">Conflictos pendientes</option><option value="complementary">Complementarios</option></select></label>
      <label>Criterio<select value={filters.criterion} onChange={e=>updateFilter('criterion',e.target.value)}><option value="">Todos los criterios</option>{schema.criteria.map(v=><option key={v.id} value={v.id}>{v.label}</option>)}</select></label>
      <label>Programa educativo<input value={filters.programme} onChange={e=>updateFilter('programme',e.target.value)}/></label>
      <label>Periodo<input value={filters.period} onChange={e=>updateFilter('period',e.target.value)}/></label>
      <label className="nav-hide-nulls"><input type="checkbox" checked={hideNulls} onChange={e=>setHideNulls(e.target.checked)}/>Ocultar categorías sin datos</label>
      {view === 'indicators' && <label>Nivel<select value={indicatorMode} onChange={e=>setIndicatorMode(e.target.value as typeof indicatorMode)}><option value="all">Todos los niveles</option><option value="masters">Maestría</option></select></label>}
      {view === 'examples' && <label>Material<select value={referenceKind} onChange={e=>setReferenceKind(e.target.value as ReferenceKind)}><option value="all">Todo el material</option><option value="indicaciones">Indicaciones</option><option value="cambios">Cambios</option><option value="ejemplos">Ejemplos</option></select></label>}
    </div><div className="dialog-footer"><button className="button secondary" onClick={reset}>Restablecer</button><button className="button primary" onClick={()=>setAdvanced(false)}>Aplicar</button></div></Dialog>}
    {importing && <ImportDialog onClose={() => setImporting(false)} onImport={items => { setImporting(false); void workspace.importFiles(items); }}/>}
    {editor && <RecordEditor schema={schema} record={editor.record} sourceName={session.sources.find(item => item.id === (editor.sourceId ?? editor.record?.sourceId))?.name} onClose={() => setEditor(undefined)} onSave={data => { workspace.saveRecord(data, editor.record, editor.sourceId); setEditor(undefined); }}/>}
    {detail && <RecordDetail group={detail} sources={session.sources} decisions={session.decisions} onDecision={(id, decision) => workspace.setSession(s => ({ ...s, decisions: { ...s.decisions, [id]: decision } }))} onClose={() => setDetailId(undefined)} onEdit={record => { setDetailId(undefined); setEditor({ record }); }} onDelete={record => deleteRecords([record])}/>}
    {confirmation && <Dialog title={confirmation.title} onClose={() => setConfirmation(undefined)}><div className="dialog-body"><p>{confirmation.text}</p></div><div className="dialog-footer"><button autoFocus className="button secondary" onClick={() => setConfirmation(undefined)}>Cancelar</button><button className="button danger solid" onClick={() => { confirmation.action(); setConfirmation(undefined); }}>{confirmation.label}</button></div></Dialog>}
    {workspace.importSummary && <Dialog title="Importación completada" onClose={() => workspace.setImportSummary(undefined)}><div className="dialog-body import-summary">{workspace.importSummary.map(item => { const source = session.sources.find(s => s.id === item.id); return <div key={item.id} className="import-summary-row"><div><strong>{item.name}</strong><small className={!source ? 'duplicate-notice' : undefined}>{source?.filename ?? item.message}</small></div><span>{item.records} registros</span>{!!source?.warnings.length && <details><summary>{source.warnings.length} advertencias</summary><ul>{source.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul></details>}</div>; })}</div><div className="dialog-footer"><button className="button secondary" onClick={() => workspace.setImportSummary(undefined)}>Cerrar</button><button className="button primary" onClick={() => { workspace.setImportSummary(undefined); openRecords({}); }}>Ver aportaciones</button></div></Dialog>}
    {exporting && <ExportDialog records={groups.length} sources={session.sources.length} pending={pending} onClose={()=>setExporting(false)} onReview={()=>{setExporting(false);openRecords({status:'pending'});}} onExport={()=>{setExporting(false);void workspace.download();}} onPreview={()=>{setExporting(false);setView('preview');}}/>}
    {workspace.exportReport && <ExportResult report={workspace.exportReport} onClose={() => workspace.setExportReport(undefined)}/>}
  </div>;
}
