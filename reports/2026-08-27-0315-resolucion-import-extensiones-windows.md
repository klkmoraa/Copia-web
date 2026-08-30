# Resolución de colisión de nombres de archivo en importaciones bajo Windows

**Fecha:** 2026-08-27 03:15
**Agente:** Antigravity
**Rama:** main

## Qué cambió
Se especificó la extensión `.tsx` explícita en las importaciones de componentes (`ModelOverview.tsx` y `DataSurface.tsx`) para resolver colisiones de nombres con sus módulos de lógica homónimos (`modelOverview.ts` y `dataSurface.ts`) en sistemas de archivos no sensibles a mayúsculas/minúsculas (Windows).

## Por qué
En Windows, al ejecutar `vite` en desarrollo o resolver módulos sin extensión, Vite resolvía `import ... from './ModelOverview'` hacia `modelOverview.ts` (debido al orden de prioridad de extensiones `.ts` antes de `.tsx` y la insensibilidad a mayúsculas del sistema de archivos). Como `modelOverview.ts` solo exporta funciones y tipos pero no el componente React `ModelOverview`, el navegador lanzaba un `SyntaxError` de exportación no encontrada y activaba el `ErrorBoundary` en el arranque.

## Archivos tocados
- `src/features/inspector/InspectorProperties.tsx` — import explícito a `./ModelOverview.tsx`.
- `src/features/inspector/ModelOverview.test.tsx` — import explícito a `./ModelOverview.tsx`.
- `src/features/workspace/WorkspaceShell.tsx` — import diferido explícito a `../data/DataSurface.tsx`.
- `src/features/datasheet/DatasheetContent.test.tsx` — import explícito a `../data/DataSurface.tsx`.
- `src/features/model-doctor/ModelDoctorContent.test.tsx` — import explícito a `../data/DataSurface.tsx`.

## Cómo verificar
```bash
npm run verify:protected
npm run lint
npm run typecheck
npm run verify:docs
npm run build
```
Acceder a `http://localhost:5173/` en el navegador y comprobar que la pantalla de inicio y mesa de trabajo cargan limpiamente sin errores de consola.

## Pendiente / siguiente paso
Nada pendiente.
