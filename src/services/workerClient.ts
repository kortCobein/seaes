import type { DataSource, ExportReport, ParseResult, SeaesRecord, WorkbookSchema } from '../models/types';
let worker: Worker | undefined;
let sequence = 0;
const pending = new Map<number, { resolve: (value: any) => void; reject: (error: Error) => void }>();
function request<T>(message: Record<string, unknown>): Promise<T> {
  if (!worker) {
    worker = new Worker(new URL('../workers/excel.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = ({ data }) => { const job = pending.get(data.id); if (job) { data.error ? job.reject(new Error(data.error)) : job.resolve(data.result); pending.delete(data.id); } };
    worker.onerror = () => { for (const job of pending.values()) job.reject(new Error('No se pudo procesar el archivo. Vuelve a intentarlo.')); pending.clear(); worker?.terminate(); worker = undefined; };
  }
  return new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, { resolve, reject }); worker!.postMessage({ ...message, id }); });
}
export const parseExcel = (bytes: ArrayBuffer, schema: WorkbookSchema, source: DataSource, mode: 'input' | 'output' = 'input') => request<ParseResult>({ type: 'parse', bytes, schema, source, mode });
export const exportExcel = (bytes: ArrayBuffer, schema: WorkbookSchema, records: SeaesRecord[], mode: 'full' | 'simplified' = 'full') => request<{ bytes: Uint8Array; report: ExportReport }>({ type: 'export', bytes, schema, records, mode });
export async function getAsset(name: string): Promise<ArrayBuffer> { const response = await fetch(`${import.meta.env.BASE_URL}data/${name}`); if (!response.ok) throw new Error(`No se encontró el recurso ${name}.`); return response.arrayBuffer(); }
