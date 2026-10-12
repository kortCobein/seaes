import { useMemo, useState } from 'react';
import { ChartNoAxesCombined, Check, FileText, Layers3, Pencil, Plus, Trash2, X } from 'lucide-react';
import { DynamicCards, type DynamicCardItem } from '../../components/DynamicCards';
import { RecordFields } from '../../components/RecordCards';
import type { DataSource, RecordGroup, SeaesRecord, WorkbookSchema } from '../../models/types';
import { normalize, recordLabel } from '../../services/consolidation';

const compatibility = { compatible: 'Compatible', variations: 'Con variaciones', partial: 'Parcial', unknown: 'Error de lectura' };
interface Props {
  schema: WorkbookSchema;
  sources: DataSource[];
  records: SeaesRecord[];
  groups: RecordGroup[];
  busy: string;
  globalQuery: string;
  filteredSourceId: string;
  onRename: (source: DataSource, name: string) => void;
  onDelete: (source: DataSource) => void;
  onEdit: (record: SeaesRecord) => void;
  onDeleteRecords: (records: SeaesRecord[]) => void;
  onAdd: (sourceId: string) => void;
}
type SourceCategory = 'all' | 'quantitative' | 'annex' | 'identity';
const categories = [
  { id: 'all' as const, label: 'Todo', icon: Layers3 },
  { id: 'quantitative' as const, label: 'Indicadores', icon: ChartNoAxesCombined },
  { id: 'annex' as const, label: 'Anexos', icon: Layers3 },
  { id: 'identity' as const, label: 'Identificación', icon: FileText },
];

