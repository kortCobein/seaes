import JSZip from 'jszip';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import type { Scalar } from '../../models/types';

type XmlNode = Record<string, unknown>;
export interface WorkbookCell { ref: string; value: Scalar; formula: boolean; type: string; style?: string }
export interface WorkbookSheet { name: string; path: string; xml: string; cells: Map<string, WorkbookCell>; merges: string[] }
export interface WorkbookPackage { zip: JSZip; sheets: WorkbookSheet[]; workbookXml: string; sharedStrings: string[] }

const parser = new XMLParser({ ignoreAttributes: false, parseTagValue: false, parseAttributeValue: false, trimValues: false, removeNSPrefix: true, htmlEntities: true });
export const list = <T>(value: T | T[] | undefined): T[] => value === undefined ? [] : Array.isArray(value) ? value : [value];
const obj = (value: unknown): XmlNode => value !== null && typeof value === 'object' ? value as XmlNode : {};
const text = (value: unknown): string => typeof value === 'object' ? String(obj(value)['#text'] ?? '') : String(value ?? '');

/** Shared strings may contain formatting runs; their text is data, never markup or instructions. */
function richText(value: unknown): string {
  const node = obj(value);
  if (node.t !== undefined) return text(node.t);
  return list(node.r).map(run => text(obj(run).t)).join('');
}

export function normalized(value: unknown): string {
  return String(value ?? '').normalize('NFC').replace(/\s+/g, ' ').trim();
}
export function nameKey(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\binds?\b/g, 'indicador').replace(/\banexos\b/g, 'anexo').replace(/\b0+(\d)/g, '$1').replace(/[^a-z0-9]/g, '');
}
export function equalValue(a: Scalar | undefined, b: Scalar | undefined): boolean {
  if (a == null || a === '') return b == null || b === '';
  if (b == null || b === '') return false;
  if (typeof a === 'number' && typeof b === 'number') return a === b;
  return normalized(a) === normalized(b);
}
export function parseRef(ref: string): { col: number; row: number } {
  const match = /^\$?([A-Z]+)\$?([1-9]\d*)$/i.exec(ref);
  if (!match) throw new Error(`Referencia de celda inválida: ${ref}`);
  let col = 0;
  for (const ch of match[1].toUpperCase()) col = col * 26 + ch.charCodeAt(0) - 64;
  return { col, row: Number(match[2]) };
}
export function makeRef(col: number, row: number): string {
  if (col < 1 || col > 16384 || row < 1 || row > 1048576) throw new Error('La estructura desplazada excede los límites de Excel.');
  let name = '';
  for (let value = col; value > 0; value = Math.floor((value - 1) / 26)) name = String.fromCharCode(65 + (value - 1) % 26) + name;
  return `${name}${row}`;
}
export function shiftedRef(ref: string, offset: { col: number; row: number }): string {
  const parsed = parseRef(ref);
  return makeRef(parsed.col + offset.col, parsed.row + offset.row);
}

function safePartPath(target: string): string {
  const parts: string[] = [];
  for (const segment of (target.startsWith('/') ? target.slice(1) : `xl/${target}`).replace(/\\/g, '/').split('/')) {
    if (segment === '..') parts.pop();
    else if (segment && segment !== '.') parts.push(segment);
  }
  const path = parts.join('/');
  if (!path.startsWith('xl/')) throw new Error('El libro contiene una relación de hoja no válida.');
  return path;
}

