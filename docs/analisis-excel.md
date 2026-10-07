# Análisis estructural de los libros SEAES UTSJR

Fecha: 7 de octubre de 2026. Análisis de solo lectura de los tres archivos suministrados. Se inspeccionaron directamente las partes OOXML de cada XLSX: hojas, contenido, estilos, fórmulas, combinaciones, dibujos y gráficas, validaciones, nombres definidos y dimensiones. Los hashes SHA-256 de las fuentes se verificaron sin cambios después del análisis.

## Contratos independientes de entrada y salida

| Función | Archivo | Hojas | Fórmulas | Gráficas | Combinaciones |
|---|---|---:|---:|---:|---:|
| Entrada oficial CAI 2026 | `SEAES - CAI 2026 Anexo 2 Formulario Indicadores básicos V5F 2 (1).xlsx` | 58 | 1489 | 180 | 645 |
| Salida consolidada UTSJR | `SEAES_UTSJR_PLANTILLA_REAL.xlsx` | 58 | 1489 | 180 | 645 |
| Ejemplo ficticio | `SEAES_UTSJR_FICTICIO_ENTREGABLE.xlsx` | 58 | 1205 | 180 | 645 |

La coincidencia de nombres y posiciones no hace intercambiables a las plantillas. La de entrada incluye textos de ejemplo dentro de campos capturables, mientras que la de salida los limpia y modifica fórmulas. La exportación debe partir del paquete ZIP de salida y parchear exclusivamente las celdas mapeadas. El ejemplo ficticio elimina 284 fórmulas de niveles sin datos y no es una plantilla de exportación.

## Inventario en el orden original

Las tres fuentes conservan este orden, incluidos los espacios del nombre `EJEMPLO Ind2 `. Las hojas de ejemplo y muestras son referencia: su contenido no constituye aportaciones. Las tablas de captura son rangos ordinarios, no tablas estructuradas ListObject; no se encontraron partes `xl/tables/`.

