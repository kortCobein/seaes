# Contrato de interacción SEAES

Autoridad: los dos encargos UI/UX del usuario del 7 de octubre de 2026 y la corrección del 10 de octubre de 2026, que establece el dist mejorado por el usuario como referencia para sincronizar el código fuente y el repositorio. Identidad en DESIGN.md. Idioma es-MX; procesamiento local, sin backend ni transmisión de capturas.

## Canonical UI Map

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
|---|---|---|---|---|
| Table Selection | RecordsTable | Selección de la página; eliminación explícita de aportaciones | Página y selección entre páginas | Pruebas de navegador |
| Select/Listbox | Select nativo HTML | Popup y teclado del navegador/SO aceptados | Filtros y formularios | Teclado y popup |
| Form | RecordEditor / ImportDialog | Esquema SEAES y parser existente | Crear / editar / importar | Validación, cero y guardado |
| Scrollbar | src/styles.css | Tokens globales | Geometría interna en tablas/drawers | Inspección visual responsive |
| Toast | App feedback / useWorkspace | Estado de operación central | Éxito / error / proceso | Regiones status/alert |
| CRUD | useWorkspace + Dialog | Consolidación y almacenamiento existentes | Guardar cierra editor, detalle conserva contexto | Pruebas de flujos |

## Navegación y estado

La navegación principal consta de cuatro vistas: Dashboard (gráficas y administración de fuentes), Ejemplos (indicaciones, cambios y ejemplos), Indicadores (todos o solo maestría) y Anexos y rasgos (anexos y referencias de rasgos). Una sola navbar aloja fuente, índice, búsqueda, filtros avanzados, importación, exportación, alta y limpieza; conserva la selección global al cambiar de sección. Los filtros se aplican sobre aportaciones; las hojas de referencia pertenecen a la plantilla común y no se atribuyen falsamente a un archivo importado. Las gráficas usan el subconjunto filtrado y el resumen completo requiere restablecer filtros.

La búsqueda y los filtros globales se guardan en sessionStorage, no en URL: pueden contener textos privados capturados, la app es local y las fuentes no son compartibles por enlace. Las preferencias de Ocultar nulos van a localStorage; una instalación nueva empieza con false. No tocan IndexedDB ni el consolidado. Las métricas globales siempre usan el universo completo. Un valor capturado 0 es dato. Las tablas paginan; cambios de filtros reinician página y selección.

## Operaciones y recuperación

Conservar parser, comparación con plantilla, 14 fuentes demo, IndexedDB y mapper completo. Mostrar ocupación de importación/exportación y deshabilitar las acciones de ejecución repetida. Validar nombres cortos y valores, preservar entrada ante error y enfocar el primer campo inválido. Avisar antes de descartar cambios. Eliminaciones requieren diálogo con Cancelar primero y el nombre de la acción real.

Los valores numéricos se suman automáticamente como aportaciones al total institucional; las aportaciones cuantitativas iguales no son duplicados ni conflictos. Institución y entidad se normalizan a la identidad canónica UTSJR y Querétaro. Las observaciones y los comentarios se combinan conservando los textos distintos. Las decisiones explícitas guardadas prevalecen sobre la agregación automática, salvo la normalización de identidad. Las diferencias restantes de texto, incluidas las de anexos con la misma identidad, requieren revisión: elegir una fuente, combinar textos o separar registros cuando procede. Los duplicados exactos se reconocen únicamente en anexos. Detalles muestran procedencia y modificaciones. Exportar usa el consolidado completo, independientemente de filtros o nulos; advertir inclusión de demo y conflictos sin resolver. Simplificado conserva dependencias y elimina enlaces hacia hojas retiradas. Errores materiales detienen exportación, nunca truncar.

## Accesibilidad y verificación

Semántica HTML, labels reales, foco visible, Escape y retorno de foco de diálogos nativos. Botones de segmentos SVG equivalentes por teclado y leyenda. Avisos status/alert. Tablas usan desplazamiento propio y responsive. Comprobar estado vacío, errores, no resultados, carga, CRUD, conflictos, persistencia y ambas exportaciones. No afirmar renderizado en Excel de escritorio basándose únicamente en XML.
