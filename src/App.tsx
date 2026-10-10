import { useEffect, useMemo, useState } from 'react';
import { BarChart3, CheckCircle2, Download, Filter, FlaskConical, LoaderCircle, Plus, RotateCcw, Trash2, Upload, X } from 'lucide-react';
import type { SeaesRecord } from './models/types';
import { consolidate } from './services/consolidation';
import { useWorkspace } from './hooks/useWorkspace';
import { Dashboard, dashboardDimensions } from './features/dashboard/Dashboard';
import type { DashboardDimension, DashboardRecordFilter } from './features/dashboard/analytics';
import { ReferenceScreen, type ReferenceKind } from './features/references/ReferenceScreen';
import { AnnexAccordion } from './features/dashboard/AnnexAccordion';
import { FilesScreen } from './features/files/FilesScreen';
import { ExportDialog, ExportResult } from './features/files/ExportDialog';
import { cleanFilters, filterGroups, type Filters } from './features/records/filters';
import { RecordsTable } from './components/RecordsTable';
import { Dialog } from './components/Dialog';
import { ImportDialog } from './components/ImportDialog';
import { RecordEditor } from './components/RecordEditor';
import { RecordDetail } from './components/RecordDetail';
import { SearchField } from './components/SearchField';
import { ExcelIcon } from './components/ExcelIcon';

const nav = [{ id: 'dashboard', label: 'Dashboard' }, { id: 'examples', label: 'Ejemplos' }, { id: 'indicators', label: 'Indicadores' }, { id: 'annexes', label: 'Anexos y rasgos' }] as const;
type View = typeof nav[number]['id'];
const stateKey = `seaes-ui-v4:${location.pathname}`;
function loadUI(): { view: View; query: string; filters: Filters } {
  try { const state = JSON.parse(sessionStorage.getItem(stateKey) ?? '{}'); return { view: nav.some(n => n.id === state.view) ? state.view : 'dashboard', query: typeof state.query === 'string' ? state.query : '', filters: { ...cleanFilters, ...state.filters } }; } catch { return { view: 'dashboard', query: '', filters: { ...cleanFilters } }; }
}
const initialUI = loadUI();