| # | Hoja | Función | Fórmulas entrada / salida / demo | Gráficas salida | Combinaciones |
|---:|---|---|---:|---:|---:|
| 1 | Indicaciones y definiciones | Referencia / ejemplo, no importar como datos | 0 / 0 / 0 | 0 | 15 |
| 2 | Cambios 5.0 | Referencia / ejemplo, no importar como datos | 0 / 0 / 0 | 0 | 0 |
| 3 | Indicador 1 | Captura agregada y resultados | 40 / 40 / 24 | 6 | 6 |
| 4 | Indicador 2 | Captura agregada y resultados | 40 / 40 / 24 | 6 | 7 |
| 5 | Indicador 3 | Captura agregada y resultados | 110 / 110 / 66 | 6 | 31 |
| 6 | Indicador 4 | Captura agregada y resultados | 40 / 40 / 24 | 6 | 6 |
| 7 | Anexo inds 1 a 4 y 11 | Captura cualitativa repetible | 0 / 0 / 0 | 0 | 7 |
| 8 | Rasgos inds 1 a 4 y 11 | Referencia / ejemplo, no importar como datos | 0 / 0 / 0 | 0 | 9 |
| 9 | Indicador 5 | Captura agregada y resultados | 8 / 8 / 8 | 1 | 21 |
| 10 | Indicador 6 | Captura agregada y resultados | 8 / 8 / 8 | 1 | 5 |
| 11 | Anexo ind 6 | Captura cualitativa repetible | 0 / 0 / 0 | 0 | 6 |
| 12 | Muestras ind 6 | Referencia / ejemplo, no importar como datos | 0 / 0 / 0 | 0 | 2 |
| 13 | Indicador 7 | Captura agregada y resultados | 8 / 8 / 8 | 1 | 4 |
| 14 | Anexo inds 7 y 12 | Captura cualitativa repetible | 0 / 0 / 0 | 0 | 6 |
| 15 | Muestras inds 7 y 12 | Referencia / ejemplo, no importar como datos | 0 / 0 / 0 | 0 | 9 |
| 16 | Indicador 8 | Captura agregada y resultados | 40 / 40 / 24 | 6 | 23 |
| 17 | Indicador 9 | Captura agregada y resultados | 280 / 280 / 168 | 21 | 90 |
| 18 | Indicador 10 | Captura agregada y resultados | 40 / 40 / 24 | 6 | 7 |
| 19 | Indicador 11 | Captura agregada y resultados | 40 / 40 / 24 | 6 | 7 |
| 20 | Indicador 12 | Captura agregada y resultados | 40 / 40 / 24 | 6 | 6 |
| 21 | Indicador 13 | Captura agregada y resultados | 8 / 8 / 8 | 1 | 4 |
| 22 | Anexo ind 13 | Captura cualitativa repetible | 0 / 0 / 0 | 0 | 12 |
| 23 | Muestras ind 13 | Referencia / ejemplo, no importar como datos | 0 / 0 / 0 | 0 | 2 |
| 24 | Indicador 14 | Captura agregada y resultados | 8 / 8 / 8 | 1 | 4 |
| 25 | Anexo ind 14 | Captura cualitativa repetible | 0 / 0 / 0 | 0 | 12 |
| 26 | Muestras ind 14 | Referencia / ejemplo, no importar como datos | 0 / 0 / 0 | 0 | 2 |
| 27 | Indicador 15 | Captura agregada y resultados | 8 / 8 / 8 | 1 | 5 |
| 28 | Indicador 16 | Captura agregada y resultados | 40 / 40 / 24 | 6 | 6 |
| 29 | Indicador 17 | Captura agregada y resultados | 16 / 16 / 16 | 3 | 22 |
| 30 | Indicador 18 | Captura agregada y resultados | 0 / 0 / 0 | 5 | 4 |
| 31 | Anexo ind 18 | Captura cualitativa repetible | 0 / 0 / 0 | 0 | 12 |
| 32 | Muestras ind 18 | Referencia / ejemplo, no importar como datos | 0 / 0 / 0 | 0 | 2 |
| 33 | Indicador 19 | Captura agregada y resultados | 0 / 0 / 0 | 1 | 3 |
| 34 | Anexo ind 19 | Captura cualitativa repetible | 0 / 0 / 0 | 0 | 12 |
| 35 | Muestras ind 19 | Referencia / ejemplo, no importar como datos | 0 / 0 / 0 | 0 | 2 |
| 36 | Indicador 20 | Captura agregada y resultados | 0 / 0 / 0 | 1 | 3 |
| 37 | Anexo ind 20 | Captura cualitativa repetible | 0 / 0 / 0 | 0 | 12 |
| 38 | Muestras ind 20 | Referencia / ejemplo, no importar como datos | 0 / 0 / 0 | 0 | 2 |
| 39 | EJEMPLO Ind1 | Referencia / ejemplo, no importar como datos | 40 / 40 / 40 | 6 | 15 |
| 40 | EJEMPLO Ind2  | Referencia / ejemplo, no importar como datos | 40 / 40 / 40 | 6 | 6 |
| 41 | EJEMPLO Ind3 | Referencia / ejemplo, no importar como datos | 110 / 110 / 110 | 6 | 30 |
| 42 | EJEMPLO Ind4 | Referencia / ejemplo, no importar como datos | 40 / 40 / 40 | 6 | 6 |
| 43 | EJEMPLO Ind5 | Referencia / ejemplo, no importar como datos | 8 / 8 / 8 | 1 | 20 |
| 44 | EJEMPLO Ind6 | Referencia / ejemplo, no importar como datos | 8 / 8 / 8 | 1 | 3 |
| 45 | EJEMPLO Ind7 | Referencia / ejemplo, no importar como datos | 8 / 8 / 8 | 1 | 4 |
| 46 | EJEMPLO Ind8 | Referencia / ejemplo, no importar como datos | 34 / 34 / 34 | 6 | 22 |
| 47 | EJEMPLO Ind9 | Referencia / ejemplo, no importar como datos | 237 / 237 / 237 | 19 | 88 |
| 48 | EJEMPLO Ind10 | Referencia / ejemplo, no importar como datos | 40 / 40 / 40 | 6 | 5 |
| 49 | EJEMPLO Ind11 | Referencia / ejemplo, no importar como datos | 31 / 31 / 31 | 6 | 6 |
| 50 | EJEMPLO Ind12 | Referencia / ejemplo, no importar como datos | 40 / 40 / 40 | 6 | 6 |
| 51 | EJEMPLO Ind13 | Referencia / ejemplo, no importar como datos | 8 / 8 / 8 | 1 | 4 |
| 52 | EJEMPLO Ind14 | Referencia / ejemplo, no importar como datos | 8 / 8 / 8 | 1 | 4 |
| 53 | EJEMPLO Ind15 | Referencia / ejemplo, no importar como datos | 8 / 8 / 8 | 1 | 3 |
| 54 | EJEMPLO Ind16 | Referencia / ejemplo, no importar como datos | 40 / 40 / 40 | 6 | 5 |
| 55 | EJEMPLO Ind17 | Referencia / ejemplo, no importar como datos | 15 / 15 / 15 | 3 | 20 |
| 56 | EJEMPLO Ind18 | Referencia / ejemplo, no importar como datos | 0 / 0 / 0 | 5 | 3 |
| 57 | EJEMPLO Ind19 | Referencia / ejemplo, no importar como datos | 0 / 0 / 0 | 1 | 4 |
| 58 | EJEMPLO Ind20 | Referencia / ejemplo, no importar como datos | 0 / 0 / 0 | 1 | 3 |

