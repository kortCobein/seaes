import { useCallback, useEffect, useRef, useState } from 'react';
import { emptySession, type DataSource, type ExportReport, type Scalar, type SeaesRecord, type WorkbookSchema, type WorkSession } from '../models/types';
import { consolidate } from '../services/consolidation';
import { deleteWorkspaceRecords, saveWorkspaceRecord, setPreviewValue, withRecords } from '../services/workspaceRecords';
import { fileFingerprint } from '../services/fileFingerprint';
import { clearOriginals, deleteOriginal, loadOriginal, loadSession, saveSession, storeOriginal } from '../services/storage';
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
    // Migrar las fuentes previas sin perder sus registros, usando los originales en IndexedDB.
    const known = new Map<string, DataSource>();
    const migrated = new Map<string, string>();
    for (const previous of session.sources.filter(s => s.kind === 'real')) {
      let fingerprint = previous.fingerprint;
      if (!fingerprint) {
        try {
          const original = await loadOriginal(previous.id);
          if (original) { fingerprint = await fileFingerprint(original); migrated.set(previous.id, fingerprint); }
        } catch { /* Sigue disponible la información de la sesión heredada. */ }
      }
      if (fingerprint) known.set(fingerprint, previous);
    }
    for (let index = 0; index < items.length; index++) {
      const item = items[index]; setBusy(`Analizando ${index + 1} de ${items.length}: ${item.name}`);
      const source: DataSource = { id: crypto.randomUUID(), name: item.name, filename: item.file.name, importedAt: new Date().toISOString(), kind: 'real', compatibility: 'compatible', warnings: [] };
      try {
        if (item.file.size > 40 * 1024 * 1024) throw new Error('El archivo supera el límite de 40 MB para procesamiento local.');
        const bytes = await item.file.arrayBuffer();
        const fingerprint = await fileFingerprint(bytes);
        const duplicate = known.get(fingerprint);
        if (duplicate) {
          summary.push({ id: source.id, name: item.name, records: 0, fields: 0,
            message: `Archivo idéntico a «${duplicate.name}». No se importó nuevamente ni se duplicaron sus cantidades.` });
          continue;
        }
        const result = await parseExcel(bytes, schema, { ...source, fingerprint });
        sources.push(result.source); records.push(...result.records);
        known.set(fingerprint, result.source);
        try { await storeOriginal(source.id, bytes); } catch { result.source.warnings.push('No se pudo conservar el archivo original en el navegador. La información extraída permanece disponible.'); }
        summary.push({ id: source.id, name: source.name, records: result.records.length, fields: result.records.reduce((n, r) => n + Object.keys(r.values).length, 0), message: result.source.warnings.join(' ') || 'Compatible' });
      } catch (e) { const message = e instanceof Error ? e.message : 'Error de lectura'; sources.push({ ...source, compatibility: 'unknown', warnings: [message] }); summary.push({ id: source.id, name: source.name, records: 0, fields: 0, message }); }
    }
    setSession(s => ({
      ...withRecords(s, [...s.records, ...records], schema),
      sources: [...s.sources.map(previous => migrated.has(previous.id) ? { ...previous, fingerprint: migrated.get(previous.id) } : previous), ...sources],
    }));
    setImportSummary(summary);
  }); }
  async function removeSources(ids: string[]) { if (!schema) return; setSession(s => ({ ...withRecords(s, s.records.filter(r => !ids.includes(r.sourceId)), schema), sources: s.sources.filter(f => !ids.includes(f.id)) })); await Promise.all(ids.map(id => deleteOriginal(id).catch(() => {}))); setNotice('Fuente eliminada. Se recalcularon sus aportaciones.'); }
  async function clearSession() { setSession(emptySession()); await clearOriginals().catch(() => {}); setNotice('Sesión vacía. Puedes importar tus archivos.'); }
  function saveRecord(data: { sectionId: string; rowId: string; values: Record<string, Scalar> }, record?: SeaesRecord, sourceId?: string) {
    if (!schema) return;
    setSession(saveWorkspaceRecord(session, schema, data, record, sourceId));
    setNotice(record ? 'Registro actualizado. Se recalcularon sus valores consolidados.' : 'Registro agregado a la fuente.');
  }
  function deleteRecords(records: SeaesRecord[]) { if (!schema) return; const ids = new Set(records.map(r => r.id)); setSession(s => deleteWorkspaceRecords(s, schema, ids)); setNotice(`${ids.size} aportaciones eliminadas. Se recalculó el consolidado.`); }
  function editPreview(groupId: string, fieldId: string, value: Scalar) {
    if (!schema) return;
    setSession(setPreviewValue(session, schema, groupId, fieldId, value));
    setNotice('Cambio de Preview guardado en el consolidado y la exportación.');
  }
  async function download() { if (!schema) return; await run('Generando y verificando el Excel…', async () => {
    const groups = consolidate(session.records, schema, session.decisions);
    const result = await exportExcel(await getAsset('output.xlsx'), schema, groups.map(g => g.resolved));
    const url = URL.createObjectURL(new Blob([new Uint8Array(result.bytes)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })); const link = document.createElement('a'); link.href = url; link.download = `SEAES_UTSJR_COMPLETO_${new Date().toLocaleDateString('en-CA')}.xlsx`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 60000); setExportReport(result.report);
  }); }
  return { schema, session, setSession, busy, ready, error, setError, notice, setNotice, saved, importSummary, setImportSummary, exportReport, setExportReport, importFiles, removeSources, clearSession, saveRecord, deleteRecords, editPreview, download };
}
