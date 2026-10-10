import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, LoaderCircle, Plus, Trash2, X } from 'lucide-react';
import type { SeaesRecord } from './models/types';
import { consolidate } from './services/consolidation';
import { useWorkspace } from './hooks/useWorkspace';
import { Dashboard } from './features/dashboard/Dashboard';
import { FilesScreen } from './features/files/FilesScreen';
import { ExportDialog, ExportResult } from './features/files/ExportDialog';
import { cleanFilters, filterGroups, type Filters } from './features/records/filters';
import { RecordFilters } from './features/records/RecordFilters';
import { RecordsTable } from './components/RecordsTable';
import { Dialog } from './components/Dialog';
import { ImportDialog } from './components/ImportDialog';
import { RecordEditor } from './components/RecordEditor';
import { RecordDetail } from './components/RecordDetail';
import { SearchField } from './components/SearchField';
import { ExcelIcon } from './components/ExcelIcon';

const nav = [{ id: 'dashboard', label: 'Dashboard' }, { id: 'records', label: 'Registros' }, { id: 'files', label: 'Archivos' }] as const;
type View = typeof nav[number]['id'];
const stateKey = `seaes-ui-v2:${location.pathname}`;
function loadUI(): { view: View; query: string; filters: Filters } {
  try { const state = JSON.parse(sessionStorage.getItem(stateKey) ?? '{}'); return { view: nav.some(n => n.id === state.view) ? state.view : 'dashboard', query: typeof state.query === 'string' ? state.query : '', filters: { ...cleanFilters, ...state.filters } }; } catch { return { view: 'dashboard', query: '', filters: { ...cleanFilters } }; }
}
const initialUI = loadUI();

