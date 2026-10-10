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
