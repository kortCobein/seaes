import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import type { DataSource, GroupDecision, RecordGroup, SeaesRecord } from '../models/types';
import { Dialog } from './Dialog';
import { hasValue, recordLabel } from '../services/consolidation';
import { statusText } from './RecordsTable';
import { ConflictResolution } from '../features/records/ConflictResolution';

export function RecordDetail({ group, sources, decisions, onDecision, onClose, onEdit, onDelete }: {
  group: RecordGroup; sources: DataSource[]; decisions: Record<string, GroupDecision>;
  onDecision: (id: string, decision: GroupDecision) => void; onClose: () => void;
  onEdit: (record: SeaesRecord) => void; onDelete: (record: SeaesRecord) => void;
}) {
  const [tab, setTab] = useState<'fields' | 'origins' | 'conflicts'>(group.conflicts.some(conflict => !conflict.resolved) ? 'conflicts' : 'fields');
  const [recordId, setRecordId] = useState(group.records[0].id);
  const record = group.records.find(item => item.id === recordId) ?? group.records[0];
  const source = sources.find(item => item.id === record.sourceId);
  const applicableFields = group.section.fields.filter(field => group.section.rows.find(row => row.id === group.resolved.rowId)?.fields[field.id] || hasValue(group.resolved.values[field.id]));
  const pending = group.conflicts.filter(conflict => !conflict.resolved).length;
  const hasReview = group.status !== 'unique';
  return <Dialog title={recordLabel(group.resolved, group.section)} onClose={onClose} wide drawer>
    <div className="dialog-body">
      <div className="record-context"><span>{group.section.label}</span><span className={`badge ${group.status === 'conflict' && !pending ? 'unique' : group.status}`}>{group.status === 'conflict' && !pending ? 'Resuelto' : statusText[group.status]}</span><span className="muted">{group.records.length} {group.records.length === 1 ? 'aportación' : 'aportaciones'}</span></div>
      <div className="detail-tabs button-row" aria-label="Detalle del registro">
        <button className={`button small ${tab === 'fields' ? 'primary' : 'secondary'}`} aria-pressed={tab === 'fields'} onClick={() => setTab('fields')}>Campos</button>
        <button className={`button small ${tab === 'origins' ? 'primary' : 'secondary'}`} aria-pressed={tab === 'origins'} onClick={() => setTab('origins')}>Procedencia</button>
        {hasReview && <button className={`button small ${tab === 'conflicts' ? 'primary' : 'secondary'}`} aria-pressed={tab === 'conflicts'} onClick={() => setTab('conflicts')}>{group.conflicts.length ? `Conflictos${pending ? ` · ${pending}` : ''}` : 'Coincidencias'}</button>}
      </div>
      {tab === 'fields' && <div className="detail-table consolidated-fields"><table><thead><tr><th scope="col">Campo</th><th scope="col">Valor consolidado</th></tr></thead><tbody>{applicableFields.map(field => <tr key={field.id}><th scope="row">{field.label}</th><td>{hasValue(group.resolved.values[field.id]) ? String(group.resolved.values[field.id]) : <span className="muted">Sin captura</span>}</td></tr>)}</tbody></table></div>}
      {tab === 'origins' && <section className="record-origin-panel">
        {group.records.length > 1 && <label className="record-origin-selector">Aportación<select value={record.id} onChange={event => setRecordId(event.target.value)}>{group.records.map((item, index) => <option key={item.id} value={item.id}>{sources.find(origin => origin.id === item.sourceId)?.name ?? 'Origen'} · {index + 1}</option>)}</select></label>}
        <dl className="record-metadata"><div><dt>Fuente</dt><dd>{source?.name ?? 'Origen no disponible'}{source?.kind === 'demo' && <span className="badge demo">Datos ficticios</span>}</dd></div><div><dt>Archivo</dt><dd>{source?.filename ?? 'Captura manual'}</dd></div><div><dt>Hoja</dt><dd>{group.section.sheet}</dd></div>{source?.importedAt && <div><dt>Importación</dt><dd>{new Date(source.importedAt).toLocaleString('es-MX')}</dd></div>}{record.modifiedAt && <div><dt>Última edición</dt><dd>{new Date(record.modifiedAt).toLocaleString('es-MX')}</dd></div>}</dl>
        <div className="detail-table"><table><thead><tr><th scope="col">Campo</th><th scope="col">Valor actual</th><th scope="col">Celda de origen</th>{record.modifiedAt && <th scope="col">Valor original</th>}</tr></thead><tbody>{group.section.fields.filter(field => hasValue(record.values[field.id]) || hasValue(record.originalValues[field.id])).map(field => <tr key={field.id}><th scope="row">{field.label}</th><td className={record.values[field.id] !== record.originalValues[field.id] ? 'changed' : ''}>{String(record.values[field.id] ?? '—')}</td><td>{record.origins[field.id]?.sheet ?? 'Captura manual'}<small>{record.origins[field.id]?.cell}</small></td>{record.modifiedAt && <td>{String(record.originalValues[field.id] ?? '—')}</td>}</tr>)}</tbody></table></div>
        <details className="technical-details"><summary>Identificador del registro</summary><code>{record.id}</code></details>
      </section>}
      {tab === 'conflicts' && <ConflictResolution group={group} sources={sources} decisions={decisions} onDecision={onDecision}/>}
    </div>
    <div className="dialog-footer record-actions">
      {group.records.length > 1 && tab !== 'origins' ? <button className="button secondary" onClick={() => setTab('origins')}>Editar aportaciones</button> : <><button className="button secondary" onClick={() => onEdit(record)}><Pencil size={15}/>Editar{group.records.length > 1 ? ' aportación' : ''}</button><button className="button danger" onClick={() => onDelete(record)}><Trash2 size={15}/>Eliminar{group.records.length > 1 ? ' aportación' : ''}</button></>}
      <button className="button secondary" onClick={onClose}>Cerrar</button>
    </div>
  </Dialog>;
}
