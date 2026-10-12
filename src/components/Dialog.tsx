import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';

export function Dialog({ title, onClose, children, wide = false, drawer = false }: {
  title: string; onClose: () => void; children: ReactNode; wide?: boolean; drawer?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [closing, setClosing] = useState(false);
  const closingRef = useRef(false);
  const exitTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const requestClose = () => {
    if (closingRef.current) return;
    closingRef.current = true;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      onClose();
      return;
    }
    setClosing(true);
    exitTimer.current = setTimeout(onClose, 155);
  };

  useEffect(() => {
    const dialog = ref.current!;
    const old = document.activeElement as HTMLElement;
    dialog.showModal();
    return () => {
      if (exitTimer.current) clearTimeout(exitTimer.current);
      dialog.close();
      if (old?.isConnected) old.focus();
    };
  }, []);

  return <dialog ref={ref} className={`dialog${wide ? ' wide' : ''}${drawer ? ' drawer' : ''}${closing ? ' is-closing' : ''}`}
    onCancel={event => { event.preventDefault(); requestClose(); }}
    onClick={event => {
      if (event.target !== ref.current) return;
      const bounds = ref.current.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) requestClose();
    }}
    aria-labelledby={titleId}>
    <div className="dialog-heading"><h2 id={titleId}>{title}</h2><button type="button" className="icon-button" aria-label="Cerrar" disabled={closing} onClick={requestClose}><X size={20}/></button></div>
    {children}
  </dialog>;
}
