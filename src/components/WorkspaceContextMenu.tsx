import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Download, FilePlus, Filter, RotateCcw, Search, Settings2, Trash2, Upload, X } from 'lucide-react';
import './workspace-menu.css';

export function WorkspaceContextMenu({ hideNulls, setHideNulls, onFilters, onReset, onImport, onExport, onAdd, onClear, onSearch, canClear, children }: {
  hideNulls: boolean; setHideNulls: (value: boolean) => void;
  onFilters: () => void; onReset: () => void; onImport: () => void;
  onExport: () => void; onAdd: () => void; onClear: () => void; onSearch: () => void;
  canClear: boolean; children?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [point, setPoint] = useState<{ x: number; y: number } | null>(null);
  useEffect(() => {
    const open = (event: MouseEvent) => {
      if (event.ctrlKey) return; // Ctrl+click derecho mantiene el menú nativo del navegador.
      event.preventDefault();
      const width = Math.min(340, window.innerWidth - 16);
      const height = Math.min(570, window.innerHeight - 16);
      setPoint({ x: Math.max(8, Math.min(event.clientX, window.innerWidth - width - 8)),
        y: Math.max(8, Math.min(event.clientY, window.innerHeight - height - 8)) });
    };
    document.addEventListener('contextmenu', open);
    return () => document.removeEventListener('contextmenu', open);
  }, []);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (point && !dialog.open) dialog.showModal();
    if (!point && dialog.open) dialog.close();
  }, [point]);
  const close = () => { ref.current?.close(); setPoint(null); };
  const choose = (run: () => void) => { close(); run(); };
  const actions = [
    { title: 'Buscar', detail: 'Busca datos y fuentes de esta sección.', icon: Search, run: onSearch },
    { title: 'Filtros', detail: 'Filtra por archivo, indicador, criterio o periodo.', icon: Filter, run: onFilters },
    { title: 'Restablecer filtros', detail: 'Vuelve a mostrar toda la información.', icon: RotateCcw, run: onReset },
    { title: 'Importar Excel', detail: 'Añade uno o varios archivos al consolidado.', icon: Upload, run: onImport },
    { title: 'Exportar', detail: 'Descarga el Excel o consulta Preview.', icon: Download, run: onExport },
    { title: 'Agregar aportación', detail: 'Crea una captura manual editable.', icon: FilePlus, run: onAdd },
    { title: 'Limpiar sesión', detail: 'Borra los datos locales, previa confirmación.', icon: Trash2, run: onClear, disabled: !canClear },
  ];
  return <dialog className="workspace-context-menu" ref={ref} aria-label="Menú de ajustes y herramientas"
    style={point ? { left: point.x, top: point.y } : undefined}
    onCancel={event => { event.preventDefault(); close(); }}
    onClick={event => { if (event.target === ref.current) close(); }}>
    <header><strong><Settings2 size={17}/> Ajustes y herramientas</strong><button onClick={close} aria-label="Cerrar"><X size={16}/></button></header>
    <div className="context-menu-body">
      <label className="context-menu-toggle"><input type="checkbox" checked={hideNulls}
        onChange={event => setHideNulls(event.target.checked)}/>
        <span><strong>Ocultar nulos</strong><small>Una fila totalmente vacía es nula. Si hay datos, los campos numéricos vacíos cuentan como cero.</small></span>
      </label>
      {children && <div className="context-menu-extra">{children}</div>}
      <p className="context-menu-caption">Herramientas y función de cada botón</p>
      {actions.map(({ title, detail, icon: Icon, run, disabled }) => <button type="button" key={title}
        className="context-menu-option" disabled={disabled} onClick={() => choose(run)}>
        <Icon size={18}/><span><strong>{title}</strong><small>{detail}</small></span></button>)}
    </div>
    <footer>Clic derecho: menú · Esc: salir · Ctrl + clic derecho: menú nativo</footer>
  </dialog>;
}
