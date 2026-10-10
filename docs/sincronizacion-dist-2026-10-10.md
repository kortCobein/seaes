# Sincronización de fuente y dist — 10 de octubre de 2026

Se tomó como referencia el `dist` corregido por el usuario, antes de recompilar. La interfaz, estilos, worker y libros ya coincidían con el código local pendiente de versionar. Las diferencias recuperadas fueron la consolidación con suma automática y el favicon.

Se integraron los cambios remotos existentes y se conservaron las decisiones y procedencias de la versión entregada, incluido el periodo elegido en una decisión de identidad. La interfaz y las exportaciones completa y simplificada quedan incluidas en el repositorio.

## Verificación ejecutada

| Verificación | Resultado |
| --- | --- |
| `npm test` | 35 pruebas aprobadas, sin fallos |
| `npm run build` | TypeScript y Vite finalizados con código 0 |
| Comparación con el bundle corregido | 1,572 escenarios del esquema real y 28 casos dirigidos coincidentes; sin mutación de entradas |
| Demo proporcionada | 683 aportaciones, 14 fuentes y 541 registros consolidados |
| Copia independiente del índice de Git | `npm ci` y build correctos; mismos 9 archivos de dist, normalizando únicamente finales de línea del archivo generado por Git en Windows |
| Hosting estático | 27 respuestas HTTP 200: todos los recursos en `/`, `/seaes/` y `/universidad/reportes/seaes/` |
| Navegador | Importación múltiple, búsqueda, detalle, persistencia tras recarga y ambas descargas comprobadas; sin errores ni advertencias en consola |
| Suma de prueba | `20 + 0 + 7 + 0 = 27`, cuatro aportaciones conservadas y estado complementario |
| Excel completo descargado | 58 hojas, 541 registros releídos y todos los valores esperados; 1,489 fórmulas y 180 gráficas conservadas |
| Excel simplificado descargado | 28 hojas, 30 omitidas, los mismos 541 registros y todos los valores esperados; 774 fórmulas y 91 gráficas en las hojas conservadas |

La revisión de Excel valida los datos y la estructura OpenXML, incluidas relaciones y dependencias. No se abrió Microsoft Excel para comprobar su recálculo o renderizado.

El respaldo del dist recibido, los oráculos temporales, logs y resultados detallados permanecen localmente en `work/reconcile-dist-20261010/`, excluidos de Git. Las cachés de TypeScript y salidas regenerables de pruebas también se conservan localmente sin versionarse.

El workflow de GitHub recompila y comprueba que `dist/` siga coincidiendo con la fuente. El directorio publicado debe generarse con `npm run build`, sin parches manuales en sus bundles.
