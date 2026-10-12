import { jsPDF } from 'jspdf';
import { hasPreviewContent } from '../../services/excel/WorkbookPreview';
import type { PreviewCell, WorkbookPreviewData } from '../../services/excel/WorkbookPreview';

export interface PdfFonts { regular: string; bold: string }
let fontPromise: Promise<PdfFonts> | undefined;
export function loadPdfFonts(): Promise<PdfFonts> {
  if (!fontPromise) fontPromise = Promise.all([
    new URL('./assets/Vera.ttf', import.meta.url), new URL('./assets/VeraBd.ttf', import.meta.url),
  ].map(async url => {
    const response = await fetch(url);
    if (!response.ok) throw new Error('No se pudo cargar la tipografía para el PDF.');
    const bytes = new Uint8Array(await response.arrayBuffer());
    let binary = '';
    for (let index = 0; index < bytes.length; index += 8192) binary += String.fromCharCode(...bytes.subarray(index, index + 8192));
    return btoa(binary);
  })).then(([regular, bold]) => ({ regular, bold })).catch(error => { fontPromise = undefined; throw error; });
  return fontPromise;
}

export function pdfCellValue(cell: PreviewCell): string {
  if (!cell.formula) return typeof cell.value === 'boolean' ? (cell.value ? 'Verdadero' : 'Falso') : String(cell.value ?? '');
  return `${cell.formula}\n${hasPreviewContent(cell.value) ? `Valor almacenado, sin recalcular: ${String(cell.value)}` : 'Sin resultado recalculado en el navegador.'}`;
}