function SourceContent({ source, records, schema, groups, busy, onRename, onDelete, onEdit, onDeleteRecords, onAdd }: Pick<Props, 'records' | 'schema' | 'groups' | 'busy' | 'onRename' | 'onDelete' | 'onEdit' | 'onDeleteRecords' | 'onAdd'> & { source: DataSource }) {
  const [category, setCategory] = useState<SourceCategory>('all');
  const [editing, setEditing] = useState(false);
  const [alias, setAlias] = useState(source.name);
  const sections = new Map(schema.sections.map(section => [section.id, section]));
  // Mantener cada aportación original evita editar o eliminar datos de otra fuente.
  const own = records.filter(record => record.sourceId === source.id);
  const available = categories.filter(item => item.id === 'all' || own.some(record => sections.get(record.sectionId)?.kind === item.id));
  const selected = available.some(item => item.id === category) ? category : 'all';
  const visible = own.filter(record => selected === 'all' || sections.get(record.sectionId)?.kind === selected);
  const groupsByRecord = new Map(groups.flatMap(group => group.records.map(record => [record.id, group] as const)));

  return <div className="source-card-content">
    <div className="source-card-actions">
      <button type="button" className="button secondary small" aria-expanded={editing} disabled={!!busy} onClick={() => { setAlias(source.name); setEditing(value => !value); }}><Pencil size={14}/>Editar</button>
      <button type="button" className="button secondary small" disabled={!!busy} onClick={() => onAdd(source.id)}><Plus size={15}/>Agregar registro</button>
      <button type="button" className="button danger small" disabled={!!busy} onClick={() => onDelete(source)}><Trash2 size={14}/>Eliminar fuente</button>
      <span className={`badge ${source.compatibility === 'unknown' ? 'conflict' : source.warnings.length ? 'possible' : 'unique'}`}>{source.warnings.length ? `${source.warnings.length} advertencias` : compatibility[source.compatibility]}</span>
    </div>
    {editing && <form className="source-card-rename" onSubmit={event => { event.preventDefault(); if (alias.trim() && alias.trim() !== source.name) onRename(source, alias.trim()); setEditing(false); }}>
      <label>Nombre de la fuente<input aria-label="Editar nombre de la fuente" value={alias} maxLength={120} onChange={event => setAlias(event.target.value)} disabled={!!busy}/></label>
      <button type="submit" className="button secondary small" disabled={!!busy || !alias.trim()}><Check size={14}/>Guardar</button>
      <button type="button" className="icon-button" aria-label="Cancelar edición del nombre" onClick={() => setEditing(false)}><X size={15}/></button>
    </form>}
    <div className="source-card-records dynamic-card-layout">
      <nav className="dynamic-card-menu" aria-label="Contenido de la fuente">
        <span className="dynamic-menu-heading">Contenido aportado</span>
        {available.map(item => <button type="button" key={item.id} className={`dynamic-menu-button ${selected === item.id ? 'active' : ''}`} aria-pressed={selected === item.id} onClick={() => setCategory(item.id)}><item.icon size={16}/><span>{item.label}</span><small>{item.id === 'all' ? own.length : own.filter(record => sections.get(record.sectionId)?.kind === item.id).length}</small></button>)}
      </nav>
      <div className="dynamic-card-scroll" aria-live="polite">
        {visible.map(record => {
          const section = sections.get(record.sectionId);
          if (!section) return null;
          const label = recordLabel(record, section);
          const pending = groupsByRecord.get(record.id)?.conflicts.filter(conflict => !conflict.resolved && conflict.candidates.some(candidate => candidate.recordId === record.id)).length ?? 0;
          return <section key={record.id} className="dynamic-record">
            <div className="dynamic-record-header"><div><h3>{label}</h3><p>{section.sheet}{section.label !== label && section.label !== section.sheet ? ` · ${section.label}` : ''}</p></div><div className="dynamic-record-actions">
              <button type="button" className="icon-button" disabled={!!busy} title="Editar registro" aria-label={`Editar ${label}`} onClick={() => onEdit(record)}><Pencil size={15}/></button>
              <button type="button" className="icon-button danger" disabled={!!busy} title="Eliminar registro" aria-label={`Eliminar ${label}`} onClick={() => onDeleteRecords([record])}><Trash2 size={15}/></button>
            </div></div>
            {pending > 0 && <span className="badge conflict">{pending} conflictos pendientes</span>}
            <RecordFields record={record} section={section}/>
          </section>;
        })}
        {!visible.length && <div className="quiet-empty">Esta fuente no tiene registros. Agrega uno para comenzar.</div>}
      </div>
    </div>
    {source.warnings.length > 0 && <details className="source-card-warnings"><summary>Advertencias de lectura</summary><ul>{source.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></details>}
  </div>;
}

export function FilesScreen({ schema, sources, records, groups, busy, globalQuery, filteredSourceId, onRename, onDelete, onEdit, onDeleteRecords, onAdd }: Props) {
  const visible = useMemo(() => {
    const query = normalize(globalQuery);
    return sources.filter(source => (!filteredSourceId || source.id === filteredSourceId) && (!query || normalize(`${source.name} ${source.filename}`).includes(query)
      || records.some(record => record.sourceId === source.id && normalize(Object.values(record.values).join(' ')).includes(query))));
  }, [sources, records, globalQuery, filteredSourceId]);
  const items: DynamicCardItem[] = visible.map(source => ({
    id: source.id,
    title: source.name,
    icon: <span className="dynamic-card-record-count" aria-label={`${records.filter(record => record.sourceId === source.id).length} aportaciones`}>{records.filter(record => record.sourceId === source.id).length}</span>,
    content: <SourceContent key={source.id} source={source} records={records} schema={schema} groups={groups} busy={busy} onRename={onRename} onDelete={onDelete} onEdit={onEdit} onDeleteRecords={onDeleteRecords} onAdd={onAdd}/>,
  }));
  return <DynamicCards items={items} label="Fuentes y registros aportados" className="source-cards" emptyMessage={globalQuery || filteredSourceId ? 'No hay fuentes que coincidan con la búsqueda.' : 'Carga un archivo de entrada para revisar sus aportaciones.'}/>;
}

