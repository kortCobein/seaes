# SEAES · UTSJR

Sitio estático para consultar, capturar y consolidar los indicadores SEAES. Los libros se procesan en el navegador y la sesión se guarda localmente, sin backend.

## Desarrollo y publicación

Requiere Node.js 22 y npm.

```sh
npm ci
npm test
npm run build
```

`npm run dev` abre el servidor de desarrollo. `npm run preview` sirve el build para revisarlo.

Sube **todo el contenido de `dist/`** a la carpeta elegida del hosting. Sus rutas son relativas y permiten publicarlo en una subcarpeta. No requiere instalar Node.js en el servidor.

## Fuente y build sincronizados

El código editable está en `src/`; los libros, esquema y favicon originales del build están en `public/`. `dist/` se genera y se versiona junto con esos archivos. Para cambiar el comportamiento, modifica la fuente, ejecuta las pruebas y vuelve a compilar; un cambio manual en los bundles de `dist/assets/` se perdería en el siguiente build.

Las correcciones recuperadas del `dist` del 10 de octubre de 2026 están implementadas en `src/services/consolidation.ts`:

- Sumar aportaciones numéricas, incluso cuando sus valores coinciden; conservar el cero capturado.
- Normalizar institución y entidad a UTSJR y Querétaro.
- Reunir comentarios y observaciones, conservando las aportaciones originales.
- Respetar las decisiones guardadas y mostrar conflictos en los campos que requieren elegir un valor.
- Clasificar duplicados exactos únicamente en anexos.

`tests/consolidation.test.ts` protege estas reglas; las pruebas de integración verifican importación y exportación con los libros del proyecto. `UX-CONTRACT.md` describe la navegación y las interacciones.

## Tema Celadon UT
`src/celadon-ut.css` adapta el relieve, los paneles claros, el encabezado flotante, los botones y las tablas de [Celadon (TemplateMo)](https://templatemo.com/tm-633-celadon). Los blancos y grises suaves de la plantilla se conservan y los acentos se distribuyen entre verde UT (`#009D81`) y azul UT (`#00245A`). La atribución de TemplateMo permanece en el pie de página. El icono de Excel del proyecto está en `public/excel-icon.webp`.

## Importaciones duplicadas
Cada Excel obtiene una huella SHA-256 del contenido binario. Una importación idéntica se omite antes de consolidar, aunque tenga otro nombre o ya estuviera guardada en una sesión anterior con su original disponible. Dos fuentes diferentes con el mismo número siguen siendo aportaciones independientes.

## Sincronización automática del build
GitHub Actions compila, ejecuta pruebas y, en pushes a `main`, versiona automáticamente `dist/` cuando cambia. Los bundles de `dist/assets/` no deben editarse a mano. Los artefactos de Actions son una alternativa descargable para Hostinger.