export function parseSheetXml(name: string, path: string, xml: string, sharedStrings: string[]): WorkbookSheet {
  if (!/<(?:\w+:)?worksheet\b/.test(xml) || !/<\/(?:\w+:)?worksheet>/.test(xml)) throw new Error(`No se pudo leer la hoja «${name}».`);
  const cells = new Map<string, WorkbookCell>();
  // The supplied books have almost two million styled empty cells. Do not materialize
  // those cells (or a full worksheet object tree) in browser memory.
  for (const match of xml.matchAll(/<(?:\w+:)?c\b[^>]*?(?:\/>|>[\s\S]*?<\/(?:\w+:)?c>)/g)) {
      if (match[0].endsWith('/>') || !/<(?:\w+:)?(?:v|is|f)(?:\s|>|\/)/.test(match[0])) continue;
      const cell = obj(obj(parser.parse(match[0])).c);
      const ref = String(cell['@_r'] ?? '').replace(/\$/g, '').toUpperCase();
      if (!ref) continue;
      const type = String(cell['@_t'] ?? 'n');
      const raw = text(cell.v);
      let value: Scalar = null;
      if (type === 's') value = sharedStrings[Number(raw)] ?? null;
      else if (type === 'inlineStr') value = richText(cell.is);
      else if (type === 'b') value = raw === '1';
      else if (type === 'str' || type === 'e' || type === 'd') value = raw || null;
      else if (raw !== '') value = Number.isFinite(Number(raw)) ? Number(raw) : raw;
      cells.set(ref, { ref, value, formula: Object.hasOwn(cell, 'f'), type, style: cell['@_s'] === undefined ? undefined : String(cell['@_s']) });
  }
  const merges = [...xml.matchAll(/<(?:\w+:)?mergeCell\b[^>]*\bref=["']([^"']+)["'][^>]*\/>/g)].map(match => match[1]);
  return { name, path, xml, cells, merges };
}

export async function openPackage(bytes: Uint8Array | ArrayBuffer): Promise<WorkbookPackage> {
  if (bytes.byteLength > 40 * 1024 * 1024) throw new Error('El archivo supera el límite de 40 MB.');
  let zip: JSZip;
  try { zip = await JSZip.loadAsync(bytes); }
  catch { throw new Error('No se puede abrir el archivo. Selecciona un libro .xlsx válido y sin contraseña.'); }
  if (Object.keys(zip.files).length > 10000) throw new Error('El libro contiene demasiadas partes para procesarse en el navegador.');
  const workbookPart = zip.file('xl/workbook.xml');
  const relsPart = zip.file('xl/_rels/workbook.xml.rels');
  if (!workbookPart || !relsPart) throw new Error('El archivo no contiene la estructura de un libro Excel .xlsx.');
  const [workbookXml, relsXml, sharedXml] = await Promise.all([workbookPart.async('string'), relsPart.async('string'), zip.file('xl/sharedStrings.xml')?.async('string')]);
  const sharedStrings = sharedXml ? list(obj(obj(parser.parse(sharedXml)).sst).si).map(richText) : [];
  const relationships = new Map(list(obj(obj(parser.parse(relsXml)).Relationships).Relationship).filter(rel => obj(rel)['@_TargetMode'] !== 'External').map(rel => [String(obj(rel)['@_Id']), String(obj(rel)['@_Target'])]));
  const sheets: WorkbookSheet[] = [];
  let totalXml = (sharedXml?.length ?? 0) + workbookXml.length;
  for (const item of list(obj(obj(obj(parser.parse(workbookXml)).workbook).sheets).sheet)) {
    const sheet = obj(item);
    const target = relationships.get(String(sheet['@_id']));
    if (!target) throw new Error(`No se encontró la relación de la hoja ${String(sheet['@_name'])}.`);
    const path = safePartPath(target);
    const part = zip.file(path);
    if (!part) throw new Error(`Falta el archivo interno de la hoja ${String(sheet['@_name'])}.`);
    const xml = await part.async('string');
    totalXml += xml.length;
    if (totalXml > 90 * 1024 * 1024) throw new Error('El contenido descomprimido del libro excede el límite de 90 MB.');
    sheets.push(parseSheetXml(String(sheet['@_name']), path, xml, sharedStrings));
  }
  return { zip, sheets, workbookXml, sharedStrings };
}

export function xmlEscape(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}
export function assertValidXml(xml: string, name: string): void {
  const valid = XMLValidator.validate(xml);
  if (valid !== true) throw new Error(`Falló la validación XML de ${name}. No se generó el libro.`);
}
export function formulaSignatures(xml: string): string[] {
  return [...xml.matchAll(/<(?:\w+:)?c\b[^>]*?(?:\/>|>[\s\S]*?<\/(?:\w+:)?c>)/g)].flatMap(match => {
    if (match[0].endsWith('/>')) return [];
    const formula = match[0].match(/<(?:\w+:)?f\b[^>]*(?:\/>|>[\s\S]*?<\/(?:\w+:)?f>)/);
    const ref = match[0].match(/\br=["']([^"']+)["']/)?.[1];
    return formula ? [`${ref}:${formula[0]}`] : [];
  });
}
