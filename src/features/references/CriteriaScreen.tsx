import { ArrowUpRight, BookMarked, RotateCcw } from 'lucide-react';
import type { RecordGroup, WorkbookSchema } from '../../models/types';
import { hasValue } from '../../services/consolidation';

export function CriteriaScreen({ schema, groups, activeCriterion, onSelect, onClear }: {
  schema: WorkbookSchema;
  groups: RecordGroup[];
  activeCriterion: string;
  onSelect: (criterion: string) => void;
  onClear: () => void;
}) {
  return <section className="panel seaes-criteria-panel" aria-label="Criterios SEAES">
    <div className="seaes-criteria-heading">
      <div><p className="seaes-criteria-overline">SEAES</p><h1>Criterios SEAES</h1>
        <p>Consulta los criterios oficiales del formulario. Selecciona uno para ver sus registros relacionados.</p>
      </div>
      {activeCriterion && <button className="button secondary small" onClick={onClear}><RotateCcw size={15}/>Todos los criterios</button>}
    </div>
    <div className="seaes-criteria-grid">{schema.criteria.map((criterion, index) => {
      const count = groups.filter(group => group.section.fields.some(field =>
        field.criterion === criterion.id && hasValue(group.resolved.values[field.id]))).length;
      return <button key={criterion.id} type="button"
        className={`seaes-criterion-card${activeCriterion === criterion.id ? ' selected' : ''}`}
        onClick={() => onSelect(criterion.id)}>
        <span className="seaes-criterion-number">{String(index + 1).padStart(2, '0')}</span>
        <span className="seaes-criterion-content"><strong>{criterion.label}</strong>
          <small>{count.toLocaleString('es-MX')} registros relacionados</small></span>
        <ArrowUpRight size={18} aria-hidden="true"/>
      </button>;
    })}</div>
    {!schema.criteria.length && <div className="quiet-empty"><BookMarked size={24}/>El formulario no contiene criterios registrados.</div>}
  </section>;
}
