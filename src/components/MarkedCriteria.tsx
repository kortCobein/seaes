import { X } from 'lucide-react';
import type { FieldSchema, Scalar } from '../models/types';
import './marked-criteria.css';

export const isMarked = (value: Scalar | undefined) => typeof value === 'string' && value.trim().toUpperCase() === 'X';

export function MarkedCriteria({ fields, values }: { fields: FieldSchema[]; values: Record<string, Scalar> }) {
  const marked = fields.filter(field => field.type === 'choice' && isMarked(values[field.id]));
  if (!marked.length) return null;
  return <ul className="marked-criteria" aria-label="Criterios marcados">{marked.map(field => <li key={field.id}><span className="marked-criteria-icon" aria-label="Marcado con X"><X size={23} aria-hidden="true"/></span><span>{field.label}</span></li>)}</ul>;
}
