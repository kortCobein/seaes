import { useMemo, useState } from 'react';
import { FileSpreadsheet, Layers3, Pencil } from 'lucide-react';
import type { DataSource, RecordGroup, SeaesRecord, SectionSchema, WorkbookSchema } from '../../models/types';
import { hasValue } from '../../services/consolidation';
import './annex.css';

interface AnnexCard { sheet: string; sections: SectionSchema[]; groups: RecordGroup[] }
interface Contribution { record: SeaesRecord; group: RecordGroup; name: string }

export function AnnexAccordion({ schema, groups, sources, activeSheet, onFilter, onEditRecord }: {
  schema: WorkbookSchema;
  groups: RecordGroup[];
  sources: DataSource[];
  activeSheet: string | null;
  onFilter: (sheet: string | null) => void;
  onEditRecord: (record: SeaesRecord) => void;
}) {
  const annexes = useMemo(() => {
    const bySheet = new Map<string, AnnexCard>();
    for (const section of schema.sections.filter(section => section.kind === 'annex')) {
      const card = bySheet.get(section.sheet) ?? { sheet: section.sheet, sections: [], groups: [] };
      card.sections.push(section);
      bySheet.set(section.sheet, card);
    }
    for (const group of groups) if (group.section.kind === 'annex') bySheet.get(group.section.sheet)?.groups.push(group);
    return [...bySheet.values()];
  }, [schema.sections, groups]);
  const [expanded, setExpanded] = useState('');
  const [selectedBySheet, setSelectedBySheet] = useState<Record<string, string>>({});
  const sourceNames = useMemo(() => new Map(sources.map(source => [source.id, source.name])), [sources]);
  if (!annexes.length) return null;

  return <section className="annex-section" aria-label="Anexos de SEAES">
    <div className="annex-slabrow">
      {annexes.map((annex, index) => {
        const open = (expanded || annexes[0]?.sheet) === annex.sheet;
        const contributions: Contribution[] = annex.groups.flatMap(group => group.records.map(record => ({
          record, group, name: sourceNames.get(record.sourceId) ?? 'Fuente no disponible'
        }))).sort((a,b) => a.name.localeCompare(b.name, 'es-MX'));
        const contributors = [...new Set(contributions.map(item => item.record.sourceId))];
        const selectedSource = selectedBySheet[annex.sheet] && contributors.includes(selectedBySheet[annex.sheet])
          ? selectedBySheet[annex.sheet] : contributors[0];
        const shown = contributions.filter(item => item.record.sourceId === selectedSource);
        const label = annex.sheet;
        const description = [...new Set(annex.sections.map(s => s.label).filter(Boolean))].join(' · ');
        return <div key={annex.sheet} className={`annex-stave${open ? ' open' : ''}${activeSheet === annex.sheet ? ' filtered' : ''}`}>
          <button className="annex-spine" type="button" aria-expanded={open} aria-controls={`annex-detail-${index}`}
            onClick={() => { setExpanded(annex.sheet); onFilter(annex.sheet); }}>
            <span className="annex-pip" aria-hidden="true"/><span className="annex-spine-label">{label}</span>
          </button>
          <div id={`annex-detail-${index}`} className="annex-body" hidden={!open}>
            <div className="annex-card-header">
              <div className="annex-heading-icon"><Layers3 size={22}/></div>
              <div><small>ANEXO {index + 1} DE {annexes.length}</small><h3>{label}</h3></div>
              <span className="annex-count">{contributors.length} {contributors.length === 1 ? 'fuente' : 'fuentes'}</span>
            </div>
            {description && <p className="annex-description" title={description}>{description}</p>}
            <div className="annex-contribution-layout">
              <div className="annex-source-menu" role="group" aria-label={`Fuentes del ${label}`}>
                <strong>APORTACIONES</strong>
                {contributors.map(sourceId => {
                  const count = contributions.filter(entry => entry.record.sourceId === sourceId).length;
                  return <button key={sourceId} type="button" className={`annex-source-option${selectedSource === sourceId ? ' selected' : ''}`}
                    aria-pressed={selectedSource === sourceId} title={sourceNames.get(sourceId) ?? sourceId}
                    onClick={() => setSelectedBySheet(current => ({ ...current, [annex.sheet]: sourceId }))}>
                    <FileSpreadsheet size={16}/><span>{sourceNames.get(sourceId) ?? 'Fuente'}</span><small>{count}</small>
                  </button>;
                })}
                {!contributors.length && <span className="annex-no-data">Sin aportaciones</span>}
              </div>
              <div className="annex-contribution-preview" aria-live="polite">
                {shown.length ? shown.map(({ record, group }, recordIndex) => {
                  const entries = group.section.fields.filter(field => hasValue(record.values[field.id]))
                    .map(field => ({ label: field.label, value: String(record.values[field.id]) }));
                  return <article className="annex-record-preview" key={record.id}>
                    <div className="annex-record-heading"><strong>Registro {recordIndex + 1}</strong>
                      <button type="button" className="annex-edit" title="Editar este registro" onClick={() => onEditRecord(record)}><Pencil size={14}/>Editar</button>
                    </div>
                    <small className="annex-record-section">{group.section.label}</small>
                    {entries.length ? <dl className="annex-data-fields">{entries.map((field, i) =>
                      <div key={i}><dt>{field.label}</dt><dd>{field.value}</dd></div>
                    )}</dl> : <p className="annex-no-data">Sin campos capturados.</p>}
                  </article>;
                }) : <p className="annex-no-data">Selecciona un archivo para consultar su aportación en este anexo.</p>}
              </div>
            </div>
          </div>
        </div>;
      })}
    </div>
  </section>;
}
