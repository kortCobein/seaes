import type { DataSource, ParseResult, Scalar, SeaesRecord, SectionSchema, WorkbookSchema } from '../../models/types';
import { equalValue, nameKey, normalized, openPackage, parseRef, shiftedRef } from './package';
import type { WorkbookSheet } from './package';

type Mode = 'input' | 'output';
interface Recognized { sheet: WorkbookSheet; offset: { col: number; row: number }; variation: boolean }

function anchorKey(value: unknown): string {
  return normalized(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}
function sameAnchor(actual: unknown, expected: string): boolean {
  const a = anchorKey(actual), b = anchorKey(expected);
  return a === b || (a.length >= 60 && b.length >= 60 && a.slice(0, 120) === b.slice(0, 120));
}

/** Recognize sheet content as well as its name. Formatting, case and accents never affect recognition. */
function recognize(section: SectionSchema, sheets: WorkbookSheet[]): Recognized | undefined {
  const named = sheets.filter(sheet => nameKey(sheet.name) === nameKey(section.sheet));
  const candidates = named.length ? named : sheets.filter(sheet => !/ejemplo|muestra|rasgos|indicaciones/i.test(sheet.name));
  const possible: Recognized[] = [];
  for (const sheet of candidates) {
    if (!section.anchors.length) {
      if (named.includes(sheet)) possible.push({ sheet, offset: { col: 0, row: 0 }, variation: sheet.name !== section.sheet });
      continue;
    }
    const directMatches = section.anchors.filter(anchor => sameAnchor(sheet.cells.get(anchor.ref)?.value, anchor.value)).length;
    if (directMatches >= Math.ceil(section.anchors.length * 0.6)) {
      possible.push({ sheet, offset: { col: 0, row: 0 }, variation: sheet.name !== section.sheet || directMatches !== section.anchors.length });
      continue;
    }
    // A uniform displacement is safe only when independently confirmed by at least two anchors.
    if (section.anchors.length < 2) continue;
    const offsets = new Map<string, { col: number; row: number; count: number }>();
    for (const anchor of section.anchors) {
      const matches = [...sheet.cells.values()].filter(cell => !cell.formula && sameAnchor(cell.value, anchor.value));
      if (matches.length !== 1) continue;
      const from = parseRef(anchor.ref), to = parseRef(matches[0].ref);
      const col = to.col - from.col, row = to.row - from.row, key = `${col}:${row}`;
      const current = offsets.get(key) ?? { col, row, count: 0 };
      current.count++;
      offsets.set(key, current);
    }
    const confirmed = [...offsets.values()].filter(offset => offset.count >= Math.max(2, Math.ceil(section.anchors.length * 0.6)));
    if (confirmed.length === 1) possible.push({ sheet, offset: confirmed[0], variation: true });
  }
  return possible.length === 1 ? possible[0] : undefined;
}

function inputValue(value: Scalar, type: string): Scalar {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (type === 'number' && /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(trimmed) && Number.isFinite(Number(trimmed))) return Number(trimmed);
    // Keep the original text, including accents, line breaks, and formula-looking strings.
    return value;
  }
  return value;
}