export function App() {
  const workspace = useWorkspace(); const { schema, session, busy, ready, error, notice } = workspace;
  const [view, setView] = useState<View>(initialUI.view); const [query, setQuery] = useState(initialUI.query); const [filters, setFilters] = useState<Filters>(initialUI.filters);
  const [importing, setImporting] = useState(false); const [editor, setEditor] = useState<{ record?: SeaesRecord }>(); const [detailId, setDetailId] = useState<string>();
  const [exporting, setExporting] = useState<'full' | 'simplified'>();
  const [advanced, setAdvanced] = useState(false);
  const [referenceKind, setReferenceKind] = useState<ReferenceKind>('all');
  const [indicatorMode, setIndicatorMode] = useState<'all' | 'masters'>('all');
  const [annexMode, setAnnexMode] = useState<'annexes' | 'rasgos'>('annexes');
  const [annexSheet, setAnnexSheet] = useState<string | null>(null);
  const [chartDimension, setChartDimension] = useState<Exclude<DashboardDimension, 'examples'>>('all');
  const [chartMode, setChartMode] = useState<'bars' | 'donut'>('bars');
  const [hideNulls, setHideNulls] = useState(false);
  const [confirmation, setConfirmation] = useState<{ title: string; text: string; action: () => void; label: string }>();
  useEffect(() => { try { sessionStorage.setItem(stateKey, JSON.stringify({ view, query, filters })); } catch { /* UI preferences are optional; session data has its own error feedback. */ } }, [view, query, filters]);
  const groups = useMemo(() => schema ? consolidate(session.records, schema, session.decisions) : [], [schema, session.records, session.decisions]);
  const filtered = useMemo(() => schema ? filterGroups(groups, schema, session.sources, filters, query) : [], [groups, schema, session.sources, filters, query]);
  const detail = groups.find(g => g.id === detailId);
  const demoSources = session.sources.filter(s => s.kind === 'demo'); const pending = groups.filter(g => g.conflicts.some(c => !c.resolved)).length;
  const reset = () => { setFilters({ ...cleanFilters }); setQuery(''); setAnnexSheet(null); };
  const updateFilter = (key: keyof Filters, value: string) => setFilters(previous => ({ ...previous, [key]: value, groupIds: undefined }));
  const source = session.sources.find(item => item.id === filters.source);
  const scopedSources = session.sources.filter(item => !filters.source || item.id === filters.source);
  const isMaster = (g: (typeof groups)[number]) => /maestr[ií]a|posgrado/i.test([g.section.sheet, g.section.label, ...g.section.indicators.map(id => schema?.indicators?.find(v => v.id === id)?.label ?? '')].join(' '));
  const indicatorGroups = filtered.filter(g => g.section.kind !== 'annex' && (indicatorMode === 'all' || isMaster(g)));
  const annexGroups = filtered.filter(g => g.section.kind === 'annex' && (!annexSheet || g.section.sheet === annexSheet));
  const openFiltered = (next: DashboardRecordFilter) => { setFilters(previous => ({ ...previous, groupIds: next.groupIds, source: next.source ?? previous.source, indicator: next.indicator ?? previous.indicator, status: next.status && next.status !== 'all' ? next.status : previous.status })); setView(next.groupIds?.length && next.groupIds.every(id => groups.find(g => g.id === id)?.section.kind === 'annex') ? 'annexes' : 'indicators'); setAnnexSheet(null); setIndicatorMode('all'); setAnnexMode('annexes'); };
  const clearSession = () => setConfirmation({ title: 'Limpiar sesión', text: 'Se eliminarán todas las fuentes, capturas y decisiones del navegador. No se puede deshacer.', label: 'Limpiar sesión', action: () => { void workspace.clearSession(); reset(); setView('dashboard'); } });
  const removeDemo = () => setConfirmation({ title: 'Eliminar datos ficticios', text: `Se eliminarán ${demoSources.length} fuentes ficticias. Se conservan las reales.`, label: 'Eliminar datos ficticios', action: () => { void workspace.removeSources(demoSources.map(s => s.id)); reset(); } });
  const openRecords = (next: Partial<Filters>) => { setFilters(previous => ({ ...previous, ...next })); setQuery(''); setView('indicators'); setIndicatorMode('all'); setAnnexSheet(null); };
  const deleteRecords = (records: SeaesRecord[]) => setConfirmation({ title: 'Eliminar registros', text: `Se eliminarán ${records.length} aportaciones de la sesión. Los archivos originales se conservan.`, label: 'Eliminar registros', action: () => { workspace.deleteRecords(records); setDetailId(undefined); } });
  const importAction = () => setImporting(true);
  if (!schema || !ready) return <div className="loading-screen"><div className="brand-mark"><ExcelIcon size={46}/></div><h1>SEAES · UTSJR</h1>{busy && <LoaderCircle className="spin"/>}<p role={error ? 'alert' : 'status'}>{busy || error}</p>{!busy && <button className="button primary" onClick={() => location.reload()}>Volver a cargar</button>}</div>;
  return <div className="app-shell"><header className="app-header unified-navbar">
    <a className="brand" href="#dashboard" onClick={e => { e.preventDefault(); setView('dashboard'); }}><img className="ut-navbar-logo" src={`${import.meta.env.BASE_URL}ut-logo.svg`} width={180} height={34} alt="Universidad Tecnológica de San Juan del Río"/><span className="brand-name">SEAES</span></a>
    <nav aria-label="Secciones">{nav.map(({ id, label }) => <button key={id} className={`nav-item ${view === id ? 'active' : ''}`} aria-current={view === id ? 'page' : undefined} onClick={() => setView(id)}>{label}</button>)}</nav>
    <div className="nav-utilities">
      <select className="nav-filter" aria-label="Filtrar por archivo" title={source?.name ?? 'Todos los archivos'} value={filters.source} onChange={e => updateFilter('source',e.target.value)}><option value="">Todos los archivos</option>{session.sources.map(s=><option key={s.id} value={s.id}>{s.name.slice(0,38)}</option>)}</select>
      <select className="nav-filter nav-index" aria-label="Filtrar por índice" value={filters.indicator} onChange={e => updateFilter('indicator',e.target.value)}><option value="">Todos los índices</option>{[...new Set([...(schema.indicators??[]).map(i=>i.id),...schema.sections.flatMap(s=>s.indicators)])].sort((a,b)=>a-b).map(id=><option key={id} value={id}>Indicador {String(id).padStart(2,'0')}</option>)}</select>
      {view === 'examples' && <select className="nav-filter nav-context" aria-label="Tipo de referencia" value={referenceKind} onChange={e=>setReferenceKind(e.target.value as ReferenceKind)}><option value="all">Todo el material</option><option value="indicaciones">Indicaciones</option><option value="cambios">Cambios</option><option value="ejemplos">Ejemplos</option></select>}
      {view === 'indicators' && <select className="nav-filter nav-context" aria-label="Subsección de indicadores" value={indicatorMode} onChange={e=>setIndicatorMode(e.target.value as typeof indicatorMode)}><option value="all">Todos los indicadores</option><option value="masters">Maestría</option></select>}
      {view === 'annexes' && <select className="nav-filter nav-context" aria-label="Subsección de anexos y rasgos" value={annexMode} onChange={e=>setAnnexMode(e.target.value as typeof annexMode)}><option value="annexes">Anexos</option><option value="rasgos">Rasgos</option></select>}
      {view === 'dashboard' && <><select className="nav-filter nav-context" aria-label="Categoría de gráfica" value={chartDimension} onChange={e=>setChartDimension(e.target.value as Exclude<DashboardDimension,'examples'>)}>{dashboardDimensions.map(x=><option key={x.id} value={x.id}>{x.label}</option>)}</select><button className="nav-tool" title={chartMode === 'bars' ? 'Mostrar anillo' : 'Mostrar barras'} aria-label="Cambiar tipo de gráfica" onClick={()=>setChartMode(m=>m==='bars'?'donut':'bars')}><BarChart3 size={17}/></button></>}
      <div className="header-search"><SearchField value={query} onChange={setQuery} label="Buscar en sección" placeholder="Buscar…"/></div>
      <button className="nav-tool" onClick={()=>setAdvanced(true)} title="Filtros adicionales" aria-label="Filtros adicionales"><Filter size={18}/></button>
      <button className="nav-tool" onClick={reset} title="Restablecer filtros" aria-label="Restablecer filtros"><RotateCcw size={17}/></button>
      <button className="nav-tool" disabled={!!busy} onClick={importAction} title="Importar Excel" aria-label="Importar Excel"><Upload size={18}/></button>
      <button className="nav-tool" disabled={!!busy} onClick={()=>setExporting('full')} title="Exportar Excel" aria-label="Exportar Excel"><Download size={18}/></button>
      <button className="nav-tool" disabled={!!busy} onClick={()=>setEditor({})} title="Agregar registro" aria-label="Agregar registro"><Plus size={18}/></button>
      {!demoSources.length ? <button className="nav-tool" disabled={!!busy} onClick={()=>void workspace.useDemo()} title="Cargar datos ficticios" aria-label="Cargar datos ficticios"><FlaskConical size={18}/></button> : <button className="nav-tool" disabled={!!busy} onClick={removeDemo} title="Eliminar datos ficticios" aria-label="Eliminar datos ficticios"><FlaskConical size={18}/><X size={11}/></button>}
      <button className="nav-tool danger-tool" disabled={!!busy || !(session.sources.length || session.records.length || Object.keys(session.decisions).length)} onClick={clearSession} title="Limpiar toda la sesión" aria-label="Limpiar toda la sesión"><Trash2 size={18}/></button>
    </div></header>
    <main className="workspace" id="main">
      <div className="feedback" aria-live="polite">{busy && <div className="message processing" role="status"><LoaderCircle size={18} className="spin"/>{busy}</div>}{error && <div className="message error" role="alert"><span>{error}</span><button className="icon-button" aria-label="Cerrar error" onClick={() => workspace.setError('')}><X size={17}/></button></div>}{notice && <div className="message success" role="status"><CheckCircle2 size={17}/><span>{notice}</span><button className="icon-button" aria-label="Cerrar aviso" onClick={() => workspace.setNotice('')}><X size={17}/></button></div>}</div>
      {view === 'dashboard' && <><Dashboard schema={schema} groups={filtered} sources={scopedSources} dimension={chartDimension} onDimension={setChartDimension} mode={chartMode} hideNulls={hideNulls} onImport={importAction} onRecord={group=>setDetailId(group.id)} onRecords={openFiltered}/><FilesScreen schema={schema} sources={session.sources} groups={filtered} busy={busy} globalQuery={query} filteredSourceId={filters.source} onRecords={id=>openRecords({source:id})} onRename={(old,name)=>workspace.setSession(s=>({...s,sources:s.sources.map(item=>item.id===old.id?{...item,name}:item)}))} onDelete={old=>setConfirmation({title:'Eliminar fuente',text:`Se eliminarán «${old.name}» y sus aportaciones de la sesión.`,label:'Eliminar fuente',action:()=>{void workspace.removeSources([old.id]);reset();}})}/></>}
    {view === 'examples' && <ReferenceScreen schema={schema} kind={referenceKind} query={query} indicator={filters.indicator} sourceName={source?.name} relatedRecords={filtered.length}/>}
    {view === 'indicators' && <section className="section-records"><div className="section-summary"><strong>{indicatorMode==='masters'?'Indicador de maestría':'Indicadores'}</strong><span>{indicatorGroups.length.toLocaleString('es-MX')} registros</span></div><RecordsTable schema={schema} groups={indicatorGroups} sources={session.sources} onDetail={g=>setDetailId(g.id)} onEdit={record=>setEditor({record})} onDelete={deleteRecords}/></section>}
    {view === 'annexes' && (annexMode==='rasgos' ? <ReferenceScreen schema={schema} kind="all" query={query} indicator={filters.indicator} sourceName={source?.name} isRasgos relatedRecords={filtered.length}/> : <div className="annex-workspace"><AnnexAccordion schema={schema} groups={filtered} activeSheet={annexSheet} onFilter={setAnnexSheet} onRecords={ids=>{const g=groups.find(x=>ids.includes(x.id));setAnnexSheet(g?.section.sheet??null);}}/><div className="section-summary"><strong>Registros de anexos</strong><span>{annexGroups.length.toLocaleString('es-MX')} registros</span></div><RecordsTable schema={schema} groups={annexGroups} sources={session.sources} onDetail={g=>setDetailId(g.id)} onEdit={record=>setEditor({record})} onDelete={deleteRecords}/></div>)}
    <footer className="workspace-footer"><span>Universidad Tecnológica de San Juan del Río</span><span>SEAES · Procesamiento local</span><span className="theme-credit">Diseño inspirado en <a href="https://templatemo.com/tm-633-celadon" target="_blank" rel="noopener noreferrer">Celadon · TemplateMo</a></span></footer></main>
    {advanced && <Dialog title="Filtros para todas las secciones" onClose={()=>setAdvanced(false)}><div className="dialog-body filter-grid">
      <label>Archivo<select value={filters.source} onChange={e=>updateFilter('source',e.target.value)}><option value="">Todos los archivos</option>{session.sources.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      <label>Índice<select value={filters.indicator} onChange={e=>updateFilter('indicator',e.target.value)}><option value="">Todos los indicadores</option>{[...new Set(schema.sections.flatMap(s=>s.indicators))].sort((a,b)=>a-b).map(id=><option key={id} value={id}>Indicador {String(id).padStart(2,'0')}</option>)}</select></label>
      <label>Estado<select value={filters.status} onChange={e=>updateFilter('status',e.target.value)}><option value="">Todos los estados</option><option value="unique">Únicos</option><option value="duplicates">Duplicados</option><option value="conflicts">Conflictos</option><option value="pending">Conflictos pendientes</option><option value="complementary">Complementarios</option></select></label>
      <label>Criterio<select value={filters.criterion} onChange={e=>updateFilter('criterion',e.target.value)}><option value="">Todos los criterios</option>{schema.criteria.map(v=><option key={v.id} value={v.id}>{v.label}</option>)}</select></label>
      <label>Sección<select value={filters.section} onChange={e=>updateFilter('section',e.target.value)}><option value="">Todas las secciones</option>{schema.sections.map(v=><option key={v.id} value={v.id}>{v.sheet} · {v.label}</option>)}</select></label>
      <label>Tipo de archivo<select value={filters.kind} onChange={e=>updateFilter('kind',e.target.value)}><option value="">Todos</option><option value="real">Reales</option><option value="demo">Ficticios</option><option value="manual">Manuales</option></select></label>
      <label>Completitud<select value={filters.completeness} onChange={e=>updateFilter('completeness',e.target.value)}><option value="">Todos</option><option value="complete">Completos</option><option value="partial">Pendientes</option></select></label>
      <label>Programa educativo<input value={filters.programme} onChange={e=>updateFilter('programme',e.target.value)}/></label>
      <label>Periodo<input value={filters.period} onChange={e=>updateFilter('period',e.target.value)}/></label>
      <label className="nav-hide-nulls"><input type="checkbox" checked={hideNulls} onChange={e=>setHideNulls(e.target.checked)}/>Ocultar categorías sin datos</label>
    </div><div className="dialog-footer"><button className="button secondary" onClick={reset}>Restablecer</button><button className="button primary" onClick={()=>setAdvanced(false)}>Aplicar</button></div></Dialog>}
    {importing && <ImportDialog onClose={() => setImporting(false)} onImport={items => { setImporting(false); void workspace.importFiles(items); }}/>}
    {editor && <RecordEditor schema={schema} record={editor.record} onClose={() => setEditor(undefined)} onSave={data => { workspace.saveRecord(data, editor.record); setEditor(undefined); }}/>}
    {detail && <RecordDetail group={detail} sources={session.sources} decisions={session.decisions} onDecision={(id, decision) => workspace.setSession(s => ({ ...s, decisions: { ...s.decisions, [id]: decision } }))} onClose={() => setDetailId(undefined)} onEdit={record => { setDetailId(undefined); setEditor({ record }); }} onDelete={record => deleteRecords([record])}/>}
    {confirmation && <Dialog title={confirmation.title} onClose={() => setConfirmation(undefined)}><div className="dialog-body"><p>{confirmation.text}</p></div><div className="dialog-footer"><button autoFocus className="button secondary" onClick={() => setConfirmation(undefined)}>Cancelar</button><button className="button danger solid" onClick={() => { confirmation.action(); setConfirmation(undefined); }}>{confirmation.label}</button></div></Dialog>}
    {workspace.importSummary && <Dialog title="Importación completada" onClose={() => workspace.setImportSummary(undefined)}><div className="dialog-body import-summary">{workspace.importSummary.map(item => { const source = session.sources.find(s => s.id === item.id); return <div key={item.id} className="import-summary-row"><div><strong>{item.name}</strong><small className={!source ? 'duplicate-notice' : undefined}>{source?.filename ?? item.message}</small></div><span>{item.records} registros</span>{!!source?.warnings.length && <details><summary>{source.warnings.length} advertencias</summary><ul>{source.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul></details>}</div>; })}</div><div className="dialog-footer"><button className="button secondary" onClick={() => workspace.setImportSummary(undefined)}>Cerrar</button><button className="button primary" onClick={() => { workspace.setImportSummary(undefined); openRecords({}); }}>Ver registros</button></div></Dialog>}
    {exporting && <ExportDialog initialMode={exporting} records={groups.length} sources={session.sources.length} demoSources={demoSources.length} pending={pending} onClose={() => setExporting(undefined)} onReview={() => { setExporting(undefined); openRecords({ status: 'pending' }); }} onExport={mode => { setExporting(undefined); void workspace.download(mode); }}/>}
    {workspace.exportReport && <ExportResult report={workspace.exportReport} onClose={() => workspace.setExportReport(undefined)}/>}
  </div>;
}
