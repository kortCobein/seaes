import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, FileSpreadsheet, Info, LoaderCircle, Pencil } from 'lucide-react';
import type { RecordGroup, Scalar, WorkbookSchema } from '../../models/types';
import type { PreviewCell, PreviewSheet, WorkbookPreviewData } from '../../services/excel/WorkbookPreview';
import { getAsset, previewExcel } from '../../services/workerClient';
import { DynamicCards } from '../../components/DynamicCards';
import { Dialog } from '../../components/Dialog';
import './preview.css';

function coordinate(ref: string) {
  const [, letters, row] = /^([A-Z]+)(\d+)$/.exec(ref)!;
  let col = 0; for (const letter of letters) col = col * 26 + letter.charCodeAt(0) - 64;
  return { row: Number(row), col };
}
function columnLabel(value: number) {
  let label = ''; for (let next = value; next > 0; next = Math.floor((next - 1) / 26)) label = String.fromCharCode(65 + (next - 1) % 26) + label;
  return label;
}

function SheetGrid({ sheet, onEdit }: { sheet: PreviewSheet; onEdit: (cell: PreviewCell) => void }) {
  const layout = useMemo(() => {
    const cells = new Map(sheet.cells.map(cell => [cell.ref, cell]));
    const rows = [...new Set(sheet.cells.map(cell => coordinate(cell.ref).row))].sort((a, b) => a - b);
    const columns = [...new Set(sheet.cells.map(cell => coordinate(cell.ref).col))].sort((a, b) => a - b);
    const spans = new Map<string, { colSpan: number; rowSpan: number }>();
    const hidden = new Set<string>();
    for (const range of sheet.merges) {
      const [startRef, endRef = startRef] = range.split(':');
      if (!cells.has(startRef)) continue;
      const start = coordinate(startRef), end = coordinate(endRef);
      const withinRows = rows.filter(row => row >= start.row && row <= end.row);
      const withinCols = columns.filter(col => col >= start.col && col <= end.col);
      spans.set(startRef, { colSpan: withinCols.length, rowSpan: withinRows.length });
      for (const row of withinRows) for (const col of withinCols) {
        const ref = `${columnLabel(col)}${row}`;
        if (ref !== startRef) hidden.add(ref);
      }
    }
    return { cells, rows, columns, spans, hidden };
  }, [sheet]);
  return <div className="preview-sheet-content">
    {!!sheet.images.length && <div className="preview-images">{sheet.images.map((image, index) => <img key={index} src={image.dataUrl} alt={image.label}/>)}</div>}
    {!!sheet.charts && <p className="preview-chart-note"><Info size={15}/>{sheet.charts} gráfica{sheet.charts === 1 ? '' : 's'} conservada{sheet.charts === 1 ? '' : 's'} en Excel. Esta vista muestra sus celdas y fórmulas; la gráfica se actualiza al abrir el Excel.</p>}
    {!layout.rows.length ? <p className="empty-state">Esta hoja no contiene celdas con contenido.</p> : <div className="preview-grid-scroll" tabIndex={0} aria-label={`Contenido de ${sheet.name}. Desplazamiento horizontal disponible.`}>
      <table className="preview-grid"><caption className="sr-only">{sheet.name}: contenido del Excel generado</caption><thead><tr><th scope="col" aria-label="Fila"/>{layout.columns.map(col => <th scope="col" key={col}>{columnLabel(col)}</th>)}</tr></thead><tbody>
        {layout.rows.map(row => <tr key={row}><th scope="row">{row}</th>{layout.columns.map(col => {
          const ref = `${columnLabel(col)}${row}`;
          if (layout.hidden.has(ref)) return null;
          const cell = layout.cells.get(ref);
          const span = layout.spans.get(ref);
          if (!cell) return <td key={col}/>;
          return <td key={col} {...span} style={{ fontWeight: cell.bold ? 650 : undefined, background: cell.background, color: cell.color }} className={`${cell.binding ? 'preview-editable' : ''} ${cell.formula ? 'preview-formula' : ''}`}>
            {cell.formula ? <><code>{cell.formula}</code><small>Valor almacenado, sin recalcular: {cell.value === null || cell.value === '' ? 'no disponible' : String(cell.value)}</small></>
              : cell.binding ? <button type="button" title={`Editar ${ref}: ${cell.binding.field.label}`} aria-label={`Editar ${ref}: ${cell.binding.field.label}`} onClick={() => onEdit(cell)}><span>{cell.value === null || cell.value === '' ? <em>Sin captura</em> : String(cell.value)}</span><Pencil size={12}/></button>
                : <span>{String(cell.value ?? '')}</span>}
          </td>;
        })}</tr>)}
      </tbody></table>
    </div>}
  </div>;
}

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
  const [busy, setBusy] = useState(true), [pdfBusy, setPdfBusy] = useState(false), [error, setError] = useState('');
  const [editing, setEditing] = useState<PreviewCell>();
  const template = useRef<Promise<ArrayBuffer> | null>(null);
  useEffect(() => {
    let cancelled = false;
    setBusy(true); setError('');
    template.current ??= getAsset('output.xlsx');
    void template.current.then(bytes => previewExcel(bytes, schema, groups)).then(result => {
      if (!cancelled) setPreview(result.preview);
    }).catch(cause => { if (!cancelled) setError(cause instanceof Error ? cause.message : 'No se pudo generar la vista previa.'); })
      .finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
  }, [schema, groups]);
  async function exportPdf() {
    if (!preview || busy) return;
    setPdfBusy(true); setError('');
    try { const { downloadWorkbookPdf } = await import('./exportPdf'); await downloadWorkbookPdf(preview); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo generar el PDF.'); }
    finally { setPdfBusy(false); }
  }
  return <section className="workbook-preview" aria-label="Preview del Excel completo">
    <div className="preview-toolbar"><div><h2>Preview</h2><p>Revisa todas las hojas y edita las celdas de captura antes de exportar.</p></div><div className="preview-export-actions">
      {onExportExcel && <button className="button secondary small" onClick={onExportExcel} disabled={busy || pdfBusy}><FileSpreadsheet size={15}/>Excel completo</button>}
      <button className="button primary small" onClick={() => void exportPdf()} disabled={busy || pdfBusy || !preview}>{pdfBusy ? <LoaderCircle size={15} className="spin"/> : <Download size={15}/>}Exportar PDF</button>
    </div></div>
    <details className="preview-help"><summary><Info size={15}/>Cómo leer esta vista</summary><p>Las celdas con lápiz se pueden editar. Se muestran los valores guardados en el Excel completo, conservando sus coordenadas y combinaciones; se ocultan filas y columnas completamente vacías.</p><p>Las fórmulas se conservan y aparecen como expresiones. <strong>El navegador no las recalcula.</strong> Los valores almacenados pueden estar desactualizados. Las imágenes se muestran por hoja y las gráficas se conservan en el Excel; esta vista no reproduce su diseño de impresión.</p><p>El PDF del consolidado incluye las celdas capturadas con contenido, organizadas por hoja y registro; conserva ceros y textos largos. Omite instrucciones, ejemplos y resultados de fórmulas sin recalcular.</p></details>
    {error && <p className="error-message" role="alert">{error}</p>}
    {busy ? <div className="preview-loading" role="status"><LoaderCircle className="spin" size={23}/>Generando y verificando el Excel para mostrar su contenido…</div>
      : preview && <><p className="preview-formula-warning"><Info size={15}/>Fórmulas sin recalcular: los valores almacenados no son resultados actualizados.</p><DynamicCards label="Hojas del Excel completo" items={preview.sheets.map((sheet, index) => ({ id: sheet.name, title: sheet.name,
        eyebrow: `HOJA ${index + 1} DE ${preview.sheets.length}`, icon: <FileSpreadsheet size={22}/>,
        badge: `${sheet.cells.filter(cell => cell.value !== null && cell.value !== '' || cell.formula).length} celdas`,
        content: <SheetGrid sheet={sheet} onEdit={setEditing}/>,
      }))}/></>}
    {editing?.binding && <CellEditor cell={editing} onClose={() => setEditing(undefined)} onSave={value => { onEditCell(editing.binding!.groupId, editing.binding!.fieldId, value); setEditing(undefined); }}/ >}
  </section>;
}
