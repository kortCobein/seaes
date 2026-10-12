import { XMLParser } from 'fast-xml-parser';
import type { ExportReport, FieldSchema, RecordGroup, Scalar, WorkbookSchema } from '../../models/types';
import { exportWorkbook } from './OutputWorkbookMapper';
import { list, nameKey, openPackage, parseRef } from './package';

export interface PreviewBinding {
  groupId: string; fieldId: string; field: FieldSchema; sectionLabel: string; rowLabel: string;
  captured?: boolean; readonly?: boolean;
}
export interface PreviewCell {
  ref: string; value: Scalar; formula?: string; binding?: PreviewBinding;
  captured?: PreviewBinding;
  bold?: boolean; background?: string; color?: string;
}
export interface PreviewImage { dataUrl: string; label: string }
export interface PreviewSheet {
  name: string; cells: PreviewCell[]; merges: string[]; images: PreviewImage[]; charts: number;
}
export interface WorkbookPreviewData { sheets: PreviewSheet[]; warnings: string[] }
export interface WorkbookPreviewResult { preview: WorkbookPreviewData; report: ExportReport }
export const hasPreviewContent = (value: Scalar | undefined) => value !== undefined && value !== null && String(value).trim() !== '';

const parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true, parseTagValue: false, trimValues: false, htmlEntities: true });
type Node = Record<string, unknown>;
const object = (value: unknown): Node => value !== null && typeof value === 'object' ? value as Node : {};
const text = (value: unknown) => typeof value === 'object' ? String(object(value)['#text'] ?? '') : String(value ?? '');

function bindingsFor(schema: WorkbookSchema, groups: RecordGroup[]) {
  const bindings = new Map<string, PreviewBinding>();
  const slots = new Map<string, number>();
  for (const group of groups) {
    const section = schema.sections.find(item => item.id === group.section.id);
    if (!section) continue;
    const slot = slots.get(section.id) ?? 0;
    const row = section.kind === 'annex' ? section.rows[slot] : section.rows.find(item => item.id === group.resolved.rowId);
    if (section.kind === 'annex') slots.set(section.id, slot + 1);
    if (!row) continue;
    for (const field of section.fields) {
      const ref = row.fields[field.id]?.outputRef;
      if (ref) bindings.set(`${nameKey(section.sheet)}!${ref}`, {
        groupId: group.id, fieldId: field.id, field, sectionLabel: section.label,
        rowLabel: section.kind === 'annex' ? `Registro ${slot + 1}` : row.label,
        captured: Object.hasOwn(group.resolved.values, field.id) && hasPreviewContent(group.resolved.values[field.id]),
        readonly: section.kind === 'identity' && /instituci[oó]n|entidad/i.test(field.label),
      });
    }
  }
  return bindings;
}