## Campos cuantitativos y unidades de registro

Un registro cuantitativo representa una fila de una tabla de cantidades, por nivel educativo o población. No representa una carrera individual. Los niveles originales son TSU o PA, Licenciatura, Especialidad, Maestría y Doctorado; los anexos sí permiten nombrar programas y carreras. Los encabezados y subencabezados determinan los criterios y desgloses.

Los números representan cantidades absolutas. Las tablas b contienen proporciones calculadas; esas fórmulas no se importan como datos. Los marcadores oficiales `No disponible` deben conservarse como texto y distinguirse de cero y del campo vacío. No deben sumarse tasas ni cantidades provenientes de poblaciones posiblemente superpuestas sin una decisión del usuario.

| Sección | Filas de cantidades | Columnas numéricas | Comentarios | Dimensión |
|---|---|---|---|---|
| Indicador 1 · Tabla 1a | 8–12 | E:L | M8–M12 | TSU o PA, Licenciatura, Especialidad, Maestría, Doctorado |
| Indicador 2 · Tabla 2a | 8–12 | E:L | M8–M12 | TSU o PA, Licenciatura, Especialidad, Maestría, Doctorado |
| Indicador 3 · Tabla 3a | 9–13 | E:Z | AA9–AA13 | TSU o PA, Licenciatura, Especialidad, Maestría, Doctorado |
| Indicador 4 · Tabla 4a | 7–11 | E:L | M7–M11 | TSU o PA, Licenciatura, Especialidad, Maestría, Doctorado |
| Indicador 5 · Tabla 5a | 7–7 | E:L | M7–M7 | Docentes, investigadores |
| Indicador 6 · Tabla 6a | 8–8 | E:L | M8–M8 | Docentes |
| Indicador 7 · Tabla 7a | 8–8 | E:L | M8–M8 | Docentes |
| Indicador 8 · Tabla 8a | 7–11 | E:L | M7–M11 | TSU o PA, Licenciatura, Especialidad, Maestría, Doctorado |
| Indicador 9 · Tabla 9a1 - General | 6–10 | E:L | M6–M10 | TSU o PA, Licenciatura, Especialidad, Maestría, Doctorado |
| Indicador 9 · Tabla 9a2 - Equidad social y de género | 24–28 | E:Z | AA24–AA28 | TSU o PA, Licenciatura, Especialidad, Maestría, Doctorado |
| Indicador 9 · Tabla 9a3 - Inclusión | 42–46 | E:S | T42–T46 | TSU o PA, Licenciatura, Especialidad, Maestría, Doctorado |
| Indicador 9 · Tabla 9a4 - Interculturalidad | 60–64 | E:S | T60–T64 | TSU o PA, Licenciatura, Especialidad, Maestría, Doctorado |
| Indicador 10 · Tabla 10a | 6–10 | E:L | M6–M10 | TSU o PA, Licenciatura, Especialidad, Maestría, Doctorado |
| Indicador 11 · Tabla 11a | 8–12 | E:L | M8–M12 | TSU o PA, Licenciatura, Especialidad, Maestría, Doctorado |
| Indicador 12 · Tabla 12a | 7–11 | E:L | M7–M11 | TSU o PA, Licenciatura, Especialidad, Maestría, Doctorado |
| Indicador 13 · Tabla 13a | 8–8 | E:L | M8–M8 | Proyectos de investigación |
| Indicador 14 · Tabla 14a | 8–8 | E:L | M8–M8 | Productos de investigación |
| Indicador 15 · Tabla 15a | 6–6 | E:L | M6–M6 | Docentes, investigadores |
| Indicador 16 · Tabla 16a | 5–9 | E:L | M5–M9 | TSU, Licenciatura, Especialidad, Maestría, Doctorado |
| Indicador 17 · Tabla 17a | 7–8 | E:L | M7–M8 | Personal directivo, Personal administrativo |
| Indicador 18 · Tabla 18a | 8–11 | E:L | M8–M11 | Acompañamiento estudiantil, Vinculación social, Gestión cultural, Gestión institucional (administración y gobierno) |
| Indicador 19 · Tabla 19a | 8–8 | E:L | M8–M8 | Planes y programas de desarrollo institucional |
| Indicador 20 · Tabla 20a | 7–7 | E:L | M7–M7 | Acciones de atención y sensibilización |

