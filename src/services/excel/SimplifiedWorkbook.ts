import type { ExportReport, SeaesRecord, WorkbookSchema } from '../../models/types';
import { assertValidXml, formulaSignatures, nameKey, openPackage } from './package';
import type { WorkbookPackage } from './package';

const q = '(?:[A-Za-z_][\\w.-]*:)?';
const tags = (name: string) => new RegExp(`<${q}${name}\\b[^>]*?(?:\\/>|>[\\s\\S]*?<\\/${q}${name}>)`, 'g');
const decode = (value: string): string => value.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, entity: string) => {
  if (entity[0] === '#') return String.fromCodePoint(entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1)));
  return ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" } as Record<string, string>)[entity.toLowerCase()];
});
const attr = (xml: string, name: string): string | undefined => {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`\\s${escaped}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`).exec(xml);
  return match ? decode(match[1] ?? match[2]) : undefined;
};
const replaceAttr = (xml: string, name: string, value: number): string => xml.replace(new RegExp(`(\\s${name}\\s*=\\s*)(?:"[^"]*"|'[^']*')`), `$1"${value}"`);
const sheetKey = (value: string) => value.normalize('NFC').toLowerCase();
const relsFor = (path: string): string => path ? path.replace(/(^|\/)([^/]+)$/, '$1_rels/$2.rels') : '_rels/.rels';
const ownerOf = (path: string): string => path === '_rels/.rels' ? '' : path.replace(/(^|\/)_rels\/([^/]+)\.rels$/, '$1$2');

interface Relationship { id: string; type: string; target?: string; external: boolean; raw: string }

function resolvePart(owner: string, target: string): string | undefined {
  const path = decodeURIComponent(target.split('#')[0]);
  if (!path) return undefined;
  const pieces: string[] = [];
  const base = owner.includes('/') ? owner.slice(0, owner.lastIndexOf('/') + 1) : '';
  for (const piece of (path.startsWith('/') ? path.slice(1) : base + path).replace(/\\/g, '/').split('/')) {
    if (piece === '..') {
      if (!pieces.length) throw new Error('Una relación interna sale del paquete Excel.');
      pieces.pop();
    } else if (piece && piece !== '.') pieces.push(piece);
  }
  return pieces.join('/');
}

async function relationships(workbook: WorkbookPackage): Promise<Map<string, Relationship[]>> {
  const result = new Map<string, Relationship[]>();
  for (const part of Object.values(workbook.zip.files)) {
    if (part.dir || !part.name.endsWith('.rels')) continue;
    const owner = ownerOf(part.name);
    const xml = await part.async('string');
    assertValidXml(xml, part.name);
    result.set(owner, [...xml.matchAll(tags('Relationship'))].map(match => {
      const raw = match[0], external = attr(raw, 'TargetMode') === 'External';
      return { id: attr(raw, 'Id') ?? '', type: attr(raw, 'Type') ?? '', external, raw,
        target: external ? undefined : resolvePart(owner, attr(raw, 'Target') ?? '') };
    }));
  }
  return result;
}

function dependencies(text: string, names: Map<string, string>, orderedNames: string[]): Set<string> {
  const found = new Set<string>();
  // A 3-D reference depends on every sheet between its endpoints, including empty ones.
  const token = "(?:'(?:[^']|'')+'|[\\p{L}\\p{N}_.$\\\\]+)";
  for (const match of text.matchAll(new RegExp(`(${token}(?::${token})?)!`, 'gu'))) {
    if (match[1].includes('[') || match[1].includes(']')) continue;
    const endpoints = match[1].split(':').map(part => part.replace(/^'|'$/g, '').replace(/''/g, "'"));
    const from = names.get(sheetKey(endpoints[0]));
    const to = endpoints.length === 2 ? names.get(sheetKey(endpoints[1])) : from;
    if (from && to) {
      const start = orderedNames.indexOf(from), end = orderedNames.indexOf(to);
      for (const name of orderedNames.slice(Math.min(start, end), Math.max(start, end) + 1)) found.add(name);
    }
  }
  return found;
}

