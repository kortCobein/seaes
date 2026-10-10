import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
export function Dialog({ title, onClose, children, wide = false, drawer = false }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean; drawer?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => { const dialog = ref.current!; const old = document.activeElement as HTMLElement; dialog.showModal(); return () => { dialog.close(); if (old?.isConnected) old.focus(); }; }, []);
  return <dialog ref={ref} className={`dialog${wide ? ' wide' : ''}${drawer ? ' drawer' : ''}`} onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === ref.current) { const bounds = ref.current.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose(); } }} aria-labelledby={titleId}>
    <div className="dialog-heading"><h2 id={titleId}>{title}</h2><button type="button" className="icon-button" aria-label="Cerrar" onClick={onClose}><X size={20}/></button></div>{children}
  </dialog>;
}
