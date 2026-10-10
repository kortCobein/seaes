import { useCallback, useEffect, useRef, useState } from 'react';
import { emptySession, type DataSource, type ExportReport, type Scalar, type SeaesRecord, type WorkbookSchema, type WorkSession } from '../models/types';
import { buildDemo, consolidate } from '../services/consolidation';
import { clearOriginals, deleteOriginal, loadSession, saveSession, storeOriginal } from '../services/storage';
import { exportExcel, getAsset, parseExcel } from '../services/workerClient';

export interface ImportSummary { id: string; name: string; records: number; fields: number; message: string }
export function useWorkspace() {
  const [schema, setSchema] = useState<WorkbookSchema>(); const [session, setSession] = useState<WorkSession>(emptySession);
  const [busy, setBusy] = useState('Cargando estructura SEAES…'); const [ready, setReady] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [saved, setSaved] = useState(false);
  const [importSummary, setImportSummary] = useState<ImportSummary[]>(); const [exportReport, setExportReport] = useState<ExportReport>();
  const started = useRef(false); const queue = useRef(Promise.resolve());
  useEffect(() => { if (started.current) return; started.current = true;
    (async () => {
      try { const response = await fetch(`${import.meta.env.BASE_URL}data/schema.json`); if (!response.ok) throw new Error('No se encontró la estructura del formulario. Comprueba que se haya subido toda la carpeta dist.'); setSchema(await response.json());
        try { const stored = await loadSession(); if (stored?.version === 1 && Array.isArray(stored.records)) setSession(stored); } catch { setError('El navegador no permite guardar la sesión local. Puedes trabajar y exportar, pero los cambios no persistirán al cerrar.'); }
        setReady(true);
      } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo iniciar el sitio.'); } finally { setBusy(''); }
    })();
  }, []);
  useEffect(() => { if (!ready) return; setSaved(false); const timer = setTimeout(() => { queue.current = queue.current.then(async () => { try { await saveSession(session); setSaved(true); } catch { setError('No se pudo guardar la sesión en este navegador. Exporta antes de cerrar.'); } }); }, 300); return () => clearTimeout(timer); }, [session, ready]);
  const run = useCallback(async (label: string, action: () => Promise<void>) => { setBusy(label); setError(''); setNotice(''); try { await action(); } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo completar la operación.'); } finally { setBusy(''); } }, []);
  async function importFiles(items: { file: File; name: string }[]) { if (!schema) return; await run('Preparando importación…', async () => {
    const sources: DataSource[] = []; const records: SeaesRecord[] = []; const summary: ImportSummary[] = [];
    for (let index = 0; index < items.length; index++) {
      const item = items[index]; setBusy(`Analizando ${index + 1} de ${items.length}: ${item.name}`);
      const source: DataSource = { id: crypto.randomUUID(), name: item.name, filename: item.file.name, importedAt: new Date().toISOString(), kind: 'real', compatibility: 'compatible', warnings: [] };
      try {
        if (item.file.size > 40 * 1024 * 1024) throw new Error('El archivo supera el límite de 40 MB para procesamiento local.');
        const bytes = await item.file.arrayBuffer(); const result = await parseExcel(bytes, schema, source);
        sources.push(result.source); records.push(...result.records);
        try { await storeOriginal(source.id, bytes); } catch { result.source.warnings.push('No se pudo conservar el archivo original en el navegador. La información extraída permanece disponible.'); }
        summary.push({ id: source.id, name: source.name, records: result.records.length, fields: result.records.reduce((n, r) => n + Object.keys(r.values).length, 0), message: result.source.warnings.join(' ') || 'Compatible' });
      } catch (e) { const message = e instanceof Error ? e.message : 'Error de lectura'; sources.push({ ...source, compatibility: 'unknown', warnings: [message] }); summary.push({ id: source.id, name: source.name, records: 0, fields: 0, message }); }
    }
    setSession(s => ({ ...s, sources: [...s.sources, ...sources], records: [...s.records, ...records] })); setImportSummary(summary);
  }); }
  async function useDemo() { if (!schema || session.sources.some(s => s.kind === 'demo')) return; await run('Leyendo los datos ficticios proporcionados…', async () => {
    const source: DataSource = { id: 'demo-original', name: 'Datos ficticios', filename: schema.demoFile, importedAt: new Date().toISOString(), kind: 'demo', compatibility: 'compatible', warnings: [] };
    const result = await parseExcel(await getAsset('demo.xlsx'), schema, source, 'output'); const demo = buildDemo(result.records, schema);
    setSession(s => ({ ...s, records: [...s.records, ...demo.records], sources: [...s.sources, ...demo.sources] })); setNotice(`${demo.records.length} aportaciones cargadas en 14 fuentes ficticias.`);
  }); }
  async function removeSources(ids: string[]) { setSession(s => ({ ...s, sources: s.sources.filter(f => !ids.includes(f.id)), records: s.records.filter(r => !ids.includes(r.sourceId)), decisions: {} })); await Promise.all(ids.map(id => deleteOriginal(id).catch(() => {}))); setNotice('Fuentes eliminadas de esta sesión.'); }
  async function clearSession() { setSession(emptySession()); await clearOriginals().catch(() => {}); setNotice('Sesión vacía. Puedes importar tus archivos.'); }
  function saveRecord(data: { sectionId: string; rowId: string; values: Record<string, Scalar> }, record?: SeaesRecord) {
    setSession(s => {
      if (record) return { ...s, records: s.records.map(r => r.id === record.id ? { ...r, ...data, modifiedAt: new Date().toISOString() } : r), decisions: {} };
      const manual = s.sources.find(source => source.kind === 'manual') ?? { id: 'manual', name: 'Captura manual', filename: 'Captura en el sitio', importedAt: new Date().toISOString(), kind: 'manual', compatibility: 'compatible', warnings: [] } satisfies DataSource;
      const next: SeaesRecord = { ...data, id: crypto.randomUUID(), sourceId: manual.id, originalValues: { ...data.values }, origins: {} };
      return { ...s, sources: s.sources.some(source => source.id === manual.id) ? s.sources : [...s.sources, manual], records: [...s.records, next] };
    }); setNotice(record ? 'Registro actualizado. Se conserva su procedencia.' : 'Registro agregado al consolidado.');
  }
  function deleteRecords(records: SeaesRecord[]) { const ids = new Set(records.map(r => r.id)); setSession(s => ({ ...s, records: s.records.filter(r => !ids.has(r.id)), decisions: {} })); setNotice(`${ids.size} aportaciones eliminadas.`); }
  async function download(mode: 'full' | 'simplified' = 'full') { if (!schema) return; await run('Generando y verificando el Excel…', async () => {
    const groups = consolidate(session.records, schema, session.decisions);
    const result = await exportExcel(await getAsset('output.xlsx'), schema, groups.map(g => g.resolved), mode);
    const url = URL.createObjectURL(new Blob([new Uint8Array(result.bytes)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })); const link = document.createElement('a'); link.href = url; link.download = `SEAES_UTSJR_${mode === 'simplified' ? 'SIMPLIFICADO' : 'COMPLETO'}_${new Date().toLocaleDateString('en-CA')}.xlsx`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 60000); setExportReport(result.report);
  }); }
  return { schema, session, setSession, busy, ready, error, setError, notice, setNotice, saved, importSummary, setImportSummary, exportReport, setExportReport, importFiles, useDemo, removeSources, clearSession, saveRecord, deleteRecords, download };
}
