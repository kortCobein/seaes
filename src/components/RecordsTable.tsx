import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Columns3, Pencil, Trash2, ArrowDownUp } from 'lucide-react';
import type { DataSource, RecordGroup, SeaesRecord, WorkbookSchema } from '../models/types';
import { fieldCount, recordLabel } from '../services/consolidation';
import { recordPeriods, recordProgrammes } from '../features/dashboard/analytics';

export const statusText: Record<RecordGroup['status'], string> = {
  unique: 'Único', exact: 'Duplicado', possible: 'Posible coincidencia', complementary: 'Complementario', conflict: 'Conflicto',
};
const optionalColumns = ['Indicador', 'Programa', 'Periodo', 'Origen', 'Estado', 'Campos'] as const;
const pageSize = 25;

export function RecordsTable({ groups, sources, schema, onDetail, onEdit, onDelete }: {
  groups: RecordGroup[]; sources: DataSource[]; schema?: WorkbookSchema;
  onDetail: (group: RecordGroup) => void; onEdit: (record: SeaesRecord) => void; onDelete: (records: SeaesRecord[]) => void;
}) {
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<'section' | 'name' | 'fields'>('section');
  const [hidden, setHidden] = useState<string[]>(['Campos']);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const pageCheckbox = useRef<HTMLInputElement>(null);
  useEffect(() => { setPage(0); setSelected(new Set()); }, [groups]);
  const sorted = [...groups].sort((a, b) => sort === 'name'
    ? recordLabel(a.resolved, a.section).localeCompare(recordLabel(b.resolved, b.section), 'es-MX')
    : sort === 'fields' ? fieldCount(b.resolved) - fieldCount(a.resolved)
      : (a.section.indicators[0] ?? 0) - (b.section.indicators[0] ?? 0));
  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, pages - 1);
  const current = sorted.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  const selectedOnPage = current.filter(group => selected.has(group.id)).length;
  useEffect(() => {
    if (pageCheckbox.current) pageCheckbox.current.indeterminate = selectedOnPage > 0 && selectedOnPage < current.length;
  }, [selectedOnPage, current.length]);
  const visible = (name: string) => !hidden.includes(name);
  function toggle(id: string) {
    setSelected(previous => { const next = new Set(previous); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }

  return <section className="panel records-panel" aria-label="Registros consolidados">
    <div className="table-toolbar">
      <span className="table-count" aria-live="polite">{groups.length.toLocaleString('es-MX')} registros{selected.size > 0 && ` · ${selected.size} seleccionados`}</span>
      <div className="button-row">
        {selected.size > 0 && <button className="button danger small" onClick={() => onDelete(groups.filter(group => selected.has(group.id)).flatMap(group => group.records))}><Trash2 size={15}/>Eliminar {selected.size}</button>}
        <label className="sort-control"><ArrowDownUp size={15}/><select aria-label="Ordenar registros" value={sort} onChange={event => { setSort(event.target.value as typeof sort); setPage(0); }}><option value="section">Por indicador</option><option value="name">Por registro</option><option value="fields">Por campos capturados</option></select></label>
        <details className="table-options"><summary className="button secondary small"><Columns3 size={15}/>Columnas</summary><div className="table-options-content column-options">{optionalColumns.map(name => <label key={name}><input type="checkbox" checked={visible(name)} onChange={() => setHidden(previous => previous.includes(name) ? previous.filter(value => value !== name) : [...previous, name])}/>{name}</label>)}</div></details>
      </div>
    </div>
    <div className="table-scroll"><table className="records-table"><thead><tr>
      <th className="checkbox-cell"><input ref={pageCheckbox} type="checkbox" aria-label="Seleccionar registros de esta página" checked={!!current.length && selectedOnPage === current.length} onChange={event => setSelected(event.target.checked ? new Set([...selected, ...current.map(group => group.id)]) : new Set([...selected].filter(id => !current.some(group => group.id === id))))}/></th>
      <th scope="col">Registro</th>{optionalColumns.filter(visible).map(name => <th scope="col" key={name}>{name}</th>)}<th scope="col" className="actions-cell"><span className="sr-only">Acciones</span></th>
    </tr></thead><tbody>{current.map(group => {
      const label = recordLabel(group.resolved, group.section);
      const programme = recordProgrammes(group).join(' · ');
      const period = schema ? recordPeriods(group, schema).join(' · ') : '';
      const row = group.section.rows.find(item => item.id === group.resolved.rowId);
      const expected = row ? group.section.fields.filter(field => row.fields[field.id]).length : group.section.fields.length;
      return <tr key={group.id} className={selected.has(group.id) ? 'selected' : ''}>
        <td className="checkbox-cell"><input type="checkbox" checked={selected.has(group.id)} aria-label={`Seleccionar ${label}`} onChange={() => toggle(group.id)}/></td>
        <td><button className="record-title" onClick={() => onDetail(group)} title={label}>{label}</button><small className="cell-subtitle">{group.section.label}</small></td>
        {visible('Indicador') && <td className="tabular row-data-cell">{group.section.indicators.length ? group.section.indicators.map(value => String(value).padStart(2, '0')).join(', ') : '—'}</td>}
        {visible('Programa') && <td className="row-data-cell" title={programme || undefined}>{programme || '—'}</td>}
        {visible('Periodo') && <td className="row-data-cell" title={period || undefined}>{period || '—'}</td>}
        {visible('Origen') && <td><div className="source-tags">{group.sourceIds.slice(0, 1).map(id => { const source = sources.find(item => item.id === id); return <span key={id} className="source-tag" title={source?.filename}>{source?.name ?? 'Origen no disponible'}</span>; })}{group.sourceIds.length > 1 && <button className="source-tag" aria-label={`Ver las ${group.sourceIds.length} fuentes de ${label}`} onClick={() => onDetail(group)}>+{group.sourceIds.length - 1}</button>}</div></td>}
        {visible('Estado') && <td><span className={`badge ${group.status === 'conflict' && group.conflicts.every(conflict => conflict.resolved) ? 'unique' : group.status}`}>{group.status === 'conflict' && group.conflicts.every(conflict => conflict.resolved) ? 'Resuelto' : statusText[group.status]}</span></td>}
        {visible('Campos') && <td className="tabular">{fieldCount(group.resolved)}/{expected}</td>}
        <td><button className="icon-button" title={group.records.length > 1 ? 'Ver aportaciones para editar' : 'Editar registro'} aria-label={`${group.records.length > 1 ? 'Ver aportaciones de' : 'Editar'} ${label}`} onClick={() => group.records.length > 1 ? onDetail(group) : onEdit(group.records[0])}><Pencil size={16}/></button></td>
      </tr>;
    })}</tbody></table>{!current.length && <div className="quiet-empty">No hay registros que coincidan con los filtros.</div>}</div>
    <div className="table-footer"><span>{groups.length ? currentPage * pageSize + 1 : 0}–{Math.min((currentPage + 1) * pageSize, groups.length)} de {groups.length}</span><div className="button-row"><button className="icon-button" disabled={!currentPage} aria-label="Página anterior" onClick={() => setPage(currentPage - 1)}><ChevronLeft size={18}/></button><span>Página {currentPage + 1} de {pages}</span><button className="icon-button" disabled={currentPage >= pages - 1} aria-label="Página siguiente" onClick={() => setPage(currentPage + 1)}><ChevronRight size={18}/></button></div></div>
  </section>;
}
