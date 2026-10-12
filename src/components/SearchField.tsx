import { useRef, useState } from 'react';
import { Search, X } from 'lucide-react';

export function SearchField({ value, onChange, label, placeholder = 'Buscar…' }: { value: string; onChange: (value: string) => void; label: string; placeholder?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [expanded, setExpanded] = useState(!!value);
  if (!expanded && !value) return <button type="button" className="nav-tool" aria-label={label} title={label} aria-expanded={false} onClick={() => setExpanded(true)}><Search size={18}/></button>;
  return <div className="search-field expanded-search" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget) && !value) setExpanded(false); }}><Search size={17} aria-hidden="true"/><input autoFocus ref={input} type="search" aria-label={label} placeholder={placeholder} value={value} onKeyDown={event => { if (event.key === 'Escape') { onChange(''); setExpanded(false); } }} onChange={e => onChange(e.target.value)}/><button type="button" className="icon-button" aria-label={`Cerrar ${label.toLocaleLowerCase('es-MX')}`} onClick={() => { onChange(''); setExpanded(false); }}><X size={16}/></button></div>;
}
