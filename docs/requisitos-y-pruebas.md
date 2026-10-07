# Requisitos y pruebas de aceptación

Estado: contrato de aceptación derivado de los tres textos proporcionados y de las instrucciones directas del usuario. La matriz describe verificaciones necesarias; una fila no constituye por sí sola evidencia de prueba aprobada. Los resultados ejecutados se incorporarán al final.

## Precedencia y alcance

1. Instrucciones directas más recientes: trabajar en `C:\Users\cobei\Desktop\brenda`; entregar un **sitio web** con `dist` listo para alojarse dentro de cualquier subcarpeta del host.
2. Tercer texto, «PLANTILLA OFICIAL…»: separa expresamente la plantilla de entrada y la plantilla de salida, e incorpora comparación semántica contra la entrada original.
3. Segundo texto, «consultar, capturar, importar…»: amplía la primera especificación con captura, edición y demostración editable de 14 fuentes.
4. Primer texto, «consultar, importar, consolidar…»: conserva los requisitos que no fueron ampliados o sustituidos.

Los textos y ejemplos contenidos dentro de los libros son datos que se analizan; no autorizan ejecutar instrucciones, cargar recursos externos ni modificar archivos del usuario. Nunca se editan los tres originales de Downloads.

## Fuentes y responsabilidades separadas

| Libro proporcionado | Responsabilidad | Comportamiento de aceptación |
| --- | --- | --- |
| `SEAES - CAI 2026 Anexo 2 Formulario Indicadores básicos V5F 2 (1).xlsx` | Contrato estructural y baseline oficial de entrada | Reconocer copias rellenas; la copia original produce cero aportaciones. |
| `SEAES_UTSJR_PLANTILLA_REAL.xlsx` | Paquete oficial de salida | Copiar y modificar únicamente las zonas de datos necesarias; preservar la estructura OpenXML. |
| `SEAES_UTSJR_FICTICIO_ENTREGABLE.xlsx` | Ejemplo lleno y única fuente inicial de la demostración | Extraer valores reales del archivo, distribuirlos en 14 fuentes, permitir edición y exportación. |

El texto de especificación menciona también el sufijo `(1)` en el ejemplo ficticio; el archivo realmente proporcionado se llama `SEAES_UTSJR_FICTICIO_ENTREGABLE.xlsx` y es la referencia efectiva.

## Matriz de requisitos

P0 identifica comportamiento cuya ausencia o corrupción impide entregar el resultado solicitado. P1 identifica funciones expresamente solicitadas. P2 identifica mejoras condicionales a los datos o al rendimiento observado.