/** Interpret only the finished export; never substitute source records for workbook values. */
export async function readWorkbookPreview(bytes: Uint8Array | ArrayBuffer, schema: WorkbookSchema, groups: RecordGroup[]): Promise<WorkbookPreviewData> {
  const workbook = await openPackage(bytes);
  const bindings = bindingsFor(schema, groups);
  const styleXml = await workbook.zip.file('xl/styles.xml')?.async('string');
  const style = styleXml ? object(object(parser.parse(styleXml)).styleSheet) : {};
  const fonts = list(object(style.fonts).font).map(object);
  const fills = list(object(style.fills).fill).map(fill => object(object(fill).patternFill));
  const styles = list(object(style.cellXfs).xf).map(object);
  const rgb = (value: unknown) => {
    const color = object(value)['@_rgb'];
    return typeof color === 'string' && /^(?:[0-9a-f]{2})?[0-9a-f]{6}$/i.test(color) ? `#${color.slice(-6)}` : undefined;
  };
  const sheets: PreviewSheet[] = [];
  for (const sheet of workbook.sheets) {
    const formulas = new Map<string, string>();
    for (const match of sheet.xml.matchAll(/<(?:\w+:)?c\b[^>]*?(?:\/>|>[\s\S]*?<\/(?:\w+:)?c>)/g)) {
      if (!/<(?:\w+:)?f(?:\s|>|\/)/.test(match[0])) continue;
      const cell = object(object(parser.parse(match[0])).c);
      const expression = text(cell.f);
      const shared = object(cell.f)['@_si'];
      formulas.set(String(cell['@_r']), expression ? `=${expression}` : `Fórmula compartida${shared === undefined ? '' : ` ${shared}`} (definida en el libro)`);
    }
    const cells: PreviewCell[] = [];
    for (const cell of sheet.cells.values()) {
      if (!hasPreviewContent(cell.value) && !cell.formula) continue;
      const xf = styles[Number(cell.style)] ?? {};
      const font = fonts[Number(xf['@_fontId'])] ?? {};
      const fill = fills[Number(xf['@_fillId'])] ?? {};
      const mapped = bindings.get(`${nameKey(sheet.name)}!${cell.ref}`);
      cells.push({ ref: cell.ref, value: cell.value, formula: formulas.get(cell.ref),
        binding: cell.formula || mapped?.readonly ? undefined : mapped,
        captured: !cell.formula && mapped?.captured ? mapped : undefined,
        bold: Object.hasOwn(font, 'b'), color: rgb(font.color), background: rgb(fill.fgColor),
      });
    }
    // Empty capturable fields remain available for editing, but never enter the PDF.
    const visibleRefs = new Set(cells.map(cell => cell.ref));
    for (const [key, binding] of bindings) if (key.startsWith(`${nameKey(sheet.name)}!`)) {
      const ref = key.slice(key.lastIndexOf('!') + 1);
      if (!visibleRefs.has(ref) && binding.field.type !== 'choice') cells.push({ ref, value: null, binding });
    }
    cells.sort((a, b) => parseRef(a.ref).row - parseRef(b.ref).row || parseRef(a.ref).col - parseRef(b.ref).col);
    const images: PreviewImage[] = [];
    let charts = 0;
    const sheetRelsPath = sheet.path.replace(/([^/]+)$/, '_rels/$1.rels');
    const sheetRels = await workbook.zip.file(sheetRelsPath)?.async('string');
    if (sheetRels) for (const rel of relationships(sheetRels)) {
      if (!String(rel['@_Type']).endsWith('/drawing')) continue;
      const drawingPath = resolvePart(sheet.path, String(rel['@_Target']));
      const drawingRels = await workbook.zip.file(drawingPath.replace(/([^/]+)$/, '_rels/$1.rels'))?.async('string');
      if (!drawingRels) continue;
      for (const resource of relationships(drawingRels)) {
        if (String(resource['@_Type']).endsWith('/chart')) charts++;
        if (!String(resource['@_Type']).endsWith('/image')) continue;
        const path = resolvePart(drawingPath, String(resource['@_Target']));
        const extension = path.split('.').at(-1)?.toLowerCase();
        const mime = ({ png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', svg: 'image/svg+xml', webp: 'image/webp' } as Record<string, string>)[extension ?? ''];
        const data = workbook.zip.file(path);
        if (mime && data) images.push({ dataUrl: `data:${mime};base64,${await data.async('base64')}`, label: `Imagen ${images.length + 1} de ${sheet.name}` });
      }
    }
    sheets.push({ name: sheet.name, cells, merges: sheet.merges, images, charts });
  }
  return { sheets, warnings: [
    'El navegador no recalcula fórmulas. Se muestra su expresión y, cuando existe, el valor almacenado en la plantilla; ese valor no es un resultado actualizado.',
    'La vista muestra el contenido del Excel generado, con sus coordenadas y celdas combinadas. Se omiten filas y columnas completamente vacías. Las gráficas conservan su definición en Excel y no se representan aquí.',
  ] };
}

function relationships(xml: string): Node[] {
  return list(object(object(parser.parse(xml)).Relationships).Relationship).map(object).filter(rel => rel['@_TargetMode'] !== 'External');
}
function resolvePart(from: string, target: string): string {
  const parts = (target.startsWith('/') ? [] : from.split('/').slice(0, -1));
  for (const part of target.replace(/\\/g, '/').split('/')) {
    if (part === '..') parts.pop(); else if (part && part !== '.') parts.push(part);
  }
  return parts.join('/');
}

export async function createWorkbookPreview(bytes: Uint8Array | ArrayBuffer, schema: WorkbookSchema, groups: RecordGroup[]): Promise<WorkbookPreviewResult> {
  const exported = await exportWorkbook(bytes, schema, groups.map(group => group.resolved));
  return { preview: await readWorkbookPreview(exported.bytes, schema, groups), report: exported.report };
}