Los indicadores 1, 2, 4, 6, 7, 10–16 y 18–20 desglosan siete criterios. Indicador 3 incorpora tres tipos de evaluación por cada criterio: dentro del currículo, interna independiente del currículo y externa. Los indicadores 5, 8 y 17 desglosan género (mujeres, hombres y otras autoadscripciones), discapacidad (con/sin) e identidad cultural (se autoidentifica/no).

El indicador 9 tiene cuatro tablas de cantidades independientes: general, equidad social y de género, inclusión e interculturalidad. Sus campos recorren población escolar, aspirantes, ingreso de cohorte, permanencia, abandono, reprobación, egreso y titulación. Los subgrupos aparecen en columnas bajo cada trayectoria. El campo de cohorte de la columna C contiene fechas serializadas de Excel, no porcentajes ni simples cantidades; debe mantener su valor y formato. En la muestra se observa `45292` (1 de enero de 2024).

## Identificación, periodos y combinaciones

Las columnas A y B de los bloques de datos contienen entidad e institución. C contiene periodo o fecha de cohorte. Se mapearon por separado en 20 secciones de identificación, incluidas las repeticiones en las tablas de porcentajes para conservar todas las capturas. Los nombres cortos de fuente pertenecen exclusivamente a la aplicación y nunca se escriben en estas celdas.

Los periodos verticalmente combinados se mapean una sola vez en la celda superior izquierda. Por ejemplo, `Indicador 1!C8:C12` se captura en C8 y `C16:C20` en C16. El esquema evita apuntar a celdas subordinadas de esas combinaciones.

Periodo general de la CAI: 2025–2026, normalmente al cierre del ciclo escolar. Indicador 9 especifica cohortes 2021, 2022 o 2023 según nivel, además de la reprobación del ciclo 2025–2026. El texto de Indicador 20 conserva una incongruencia original entre el encabezado 2023–2026 y la aclaración 2023–2025; la aplicación debe mostrar el texto de referencia sin inventar un periodo corregido.

## Anexos cualitativos repetibles

Cada fila es un registro completo. Las X representan los criterios asociados; no se deben convertir las siete columnas en siete registros. La identidad para comparar duplicados debe considerar alcance/tipo/descripción normalizados, nunca el número de fila como identificador global entre archivos.

