import { useEffect, useId, useRef, useState } from 'react';
import type { Scalar, SeaesRecord, WorkbookSchema } from '../models/types';
import { hasValue } from '../services/consolidation';
import { Dialog } from './Dialog';

type EditorField = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
export function RecordEditor({ schema, record, onClose, onSave }: {
  schema: WorkbookSchema; record?: SeaesRecord; onClose: () => void;
  onSave: (data: { sectionId: string; rowId: string; values: Record<string, Scalar> }) => void;
}) {
  const [sectionId, setSectionId] = useState(record?.sectionId ?? schema.sections[0]?.id ?? '');
  const section = schema.sections.find(item => item.id === sectionId)!;
  const [rowId, setRowId] = useState(record?.rowId ?? section.rows[0].id);
  const [values, setValues] = useState<Record<string, Scalar>>(record?.values ?? {});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pendingAction, setPendingAction] = useState<{ run: () => void }>();
  const [saving, setSaving] = useState(false);
  const submitting = useRef(false);
  const fields = useRef<Record<string, EditorField | null>>({});
  const formId = useId();
  const original = useRef(JSON.stringify(record?.values ?? {}));
  const dirty = JSON.stringify(values) !== original.current;
  const row = section.rows.find(item => item.id === rowId) ?? section.rows[0];
  const editableFields = section.fields.filter(field => row.fields[field.id]);
  useEffect(() => {
    if (!dirty) return;
    const preventLoss = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', preventLoss);
    return () => window.removeEventListener('beforeunload', preventLoss);
  }, [dirty]);
  function guard(action: () => void) { if (dirty) setPendingAction({ run: action }); else action(); }
  function update(fieldId: string, value: string) {
    setValues(previous => ({ ...previous, [fieldId]: value }));
    setErrors(previous => { const next = { ...previous }; delete next[fieldId]; return next; });
  }
  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting.current || (event.nativeEvent as Event & { isComposing?: boolean }).isComposing) return;
    const cleaned: Record<string, Scalar> = {};
    const nextErrors: Record<string, string> = {};
    for (const field of editableFields) {
      const value = values[field.id];
      if (!hasValue(value)) continue;
      if (field.type === 'number') {
        const candidate = String(value).replace(/,/g, '').trim();
        const number = Number(candidate);
        if (/^[-+]?\d+(\.\d+)?$/.test(candidate) && Number.isFinite(number) && number >= 0) cleaned[field.id] = number;
        else if (/^no (disponible|aplica)$/i.test(String(value).trim())) cleaned[field.id] = String(value).trim();
        else nextErrors[field.id] = 'Escribe un número no negativo, No disponible o No aplica.';
      } else cleaned[field.id] = String(value).trim();
    }
    if (!Object.keys(nextErrors).length && !Object.values(cleaned).some(hasValue) && editableFields[0]) nextErrors[editableFields[0].id] = 'Captura al menos un campo para guardar el registro.';
    setErrors(nextErrors);
    const firstError = Object.keys(nextErrors)[0];
    if (firstError) { fields.current[firstError]?.focus(); fields.current[firstError]?.scrollIntoView({ block: 'nearest' }); return; }
    submitting.current = true;
    setSaving(true);
    try { onSave({ sectionId, rowId: row.id, values: cleaned }); }
    catch (error) { setErrors({ form: error instanceof Error ? error.message : 'No se pudo guardar. Inténtalo nuevamente.' }); }
    finally { submitting.current = false; setSaving(false); }
  }
  return <>
    <Dialog title={record ? 'Editar registro' : 'Agregar registro'} onClose={() => guard(onClose)} wide drawer><form onSubmit={submit} noValidate onKeyDown={event => { if (event.key === 'Enter' && event.nativeEvent.isComposing) event.preventDefault(); }}>
      <div className="dialog-body"><div className="form-selectors">
        <label>Indicador / sección<select value={sectionId} disabled={!!record || saving} onChange={event => { const next = schema.sections.find(item => item.id === event.target.value)!; guard(() => { setSectionId(next.id); setRowId(next.rows[0].id); setValues({}); setErrors({}); }); }}>{schema.sections.map(item => <option key={item.id} value={item.id}>{item.indicators.length ? `${item.indicators.map(value => String(value).padStart(2, '0')).join(', ')} · ` : ''}{item.label}</option>)}</select></label>
        {section.kind !== 'annex' && <label>Tipo de registro<select value={row.id} disabled={!!record || saving} onChange={event => { const nextRow = event.target.value; guard(() => { setRowId(nextRow); setValues({}); setErrors({}); }); }}>{section.rows.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>}
      </div>
      <div className="form-fields">{editableFields.map(field => {
        const inputId = `${formId}-${field.id}`;
        const common = { id: inputId, value: String(values[field.id] ?? ''), disabled: saving, 'aria-invalid': !!errors[field.id], 'aria-describedby': errors[field.id] ? `${inputId}-error` : undefined };
        return <div key={field.id} className={field.type === 'text' ? 'full-field' : ''}><label htmlFor={inputId}><span>{field.label}{field.criterion && <small>{schema.criteria.find(criterion => criterion.id === field.criterion)?.label}</small>}</span>
          {field.type === 'choice' ? <select {...common} ref={element => { fields.current[field.id] = element; }} onChange={event => update(field.id, event.target.value)}><option value="">Sin captura</option>{(field.choices ?? ['X']).filter(Boolean).map(choice => <option key={choice}>{choice}</option>)}</select>
            : field.type === 'text' ? <textarea {...common} ref={element => { fields.current[field.id] = element; }} rows={3} maxLength={32767} style={{ resize: 'none' }} onChange={event => { update(field.id, event.target.value); event.target.style.height = 'auto'; event.target.style.height = `${Math.min(320, event.target.scrollHeight)}px`; }}/>
              : <input {...common} ref={element => { fields.current[field.id] = element; }} inputMode="decimal" placeholder="Sin captura" onChange={event => update(field.id, event.target.value)}/>}
          </label>{errors[field.id] && <span className="field-error" id={`${inputId}-error`}>{errors[field.id]}</span>}
        </div>;
      })}</div>{Object.keys(errors).length > 0 && <p className="error-message" role="alert">{errors.form ?? 'Revisa los campos señalados.'}</p>}
      </div><div className="dialog-footer"><span className="muted">{record ? 'Edición de aportación' : 'Captura manual'}</span><button type="button" className="button secondary" disabled={saving} onClick={() => guard(onClose)}>Cancelar</button><button type="submit" className="button primary" disabled={saving} aria-busy={saving}>{saving ? 'Guardando…' : 'Guardar registro'}</button></div>
    </form></Dialog>
    {pendingAction && <Dialog title="Descartar cambios" onClose={() => setPendingAction(undefined)}><div className="dialog-body"><p>Los cambios sin guardar se perderán.</p></div><div className="dialog-footer"><button className="button secondary" onClick={() => setPendingAction(undefined)}>Seguir editando</button><button className="button danger solid" onClick={() => { const action = pendingAction.run; setPendingAction(undefined); action(); }}>Descartar cambios</button></div></Dialog>}
  </>;
}
