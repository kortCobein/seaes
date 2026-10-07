import assert from 'node:assert/strict';
import path from 'node:path';
import JSZip from 'jszip';
import { XMLParser, XMLValidator } from 'fast-xml-parser';

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', parseTagValue: false, trimValues: false });
export const asArray = <T>(value: T | T[] | undefined): T[] => value === undefined ? [] : Array.isArray(value) ? value : [value];

export interface WorkbookSnapshot {
  parts: Map<string, Uint8Array>;
  sheets: { name: string; part: string }[];
  cells: Map<string, Map<string, { value: string | number | boolean | null; formula: unknown }>>;
  formulas: Map<string, { ref: string; formula: unknown }[]>;
  structures: Map<string, unknown>;
  charts: string[];
}

const textOf = (node: unknown): string => {
  if (node === undefined || node === null) return '';
  if (typeof node !== 'object') return String(node);
  const v = node as Record<string, any>;
  if ('#text' in v) return String(v['#text']);
  if ('t' in v) return textOf(v.t);
  if ('r' in v) return asArray(v.r).map(r => textOf(r)).join('');
  return '';
};

export async function snapshotWorkbook(bytes: Uint8Array): Promise<WorkbookSnapshot> {
  const zip = await JSZip.loadAsync(bytes);
  const parts = new Map<string, Uint8Array>();
  for (const entry of Object.values(zip.files)) {
    if (entry.dir) continue;
    const content = await entry.async('uint8array');
    parts.set(entry.name, content);
    if (entry.name.endsWith('.xml') || entry.name.endsWith('.rels')) {
      assert.equal(XMLValidator.validate(new TextDecoder().decode(content)), true, `XML inválido: ${entry.name}`);
    }
  }
  const xml = (name: string) => parser.parse(new TextDecoder().decode(parts.get(name)!));
  assert.ok(parts.has('[Content_Types].xml'), 'Falta Content Types');
  const workbook = xml('xl/workbook.xml').workbook;
  const workbookRels = asArray<any>(xml('xl/_rels/workbook.xml.rels').Relationships.Relationship);
  const sheets = asArray<any>(workbook.sheets.sheet).map(sheet => {
    const rel = workbookRels.find(r => r['@_Id'] === sheet['@_r:id']);
    assert.ok(rel, `Relación de hoja ausente: ${sheet['@_name']}`);
    const target = String(rel['@_Target']);
    return { name: String(sheet['@_name']), part: target.startsWith('/') ? target.slice(1) : path.posix.normalize(`xl/${target}`) };
  });
  const shared = parts.has('xl/sharedStrings.xml') ? asArray<any>(xml('xl/sharedStrings.xml').sst.si).map(textOf) : [];
  const cells: WorkbookSnapshot['cells'] = new Map();
  const formulas: WorkbookSnapshot['formulas'] = new Map();
  const structures: WorkbookSnapshot['structures'] = new Map();
  for (const sheet of sheets) {
    assert.ok(parts.has(sheet.part), `Hoja inexistente: ${sheet.part}`);
    const ws = xml(sheet.part).worksheet;
    const cellMap = new Map<string, { value: string | number | boolean | null; formula: unknown }>();
    const sheetFormulas: { ref: string; formula: unknown }[] = [];
    const rows = asArray<any>(ws.sheetData?.row);
    for (const row of rows) {
      for (const cell of asArray<any>(row.c)) {
        const ref = String(cell['@_r']);
        let value: string | number | boolean | null = null;
        if (cell['@_t'] === 's') value = shared[Number(textOf(cell.v))] ?? '';
        else if (cell['@_t'] === 'inlineStr') value = textOf(cell.is);
        else if (cell['@_t'] === 'b') value = textOf(cell.v) === '1';
        else if (cell.v !== undefined) {
          const raw = textOf(cell.v);
          value = cell['@_t'] === 'str' || cell['@_t'] === 'e' || !Number.isFinite(Number(raw)) ? raw : Number(raw);
        }
        cellMap.set(ref, { value, formula: cell.f });
        if (cell.f !== undefined) sheetFormulas.push({ ref, formula: cell.f });
      }
    }
    cells.set(sheet.name, cellMap);
    formulas.set(sheet.name, sheetFormulas);
    // Exclude cell contents only. Dimensions, row attributes and cell styles must survive.
    const { sheetData, ...rest } = ws;
    structures.set(sheet.name, {
      ...rest,
      rows: rows.map(row => {
        const { c, ...attrs } = row;
        return { ...attrs, cells: asArray<any>(c).map(cell => {
          const { v, is, f, '@_t': type, ...cellAttrs } = cell;
          return cellAttrs;
        }) };
      }),
    });
  }
  for (const [name, bytes] of parts) {
    if (!name.endsWith('.rels')) continue;
    const relationships = asArray<any>(parser.parse(new TextDecoder().decode(bytes)).Relationships?.Relationship);
    const base = name === '_rels/.rels' ? '' : name.replace(/\/\_rels\/[^/]+\.rels$/, '');
    for (const rel of relationships) {
      if (rel['@_TargetMode'] === 'External') continue;
      const target = String(rel['@_Target']).split('#')[0];
      if (!target) continue;
      const decoded = decodeURIComponent(target);
      const resolved = decoded.startsWith('/') ? decoded.slice(1) : path.posix.normalize(`${base}/${decoded}`).replace(/^\//, '');
      assert.ok(parts.has(resolved), `Relación rota: ${name} → ${resolved}`);
    }
  }
  return { parts, sheets, cells, formulas, structures, charts: [...parts.keys()].filter(n => /^xl\/charts\/chart\d+\.xml$/.test(n)) };
}

export function assertPreserved(before: WorkbookSnapshot, after: WorkbookSnapshot): void {
  assert.deepEqual(after.sheets, before.sheets, 'Cambió el orden, nombre o destino de las hojas');
  assert.deepEqual(after.formulas, before.formulas, 'Se alteraron las fórmulas');
  assert.deepEqual(after.charts, before.charts, 'Cambió el conjunto de gráficas');
  const allowedChanges = new Set([...before.sheets.map(s => s.part), 'xl/workbook.xml', 'xl/calcChain.xml']);
  for (const [part, bytes] of before.parts) {
    if (allowedChanges.has(part)) continue;
    assert.deepEqual(after.parts.get(part), bytes, `Se modificó una parte ajena a los datos: ${part}`);
  }
  for (const [sheet, structure] of before.structures) {
    assert.deepEqual(after.structures.get(sheet), structure, `Cambió estructura/estilos/dimensiones de ${sheet}`);
  }
}

function escapeXML(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
}

export async function replaceCell(bytes: Uint8Array, sheetName: string, ref: string, value: string | number | boolean, options: { formula?: string } = {}): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(bytes);
  const workbook = parser.parse(await zip.file('xl/workbook.xml')!.async('string')).workbook;
  const rels = asArray<any>(parser.parse(await zip.file('xl/_rels/workbook.xml.rels')!.async('string')).Relationships.Relationship);
  const source = asArray<any>(workbook.sheets.sheet).find(s => s['@_name'] === sheetName);
  const rel = rels.find(r => r['@_Id'] === source?.['@_r:id']);
  const target = String(rel?.['@_Target'] ?? '');
  const sheet = source && rel ? { part: target.startsWith('/') ? target.slice(1) : path.posix.normalize(`xl/${target}`) } : undefined;
  assert.ok(sheet, `Hoja de fixture inexistente: ${sheetName}`);
  const entry = zip.file(sheet.part)!;
  let xml = await entry.async('string');
  const re = new RegExp(`<c\\b([^>]*\\br="${ref}"[^>]*)(?:\\/>|>([\\s\\S]*?)<\\/c>)`);
  const existing = xml.match(re);
  assert.ok(existing, `Celda de fixture no serializada: ${sheetName}!${ref}`);
  const attrs = existing[1].replace(/\s+t="[^"]*"/, '').replace(/\/$/, '');
  const payload = options.formula !== undefined
    ? `<c${attrs}><f>${escapeXML(options.formula)}</f><v>${escapeXML(String(value))}</v></c>`
    : typeof value === 'string'
      ? `<c${attrs} t="inlineStr"><is><t xml:space="preserve">${escapeXML(value)}</t></is></c>`
      : `<c${attrs}${typeof value === 'boolean' ? ' t="b"' : ''}><v>${typeof value === 'boolean' ? (value ? '1' : '0') : value}</v></c>`;
  xml = xml.replace(re, payload);
  zip.file(sheet.part, xml);
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}
