import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
export function Dialog({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current!; dialog.showModal(); const old = document.activeElement as HTMLElement; return () => { dialog.close(); old?.focus(); }; }, []);
  return <dialog ref={ref} className={wide ? 'dialog wide' : 'dialog'} onCancel={onClose} onClick={event => { if (event.target === ref.current) onClose(); }} aria-label={title}>
    <div className="dialog-heading"><h2>{title}</h2><button className="icon-button" aria-label="Cerrar" onClick={onClose}><X size={20}/></button></div>{children}
  </dialog>;
}