/** A report of captured consolidated cells, excluding template examples and stale formula caches. */
export function createWorkbookPdf(preview: WorkbookPreviewData, fonts: PdfFonts): { bytes: Uint8Array; pages: number; cells: number } {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true, putOnlyUsedFonts: true });
  pdf.addFileToVFS('Vera.ttf', fonts.regular); pdf.addFont('Vera.ttf', 'Vera', 'normal');
  pdf.addFileToVFS('VeraBd.ttf', fonts.bold); pdf.addFont('VeraBd.ttf', 'Vera', 'bold');
  pdf.setProperties({ title: 'SEAES UTSJR - Consolidado con contenido', subject: 'Datos capturados del Excel consolidado', creator: 'SEAES UTSJR' });
  const margin = 16, width = 178, bottom = 278;
  let y = 35, activeSheet = '', cells = 0;
  const font = (size = 9, bold = false) => { pdf.setFont('Vera', bold ? 'bold' : 'normal'); pdf.setFontSize(size); };
  const header = () => {
    font(12, true); pdf.setTextColor(0, 36, 90); pdf.text('SEAES · UTSJR', margin, 16);
    font(8); pdf.setTextColor(86, 103, 124); pdf.text('Consolidado con contenido', margin, 22);
    pdf.setDrawColor(0, 157, 129); pdf.line(margin, 27, margin + width, 27);
    y = 35;
    if (activeSheet) { font(10, true); pdf.setTextColor(0, 36, 90); const lines = pdf.splitTextToSize(activeSheet, width); pdf.text(lines, margin, y); y += lines.length * 5 + 4; }
  };
  const newPage = () => { pdf.addPage(); header(); };
  const paragraph = (value: string, options: { size?: number; bold?: boolean; color?: [number, number, number]; indent?: number; gap?: number } = {}) => {
    const size = options.size ?? 9, lineHeight = size * .46;
    const indent = options.indent ?? 0;
    font(size, options.bold); pdf.setTextColor(...(options.color ?? [28, 48, 75]));
    const lines: string[] = pdf.splitTextToSize(value.replace(/\r\n?/g, '\n'), width - indent);
    for (const line of lines) {
      if (y + lineHeight > bottom) { newPage(); font(size, options.bold); pdf.setTextColor(...(options.color ?? [28, 48, 75])); }
      pdf.text(line, margin + indent, y); y += lineHeight;
    }
    y += options.gap ?? 2;
  };
  const compactCells = (items: PreviewCell[]) => {
    const columns = 3, gap = 4, cellWidth = (width - gap * (columns - 1)) / columns;
    for (let start = 0; start < items.length; start += columns) {
      const row = items.slice(start, start + columns).map(cell => {
        font(7, true);
        const label: string[] = pdf.splitTextToSize(`${cell.captured!.field.label} (${cell.ref})`, cellWidth - 4);
        font(8.5);
        const value: string[] = pdf.splitTextToSize(pdfCellValue(cell), cellWidth - 4);
        return { cell, label, value, height: label.length * 3.3 + value.length * 4 + 8 };
      });
      const height = Math.max(...row.map(cell => cell.height));
      if (y + height > bottom) newPage();
      for (let column = 0; column < row.length; column++) {
        const item = row[column], x = margin + column * (cellWidth + gap);
        pdf.setFillColor(246, 249, 252); pdf.roundedRect(x, y - 3, cellWidth, height, 1.5, 1.5, 'F');
        font(7, true); pdf.setTextColor(0, 115, 96);
        item.label.forEach((line, index) => pdf.text(line, x + 2, y + index * 3.3));
        font(8.5); pdf.setTextColor(28, 48, 75);
        item.value.forEach((line, index) => pdf.text(line, x + 2, y + item.label.length * 3.3 + 1 + index * 4));
      }
      y += height + gap;
    }
  };
  header();
  paragraph('Consolidado con contenido', { size: 17, bold: true, color: [0, 36, 90], gap: 5 });
  paragraph('Datos capturados y consolidados, organizados por hoja, sección y registro. Se conservan los ceros; se omiten campos vacíos, instrucciones y ejemplos de la plantilla. Las coordenadas entre paréntesis permiten verificar cada dato en el Excel.');
  paragraph('Los resultados de fórmulas y las gráficas requieren recalcular el Excel completo y no se incluyen en este informe.', { color: [113, 79, 12], gap: 6 });
  for (const sheet of preview.sheets) {
    const content = sheet.cells.filter(cell => cell.captured && hasPreviewContent(cell.value) && !cell.formula);
    if (!content.length) continue;
    activeSheet = sheet.name;
    if (y > bottom - 45) newPage();
    else paragraph(sheet.name, { size: 12, bold: true, color: [0, 36, 90], gap: 5 });
    let compact: PreviewCell[] = [], context = '';
    const flush = () => { if (compact.length) compactCells(compact); compact = []; };
    for (const cell of content) {
      const nextContext = `${cell.captured!.sectionLabel} · ${cell.captured!.rowLabel}`;
      if (nextContext !== context) { flush(); context = nextContext; if (context) paragraph(context, { size: 9, bold: true, gap: 3 }); }
      cells++;
      if (pdfCellValue(cell).length <= 150 && cell.captured!.field.label.length <= 180) { compact.push(cell); continue; }
      flush();
      if (y > bottom - 20) newPage();
      const label = `${cell.captured!.field.label} (${cell.ref})`;
      paragraph(label, { size: 7.5, bold: true, color: [0, 115, 96], gap: 1 });
      paragraph(pdfCellValue(cell), { size: 9, indent: 2, bold: !cell.binding && !!cell.bold, gap: 3 });
    }
    flush();
    y += 5;
  }
  if (!cells) paragraph('No hay datos capturados para incluir en este informe.', { size: 11 });
  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    pdf.setPage(page); font(7.5); pdf.setTextColor(102, 114, 132);
    pdf.text(`Página ${page} de ${pages}`, margin + width, 288, { align: 'right' });
    pdf.text('SEAES UTSJR · Consolidado con contenido', margin, 288);
  }
  return { bytes: new Uint8Array(pdf.output('arraybuffer')), pages, cells };
}

export async function downloadWorkbookPdf(preview: WorkbookPreviewData): Promise<{ pages: number; cells: number }> {
  const result = createWorkbookPdf(preview, await loadPdfFonts());
  const url = URL.createObjectURL(new Blob([new Uint8Array(result.bytes)], { type: 'application/pdf' }));
  const link = document.createElement('a'); link.href = url; link.download = 'SEAES_UTSJR_CONSOLIDADO.pdf';
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return { pages: result.pages, cells: result.cells };
}