| Hoja | Zona mapeada entrada / salida | Capacidad actual | Campos de texto | Registros ficticios |
|---|---|---:|---|---:|
| Anexo inds 1 a 4 y 11 | A4:J1000 | 997 | Programa educativo o referente, Rasgo del perfil de egreso, Observaciones (opcional) | 86 |
| Anexo ind 6 | A5:K1000 | 996 | Alcance institucional / unidad académica, Programa educativo / ámbito / lugar, Acción de profesionalización, Observaciones (opcional) | 48 |
| Anexo inds 7 y 12 | A4:K1000 | 997 | Alcance institucional / programa, Tipo de innovación, Proyecto de innovación, Observaciones (opcional) | 60 |
| Anexo ind 13 | A5:J1000 | 996 | Programa / unidad / institución, Proyecto de investigación, Observaciones (opcional) | 54 |
| Anexo ind 14 | A5:J1000 | 996 | Programa / unidad / institución, Producto de investigación, Observaciones (opcional) | 75 |
| Anexo ind 18 | A6:J1000 | 995 | Tipo de acción institucional, Iniciativa, servicio o acción, Observaciones (opcional) | 80 |
| Anexo ind 19 | A5:J1000 | 996 | Plan / programa / nivel, Acción prevista, Observaciones (opcional) | 55 |
| Anexo ind 20 | A5:J1000 | 996 | Programa / unidad / institución, Acción realizada o en proceso, Observaciones (opcional) | 72 |

Las ocho hojas tienen formato existente hasta la fila 1000. Ese es el límite mapeado sin insertar filas. Si se supera, se debe bloquear la exportación con un aviso concreto o ampliar de forma explícita los rangos/formato/validaciones; nunca truncar registros silenciosamente. La plantilla de entrada también permite estos mismos slots.

Los anexos de los indicadores 6 y 7/12 tienen once columnas (A:K), con tres campos descriptivos, criterios D:J y observaciones K. Los demás tienen diez columnas (A:J), dos campos descriptivos, criterios C:I y observaciones J. No existe una columna exclusiva de evidencias o URL; las ligas aportadas se conservan dentro de la descripción u observaciones. No corresponde inventar una columna en la salida.

Las observaciones son explícitamente opcionales. Las hojas no contienen reglas técnicas que hagan campos obligatorios: la aplicación puede señalar registros incompletos y permitir información parcial, sin atribuir una obligación inexistente a Excel. Las descripciones y el referente contextual identifican el sentido del registro; una X aislada se debe conservar con advertencia, no descartarse.

## Validaciones, protección y estilos

No hay protección de hoja activa en ninguno de los 58 tabs. Todas las celdas heredan `locked=true`, que solo tiene efecto al activar protección: ese atributo no distingue zonas capturables. Los estilos y colores también aparecen en textos guía, por lo que el contrato usa encabezados, tabla, fila semántica y baseline además de coordenadas.

Hay exactamente una validación de datos: `Anexo ind 18!A6:A647`, tipo lista, permite blanco y muestra error. Su origen es `$L$2:$L$5`:

- a) Acompañamiento a los y las estudiantes.
- b) Vinculación social.
- c) Gestión cultural.
- d) Gestión institucional en general.

La lista debe mantenerse en L2:L5. Las filas 648–1000 están formateadas pero fuera del alcance de validación original; el formulario web puede ofrecer la misma lista en todos sus registros sin alterar la estructura existente. No hay listas desplegables nativas para las X de criterios, aunque el formulario puede usar controles equivalentes.

## Fórmulas, resultados y gráficas

Las 180 gráficas se conservan como partes del ZIP, sus relaciones y dibujos. Hay 91 en hojas de captura y 89 en hojas de ejemplos. Por ejemplo, la primera gráfica de `Indicador 1` toma categorías de F7:L7 y valores de F16:L16. Los indicadores 18–20 no tienen tabla de porcentajes y grafican cantidades. El inventario JSON detalla cada referencia de cada gráfica.

