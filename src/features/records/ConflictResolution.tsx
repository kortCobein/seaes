import type { DataSource, FieldDecision, GroupDecision, RecordGroup } from '../../models/types';

export function ConflictResolution({ group, sources, decisions, onDecision }: {
  group: RecordGroup; sources: DataSource[]; decisions: Record<string, GroupDecision>;
  onDecision: (id: string, decision: GroupDecision) => void;
}) {
  const choose = (fieldId: string, decision: FieldDecision) => onDecision(group.id, {
    ...decisions[group.id], fields: { ...decisions[group.id]?.fields, [fieldId]: decision },
  });
  return <div className="record-conflicts">
    {group.conflicts.some(conflict => !conflict.resolved) && <p className="conflict-intro">Las fuentes reportan valores distintos para el mismo registro. Conserva el valor correcto de cada campo.</p>}
    {!group.conflicts.length && <p className="muted">{group.status === 'exact' ? 'Se exporta una sola vez y se conservan todos los orígenes.' : group.status === 'possible' ? 'Comparten una referencia; permanecen como registros independientes.' : group.status === 'complementary' ? 'Las aportaciones se complementan y se exportan juntas.' : 'Sin conflictos.'}</p>}
    {group.conflicts.map(conflict => {
      const field = group.section.fields.find(item => item.id === conflict.fieldId)!;
      const decision = decisions[group.id]?.fields?.[field.id];
      const chosen = conflict.candidates.find(candidate => candidate.recordId === decision?.recordId);
      const currentSource = sources.find(source => source.id === (chosen ?? conflict.candidates[0]).sourceId)?.name ?? 'Primera aportación';
      const distinct = new Set(conflict.candidates.map(candidate => JSON.stringify(candidate.value))).size;
      const numeric = conflict.candidates.every(candidate => typeof candidate.value === 'number');
      const sum = numeric ? conflict.candidates.reduce((total, candidate) => total + Number(candidate.value), 0) : undefined;
      return <fieldset className="conflict-field" key={field.id}>
        <legend>{field.label}</legend><div className="conflict-heading"><span className={`badge ${conflict.resolved ? 'unique' : 'conflict'}`}>{conflict.resolved ? 'Resuelto' : 'Por resolver'}</span><span>{distinct} valores distintos · {conflict.candidates.length} aportaciones</span></div>
        <div className="conflict-comparison"><table><thead><tr><th scope="col">Fuente</th><th scope="col">Valor reportado</th><th scope="col">Valor que quieres conservar</th></tr></thead><tbody>{conflict.candidates.map(candidate => {
          const sourceName = sources.find(source => source.id === candidate.sourceId)?.name ?? 'Origen';
          const selected = decision?.mode === 'record' && decision.recordId === candidate.recordId;
          return <tr key={candidate.recordId} className={selected ? 'chosen' : ''}><td>{sourceName}</td><td className="conflict-reported-value">{String(candidate.value)}</td><td><button className={`button small ${selected ? 'primary' : 'secondary'}`} aria-pressed={selected} aria-label={`Conservar ${String(candidate.value)} de ${sourceName}`} onClick={() => choose(field.id, { mode: 'record', recordId: candidate.recordId })}>{selected ? 'Valor conservado' : 'Conservar este valor'}</button></td></tr>;
        })}</tbody></table></div>
        <div className={`conflict-outcome ${conflict.resolved ? 'resolved' : ''}`} role="status"><span>{conflict.resolved ? 'Valor final para el consolidado y el Excel' : 'Sin resolver: por ahora se exportará'}</span><strong>{String(group.resolved.values[field.id] ?? '—')}</strong><small>{decision?.mode === 'sum' ? 'Suma de aportaciones · decisión guardada' : decision?.mode === 'combine' ? 'Textos combinados · decisión guardada' : `${currentSource}${conflict.resolved ? ' · decisión guardada' : ' · primera aportación'}`}</small></div>
        {(numeric || field.type === 'text') && <details className="conflict-alternatives"><summary>Otras formas de resolver</summary>
          {numeric && <><p>Suma solo si las fuentes cuentan poblaciones diferentes. Si reportan la misma población, conserva un único valor.</p><button className={`button small ${decision?.mode === 'sum' ? 'primary' : 'secondary'}`} aria-pressed={decision?.mode === 'sum'} onClick={() => choose(field.id, { mode: 'sum' })}>Usar suma: {sum?.toLocaleString('es-MX')}</button></>}
          {field.type === 'text' && <><p>Reúne los textos distintos en un solo campo.</p><button className={`button small ${decision?.mode === 'combine' ? 'primary' : 'secondary'}`} aria-pressed={decision?.mode === 'combine'} onClick={() => choose(field.id, { mode: 'combine' })}>Conservar ambos textos</button></>}
        </details>}
      </fieldset>;
    })}
    {group.section.kind === 'annex' && group.records.length > 1 && <button className="button secondary small" onClick={() => onDecision(group.id, { ...decisions[group.id], separate: true })}>Conservar como registros independientes</button>}
  </div>;
}
