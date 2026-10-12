import { parseWorkbook } from '../services/excel/InputWorkbookParser';
import { exportWorkbook } from '../services/excel/OutputWorkbookMapper';
import { createWorkbookPreview } from '../services/excel/WorkbookPreview';
import type { DataSource, RecordGroup, SeaesRecord, WorkbookSchema } from '../models/types';

type Message = { id: string; bytes: Uint8Array | ArrayBuffer; schema: WorkbookSchema } & (
  { type: 'parse'; source: DataSource; mode?: 'input' | 'output' } |
  { type: 'export'; records: SeaesRecord[]; mode?: 'full' | 'simplified' } |
  { type: 'preview'; groups: RecordGroup[] }
);

self.onmessage = async (event: MessageEvent<Message>) => {
  const message = event.data;
  try {
    if (message.type === 'parse') {
      const result = await parseWorkbook(message.bytes, message.schema, message.source, message.mode);
      self.postMessage({ id: message.id, result });
    } else if (message.type === 'export') {
      const result = await exportWorkbook(message.bytes, message.schema, message.records, message.mode);
      self.postMessage({ id: message.id, result }, { transfer: [result.bytes.buffer] });
    } else if (message.type === 'preview') {
      const result = await createWorkbookPreview(message.bytes, message.schema, message.groups);
      self.postMessage({ id: message.id, result });
    } else throw new Error('Operación de Excel desconocida.');
  } catch (error) {
    self.postMessage({ id: message.id, error: error instanceof Error ? error.message : 'No se pudo completar la operación con el libro.' });
  }
};
