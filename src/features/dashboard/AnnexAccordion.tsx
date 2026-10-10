import { useMemo, useState } from 'react';
import { ArrowUpRight, Filter, Layers3, X } from 'lucide-react';
import type { RecordGroup, SectionSchema, WorkbookSchema } from '../../models/types';
import './annex.css';

interface AnnexCard {
  sheet: string;
  sections: SectionSchema[];
  records: RecordGroup[];
}

export function AnnexAccordion({ schema, groups, activeSheet, onFilter, onRecords }: {
  schema: WorkbookSchema;
  groups: RecordGroup[];
  activeSheet: string | null;
  onFilter: (sheet: string | null) => void;
  onRecords: (ids: string[]) => void;
}) {
  const annexes = useMemo(() => {
    const bySheet = new Map<string, AnnexCard>();
    for (const section of schema.sections.filter(item => item.kind === 'annex')) {
      const card = bySheet.get(section.sheet) ?? { sheet: section.sheet, sections: [], records: [] };
      card.sections.push(section);
      bySheet.set(section.sheet, card);
    }
    for (const group of groups) {
      if (group.section.kind === 'annex') bySheet.get(group.section.sheet)?.records.push(group);
    }
    return [...bySheet.values()];
  }, [schema.sections, groups]);
  const [expanded, setExpanded] = useState(() => annexes[0]?.sheet ?? '');
  if (!annexes.length) return null;

  return <section className="annex-section" aria-label="Explorador de anexos">
    <div className="annex-section-heading">
      <div><h2>Anexos</h2><p>Selecciona una tarjeta para revisar el anexo y filtrar sus registros.</p></div>
      {activeSheet && <button type="button" className="button text small" onClick={() => onFilter(null)}><X size={15}/>Quitar filtro de anexos</button>}
    </div>
    <div className="annex-slabrow" aria-label="Anexos de la plantilla SEAES">
      {annexes.map((annex, index) => {
        const isOpen = expanded === annex.sheet;
        const isFiltered = activeSheet === annex.sheet;
        const label = annex.sheet;
        const description = [...new Set(annex.sections.map(section => section.label).filter(Boolean))].join(' · ');
        const indicators = new Set(annex.sections.flatMap(section => section.indicators)).size;
        return <div key={annex.sheet} className={`annex-stave${isOpen ? ' open' : ''}${isFiltered ? ' filtered' : ''}`}>
          <button type="button" className="annex-spine" aria-expanded={isOpen} aria-controls={`annex-detail-${index}`} onClick={() => setExpanded(annex.sheet)} title={label}>
            <span className="annex-pip" aria-hidden="true"/><span className="annex-spine-label">{label}</span>
          </button>
          <div id={`annex-detail-${index}`} className="annex-body" hidden={!isOpen}>
            <span className="annex-tile"><Layers3 size={25}/></span>
            <span className="annex-eyebrow">ANEXO SEAES · {index + 1} / {annexes.length}</span>
            <h3 title={label}>{label}</h3>
            <p title={description}>{description || 'Sección de anexos de la plantilla institucional.'}</p>
            <div className="annex-proof"><strong>{annex.records.length.toLocaleString('es-MX')}</strong> registros · {annex.sections.length} secciones · {indicators} indicadores</div>
            <div className="annex-actions">
              <button type="button" className={`button ${isFiltered ? 'secondary' : 'primary'} small`} onClick={() => onFilter(isFiltered ? null : annex.sheet)}>
                {isFiltered ? <X size={15}/> : <Filter size={15}/>}
                {isFiltered ? 'Quitar filtro' : 'Filtrar gráfica'}
              </button>
              <button type="button" className="button secondary small" disabled={!annex.records.length} onClick={() => onRecords(annex.records.map(group => group.id))}>
                Ver registros <ArrowUpRight size={15}/>
              </button>
            </div>
          </div>
        </div>;
      })}
    </div>
  </section>;
}