export class InputWorkbookParser {
  async parse(bytes: Uint8Array | ArrayBuffer, schema: WorkbookSchema, source: DataSource, mode: Mode = 'input'): Promise<ParseResult> {
    const workbook = await openPackage(bytes);
    const warnings = [...source.warnings];
    const records: SeaesRecord[] = [];
    const absent = new Set<string>();
    const variations = new Set<string>();
    let recognizedCount = 0;
    let ignoredFormulas = 0;
    let ignoredErrors = 0;
    const warningsForValues: string[] = [];
    for (const section of schema.sections) {
      const recognized = recognize(section, workbook.sheets);
      if (!recognized) { absent.add(section.sheet); continue; }
      recognizedCount++;
      const { sheet, offset } = recognized;
      if (recognized.variation) variations.add(`${section.sheet}${offset.row || offset.col ? ` (desplazamiento ${offset.row} filas, ${offset.col} columnas)` : ''}`);
      if (section.kind === 'annex') {
        const references = section.rows.flatMap(row => Object.values(row.fields).map(mapping => shiftedRef(mode === 'input' ? mapping.inputRef : mapping.outputRef, offset)));
        const positions = references.map(parseRef);
        const lastRow = Math.max(...positions.map(position => position.row));
        const columns = new Set(positions.map(position => position.col));
        const overflow = [...sheet.cells.values()].find(cell => {
          if (cell.formula || cell.value === null || normalized(cell.value) === '') return false;
          const position = parseRef(cell.ref);
          return position.row > lastRow && columns.has(position.col);
        });
        if (overflow) throw new Error(`«${sheet.name}» contiene datos en ${overflow.ref}, después de la última fila admitida (${lastRow}). El archivo no se importó para evitar omitir información. Divide esos registros entre varios archivos compatibles.`);
      }
      for (const row of section.rows) {
        const values: Record<string, Scalar> = {};
        const origins: SeaesRecord['origins'] = {};
        for (const field of section.fields) {
          const mapping = row.fields[field.id];
          if (!mapping) continue;
          const baseline = mode === 'input' ? mapping.inputBaseline : mapping.outputBaseline;
          const targetRef = mode === 'input' ? mapping.inputRef : mapping.outputRef;
          if (!targetRef) continue;
          const ref = shiftedRef(targetRef, offset);
          const cell = sheet.cells.get(ref);
          // Formula caches, error caches, baseline metadata and instructional examples are not captured data.
          if (!cell || cell.value === null || normalized(cell.value) === '') continue;
          if (cell.formula) { ignoredFormulas++; continue; }
          if (cell.type === 'e') { ignoredErrors++; continue; }
          if (equalValue(cell.value, baseline)) continue;
          const value = inputValue(cell.value, field.type);
          values[field.id] = value;
          origins[field.id] = { sheet: sheet.name, cell: ref };
          if (field.type === 'number' && typeof value !== 'number' && !/^no disponible$/i.test(normalized(value))) warningsForValues.push(`${sheet.name}!${ref}: «${field.label}» contiene texto; se conservó para revisión.`);
        }
        if (Object.keys(values).length) records.push({
          id: `${source.id}:${section.id}:${row.id}`,
          sourceId: source.id,
          sectionId: section.id,
          rowId: row.id,
          values,
          originalValues: { ...values },
          origins,
        });
      }
    }
    if (!recognizedCount) throw new Error('No se reconoció una estructura compatible con el formulario SEAES CAI 2026. Revisa los nombres de las hojas y sus encabezados.');
    if (absent.size) warnings.push(`No se reconocieron ${absent.size} hojas: ${[...absent].join(', ')}. Sus datos no se importaron.`);
    if (variations.size) warnings.push(`Se reconocieron variaciones compatibles en: ${[...variations].join(', ')}.`);
    if (ignoredFormulas) warnings.push(`Se omitieron ${ignoredFormulas} fórmulas encontradas en espacios de captura; importa sus valores como datos si corresponde.`);
    if (ignoredErrors) warnings.push(`Se omitieron ${ignoredErrors} errores de Excel en espacios de captura; revisa el archivo de origen.`);
    warnings.push(...warningsForValues.slice(0, 30));
    if (warningsForValues.length > 30) warnings.push(`Hay ${warningsForValues.length - 30} campos adicionales con texto en espacios numéricos, conservados para revisión.`);
    if (!records.length) warnings.push('El libro no contiene datos capturados distintos de la plantilla. No se agregaron registros.');
    return { records, source: { ...source, warnings: [...new Set(warnings)], compatibility: absent.size ? 'partial' : variations.size ? 'variations' : 'compatible' } };
  }
}

export const parseWorkbook = (bytes: Uint8Array | ArrayBuffer, schema: WorkbookSchema, source: DataSource, mode: Mode = 'input'): Promise<ParseResult> => new InputWorkbookParser().parse(bytes, schema, source, mode);
