# T03 — Procedencia y versión de exportación

**Estado inicial:** `NOT_STARTED`. **Base:** `0071688`. **Puede ejecutarse en paralelo:** T01, T02 y T04.

## Objetivo

Evitar que PDF y paquetes portables declaren `0.7.0` cuando la aplicación publicada es `0.8.0` o posterior.

## Archivos propietarios

- `src/components/TopBar.tsx`.
- `src/utils/portablePayload.ts` y, si es necesario, un módulo nuevo de versión de build.
- Pruebas de TopBar/exportación portable. No editar importadores de T02.

## Pasos

1. Crear `fix/export-version-provenance`; registrar `IN_PROGRESS`.
2. Escribir una prueba que exporte un payload y compruebe que `manifest.appVersion` coincide con la versión de build declarada por la aplicación.
3. Reemplazar los literales `0.7.0` por una única fuente tipada de versión. Mantener formato de manifest, checksum y compatibilidad de importación.
4. Probar exportación de PDF y `.structureco` con y sin análisis ya calculado; no resolver el hallazgo de paridad de T04 en esta tarea.
5. Ejecutar:

```powershell
npm.cmd test -- src/components/TopBar.test.tsx src/utils/portable.test.ts
npm.cmd run build
```

6. Commit `fix(export): align artifact provenance version`, STATUS `COMPLETE` y handoff con la versión verificada.

## Criterio de aceptación

Todo artefacto nuevo informa una versión coherente; un artefacto antiguo sigue importando sin migración nueva.
