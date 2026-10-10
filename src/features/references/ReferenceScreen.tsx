import { useMemo, useState } from 'react';
import { ArrowUpRight, BookOpen, FileText } from 'lucide-react';
import type { WorkbookSchema } from '../../models/types';
import { normalize } from '../../services/consolidation';
import { Dialog } from '../../components/Dialog';
import './references.css';

export type ReferenceKind = 'all' | 'indicaciones' | 'cambios' | 'ejemplos';
const kindOf = (name: string): Exclude<ReferenceKind, 'all'> | 'rasgos' =>
  /rasgos?/i.test(name) ? 'rasgos' : /cambio|modificacion|actualizac/i.test(name) ? 'cambios'
  : /ejemplo|muestra/i.test(name) ? 'ejemplos' : 'indicaciones';

export function ReferenceScreen({ schema, kind, query, indicator, sourceName, isRasgos = false, relatedRecords }: {
  schema: WorkbookSchema; kind: ReferenceKind; query: string; indicator: string;
  sourceName?: string; isRasgos?: boolean; relatedRecords: number;
}) {
  const [selected, setSelected] = useState<{ name: string; text: string }>();
  const all = useMemo(() => (schema.referenceSheets ?? []).filter(item =>
    (isRasgos ? kindOf(item.name) === 'rasgos' : kindOf(item.name) !== 'rasgos')
    && (isRasgos || kind === 'all' || kindOf(item.name) === kind)
    && normalize(`${item.name} ${item.text}`).includes(normalize(query))), [schema.referenceSheets, isRasgos, kind, query]);

  // Reference sheets belong to the official template, not to a particular imported workbook.
  // Only narrow the reference list when its text actually names the selected indicator.
  const matches = indicator ? all.filter(item => {
    const label = String(Number(indicator));
    return new RegExp(`(?:indicador|ind[.]?)\\s*0*${label}(?![0-9])`, 'i').test(`${item.name} ${item.text}`);
  }) : all;
  const references = !indicator || matches.length ? matches : all;
  return <section className="reference-screen panel">
    <div className="reference-screen-heading">
      <div><h2>{isRasgos ? 'Rasgos' : 'Indicaciones, cambios y ejemplos'}</h2><p>{isRasgos ? 'Rasgos y material de apoyo de la plantilla.' : 'Documentación y ejemplos de referencia de SEAES.'}</p></div>
      <span className="count">{references.length} hojas</span>
    </div>
    {(sourceName || indicator) && <p className="reference-context">
      {relatedRecords.toLocaleString('es-MX')} registros coinciden con los filtros.
      {sourceName && ` Fuente: ${sourceName}.`}
      {' '}Los textos de referencia son comunes a la plantilla, no copias independientes por archivo.
      {indicator && !matches.length && ' No hay referencias etiquetadas para ese indicador; se muestran las generales.'}
    </p>}
    <div className="reference-grid">{references.map(item => <button key={item.name} type="button" className="reference-tile" onClick={() => setSelected(item)}>
      <span className="reference-symbol"><BookOpen size={20}/></span>
      <span className="reference-description"><strong>{item.name}</strong><small>{item.text.slice(0,155).replace(/\s+/g,' ')}{item.text.length > 155 ? '…' : ''}</small></span><ArrowUpRight size={16} aria-hidden="true"/>
    </button>)}</div>
    {!references.length && <div className="quiet-empty"><FileText size={24}/><p>No hay documentos que coincidan con estos filtros.</p></div>}
    {selected && <Dialog title={selected.name} onClose={() => setSelected(undefined)} wide><div className="analysis-reference-text">{selected.text}</div></Dialog>}
  </section>;
}
