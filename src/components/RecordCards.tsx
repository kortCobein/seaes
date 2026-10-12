import { useMemo, useState } from 'react';
import { ChartNoAxesCombined, FileSpreadsheet, Layers3, Pencil, ScanEye, Trash2 } from 'lucide-react';
import type { DataSource, RecordGroup, SeaesRecord, SectionSchema, WorkbookSchema } from '../models/types';
import { hasValue, recordLabel } from '../services/consolidation';
import { DynamicCards, type DynamicCardItem } from './DynamicCards';
import { statusText } from './RecordsTable';
import { MarkedCriteria } from './MarkedCriteria';

export function RecordFields({ record, section }: { record: SeaesRecord; section: SectionSchema }) {
  const fields = section.fields.filter(field => field.type !== 'choice' && hasValue(record.values[field.id]));
  return <>{fields.length > 0 && <dl className="dynamic-record-fields">{fields.map(field => <div key={field.id}><dt>{field.label}</dt><dd>{String(record.values[field.id])}</dd></div>)}</dl>}<MarkedCriteria fields={section.fields} values={record.values}/></>;
}

interface RecordCardCategory { id: string; title: string; description: string; groups: RecordGroup[] }
interface Props {
  schema: WorkbookSchema;
  groups: RecordGroup[];
  sources: DataSource[];
  kind: 'indicators' | 'annexes';
  onDetail: (group: RecordGroup) => void;
  onEdit: (record: SeaesRecord) => void;
  onDelete: (records: SeaesRecord[]) => void;
}

function ContributionContent({ category, sources, onDetail, onEdit, onDelete }: Pick<Props, 'sources' | 'onDetail' | 'onEdit' | 'onDelete'> & { category: RecordCardCategory }) {
  const [selectedSource, setSelectedSource] = useState('');
  const contributedIds = new Set(category.groups.flatMap(group => group.records.map(record => record.sourceId)));
  const contributors = sources.filter(source => contributedIds.has(source.id));
  const sourceId = contributedIds.has(selectedSource) ? selectedSource : '';
  const entries = category.groups.flatMap(group => sourceId
    ? group.records.filter(record => record.sourceId === sourceId).map(record => ({ group, record, original: true }))
    : [{ group, record: group.resolved, original: false }]);

  return <div className="dynamic-card-layout">
    <nav className="dynamic-card-menu" aria-label={`Aportaciones de ${category.title}`}>
      <span className="dynamic-menu-heading">Aportaciones</span>
      <button type="button" className={`dynamic-menu-button ${!sourceId ? 'active' : ''}`} aria-pressed={!sourceId} onClick={() => setSelectedSource('')}><Layers3 size={16}/><span>Consolidado</span><small>{category.groups.length}</small></button>
      {contributors.map(source => <button type="button" key={source.id} className={`dynamic-menu-button ${sourceId === source.id ? 'active' : ''}`} aria-pressed={sourceId === source.id} title={source.name} onClick={() => setSelectedSource(source.id)}><FileSpreadsheet size={16}/><span>{source.name}</span><small>{category.groups.reduce((total, group) => total + group.records.filter(record => record.sourceId === source.id).length, 0)}</small></button>)}
    </nav>
    <div className="dynamic-card-scroll" aria-live="polite">
      {entries.map(({ group, record, original }) => {
        const label = recordLabel(record, group.section);
        const pending = group.conflicts.filter(conflict => !conflict.resolved).length;
        const direct = original || group.records.length === 1;
        const originalRecord = original ? record : group.records[0];
        return <section key={`${group.id}-${record.id}`} className="dynamic-record">
          <div className="dynamic-record-header"><div><h3>{label}</h3>{group.section.label !== label && <p>{group.section.label}</p>}</div><div className="dynamic-record-actions">
            <button type="button" className="icon-button" aria-label={`Ver detalle de ${label}`} title={pending ? `Revisar ${pending} conflictos` : 'Detalle y procedencia'} onClick={() => onDetail(group)}><ScanEye size={16}/></button>
            <button type="button" className="icon-button" aria-label={direct ? `Editar ${label}` : `Elegir aportación para editar ${label}`} title={direct ? 'Editar registro' : 'Elegir aportación para editar'} onClick={() => direct ? onEdit(originalRecord) : onDetail(group)}><Pencil size={15}/></button>
            {direct && <button type="button" className="icon-button danger" aria-label={`Eliminar ${label}`} title="Eliminar este registro de su fuente" onClick={() => onDelete([originalRecord])}><Trash2 size={15}/></button>}
          </div></div>
          {!original && group.records.length > 1 && <p className="dynamic-record-note">{group.records.length} aportaciones · <button type="button" className={`badge ${pending ? 'conflict' : group.status}`} onClick={() => onDetail(group)}>{pending ? `${pending} conflictos por revisar` : group.status === 'conflict' ? 'Conflictos resueltos' : statusText[group.status]}</button></p>}
          <RecordFields record={record} section={group.section}/>
        </section>;
      })}
      {!entries.length && <p className="dynamic-record-empty">Sin registros en esta selección.</p>}
    </div>
  </div>;
}

export function RecordCards({ schema, groups, sources, kind, onDetail, onEdit, onDelete }: Props) {
  const categories = useMemo(() => {
    const byCategory = new Map<string, RecordCardCategory>();
    for (const group of groups) {
      if ((kind === 'annexes') !== (group.section.kind === 'annex')) continue;
      const ids = kind === 'annexes' || !group.section.indicators.length
        ? [group.section.sheet]
        : group.section.indicators.map(id => String(id));
      for (const id of ids) {
        const indicator = kind === 'indicators' && group.section.indicators.length ? Number(id) : undefined;
        const title = indicator ? `Indicador ${String(indicator).padStart(2, '0')}` : group.section.sheet;
        const description = indicator ? schema.indicators?.find(item => item.id === indicator)?.label ?? group.section.label : group.section.label;
        const category = byCategory.get(id) ?? { id, title, description, groups: [] };
        category.groups.push(group);
        byCategory.set(id, category);
      }
    }
    return [...byCategory.values()].sort((a, b) => a.title.localeCompare(b.title, 'es-MX', { numeric: true }));
  }, [schema, groups, kind]);
  const items: DynamicCardItem[] = categories.map((category, index) => ({
    id: category.id,
    title: category.title,
    eyebrow: `${kind === 'annexes' ? 'Anexo' : 'Indicador'} ${index + 1} de ${categories.length}`,
    description: category.description,
    badge: `${category.groups.length} registros`,
    icon: kind === 'annexes' ? <Layers3 size={23}/> : <ChartNoAxesCombined size={23}/>,
    content: <ContributionContent key={category.id} category={category} sources={sources} onDetail={onDetail} onEdit={onEdit} onDelete={onDelete}/>,
  }));
  return <DynamicCards items={items} label={kind === 'annexes' ? 'Anexos por hoja' : 'Indicadores y aportaciones'} emptyMessage="No hay registros que coincidan con esta selección."/>;
}
