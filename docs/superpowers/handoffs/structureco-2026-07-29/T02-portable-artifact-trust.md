# T02 — Límites de confianza para importación portable

**Estado inicial:** `NOT_STARTED`. **Base:** `0071688`. **Puede ejecutarse en paralelo:** T01, T03 y T04.

## Objetivo

Rechazar PDF, JSON y `.structureco` sobredimensionados antes de cargarlos/descomprimirlos, con errores comprensibles y sin tocar el solver.

## Archivos propietarios

- `src/utils/portableFile.ts`, `src/utils/portableBundle.ts`, `src/utils/pdfImport.ts`.
- `src/components/portableImportAdapter.ts` sólo si necesita traducir un error existente.
- Pruebas nuevas o existentes de `portable`, `portableFile`, `portableBundle` y PDF.

## Pasos

1. Crear `fix/portable-resource-guards` y registrar `IN_PROGRESS`.
2. Escribir pruebas unitarias para: `File.size` por encima de cada límite, bundle con demasiadas entradas, bundle con ruta no permitida y bundle cuyo tamaño expandido supera el presupuesto. Usar buffers pequeños simulados, no un ZIP-bomb real.
3. Definir constantes nombradas por tipo de archivo; validar tamaño antes de `arrayBuffer()` y validar rutas/cantidad/presupuesto de expansión antes de parsear proyecto.
4. Mantener los límites actuales de schema como segunda defensa; no cambiar schema, formato portable, checksum ni importación válida.
5. Ejecutar:

```powershell
npm.cmd test -- src/utils/portable.test.ts
npm.cmd run build
npm.cmd audit --json
```

6. Commit `fix(import): bound portable file resources`, diff protegido limpio, STATUS `COMPLETE` y handoff con los límites exactos aceptados.

## Criterio de aceptación

Un archivo no confiable falla temprano sin congelar el flujo; PDF/JSON/bundle normales siguen importando y el round-trip técnico permanece idéntico.
