import { useRef } from 'react';
import { Search, X } from 'lucide-react';

export function SearchField({ value, onChange, label, placeholder = 'Buscar…' }: { value: string; onChange: (value: string) => void; label: string; placeholder?: string }) {
  const input = useRef<HTMLInputElement>(null);
  return <div className="search-field"><Search size={17} aria-hidden="true"/><input ref={input} type="search" aria-label={label} placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)}/>{value && <button type="button" className="icon-button" aria-label={`Limpiar ${label.toLocaleLowerCase('es-MX')}`} onClick={() => { onChange(''); input.current?.focus(); }}><X size={16}/></button>}</div>;
}