Las tablas calculadas dependen de las cantidades de su propia hoja. Algunas fórmulas de la hoja `EJEMPLO Ind9` refieren a `EJEMPLO Ind8`; deben permanecer intactas como referencia, y nunca convertirse en contribuciones del usuario. La salida utiliza fórmulas `IFERROR(...,"")` para evitar mostrar errores ante blancos. Una diferencia relevante comprobada es `Indicador 3!U22`: la entrada tiene `U13/$E$12`, mientras que la salida ya contiene `IFERROR(U13/$E$13,"")`. El denominador correcto de la plantilla de salida se preserva.

La entrada conserva errores en las cachés de resultados de algunas fórmulas al estar vacíos los denominadores; no son aportaciones ni justifican rechazar la plantilla. El motor de importación debe ignorar las fórmulas. El de exportación debe conservarlas, invalidar resultados/cache de gráficas afectados y solicitar recálculo cuando corresponda. La conservación del XML no equivale a haber calculado todo el libro en un motor Excel.

## Baseline y clasificación de compatibilidad

Los textos originales dentro de zonas capturables forman parte del baseline: ejemplos entre paréntesis en E/F y otras celdas numéricas, `XX`/`ZZ` de Indicador 3, `XXX`/`ZZZ` de Indicador 20 y periodos prellenados. Importar la plantilla vacía debe registrar una fuente con cero aportaciones. Blancos, celdas faltantes y cadenas vacías son ausencia de aporte; el cero numérico sí es dato.

El reconocimiento debe combinar nombre de hoja normalizado, anclas de título/encabezado, bloques y celdas esperadas. Cambios de fuente, color, ancho o altura no modifican compatibilidad semántica. Una renombrada leve se puede resolver mediante anclas inequívocas. Una fila insertada o encabezado perdido exige advertencia y/o alineación explícita: no aplicar coordenadas ciegas. Las clases previstas son compatible, variaciones, parcial y desconocida.

## Verificación del contrato generado

`public/data/schema.json` contiene 51 secciones: 23 cuantitativas, 20 de identidad y 8 anexos. Incluye 20 indicadores, siete criterios, 30 hojas de referencia y 82,987 mapeos de campo. Hay 8200 slots de fila; los slots vacíos no son registros. Cada campo guarda `inputRef`, `outputRef`, `inputBaseline` y `outputBaseline` aunque actualmente coincidan las coordenadas.

Comprobaciones del generador:

- Ninguna celda de salida está asignada dos veces.
- Ningún campo importable se superpone con una fórmula de entrada o salida.
- Todos los cambios no vacíos del archivo ficticio frente a la plantilla de salida quedan dentro del esquema.
- Las ocho hojas de anexos contienen en total 530 filas ficticias (86 + 48 + 60 + 54 + 75 + 80 + 55 + 72).
- Los hashes de las tres fuentes coinciden antes y después del análisis.

Estas comprobaciones validan el mapeo documental. Las pruebas del importador/exportador y de la interfaz se documentan por separado.

## Archivos técnicos

- `public/data/schema.json`: contrato de dominio y celdas para la aplicación.
- `work/excel-audit.json`: inventario técnico completo comprimido semánticamente (contenido no vacío, estilos de muestra capturable, todas las fórmulas/referencias/gráficas/validaciones/combinaciones, dimensiones por intervalos, hashes).
- `work/schema-verification.json`: resultados de colisiones, intersección con fórmulas y cobertura del ejemplo.
- `work/input-rows.txt`: lectura ordenada de los encabezados y filas no vacías de las hojas de entrada, excluidas las hojas EJEMPLO.

## Integridad de fuentes

| Rol | SHA-256 |
|---|---|
| input | `26939f2d0d498fa0fab259a6f9d87d5c2de351cfbe74932ff2384f6bed7ad8fc` |
| output | `6a74c494ef84bdc76fd39de82ee756563f10ae8bf2ac5bdc11d2b9464b77f651` |
| demo | `71b45818a10bb8ebb76a0e31737ab035ea281a37c20b696330ee146ebfae3681` |