export function App() {
  const workspace = useWorkspace(); const { schema, session, busy, ready, error, notice } = workspace;
  const [view, setView] = useState<View>(initialUI.view); const [query, setQuery] = useState(initialUI.query); const [filters, setFilters] = useState<Filters>(initialUI.filters);
  const [importing, setImporting] = useState(false); const [editor, setEditor] = useState<{ record?: SeaesRecord }>(); const [detailId, setDetailId] = useState<string>();
  const [exporting, setExporting] = useState<'full' | 'simplified'>();
  const [confirmation, setConfirmation] = useState<{ title: string; text: string; action: () => void; label: string }>();
  useEffect(() => { try { sessionStorage.setItem(stateKey, JSON.stringify({ view, query, filters })); } catch { /* UI preferences are optional; session data has its own error feedback. */ } }, [view, query, filters]);
  const groups = useMemo(() => schema ? consolidate(session.records, schema, session.decisions) : [], [schema, session.records, session.decisions]);
  const filtered = useMemo(() => schema ? filterGroups(groups, schema, session.sources, filters, query) : [], [groups, schema, session.sources, filters, query]);
  const detail = groups.find(g => g.id === detailId);
  const demoSources = session.sources.filter(s => s.kind === 'demo'); const pending = groups.filter(g => g.conflicts.some(c => !c.resolved)).length;
  const reset = () => { setFilters({ ...cleanFilters }); setQuery(''); };
  const openRecords = (next: Partial<Filters>) => { setFilters({ ...cleanFilters, ...next }); setQuery(''); setView('records'); };
  const deleteRecords = (records: SeaesRecord[]) => setConfirmation({ title: 'Eliminar registros', text: `Se eliminarán ${records.length} aportaciones de la sesión. Los archivos originales se conservan.`, label: 'Eliminar registros', action: () => { workspace.deleteRecords(records); setDetailId(undefined); } });
  const importAction = () => { setView('files'); setImporting(true); };
  if (!schema || !ready) return <div className="loading-screen"><div className="brand-mark"><ExcelIcon size={46}/></div><h1>SEAES · UTSJR</h1>{busy && <LoaderCircle className="spin"/>}<p role={error ? 'alert' : 'status'}>{busy || error}</p>{!busy && <button className="button primary" onClick={() => location.reload()}>Volver a cargar</button>}</div>;
  return <div className="app-shell"><header className="app-header"><a className="brand" href="#dashboard" onClick={event => { event.preventDefault(); setView('dashboard'); }}><img className="ut-navbar-logo" src={`${import.meta.env.BASE_URL}ut-logo.svg`} width={180} height={34} alt="Universidad Tecnológica de San Juan del Río"/><span className="brand-name">SEAES</span></a><nav aria-label="Principal">{nav.map(({ id, label }) => <button key={id} className={`nav-item ${view === id ? 'active' : ''}`} aria-current={view === id ? 'page' : undefined} onClick={() => setView(id)}>{label}</button>)}</nav><div className="header-search"><SearchField value={query} onChange={value => { setQuery(value); if (value) { setFilters({ ...cleanFilters }); setView('records'); } }} label="Buscar en todo el consolidado" placeholder="Buscar en el consolidado…"/></div><button className="button secondary clear-session-button" disabled={!!busy || !(session.sources.length || session.records.length || Object.keys(session.decisions).length)} onClick={() => setConfirmation({ title: 'Limpiar sesión', text: 'Se eliminarán todas las fuentes, registros, capturas y decisiones guardadas en este navegador. Esta acción no puede deshacerse.', label: 'Limpiar sesión', action: () => { void workspace.clearSession(); reset(); setView('dashboard'); } })}><Trash2 size={16}/>Limpiar sesión</button></header>
    <main className="workspace" id="main">
    <div className="feedback" aria-live="polite">{busy && <div className="message processing" role="status"><LoaderCircle size={18} className="spin"/>{busy}</div>}{error && <div className="message error" role="alert"><span>{error}</span><button className="icon-button" aria-label="Cerrar error" onClick={() => workspace.setError('')}><X size={17}/></button></div>}{notice && <div className="message success" role="status"><CheckCircle2 size={17}/><span>{notice}</span><button className="icon-button" aria-label="Cerrar aviso" onClick={() => workspace.setNotice('')}><X size={17}/></button></div>}</div>
    {view === 'dashboard' && <Dashboard schema={schema} groups={groups} sources={session.sources} busy={busy} onImport={importAction} onDemo={() => void workspace.useDemo()} onRecord={group => setDetailId(group.id)} onRecords={next => openRecords(next)}/>}
    {view === 'records' && <><div className="screen-actions"><RecordFilters schema={schema} sources={session.sources} filters={filters} onChange={setFilters}/><button className="button primary" disabled={!!busy} onClick={() => setEditor({})}><Plus size={17}/>Agregar registro</button></div>{query && <div className="query-caption">Resultados para <strong>«{query}»</strong><button className="button text small" onClick={() => setQuery('')}>Quitar búsqueda</button></div>}<RecordsTable schema={schema} groups={filtered} sources={session.sources} onDetail={group => setDetailId(group.id)} onEdit={record => setEditor({ record })} onDelete={deleteRecords}/></>}
    {view === 'files' && <FilesScreen schema={schema} sources={session.sources} groups={groups} busy={busy} onImport={importAction} onDemo={() => void workspace.useDemo()} onExport={setExporting} onRecords={source => openRecords({ source })} onDelete={source => setConfirmation({ title: 'Eliminar fuente', text: `Se eliminarán «${source.name}» y sus aportaciones de la sesión.`, label: 'Eliminar fuente', action: () => { void workspace.removeSources([source.id]); reset(); } })} onRemoveDemo={() => setConfirmation({ title: 'Eliminar datos ficticios', text: `Se eliminarán las ${demoSources.length} fuentes ficticias y sus ediciones. Se conservarán archivos reales y capturas manuales.`, label: 'Eliminar datos ficticios', action: () => { void workspace.removeSources(demoSources.map(s => s.id)); reset(); } })}}/>}
    <footer className="workspace-footer"><span>Universidad Tecnológica de San Juan del Río</span><span>SEAES · Procesamiento local</span><span className="theme-credit">Diseño inspirado en <a href="https://templatemo.com/tm-633-celadon" target="_blank" rel="noopener noreferrer">Celadon · TemplateMo</a></span></footer></main>
    {importing && <ImportDialog onClose={() => setImporting(false)} onImport={items => { setImporting(false); void workspace.importFiles(items); }}/>}
    {editor && <RecordEditor schema={schema} record={editor.record} onClose={() => setEditor(undefined)} onSave={data => { workspace.saveRecord(data, editor.record); setEditor(undefined); }}/>}
    {detail && <RecordDetail group={detail} sources={session.sources} decisions={session.decisions} onDecision={(id, decision) => workspace.setSession(s => ({ ...s, decisions: { ...s.decisions, [id]: decision } }))} onClose={() => setDetailId(undefined)} onEdit={record => { setDetailId(undefined); setEditor({ record }); }} onDelete={record => deleteRecords([record])}/>}
    {confirmation && <Dialog title={confirmation.title} onClose={() => setConfirmation(undefined)}><div className="dialog-body"><p>{confirmation.text}</p></div><div className="dialog-footer"><button autoFocus className="button secondary" onClick={() => setConfirmation(undefined)}>Cancelar</button><button className="button danger solid" onClick={() => { confirmation.action(); setConfirmation(undefined); }}>{confirmation.label}</button></div></Dialog>}
    {workspace.importSummary && <Dialog title="Importación completada" onClose={() => workspace.setImportSummary(undefined)}><div className="dialog-body import-summary">{workspace.importSummary.map(item => { const source = session.sources.find(s => s.id === item.id); return <div key={item.id} className="import-summary-row"><div><strong>{item.name}</strong><small className={!source ? 'duplicate-notice' : undefined}>{source?.filename ?? item.message}</small></div><span>{item.records} registros</span>{!!source?.warnings.length && <details><summary>{source.warnings.length} advertencias</summary><ul>{source.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul></details>}</div>; })}</div><div className="dialog-footer"><button className="button secondary" onClick={() => workspace.setImportSummary(undefined)}>Cerrar</button><button className="button primary" onClick={() => { workspace.setImportSummary(undefined); openRecords({}); }}>Ver registros</button></div></Dialog>}
    {exporting && <ExportDialog initialMode={exporting} records={groups.length} sources={session.sources.length} demoSources={demoSources.length} pending={pending} onClose={() => setExporting(undefined)} onReview={() => { setExporting(undefined); openRecords({ status: 'pending' }); }} onExport={mode => { setExporting(undefined); void workspace.download(mode); }}/>}
    {workspace.exportReport && <ExportResult report={workspace.exportReport} onClose={() => workspace.setExportReport(undefined)}/>}
  </div>;
}
