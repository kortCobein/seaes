import { useMemo } from 'react';
import type { WorkbookSchema } from '../../models/types';
import { normalize } from '../../services/consolidation';
import { DynamicCards } from '../../components/DynamicCards';
import './references.css';

export type ReferenceKind = 'all' | 'indicaciones' | 'cambios' | 'ejemplos';
const kindOf = (name: string): Exclude<ReferenceKind, 'all'> | 'rasgos' =>
  /rasgos?/i.test(name) ? 'rasgos' : /cambio|modificacion|actualizac/i.test(name) ? 'cambios'
  : /ejemplo|muestra/i.test(name) ? 'ejemplos' : 'indicaciones';

const kindLabels = { indicaciones: 'Indicaciones', cambios: 'Cambios', ejemplos: 'Ejemplos de la plantilla', rasgos: 'Rasgos del perfil de egreso' };

export function ReferenceScreen({ schema, kind, query, indicator, hideNulls = true, isRasgos = false }: {
  schema: WorkbookSchema; kind: ReferenceKind; query: string; indicator: string;
  sourceName?: string; isRasgos?: boolean; hideNulls?: boolean; relatedRecords: number;
}) {
  const all = useMemo(() => (schema.referenceSheets ?? []).filter(item =>
    (isRasgos ? kindOf(item.name) === 'rasgos' : kindOf(item.name) !== 'rasgos')
    && (isRasgos || kind === 'all' || kindOf(item.name) === kind)
    && (!hideNulls || item.text.trim().length > 0)
    && normalize(`${item.name} ${item.text}`).includes(normalize(query))), [schema.referenceSheets, isRasgos, kind, query, hideNulls]);

  // Reference sheets belong to the official template, not to a particular imported workbook.
  // Only narrow the reference list when its text actually names the selected indicator.
  const matches = indicator ? all.filter(item => {
    const label = String(Number(indicator));
    return new RegExp(`(?:indicador|ind[.]?)\\s*0*${label}(?![0-9])`, 'i').test(`${item.name} ${item.text}`);
  }) : all;
  const references = !indicator || matches.length ? matches : all;
  return <section className="reference-screen" aria-label={isRasgos ? 'Rasgos de la plantilla' : 'Material de consulta'}>
    {indicator && !matches.length && <p className="reference-context">No hay referencias específicas para este indicador; se muestran las generales.</p>}
    <DynamicCards label={isRasgos ? 'Rasgos' : 'Indicaciones, cambios y ejemplos'} emptyMessage="No hay documentos que coincidan con la búsqueda." items={references.map(item => ({
      id: item.name,
      title: item.name.trim(),
      eyebrow: kindLabels[kindOf(item.name)],
      icon: <BookOpen size={22}/>,
      content: <article className="reference-document dynamic-card-scroll" aria-label={`Contenido de ${item.name.trim()}`} tabIndex={0}>
        {item.text.split(/\r?\n\s*\r?\n/).filter(paragraph => paragraph.trim()).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
      </article>,
    }))}/>
  </section>;
}
