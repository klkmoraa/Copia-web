# T07 — Certificación de release 0.8.1

**Estado inicial:** `BLOCKED` por T01, T02, T03, T04 y T05. **No publicar en esta tarea.**

## Objetivo

Certificar el commit integrado como `0.8.1` con evidencia actual, documentación coherente y rollback reproducible.

## Pasos

1. Verificar en Git que T01, T02, T03 y T05 están `COMPLETE`, y que T04 está `COMPLETE` o `NOT_NEEDED` con su decisión enlazada.
2. Crear branch de certificación desde el commit integrado; no añadir funcionalidades.
3. Ejecutar:

```powershell
npm.cmd run lint
npm.cmd test
npm.cmd run build
npm.cmd run qa
npm.cmd run qa:webkit
npm.cmd run qa:phase11
npm.cmd run qa:phase12
npm.cmd run qa:phase13
npm.cmd run qa:phase14
```

4. Restaurar evidencia histórica que los scripts regeneren y conservar sólo artefactos de `0.8.1` aprobados.
5. Comparar rutas protegidas contra el predecesor; ningún cambio no autorizado puede pasar el gate.
6. Actualizar `PHASE_STATUS.md`, release notes, release baseline, QA report, known issues, rollback y el ledger STATUS con conteos y commit exactos.
7. Commit `docs(release): certify 0.8.1`; STATUS `COMPLETE` sólo con todos los gates verdes.

## Criterio de aceptación

La documentación describe exactamente el commit que T08 va a publicar; no hay referencia a conteos, versiones o contrato móvil obsoletos.