function formulaTexts(xml: string): string[] {
  const results: string[] = [];
  for (const name of ['f', 'formula', 'formula1', 'formula2', 'definedName', 'calculatedColumnFormula', 'totalsRowFormula']) {
    for (const match of xml.matchAll(tags(name))) results.push(decode(match[0].replace(/^<[^>]+>/, '').replace(/<\/[^>]+>$/, '')));
  }
  return results;
}

/** Prune only parts owned exclusively by excluded sheets. Shared and unknown parts stay. */
export async function simplifyWorkbook(bytes: Uint8Array, schema: WorkbookSchema, records: SeaesRecord[], fullReport: ExportReport): Promise<{ bytes: Uint8Array; report: ExportReport }> {
  const workbook = await openPackage(bytes);
  const graph = await relationships(workbook);
  const sheetNames = workbook.sheets.map(sheet => sheet.name);
  const names = new Map(sheetNames.map(name => [sheetKey(name), name]));
  const sheetPaths = new Set(workbook.sheets.map(sheet => sheet.path));
  const byPath = new Map(workbook.sheets.map(sheet => [sheet.path, sheet.name]));
  const sections = new Map(schema.sections.map(section => [section.id, section]));
  const populated = new Set(records.filter(record => Object.values(record.values).some(value => value !== null && value !== undefined && value !== ''))
    .map(record => sections.get(record.sectionId)?.sheet).filter((value): value is string => !!value).map(nameKey));
  const capturable = new Set(schema.sections.map(section => nameKey(section.sheet)));
  const keep = new Set(workbook.sheets.filter(sheet => populated.has(nameKey(sheet.name)) ||
    (!capturable.has(nameKey(sheet.name)) && !/ejemplo|muestra|rasgos|indicaciones|instrucciones|definiciones|cambios/i.test(sheet.name))).map(sheet => sheet.name));
  const warnings: string[] = [];
  const sheetTags = [...workbook.workbookXml.matchAll(tags('sheet'))].map(match => match[0]);
  const visible = sheetTags.filter(tag => !attr(tag, 'state') || attr(tag, 'state') === 'visible').map(tag => attr(tag, 'name')!);
  if (![...keep].some(name => visible.includes(name))) {
    const fallback = visible.find(name => capturable.has(nameKey(name))) ?? visible[0] ?? sheetNames[0];
    if (!fallback) throw new Error('No existe una hoja que pueda conservarse en el Excel simplificado.');
    keep.add(fallback);
    warnings.push('Se conservó una hoja visible para mantener un libro válido.');
  }
  const originalKeep = new Set(keep);
  // Scoped names can be used from other sheets. Keep their owner and remap their local index.
  for (const match of workbook.workbookXml.matchAll(tags('definedName'))) {
    const scope = attr(match[0], 'localSheetId');
    if (scope !== undefined && sheetNames[Number(scope)]) keep.add(sheetNames[Number(scope)]);
  }
  const allParts = Object.values(workbook.zip.files).filter(part => !part.dir).map(part => part.name);
  const owned = new Set<string>();
  const visitOwned = (path: string) => {
    if (owned.has(path)) return;
    owned.add(path);
    if (workbook.zip.file(relsFor(path))) owned.add(relsFor(path));
    for (const rel of graph.get(path) ?? []) if (rel.target && rel.target !== 'xl/workbook.xml' && !sheetPaths.has(rel.target)) visitOwned(rel.target);
  };
  for (const sheet of workbook.sheets) visitOwned(sheet.path);
  const globalRoots = allParts.filter(path => !owned.has(path) && !path.endsWith('.rels') && path !== '[Content_Types].xml');
  const calcParts = new Set([...graph.values()].flat().filter(rel => rel.type.endsWith('/calcChain') && rel.target).map(rel => rel.target!));
  const reachable = (): Set<string> => {
    const result = new Set<string>();
    const visit = (path: string) => {
      if (result.has(path) || calcParts.has(path)) return;
      result.add(path);
      if (workbook.zip.file(relsFor(path))) result.add(relsFor(path));
      for (const rel of graph.get(path) ?? []) {
        if (!rel.target || (path === 'xl/workbook.xml' && sheetPaths.has(rel.target) && !keep.has(byPath.get(rel.target)!))) continue;
        visit(rel.target);
      }
    };
    visit('');
    for (const root of globalRoots) visit(root);
    for (const sheet of workbook.sheets) if (keep.has(sheet.name)) visit(sheet.path);
    return result;
  };
  const xmlCache = new Map(workbook.sheets.map(sheet => [sheet.path, sheet.xml]));
  const readXml = async (path: string): Promise<string> => {
    if (!xmlCache.has(path)) xmlCache.set(path, await workbook.zip.file(path)!.async('string'));
    return xmlCache.get(path)!;
  };
  // Table references do not contain a sheet name. Resolve them through table ownership.
  const tableOwners = new Map<string, string[]>();
  for (const sheet of workbook.sheets) {
    for (const rel of graph.get(sheet.path) ?? []) {
      if (!rel.type.endsWith('/table') || !rel.target) continue;
      const xml = await readXml(rel.target);
      const tag = xml.match(new RegExp(`<${q}table\\b[^>]*>`))?.[0] ?? '';
      for (const name of [attr(tag, 'name'), attr(tag, 'displayName')]) if (name) tableOwners.set(name, [...(tableOwners.get(name) ?? []), sheet.name]);
    }
  }
  // Opaque workbook extensions/macros may encode sheet indexes outside XML formulas.
  const opaque = allParts.some(path => /(?:vbaProject|vbaData|\/model\/|\/activeX\/|\/externalLinks\/)/i.test(path)) ||
    new RegExp(`<${q}(?:customWorkbookViews|extLst)\\b`).test(workbook.workbookXml);
  if (opaque) {
    sheetNames.forEach(name => keep.add(name));
    warnings.push('Se conservaron hojas por dependencias externas o extensiones del libro que no pueden simplificarse con seguridad.');
  }
  const scanned = new Set<string>();
  let live = reachable();
  let previous = -1;
  while (previous !== keep.size) {
    previous = keep.size;
    live = reachable();
    for (const path of live) {
      if (sheetPaths.has(path)) keep.add(byPath.get(path)!);
      if (!path.endsWith('.xml') || scanned.has(path) || !workbook.zip.file(path)) continue;
      scanned.add(path);
      const xml = await readXml(path);
      for (const formula of formulaTexts(xml)) {
        // Dynamic references and sheet-count/index functions cannot be proven independent.
        if (/\b(?:INDIRECT|SHEET|SHEETS|GET\.WORKBOOK|EVALUATE)\s*\(/i.test(formula)) sheetNames.forEach(name => keep.add(name));
        for (const name of dependencies(formula, names, sheetNames)) keep.add(name);
        for (const [table, owners] of tableOwners) {
          const escaped = table.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          if (new RegExp(`(^|[^\\p{L}\\p{N}_.])${escaped}(?![\\p{L}\\p{N}_.])`, 'iu').test(formula)) owners.forEach(name => keep.add(name));
        }
      }
      for (const match of xml.matchAll(tags('worksheetSource'))) {
        const name = attr(match[0], 'sheet');
        const known = name && names.get(sheetKey(name));
        if (known) keep.add(known);
      }
    }
  }
  const removedSheets = workbook.sheets.filter(sheet => !keep.has(sheet.name));
  const retainedDependencySheets = workbook.sheets.filter(sheet => keep.has(sheet.name) && !originalKeep.has(sheet.name)).map(sheet => sheet.name);
  if (!removedSheets.length) return { bytes, report: { ...fullReport, mode: 'simplified', removedSheets: [], retainedDependencySheets, warnings: [...fullReport.warnings, ...warnings] } };
  live = reachable();
  const removedParts = new Set(allParts.filter(path => (owned.has(path) && !live.has(path)) || calcParts.has(path) || [...calcParts].some(calc => relsFor(calc) === path)));
  const retained = workbook.sheets.filter(sheet => keep.has(sheet.name));
  const remapIndex = (old: number) => Math.max(0, retained.findIndex(sheet => sheet.name === sheetNames[old]));
  let updatedWorkbook = workbook.workbookXml.replace(tags('sheet'), tag => keep.has(attr(tag, 'name') ?? '') ? tag : '');
  updatedWorkbook = updatedWorkbook.replace(tags('definedName'), tag => {
    const scope = attr(tag, 'localSheetId');
    return scope === undefined ? tag : replaceAttr(tag, 'localSheetId', remapIndex(Number(scope)));
  }).replace(tags('workbookView'), tag => {
    for (const key of ['activeTab', 'firstSheet']) {
      const value = attr(tag, key);
      if (value !== undefined) tag = replaceAttr(tag, key, remapIndex(Number(value)));
    }
    return tag;
  });
  const modified = new Set<string>();
  const writeXml = (path: string, xml: string) => { assertValidXml(xml, path); workbook.zip.file(path, xml); modified.add(path); };
  writeXml('xl/workbook.xml', updatedWorkbook);
  // The official template links every sheet to examples and the index. These are
  // navigation links, not data dependencies: remove only links to excluded tabs.
  // Cell content, formatting, formulas and all links to retained sheets stay intact.
  for (const sheet of retained) {
    const updated = sheet.xml.replace(tags('hyperlink'), tag => {
      const location = attr(tag, 'location');
      return location && [...dependencies(location, names, sheetNames)].some(name => !keep.has(name)) ? '' : tag;
    }).replace(tags('hyperlinks'), tag => new RegExp(`<${q}hyperlink\\b`).test(tag) ? tag : '');
    if (updated !== sheet.xml) writeXml(sheet.path, updated);
  }
  for (const [owner, rels] of graph) {
    if (removedParts.has(owner)) continue;
    const removedIds = new Set(rels.filter(rel => rel.target && removedParts.has(rel.target)).map(rel => rel.id));
    if (!removedIds.size) continue;
    const path = relsFor(owner);
    writeXml(path, (await readXml(path)).replace(tags('Relationship'), tag => removedIds.has(attr(tag, 'Id') ?? '') ? '' : tag));
  }
  const contentTypes = '[Content_Types].xml';
  writeXml(contentTypes, (await readXml(contentTypes)).replace(tags('Override'), tag => removedParts.has((attr(tag, 'PartName') ?? '').replace(/^\//, '')) ? '' : tag));
  // Extended properties are optional metadata; remove stale sheet-title/count vectors.
  const properties = 'docProps/app.xml';
  if (workbook.zip.file(properties)) {
    const before = await readXml(properties);
    const after = before.replace(tags('HeadingPairs'), '').replace(tags('TitlesOfParts'), '');
    if (before !== after) writeXml(properties, after);
  }
  for (const path of removedParts) workbook.zip.remove(path);
  const output = await workbook.zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  const verified = await openPackage(output);
  const resultGraph = await relationships(verified);
  for (const [owner, rels] of resultGraph) for (const rel of rels) {
    if (rel.target && !verified.zip.file(rel.target)) throw new Error(`Relación interna no válida en el Excel simplificado: ${owner} → ${rel.target}.`);
  }
  if (verified.sheets.length !== retained.length || verified.sheets.some((sheet, index) => sheet.name !== retained[index].name)) throw new Error('No se pudieron verificar las hojas del Excel simplificado.');
  let preservedParts = 0;
  for (const path of allParts) {
    if (removedParts.has(path) || modified.has(path)) continue;
    const result = verified.zip.file(path);
    if (!result) throw new Error(`Falta una parte conservada del Excel simplificado: ${path}.`);
    const a = await workbook.zip.file(path)!.async('uint8array'), b = await result.async('uint8array');
    if (a.length !== b.length || a.some((value, index) => value !== b[index])) throw new Error(`Se alteró una parte conservada del Excel simplificado: ${path}.`);
    preservedParts++;
  }
  const formulas = verified.sheets.reduce((count, sheet) => count + formulaSignatures(sheet.xml).length, 0);
  if (retainedDependencySheets.length) warnings.push(`Se conservaron ${retainedDependencySheets.length} hojas necesarias para fórmulas, gráficos, nombres o relaciones.`);
  return { bytes: output, report: { ...fullReport, mode: 'simplified', sheets: verified.sheets.length, formulas,
    charts: Object.keys(verified.zip.files).filter(path => /^xl\/charts\/chart\d+\.xml$/.test(path)).length,
    preservedParts, removedSheets: removedSheets.map(sheet => sheet.name), retainedDependencySheets,
    removedParts: [...removedParts], modifiedParts: [...new Set([...(fullReport.modifiedParts as string[] ?? []), ...modified])].filter(path => !removedParts.has(path)),
    warnings: [...fullReport.warnings, ...warnings], verified: true } };
}
