import type { ExportReport, Scalar, SeaesRecord, WorkbookSchema } from '../../models/types';
import { assertValidXml, equalValue, formulaSignatures, nameKey, openPackage, parseRef, parseSheetXml, xmlEscape } from './package';
import type { WorkbookSheet } from './package';

interface CellChange { sheet: WorkbookSheet; ref: string; value: Scalar }
const q = '(?:[A-Za-z_][\\w.-]*:)?';
const cellPattern = new RegExp(`<${q}c\\b[^>]*?(?:\\/>|>[\\s\\S]*?<\\/${q}c>)`, 'g');
const rowPattern = new RegExp(`<${q}row\\b[^>]*?(?:\\/>|>[\\s\\S]*?<\\/${q}row>)`, 'g');
const refOf = (xml: string): string | undefined => /\br\s*=\s*["']([^"']+)["']/.exec(xml)?.[1];

function cellXml(original: string | undefined, ref: string, value: Scalar, fallbackPrefix = ''): string {
  const prefix = original?.match(/^<([A-Za-z_][\w.-]*:)?c\b/)?.[1] ?? fallbackPrefix;
  const tag = `${prefix}c`;
  const attrs = original ? original.match(/^<[^\s/>]+([^>]*?)(?:\/>|>)/)?.[1].replace(/\s+t\s*=\s*(?:"[^"]*"|'[^']*')/g, '') ?? ` r="${ref}"` : ` r="${ref}"`;
  if (original && new RegExp(`<${q}f(?:\\s|>|\\/)`).test(original)) throw new Error(`No se puede escribir sobre la fórmula de ${ref}.`);
  let extras = original?.replace(/^<[^>]*>/, '').replace(/<\/[^>]*>$/, '') ?? '';
  if (original?.endsWith('/>')) extras = '';
  extras = extras.replace(new RegExp(`<${q}(?:v|is)\\b[^>]*?(?:\\/>|>[\\s\\S]*?<\\/${q}(?:v|is)>)`, 'g'), '');
  if (value === null || value === '') return extras ? `<${tag}${attrs}>${extras}</${tag}>` : `<${tag}${attrs}/>`;
  if (typeof value === 'number') return `<${tag}${attrs}><${prefix}v>${value}</${prefix}v>${extras}</${tag}>`;
  if (typeof value === 'boolean') return `<${tag}${attrs} t="b"><${prefix}v>${value ? '1' : '0'}</${prefix}v>${extras}</${tag}>`;
  return `<${tag}${attrs} t="inlineStr"><${prefix}is><${prefix}t xml:space="preserve">${xmlEscape(value)}</${prefix}t></${prefix}is>${extras}</${tag}>`;
}

function replaceCell(xml: string, ref: string, value: Scalar): string {
  let found = false;
  const replaced = xml.replace(cellPattern, raw => {
    if (refOf(raw) !== ref) return raw;
    if (found) throw new Error(`La plantilla contiene una celda duplicada: ${ref}.`);
    found = true;
    return cellXml(raw, ref, value);
  });
  if (found) return replaced;
  const target = parseRef(ref);
  const prefix = xml.match(/<([A-Za-z_][\w.-]*:)?sheetData\b/)?.[1] ?? '';
  const newCell = cellXml(undefined, ref, value, prefix);
  let rowFound = false;
  const withRow = xml.replace(rowPattern, row => {
    if (Number(refOf(row)) !== target.row) return row;
    rowFound = true;
    if (row.endsWith('/>')) return row.slice(0, -2) + `>${newCell}</${prefix}row>`;
    let inserted = false;
    const updated = row.replace(cellPattern, cell => {
      const candidate = refOf(cell);
      if (!inserted && candidate && parseRef(candidate).col > target.col) { inserted = true; return newCell + cell; }
      return cell;
    });
    return inserted ? updated : updated.replace(new RegExp(`</${q}row>$`), `${newCell}</${prefix}row>`);
  });
  if (rowFound) return withRow;
  const newRow = `<${prefix}row r="${target.row}">${newCell}</${prefix}row>`;
  let inserted = false;
  const withNewRow = xml.replace(rowPattern, row => {
    if (!inserted && Number(refOf(row)) > target.row) { inserted = true; return newRow + row; }
    return row;
  });
  if (inserted) return withNewRow;
  if (new RegExp(`<${q}sheetData\\b[^>]*\\/>`).test(xml)) return xml.replace(new RegExp(`<${q}sheetData\\b([^>]*?)\\/>`), `<${prefix}sheetData$1>${newRow}</${prefix}sheetData>`);
  if (!new RegExp(`</${q}sheetData>`).test(xml)) throw new Error('La hoja de destino no contiene una zona de datos válida.');
  return xml.replace(new RegExp(`</${q}sheetData>`), `${newRow}</${prefix}sheetData>`);
}

function replaceCells(xml: string, changes: CellChange[]): string {
  const pending = new Map(changes.map(change => [change.ref, change.value]));
  const seen = new Set<string>();
  const updated = xml.replace(cellPattern, raw => {
    const ref = refOf(raw);
    if (!ref || !pending.has(ref)) return raw;
    if (seen.has(ref)) throw new Error(`La plantilla contiene una celda duplicada: ${ref}.`);
    seen.add(ref);
    return cellXml(raw, ref, pending.get(ref)!);
  });
  let result = updated;
  // Official templates normally already contain every styled slot. Inserting an absent
  // cell is the exceptional path; ordinary export scans each worksheet only once.
  for (const [ref, value] of pending) if (!seen.has(ref)) result = replaceCell(result, ref, value);
  return result;
}

function recalculateOnOpen(xml: string): string {
  const pattern = new RegExp(`<${q}calcPr\\b[^>]*?(?:\\/>|>[\\s\\S]*?<\\/${q}calcPr>)`);
  const existing = xml.match(pattern)?.[0];
  const prefix = xml.match(/<([A-Za-z_][\w.-]*:)?workbook\b/)?.[1] ?? '';
  const attrs = existing?.match(/^<[^\s/>]+([^>]*?)(?:\/>|>)/)?.[1].replace(/\s+(?:calcMode|fullCalcOnLoad|forceFullCalc|calcOnSave)\s*=\s*(?:"[^"]*"|'[^']*')/g, '') ?? '';
  const updated = `<${prefix}calcPr${attrs} calcMode="auto" fullCalcOnLoad="1" forceFullCalc="1" calcOnSave="1"/>`;
  if (existing) return xml.replace(pattern, updated);
  // calcPr is after definedNames and before pivotCaches/customWorkbookViews/extLst in the OOXML sequence.
  const following = new RegExp(`<${q}(?:oleSize|customWorkbookViews|pivotCaches|smartTagPr|smartTagTypes|webPublishing|fileRecoveryPr|webPublishObjects|extLst)\\b`);
  const at = xml.search(following);
  return at >= 0 ? xml.slice(0, at) + updated + xml.slice(at) : xml.replace(new RegExp(`</${q}workbook>`), `${updated}</${prefix}workbook>`);
}

function validateScalar(value: Scalar, location: string): void {
  if (typeof value === 'number' && !Number.isFinite(value)) throw new Error(`${location}: el valor numérico no es finito.`);
  if (typeof value === 'string') {
    if (value.length > 32767) throw new Error(`${location}: el texto excede los 32 767 caracteres permitidos por Excel. Divide el contenido antes de exportar.`);
    if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/.test(value)) throw new Error(`${location}: el texto contiene un carácter de control no admitido por Excel.`);
  }
}

export class OutputWorkbookMapper {
  async export(bytes: Uint8Array | ArrayBuffer, schema: WorkbookSchema, records: SeaesRecord[]): Promise<{ bytes: Uint8Array; report: ExportReport }> {
    const workbook = await openPackage(bytes);
    const changes = new Map<string, CellChange>();
    const assignedValues = new Map<string, Scalar>();
    const sections = new Map(schema.sections.map(section => [section.id, section]));
    const annexSlots = new Map<string, number>();
    const fixedRows = new Set<string>();
    for (const record of records) {
      const section = sections.get(record.sectionId);
      if (!section) throw new Error(`No existe un destino para la sección ${record.sectionId}. No se descartaron registros.`);
      const sheet = workbook.sheets.find(candidate => nameKey(candidate.name) === nameKey(section.sheet));
      if (!sheet) throw new Error(`Falta la hoja de destino «${section.sheet}».`);
      let row;
      if (section.kind === 'annex') {
        const index = annexSlots.get(section.id) ?? 0;
        row = section.rows[index];
        if (!row) throw new Error(`«${section.label}» tiene ${section.rows.length} espacios en la plantilla y se recibieron más registros. Reduce o combina registros antes de exportar; no se truncó ningún dato.`);
        annexSlots.set(section.id, index + 1);
      } else {
        row = section.rows.find(candidate => candidate.id === record.rowId);
        if (!row) throw new Error(`No existe una fila de destino para ${section.label}: ${record.rowId}.`);
        const key = `${section.id}:${row.id}`;
        if (fixedRows.has(key)) throw new Error(`Hay más de un registro sin consolidar para ${section.label}: ${row.label}. Resuelve la coincidencia antes de exportar.`);
        fixedRows.add(key);
      }
      for (const [fieldId, value] of Object.entries(record.values)) {
        if (value == null || value === '') continue;
        const mapping = row.fields[fieldId];
        if (!mapping?.outputRef) throw new Error(`El campo ${fieldId} de ${section.label} no tiene destino de exportación. No se descartó su contenido.`);
        const ref = mapping.outputRef;
        validateScalar(value, `${sheet.name}!${ref}`);
        const existing = sheet.cells.get(ref);
        if (existing?.formula) throw new Error(`El destino ${sheet.name}!${ref} contiene una fórmula protegida. No se generó el archivo.`);
        const key = `${sheet.path}:${ref}`;
        if (assignedValues.has(key) && !equalValue(assignedValues.get(key), value)) throw new Error(`Dos valores diferentes compiten por ${sheet.name}!${ref}. Resuelve la coincidencia antes de exportar.`);
        assignedValues.set(key, value);
        if (!equalValue(existing?.value, value)) changes.set(key, { sheet, ref, value });
      }
    }
    const modifiedPaths = new Set<string>();
    let totalFormulas = 0;
    for (const sheet of workbook.sheets) {
      const originalFormulas = formulaSignatures(sheet.xml);
      totalFormulas += originalFormulas.length;
      const sheetChanges = [...changes.values()].filter(change => change.sheet.path === sheet.path);
      if (!sheetChanges.length) continue;
      const xml = replaceCells(sheet.xml, sheetChanges);
      assertValidXml(xml, sheet.name);
      if (JSON.stringify(formulaSignatures(xml)) !== JSON.stringify(originalFormulas)) throw new Error(`Falló la conservación de las fórmulas de ${sheet.name}.`);
      const verified = parseSheetXml(sheet.name, sheet.path, xml, workbook.sharedStrings);
      for (const change of sheetChanges) if (!equalValue(verified.cells.get(change.ref)?.value, change.value)) throw new Error(`No se pudo verificar el valor escrito en ${sheet.name}!${change.ref}.`);
      if (JSON.stringify(verified.merges) !== JSON.stringify(sheet.merges)) throw new Error(`Se modificaron combinaciones de celdas de ${sheet.name}.`);
      workbook.zip.file(sheet.path, xml);
      modifiedPaths.add(sheet.path);
    }
    const workbookXml = recalculateOnOpen(workbook.workbookXml);
    assertValidXml(workbookXml, 'propiedades del libro');
    workbook.zip.file('xl/workbook.xml', workbookXml);
    modifiedPaths.add('xl/workbook.xml');
    const output = await workbook.zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 6 } });
    // Reload the finished ZIP, checking every untouched part byte-for-byte, not merely counting it.
    const result = await openPackage(output);
    const original = await openPackage(bytes);
    const originalParts = Object.values(original.zip.files).filter(part => !part.dir);
    const outputParts = Object.values(result.zip.files).filter(part => !part.dir);
    if (originalParts.length !== outputParts.length) throw new Error('La cantidad de partes internas cambió durante la exportación.');
    let preservedParts = 0;
    for (const part of originalParts) {
      if (modifiedPaths.has(part.name)) continue;
      const counterpart = result.zip.file(part.name);
      if (!counterpart) throw new Error(`Falta una parte del libro generado: ${part.name}.`);
      const [a, b] = await Promise.all([part.async('uint8array'), counterpart.async('uint8array')]);
      if (a.length !== b.length || a.some((value, index) => value !== b[index])) throw new Error(`Se modificó una parte que debía conservarse: ${part.name}.`);
      preservedParts++;
    }
    for (const sheet of result.sheets) {
      const before = original.sheets.find(candidate => candidate.path === sheet.path);
      if (!before || JSON.stringify(formulaSignatures(before.xml)) !== JSON.stringify(formulaSignatures(sheet.xml))) throw new Error(`No se pudieron verificar las fórmulas finales de ${sheet.name}.`);
    }
    return { bytes: output, report: {
      sheets: result.sheets.length,
      formulas: totalFormulas,
      charts: originalParts.filter(part => /^xl\/charts\/chart\d+\.xml$/.test(part.name)).length,
      changedCells: changes.size,
      preservedParts,
      warnings: ['Las fórmulas y los gráficos conservan su definición original. Excel recalculará los resultados al abrir el libro; las vistas previas de otros programas pueden mostrar valores almacenados anteriormente.'],
      records: records.length,
      verified: true,
      modifiedParts: [...modifiedPaths],
    } };
  }
}

export const exportWorkbook = (bytes: Uint8Array | ArrayBuffer, schema: WorkbookSchema, records: SeaesRecord[]): Promise<{ bytes: Uint8Array; report: ExportReport }> => new OutputWorkbookMapper().export(bytes, schema, records);
