import { useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import './motion.css';

interface NavItem { id: string; label: string }
interface Capsule { x: number; y: number; width: number; height: number }

export function SlidingNav({ items, activeId, onSelect }: {
  items: readonly NavItem[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  const navRef = useRef<HTMLElement>(null);
  const [capsule, setCapsule] = useState<Capsule>();

  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const active = [...nav.querySelectorAll<HTMLButtonElement>('button[data-nav-id]')]
          .find(button => button.dataset.navId === activeId);
        if (!active) { setCapsule(undefined); return; }
        const bounds = nav.getBoundingClientRect();
        const tab = active.getBoundingClientRect();
        const next = {
          x: tab.left - bounds.left + nav.scrollLeft,
          y: tab.top - bounds.top + nav.scrollTop,
          width: tab.width, height: tab.height,
        };
        setCapsule(previous => previous &&
          Math.abs(previous.x - next.x) < .5 && Math.abs(previous.y - next.y) < .5 &&
          Math.abs(previous.width - next.width) < .5 && Math.abs(previous.height - next.height) < .5
          ? previous : next);
      });
    };
    measure();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    observer?.observe(nav);
    nav.querySelectorAll('button[data-nav-id]').forEach(button => observer?.observe(button));
    nav.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure, { passive: true });
    void document.fonts?.ready.then(measure);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      nav.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
    };
  }, [activeId, items]);

  const position: CSSProperties | undefined = capsule ? {
    width: capsule.width, height: capsule.height,
    transform: `translate3d(${capsule.x}px, ${capsule.y}px, 0)`,
  } : undefined;

  return <nav ref={navRef} className="sliding-nav" aria-label="Secciones">
    <span className={`nav-motion-capsule${capsule ? ' is-ready' : ''}`} style={position} aria-hidden="true"/>
    {items.map(({ id, label }) => <button
      type="button" key={id} data-nav-id={id}
      className={`nav-item${activeId === id ? ' active' : ''}`}
      aria-current={activeId === id ? 'page' : undefined}
      onClick={() => onSelect(id)}
    >{label}</button>)}
  </nav>;
}
