import { useId, useRef, useState, type ReactNode } from 'react';
import { Layers3 } from 'lucide-react';
import './dynamic-cards.css';

export interface DynamicCardItem {
  id: string;
  title: string;
  eyebrow?: string;
  description?: string;
  badge?: ReactNode;
  icon?: ReactNode;
  content: ReactNode;
}

export function DynamicCards({ items, label, emptyMessage = 'No hay contenido que coincida con los filtros.', activeId, onActiveChange, className = '' }: {
  items: DynamicCardItem[];
  label: string;
  emptyMessage?: string;
  activeId?: string;
  onActiveChange?: (id: string) => void;
  className?: string;
}) {
  const [localActive, setLocalActive] = useState<string>();
  const prefix = useId();
  const cards = useRef(new Map<string, HTMLElement>());
  const requested = activeId ?? localActive;
  const selected = items.some(item => item.id === requested) ? requested : items[0]?.id;

  function activate(id: string) {
    setLocalActive(id);
    onActiveChange?.(id);
    requestAnimationFrame(() => cards.current.get(id)?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' }));
  }

  return <section className={`dynamic-cards ${className}`} aria-label={label}>
    {!items.length ? <div className="quiet-empty">{emptyMessage}</div> : <div className="dynamic-card-deck">
      {items.map((item, index) => {
        const expanded = item.id === selected;
        const triggerId = `${prefix}-trigger-${index}`;
        const panelId = `${prefix}-panel-${index}`;
        return <article key={item.id} ref={element => { if (element) cards.current.set(item.id, element); else cards.current.delete(item.id); }} className={`dynamic-card ${expanded ? 'is-active' : ''}`}>
          <button type="button" id={triggerId} className="dynamic-card-trigger" aria-expanded={expanded} aria-controls={panelId} onClick={() => activate(item.id)} title={expanded ? undefined : item.title}>
            <span className="dynamic-card-pip" aria-hidden="true"/>
            <span className="dynamic-card-icon" aria-hidden="true">{item.icon ?? <Layers3 size={23}/>}</span>
            <span className="dynamic-card-heading">
              {item.eyebrow && <span className="dynamic-card-eyebrow">{item.eyebrow}</span>}
              <span className="dynamic-card-title">{item.title}</span>
            </span>
            {item.badge && <span className="dynamic-card-badge">{item.badge}</span>}
          </button>
          <div id={panelId} role="region" aria-labelledby={triggerId} className="dynamic-card-body" hidden={!expanded}>
            {expanded && <>{item.description && <p className="dynamic-card-description">{item.description}</p>}<div className="dynamic-card-content">{item.content}</div></>}
          </div>
        </article>;
      })}
    </div>}
  </section>;
}
