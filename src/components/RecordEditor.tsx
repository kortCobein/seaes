import { useState } from 'react';
import type { Scalar, SeaesRecord, WorkbookSchema } from '../models/types';
import { hasValue } from '../services/consolidation';
import { Dialog } from './Dialog';
export function RecordEditor({ schema, record, onClose, onSave }: { schema: WorkbookSchema; record?: SeaesRecord; onClose: () => void; onSave: (data: { sectionId: string; rowId: string; values: Record<string, Scalar> }) => void }) {
  const [sectionId, setSectionId] = useState(record?.sectionId ?? schema.sections[0]?.id ?? '');
  const section = schema.sections.find(s => s.id === sectionId)!;
  const [rowId, setRowId] = useState(record?.rowId ?? section.rows[0].id);
  const [values, setValues] = useState<Record<string, Scalar>>(record?.values ?? {});
  const [error, setError] = useState('');
  const row = section.rows.find(r => r.id === rowId) ?? section.rows[0];
  function submit(event: React.FormEvent) {
    event.preventDefault(); const cleaned: Record<string, Scalar> = {};
    for (const field of section.fields.filter(f => row.fields[f.id])) {
      const value = values[field.id]; if (!hasValue(value)) continue;
      if (field.type === 'number') {
        const number = Number(String(value).replace(/,/g, '').trim());
        if (/^[-+]?\d+(\.\d+)?$/.test(String(value).replace(/,/g, '').trim()) && Number.isFinite(number) && number >= 0) cleaned[field.id] = number;
        else if (/^no (disponible|aplica)$/i.test(String(value).trim())) cleaned[field.id] = String(value).trim();
        else { setError(`«${field.label}» requiere un número no negativo, No disponible o No aplica.`); return; }
      } else cleaned[field.id] = String(value).trim();
    }
    if (!Object.values(cleaned).some(hasValue)) { setError('Captura al menos un campo.'); return; }
    onSave({ sectionId, rowId: row.id, values: cleaned });
  }
  return <Dialog title={record ? 'Editar registro' : 'Agregar registro'} onClose={onClose} wide><form onSubmit={submit}>
    <div className="dialog-body"><div className="form-selectors"><label>Sección<select value={sectionId} disabled={!!record} onChange={e => { const next = schema.sections.find(s => s.id === e.target.value)!; setSectionId(next.id); setRowId(next.rows[0].id); setValues({}); setError(''); }}>{schema.sections.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
      {section.kind !== 'annex' && <label>Tipo de registro<select value={row.id} disabled={!!record} onChange={e => { setRowId(e.target.value); setValues({}); }}>{section.rows.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}</select></label>}</div>
      <div className="form-fields">{section.fields.filter(f => row.fields[f.id]).map(field => <label key={field.id} className={field.type === 'text' ? 'full-field' : ''}><span>{field.label}{field.criterion && <small>{schema.criteria.find(c => c.id === field.criterion)?.label}</small>}</span>
        {field.type === 'choice' ? <select value={String(values[field.id] ?? '')} onChange={e => setValues({ ...values, [field.id]: e.target.value })}><option value="">Sin captura</option>{(field.choices ?? ['X']).filter(Boolean).map(c => <option key={c}>{c}</option>)}</select> : field.type === 'text' ? <textarea rows={2} maxLength={32767} value={String(values[field.id] ?? '')} onChange={e => setValues({ ...values, [field.id]: e.target.value })}/> : <input inputMode="decimal" placeholder="Sin captura" value={String(values[field.id] ?? '')} onChange={e => setValues({ ...values, [field.id]: e.target.value })}/>}
      </label>)}</div>{error && <p className="error-message" role="alert">{error}</p>}
    </div><div className="dialog-footer"><span className="muted">{record ? 'Se conservará la procedencia original.' : 'Origen: Captura manual'}</span><button type="button" className="button secondary" onClick={onClose}>Cancelar</button><button className="button primary">Guardar registro</button></div>
  </form></Dialog>;
}
