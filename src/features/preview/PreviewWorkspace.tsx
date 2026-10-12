import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft, ChevronRight, ChevronsDown, ChevronsUp, Expand,
  FileSpreadsheet, Info, Maximize2, Minimize2, Pencil, Search,
  ZoomIn, ZoomOut,
} from 'lucide-react';
import type { PreviewCell, PreviewSheet, WorkbookPreviewData } from '../../services/excel/WorkbookPreview';

function coordinates(ref: string) {
  const match = /^([A-Z]+)(\d+)$/.exec(ref);
  if (!match) return { row: 1, col: 1 };
  let col = 0;
  for (const char of match[1]) col = col * 26 + char.charCodeAt(0) - 64;
  return { row: Number(match[2]), col };
}
function letters(column: number) {
  let label = '';
  for (let current = column; current > 0; current = Math.floor((current - 1) / 26))
    label = String.fromCharCode(65 + (current - 1) % 26) + label;
  return label;
}
const ROW_CHUNK = 180;

function SheetGrid({ sheet, zoom, compact, onEdit }: {
  sheet: PreviewSheet; zoom: number; compact: boolean;
  onEdit: (cell: PreviewCell) => void;
}) {
  const [page, setPage] = useState(0);
  const scroll = useRef<HTMLDivElement>(null);
  useEffect(() => { setPage(0); scroll.current?.scrollTo({ top: 0, left: 0 }); }, [sheet.name, compact]);

  const layout = useMemo(() => {
    const byRef = new Map(sheet.cells.map(cell => [cell.ref, cell]));
    const coords = sheet.cells.map(cell => coordinates(cell.ref));
    const rowMax = Math.max(1, ...coords.map(cell => cell.row));
    const colMax = Math.max(1, ...coords.map(cell => cell.col));
    // Only one sheet renders at a time. Split exceptionally long sheets into consecutive
    // row ranges to avoid generating tens of thousands of DOM elements in one render.
    const usedRows = [...new Set(coords.map(cell => cell.row))].sort((a, b) => a - b);
    const rows = compact ? usedRows : Array.from({ length: rowMax }, (_, index) => index + 1);
    const cols = compact
      ? [...new Set(coords.map(cell => cell.col))].sort((a, b) => a - b)
      : Array.from({ length: colMax }, (_, index) => index + 1);
    return { byRef, rows, cols, rowMax, colMax };
  }, [sheet, compact]);

  const pages = Math.max(1, Math.ceil(layout.rows.length / ROW_CHUNK));
  const selectedPage = Math.min(page, pages - 1);
  const visibleRows = useMemo(() =>
    layout.rows.slice(selectedPage * ROW_CHUNK, (selectedPage + 1) * ROW_CHUNK),
    [layout.rows, selectedPage]);
  const { spans, covered } = useMemo(() => {
    const spans = new Map<string, { colSpan: number; rowSpan: number }>();
    const covered = new Set<string>();
    const rowSet = new Set(visibleRows);
    const colSet = new Set(layout.cols);
    for (const range of sheet.merges) {
      const [startRef, endRef = startRef] = range.split(':');
      const first = coordinates(startRef), last = coordinates(endRef);
      // A merge crossing page boundaries is anchored at the first visible position.
      const inRows = visibleRows.filter(row => row >= first.row && row <= last.row);
      if (!inRows.length) continue;
      const inCols = layout.cols.filter(col => col >= first.col && col <= last.col);
      if (!inCols.length) continue;
      const anchor = letters(inCols[0]) + inRows[0];
      spans.set(anchor, { rowSpan: inRows.length, colSpan: inCols.length });
      for (const row of inRows) for (const col of inCols) {
        const cellRef = letters(col) + row;
        if (cellRef !== anchor && rowSet.has(row) && colSet.has(col)) covered.add(cellRef);
      }
      // When the merge starts on a prior page, the original value is repeated in
      // the visible continuation by resolving to startRef during cell rendering.
    }
    return { spans, covered };
  }, [sheet.merges, visibleRows, layout.cols]);

  const mergeSource = useMemo(() => {
    const result = new Map<string, string>();
    for (const range of sheet.merges) {
      const [startRef, endRef = startRef] = range.split(':');
      const start = coordinates(startRef), end = coordinates(endRef);
      const row = visibleRows.find(item => item >= start.row && item <= end.row);
      if (row === undefined) continue;
      const col = layout.cols.find(item => item >= start.col && item <= end.col);
      if (col !== undefined) result.set(letters(col) + row, startRef);
    }
    return result;
  }, [sheet.merges, visibleRows, layout.cols]);

  if (!sheet.cells.length) return <div className="preview-empty">Esta hoja no contiene datos visibles.</div>;
  const firstRow = visibleRows[0] ?? 1, lastRow = visibleRows.at(-1) ?? firstRow;
  return <div className="preview-sheet-content">
    {!!sheet.images.length && <div className="preview-images">{sheet.images.map((image, index) =>
      <img key={index} src={image.dataUrl} alt={image.label}/>)}</div>}
    {!!sheet.charts && <p className="preview-chart-note"><Info size={15}/>
      {sheet.charts} gráfica{sheet.charts === 1 ? '' : 's'} conservada{sheet.charts === 1 ? '' : 's'} en el Excel. Aquí se muestran las celdas; el navegador no renderiza los gráficos originales.
    </p>}
    <div className="preview-grid-scroll" ref={scroll} tabIndex={0}
      aria-label={\`Cuadrícula de \${sheet.name}, desplazable horizontal y verticalmente.\`}>
      <div className="preview-grid-scale" style={{ zoom: \`\${zoom}%\` }}>
        <table className="preview-grid"><caption className="sr-only">{sheet.name}: celdas del Excel</caption>
          <thead><tr><th scope="col" aria-label="Número de fila"/>{layout.cols.map(col =>
            <th scope="col" key={col}>{letters(col)}</th>)}</tr></thead>
          <tbody>{visibleRows.map(row => <tr key={row}><th scope="row">{row}</th>
            {layout.cols.map(col => {
              const ref = letters(col) + row;
              if (covered.has(ref)) return null;
              const cell = layout.byRef.get(mergeSource.get(ref) ?? ref);
              const span = spans.get(ref);
              if (!cell) return <td key={col} {...span}/>;
              return <td key={col} {...span}
                style={{ background: cell.background, color: cell.color, fontWeight: cell.bold ? 650 : undefined }}
                className={\`\${cell.binding ? 'preview-editable' : ''} \${cell.formula ? 'preview-formula' : ''}\`}>
                {cell.formula
                  ? <div className="preview-formula-value"><code>{cell.formula}</code><small>Almacenado, no recalculado: {String(cell.value ?? 'Sin resultado')}</small></div>
                  : cell.binding
                    ? <button type="button" onClick={() => onEdit(cell)} title={\`Editar \${cell.ref}: \${cell.binding?.field.label}\`}>
                        <span>{cell.value === null || cell.value === '' ? <em>Sin captura</em> : String(cell.value)}</span><Pencil size={13}/></button>
                    : <span>{String(cell.value ?? '')}</span>}
              </td>;
            })}</tr>)}</tbody>
        </table>
      </div>
    </div>
    <div className="preview-sheet-status">
      <span>Filas {firstRow}–{lastRow} de {layout.rowMax} · {layout.colMax} columnas · {sheet.cells.length.toLocaleString('es-MX')} celdas con contenido o captura</span>
      {pages > 1 && <div className="preview-page-controls">
        <button type="button" title="Bloque anterior" disabled={!selectedPage} onClick={() => { setPage(p => p - 1); scroll.current?.scrollTo({ top: 0, left: 0 }); }}><ChevronLeft size={16}/></button>
        <span>{selectedPage + 1} / {pages}</span>
        <button type="button" title="Bloque siguiente" disabled={selectedPage >= pages - 1} onClick={() => { setPage(p => p + 1); scroll.current?.scrollTo({ top: 0, left: 0 }); }}><ChevronRight size={16}/></button>
      </div>}
    </div>
  </div>;
}

export function PreviewWorkspace({ preview, onEdit, refreshing }: {
  preview: WorkbookPreviewData; onEdit: (cell: PreviewCell) => void; refreshing: boolean;
}) {
  const [sheetIndex, setSheetIndex] = useState(0);
  const [query, setQuery] = useState('');
  const [zoom, setZoom] = useState(100);
  const [compact, setCompact] = useState(false);
  const [sidebar, setSidebar] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const root = useRef<HTMLElement>(null);
  const sheet = preview.sheets[Math.min(sheetIndex, Math.max(0, preview.sheets.length - 1))];
  const items = useMemo(() => preview.sheets.map((item, index) => ({ item, index }))
    .filter(({ item }) => item.name.toLocaleLowerCase('es-MX').includes(query.trim().toLocaleLowerCase('es-MX'))),
  [preview.sheets, query]);

  useEffect(() => {
    const update = () => setFullscreen(document.fullscreenElement === root.current);
    document.addEventListener('fullscreenchange', update);
    return () => document.removeEventListener('fullscreenchange', update);
  }, []);
  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement === root.current) await document.exitFullscreen();
      else if (root.current?.requestFullscreen) await root.current.requestFullscreen();
    } catch { /* Fullscreen can be denied by the browser; the regular viewer still works. */ }
  };
  if (!sheet) return <div className="preview-empty">No hay hojas para mostrar.</div>;

  return <section className="preview-workspace" ref={root} aria-label="Visor del Excel completo">
    <div className="preview-workspace-toolbar">
      <div className="preview-current-sheet">
        <FileSpreadsheet size={21}/>
        <div><strong>{sheet.name}</strong><small>Hoja {sheetIndex + 1} de {preview.sheets.length}{refreshing ? ' · Actualizando valores…' : ' · Cambios guardados en la sesión'}</small></div>
      </div>
      <div className="preview-view-tools">
        <button type="button" className="preview-icon-button" disabled={sheetIndex === 0} title="Hoja anterior" onClick={() => setSheetIndex(s => s - 1)}><ChevronLeft size={18}/></button>
        <button type="button" className="preview-icon-button" disabled={sheetIndex === preview.sheets.length - 1} title="Hoja siguiente" onClick={() => setSheetIndex(s => s + 1)}><ChevronRight size={18}/></button>
        <span className="preview-control-separator"/>
        <button type="button" className="preview-icon-button" title="Reducir zoom" disabled={zoom <= 70} onClick={() => setZoom(z => Math.max(70, z - 10))}><ZoomOut size={17}/></button>
        <span className="preview-zoom-label">{zoom}%</span>
        <button type="button" className="preview-icon-button" title="Aumentar zoom" disabled={zoom >= 150} onClick={() => setZoom(z => Math.min(150, z + 10))}><ZoomIn size={17}/></button>
        <span className="preview-control-separator"/>
        <button type="button" className="preview-icon-button" title={compact ? 'Mostrar filas y columnas intermedias' : 'Ocultar filas y columnas completamente vacías'} aria-pressed={compact} onClick={() => setCompact(value => !value)}>{compact ? <ChevronsDown size={18}/> : <ChevronsUp size={18}/>}</button>
        <button type="button" className="preview-icon-button" title={sidebar ? 'Ocultar lista de hojas' : 'Mostrar lista de hojas'} aria-pressed={sidebar} onClick={() => setSidebar(value => !value)}><FileSpreadsheet size={18}/></button>
        <button type="button" className="preview-fullscreen-button" onClick={() => void toggleFullscreen()} title={fullscreen ? 'Salir de pantalla completa (Esc)' : 'Pantalla completa'}>
          {fullscreen ? <Minimize2 size={16}/> : <Maximize2 size={16}/>}
          <span>{fullscreen ? 'Salir' : 'Ampliar'}</span>
        </button>
      </div>
    </div>
    <div className={\`preview-workspace-body\${sidebar ? '' : ' no-sidebar'}\`}>
      {sidebar && <aside className="preview-sheets-nav" aria-label="Navegación entre hojas">
        <label className="preview-sheet-search"><Search size={16}/><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar hoja…" aria-label="Buscar hoja por nombre"/></label>
        <span className="preview-sheets-label">HOJAS DEL LIBRO <small>{preview.sheets.length}</small></span>
        <div className="preview-sheets-list">
          {items.map(({ item, index }) => <button key={item.name} type="button"
            className={\`preview-sheet-link\${index === sheetIndex ? ' is-selected' : ''}\`}
            onClick={() => setSheetIndex(index)} aria-current={index === sheetIndex ? 'page' : undefined}
            title={item.name}>
            <span className="preview-sheet-index">{String(index + 1).padStart(2, '0')}</span>
            <span className="preview-sheet-name">{item.name}</span>
            {index === sheetIndex && <span className="preview-sheet-dot"/>}
          </button>)}
          {!items.length && <p className="preview-empty-list">No hay hojas con ese nombre.</p>}
        </div>
      </aside>}
      <div className="preview-canvas">
        <SheetGrid key={sheet.name} sheet={sheet} zoom={zoom} compact={compact} onEdit={onEdit}/>
      </div>
    </div>
  </section>;
}