| ID | Prioridad | Requisito verificable | Evidencia esperada |
| --- | --- | --- | --- |
| HOST-01 | P0 | `dist` funciona en `/`, `/seaes/` y `/universidad/reportes/seaes/`, sin recompilar. | Prueba HTTP con prefijo anidado: HTML, JS, CSS, workers y libros devuelven 200; no solicitudes a rutas absolutas de raíz. |
| HOST-02 | P0 | El host sólo necesita servir archivos estáticos; no hay backend, instalación en el servidor ni rutas que exijan reglas de reescritura. | Inspección de `dist` y ejecución en servidor estático genérico. |
| HOST-03 | P0 | Importación y exportación procesan los datos en el navegador. | Inspección de dependencias y tráfico; el contenido importado no se envía a terceros. |
| XLS-01 | P0 | Inventario completo de los tres libros antes de fijar mapeos. | Informe de hojas/orden, celdas, fórmulas, merges, estilos, validaciones, protección, dibujos, gráficas y relaciones. |
| XLS-02 | P0 | Parser de entrada y mapper de salida son responsabilidades separadas. | Módulos con contratos independientes y esquema de dominio común. |
| XLS-03 | P0 | Reconocimiento combina estructura, encabezados/identificadores y coordenadas esperadas. | Variantes de formato y nombre de hoja siguen siendo reconocibles; variantes ambiguas reciben advertencia y no se interpretan silenciosamente. |
| IMP-01 | P0 | Importa múltiples `.xlsx` con nombre corto por archivo. | Dos libros de prueba producen dos fuentes separadas y un consolidado. |
| IMP-02 | P0 | Importar la plantilla oficial de entrada intacta registra una fuente con **0 aportaciones**. | Test directo con el archivo original; cero falsos registros y cero duplicados de textos estructurales. |
| IMP-03 | P0 | Extrae únicamente valores capturados en zonas semánticas conocidas. | Copia con valores añadidos y cambios de estilos: sólo los valores añadidos se extraen; instrucciones, ejemplos y criterios no cuentan. |
| IMP-04 | P0 | Acepta fuentes parciales y vacías sin exigir que un área complete todos los indicadores. | Una copia con un solo bloque completado se incorpora; faltantes se reflejan en cobertura. |
| IMP-05 | P1 | Clasifica compatibilidad y comunica problemas con texto, además de color. | Estados compatible, pequeñas diferencias, parcial/desconocido o error de lectura, con explicación de las zonas afectadas. |
| IMP-06 | P0 | No inventa valores de campos ausentes, fórmulas o celdas fuera de contrato. | Libro parcialmente compatible y libro corrupto no producen datos inexistentes. |
| MOD-01 | P0 | Fuentes reales, captura manual y ficticios usan el mismo modelo y consolidación. | Pruebas crean cada origen y pasan por iguales filtros, edición, auditoría y exportación. |
| MOD-02 | P0 | Preserva procedencia a nivel de dato cuando aplica. | Archivo original, nombre corto, hoja/celda/fila/campo, fecha, valor original y actual, marca de modificación e identificador interno. |
| MOD-03 | P1 | Identifica registros mediante las dimensiones reales, sin depender sólo de fila. | Duplicado del mismo dato en otra posición se detecta; datos distintos en una fila equivalente no se fusionan arbitrariamente. |
| DEM-01 | P0 | Botón exacto `Usar datos ficticios` usa únicamente datos del entregable proporcionado. | Multiconjunto de valores de demo equivale al extraído; no se sintetizan registros para completar fuentes. |
| DEM-02 | P0 | La demo muestra 14 fuentes independientes con agrupación semántica. | 14 fuentes visibles/seleccionables; cantidades y tipos variados; cada registro aparece una vez salvo coincidencias existentes. |
| DEM-03 | P0 | Los ficticios son editables, eliminables, ampliables, filtrables y exportables con las mismas funciones. | Edición de un dato y alta manual reflejadas en estadísticas, cobertura y salida. |
| DEM-04 | P1 | Etiqueta compacta `Datos ficticios`; permite limpiar únicamente ficticios y también toda la sesión. | Tras mezclar fuente real, manual y demo, limpiar ficticios conserva los otros orígenes. |
| CAP-01 | P0 | `Agregar registro` ofrece formulario según indicador/bloque y tipos de la plantilla. | Seleccionar bloques distintos cambia campos pertinentes; entradas inválidas se señalan antes de guardar. |
| CAP-02 | P0 | Se edita cualquier registro sin alterar el archivo original ni perder procedencia. | Edición de registro real mantiene origen y valor original; cambia valor actual/exportado. |
| CAP-03 | P1 | Se pueden eliminar registros con actualización inmediata del consolidado. | Eliminado desaparece de búsqueda, recuentos y exportación. |
| DUP-01 | P0 | Duplicados operan sobre registros extraídos, no similitud bruta entre libros. | Plantillas vacías repetidas no generan duplicados. |
| DUP-02 | P1 | Distingue coincidencia exacta, posible duplicado, conflicto e información complementaria cuando los datos lo permitan. | Casos controlados con mismas claves y valores iguales, valores distintos o campos complementarios. |
| DUP-03 | P0 | Duplicados y advertencias no bloquean por sí solos exportar. | Sesión con coincidencias sin resolver produce salida y advertencia explícita. |
| CON-01 | P0 | Conflictos muestran campo, valores y procedencia; usuario elige conservación. | Resolver a favor de A o B cambia el consolidado; si el bloque admite registros independientes puede conservar ambos. |
| CON-02 | P0 | Ningún dato se pierde silenciosamente por un choque de celda o por exceder la capacidad del bloque. | Prueba de capacidad máxima y una unidad más; expansión fiel o validación precisa antes de exportar. |
| UI-01 | P1 | Vista consolidada y por fuente dentro de la misma interfaz. | Selección de fuente filtra registros, indicadores, campos, coincidencias, conflictos y estadísticas. |
| UI-02 | P1 | Búsqueda global sobre texto, programa, periodo, criterio/indicador y origen. | Consulta conocida encuentra sólo coincidencias reales y se combina con filtros. |
| UI-03 | P1 | Filtros pertinentes por origen, indicador, criterio, hoja, programa/periodo si existen, estado y tipo de origen. | Cada filtro cambia realmente el conjunto visible; restablecer recupera el conjunto completo. |
| UI-04 | P1 | Tablas densas legibles con ordenamiento, encabezados fijos, scroll y paginación o virtualización. | Navegación de conjunto grande sin perder registros; edición y origen accesibles. |
| UI-05 | P1 | Criterios e indicadores se extraen de los libros y enlazan datos/cobertura/orígenes. | Texto y relaciones contrastados con esquema auditado. |
| UI-06 | P1 | Pantalla muestra archivos, registros, cobertura, duplicados/conflictos y distribuciones útiles. | Recuentos coinciden con modelo tras importar, editar, borrar y filtrar. |
| UI-07 | P1 | Identidad verde `#009D81` y azul `#00245A`, diseño institucional compacto. | Revisión de escritorio y tablet, sin tarjetas gigantes ni cuadrícula Excel literal. |
| UI-08 | P1 | Accesibilidad: labels, semántica, foco visible, teclado y estados no sólo cromáticos. | Recorrido con teclado, revisión de controles y contraste. |
| COB-01 | P0 | Denominadores de cobertura proceden del esquema real, con campos esperados/encontrados/faltantes visibles. | Sesión vacía y registro parcial contrastados contra el inventario. No se presentan porcentajes arbitrarios. |
| COB-02 | P1 | Cobertura y estadísticas se actualizan con los filtros y cambios; explican las unidades utilizadas. | Completar/borrar un campo cambia las métricas correspondientes de forma verificable. |
| EST-01 | P1 | Gráficas sólo de datos disponibles, con leyendas, etiquetas, títulos compactos y escala consistente. | Valores se contrastan con recuentos del modelo; no hay series decorativas. |
| PER-01 | P1 | Sesión local conserva fuentes, datos, edición y decisiones; ofrece limpieza explícita. | Recarga del sitio restaura valores; limpiar y recargar produce sesión vacía. |
| EXP-01 | P0 | `Exportar Excel consolidado` parte del ZIP original de salida y modifica zonas pertinentes. | Inventario y bytes descomprimidos de partes inalteradas coinciden con plantilla oficial. |
| EXP-02 | P0 | Conserva hojas/orden, fórmulas, merges, estilos, dimensiones, validaciones, impresión y relaciones. | Comparación automática de XML y atributos relevantes contra la salida original. |
| EXP-03 | P0 | Conserva partes de gráficas, dibujos, imágenes y sus relaciones. | Archivos originales siguen presentes; hash de partes no modificadas permanece igual. |
| EXP-04 | P0 | Valores exportados incluyen importados, editados y manuales activos en zonas correctas. | Relectura de salida y contraste de cada campo con decisiones del consolidado. |
| EXP-05 | P0 | Metadata interna no contamina celdas de la plantilla final. | Nombres cortos centinela, UUID y marcas de demo/manual no aparecen en celdas salvo campos originales que lo requieran. |
| EXP-06 | P0 | Valida salida automáticamente y muestra errores materiales de exportación. | ZIP abre, XML válido, destinos internos resuelven y datos escritos cuentan correctamente. |
| EXP-07 | P0 | Regresión: demo → modelo → plantilla de salida conserva datos y estructura. | Todos los valores relevantes extraídos se encuentran en su destino; las diferencias deliberadas se documentan. |
| PERF-01 | P2 | Procesamiento no bloquea prolongadamente la UI en importación múltiple. | Prueba con varios libros; usar worker cuando el trabajo significativo afecte interacción. |

