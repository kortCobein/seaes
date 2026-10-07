export type Scalar = string | number | boolean | null;
export interface FieldSchema { id: string; label: string; type: 'number' | 'text' | 'choice'; criterion?: string; choices?: string[] }
export interface CellMapping { inputRef: string; outputRef: string; inputBaseline: Scalar; outputBaseline: Scalar }
export interface RowSchema { id: string; label: string; fields: Record<string, CellMapping> }
export interface SectionSchema {
  id: string; sheet: string; label: string; indicators: number[];
  kind: 'quantitative' | 'annex' | 'identity'; fields: FieldSchema[]; rows: RowSchema[];
  anchors: { ref: string; value: string }[];
}
export interface WorkbookSchema {
  version: string; inputFile: string; outputFile: string; demoFile: string;
  criteria: { id: string; label: string }[]; sections: SectionSchema[];
  referenceSheets?: { name: string; text: string }[];
  indicators?: { id: number; label: string; period?: string; description?: string }[];
}
export type Compatibility = 'compatible' | 'variations' | 'partial' | 'unknown';
export interface DataSource {
  id: string; name: string; filename: string; importedAt: string;
  kind: 'real' | 'demo' | 'manual'; compatibility: Compatibility; warnings: string[];
}
export interface SeaesRecord {
  id: string; sourceId: string; sectionId: string; rowId: string;
  values: Record<string, Scalar>; originalValues: Record<string, Scalar>;
  origins: Record<string, { sheet: string; cell: string }>;
  modifiedAt?: string;
}
export interface FieldDecision { mode: 'record' | 'sum' | 'combine'; recordId?: string }
export interface GroupDecision { separate?: boolean; fields?: Record<string, FieldDecision> }
export interface WorkSession {
  version: 1; sources: DataSource[]; records: SeaesRecord[];
  decisions: Record<string, GroupDecision>;
}
export interface ConflictField { fieldId: string; candidates: { recordId: string; sourceId: string; value: Scalar }[]; resolved: boolean }
export interface RecordGroup {
  id: string; section: SectionSchema; records: SeaesRecord[]; resolved: SeaesRecord;
  status: 'unique' | 'exact' | 'possible' | 'complementary' | 'conflict';
  conflicts: ConflictField[]; sourceIds: string[];
}
export interface ExportReport { sheets: number; formulas: number; charts: number; changedCells: number; preservedParts: number; warnings: string[]; [key: string]: unknown }
export interface ParseResult { records: SeaesRecord[]; source: DataSource }
export const emptySession = (): WorkSession => ({ version: 1, sources: [], records: [], decisions: {} });
