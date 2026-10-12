import { useEffect, useRef, useState } from 'react';
import { Download, FileSpreadsheet, Info, LoaderCircle } from 'lucide-react';
import type { RecordGroup, Scalar, WorkbookSchema } from '../../models/types';
import type { PreviewCell, WorkbookPreviewData } from '../../services/excel/WorkbookPreview';
import { getAsset, previewExcel } from '../../services/workerClient';
import { PreviewWorkspace } from './PreviewWorkspace';
import { Dialog } from '../../components/Dialog';
import './preview.css';

function CellEditor({ cell, onClose, onSave }: { cell: PreviewCell; onClose: () => void; onSave: (value: Scalar) => void }) {
  const [value, setValue] = useState(String(cell.value ?? ''));
  const [error, setError] = useState('');
  const binding = cell.binding!;
  function submit(event: React.FormEvent) {
    event.preventDefault();
    const clean = value.trim();
    let next: Scalar = clean || null;
    if (binding.field.type === 'number' && clean) {
      const candidate = clean.replace(/,/g, '');
      if (/^\d+(\.\d+)?$/.test(candidate) && Number.isFinite(Number(candidate))) next = Number(candidate);
      else if (!/^no (disponible|aplica)$/i.test(clean)) { setError('Escribe un número no negativo, No disponible o No aplica.'); return; }
    }
    try { onSave(next); } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo guardar la celda.'); }
  }
  return <Dialog title={`Editar ${cell.ref}`} onClose={onClose}><form onSubmit={submit}><div className="dialog-body preview-cell-editor">
    <p>{binding.sectionLabel} · {binding.rowLabel}</p>
    <label>{binding.field.label}{binding.field.type === 'choice'
      ? <select autoFocus value={value} onChange={event => setValue(event.target.value)}><option value="">Sin captura</option>{[...new Set([...(binding.field.choices ?? ['X']), ...(value ? [value] : [])])].map(choice => <option key={choice}>{choice}</option>)}</select>
      : binding.field.type === 'number' ? <input autoFocus inputMode="decimal" value={value} onChange={event => setValue(event.target.value)} aria-invalid={!!error}/>
        : <textarea autoFocus rows={7} maxLength={32767} value={value} onChange={event => setValue(event.target.value)}/>}</label>
    <p className="muted">El cambio se guarda en el consolidado y se aplica al Excel y al PDF. Las aportaciones originales conservan su procedencia.</p>
    {error && <p className="error-message" role="alert">{error}</p>}
  </div><div className="dialog-footer"><button className="button secondary" type="button" onClick={onClose}>Cancelar</button><button className="button primary" type="submit">Guardar cambio</button></div></form></Dialog>;
}

export function WorkbookPreview({ schema, groups, onEditCell, onExportExcel }: {
  schema: WorkbookSchema; groups: RecordGroup[];
  onEditCell: (groupId: string, fieldId: string, value: Scalar) => void;
  onExportExcel?: () => void;
}) {
  const [preview, setPreview] = useState<WorkbookPreviewData>();
  const [busy, setBusy] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<PreviewCell>();
  const template = useRef<Promise<ArrayBuffer> | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError('');
    // Keep the workbook visible when a cell is edited, rather than flashing a
    // loading page after each saved change to the consolidated session.
    if (preview) setRefreshing(true);
    else setBusy(true);
    template.current ??= getAsset('output.xlsx');
    const timeout = setTimeout(() => {
      void template.current!.then(bytes => previewExcel(bytes, schema, groups)).then(result => {
        if (!cancelled) setPreview(result.preview);
      }).catch(cause => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'No se pudo actualizar el Excel.');
      }).finally(() => {
        if (!cancelled) { setBusy(false); setRefreshing(false); }
      });
    }, preview ? 160 : 0);
    return () => { cancelled = true; clearTimeout(timeout); };
    // A refreshed worker result should never trigger a second run for the same data.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schema, groups]);

  async function exportPdf() {
    if (!preview || busy || refreshing) return;
    setPdfBusy(true); setError('');
    try {
      const { downloadWorkbookPdf } = await import('./exportPdf');
      await downloadWorkbookPdf(preview);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo generar el PDF.');
    } finally { setPdfBusy(false); }
  }

  return <section className="workbook-preview" aria-label="Vista completa del Excel">
    <div className="preview-toolbar">
      <div><h2>Vista previa del libro</h2><p>Consulta las 58 hojas a pantalla completa y edita las celdas sin descargar el Excel.</p></div>
      <div className="preview-export-actions">
        {onExportExcel && <button className="button secondary small" disabled={busy || refreshing || pdfBusy} onClick={onExportExcel}><FileSpreadsheet size={16}/>Exportar Excel</button>}
        <button className="button primary small" disabled={busy || refreshing || pdfBusy || !preview} onClick={() => void exportPdf()}>
          {pdfBusy ? <LoaderCircle className="spin" size={16}/> : <Download size={16}/>}Exportar PDF
        </button>
      </div>
    </div>
    {error && <p className="error-message" role="alert">{error}</p>}
    {busy && !preview
      ? <div className="preview-loading" role="status"><LoaderCircle size={26} className="spin"/>Preparando las hojas y celdas del libro…</div>
      : preview && <PreviewWorkspace preview={preview} onEdit={setEditing} refreshing={refreshing}/>}
    <details className="preview-help">
      <summary><Info size={15}/>Sobre las fórmulas y la vista</summary>
      <p>Las celdas marcadas con un lápiz son editables. Sus cambios se almacenan en el consolidado del navegador y actualizan esta vista, sin descargar el archivo en cada modificación.</p>
      <p>Las fórmulas se conservan, pero el navegador no las recalcula. Los valores almacenados podrían ser antiguos. Las gráficas originales se conservan al exportar Excel, aunque no se reproducen dentro del visor.</p>
      <p>Use «Ampliar» para trabajar a pantalla completa, el índice para navegar por las hojas y los controles de zoom o de filas compactas si lo necesita. En hojas muy largas se muestran bloques consecutivos de filas.</p>
    </details>
    {editing?.binding && <CellEditor cell={editing} onClose={() => setEditing(undefined)}
      onSave={value => { onEditCell(editing.binding!.groupId, editing.binding!.fieldId, value); setEditing(undefined); }}/>}
  </section>;
}