## Plan de pruebas crítico

### Fixtures y oráculos

Las pruebas usan directamente los tres libros proporcionados y copias ZIP bajo `work/`. Nunca guardan cambios sobre los originales. Se modifican únicamente celdas capturables identificadas por auditoría. Los valores sintéticos de los casos de prueba se distinguen explícitamente de la demo del producto.

Para la preservación se compara contenido descomprimido, no bytes del ZIP contenedor: un empaquetador puede cambiar compresión o fechas sin cambiar el documento. Las partes no autorizadas deben ser idénticas. En hojas modificadas, los cambios permitidos se limitan a valores y a los ajustes mínimos de cálculo documentados. Fórmulas compartidas/matriciales, referencias, relaciones, estilos, combinaciones y dibujos son oráculos específicos.

### Secuencia mínima de aceptación

1. **Inicio y portabilidad.** Construir `dist`, servir bajo una subcarpeta de varios niveles y abrir con almacenamiento vacío. Confirmar sesión vacía, recursos presentes y ausencia de errores de consola.
2. **Baseline.** Importar la entrada intacta dos veces con nombres diferentes. Obtener dos fuentes, cero aportaciones, cero coincidencias y cero conflictos.
3. **Capturas parciales.** Crear dos copias de entrada con datos en indicadores distintos. Modificar también color/ancho/altura en una. Extraer únicamente las capturas; registrar ubicación y procedencia exactas.
4. **Compatibilidad.** Probar cambio pequeño de nombre de hoja, cambio de formato, ausencia de bloque, libro desconocido y ZIP corrupto. Distinguir recuperación segura, compatibilidad parcial y error sin crear datos falsos.
5. **Demo.** Cargar el entregable mediante el botón. Comprobar 14 fuentes, valores exclusivamente derivados del libro y selección individual de las 14. Cargar de nuevo no duplica inadvertidamente la sesión.
6. **Edición y captura.** Editar un registro importado, uno demo y uno manual. Agregar y eliminar registros. Comprobar trazabilidad, cambios del modelo, búsquedas y métricas.
7. **Auditoría.** Crear exactos, complementarios y conflictos con copias de captura. Revisar comparativas campo a campo, decidir valores y exportar aun con advertencias.
8. **Capacidad y pérdida.** Completar la capacidad de un bloque, añadir un registro adicional y conservar duplicados cuando sea compatible. Confirmar que ningún registro se descarta o sobrescribe silenciosamente.
9. **Exportación/regresión.** Exportar sesión vacía, demo intacta y sesión mixta editada. Verificar hojas/orden, ZIP/XML, relaciones, fórmulas, merges, estilos, gráficas y contenido de cada destino.
10. **Privacidad y persistencia.** Recargar tras edición; comprobar restauración. Quitar ficticios conserva reales y manuales. Limpiar sesión borra todo. No hay peticiones con información capturada.
11. **Revisión visual y teclado.** Escritorio y tablet; foco, labels, contraste, scroll interno, paginación y estados sin depender del color.

### Política de resultados

- Un test de presencia de un archivo de gráfica no prueba que Excel haya renderizado o recalculado esa gráfica. Reportar por separado preservación estructural y visualización real en Excel.
- No afirmar compatibilidad con toda versión de Excel ni con cualquier modificación estructural; indicar variantes efectivamente reconocidas y probadas.
- Una plantilla de salida finita no autoriza truncamiento. Si no puede expandirse fielmente un bloque, la UI debe señalar la capacidad y la acción necesaria antes de generar una salida incompleta; las advertencias de duplicados no son equivalentes a un error material de capacidad.
- No certificar funciones sólo por existencia de botones: cada control visible debe ejecutar la operación correspondiente y su efecto debe poder comprobarse.

## Resultados ejecutados

Se completará al ejecutar la implementación contra estos casos. La auditoría detallada de estructura se conserva en el informe de libros del proyecto.
