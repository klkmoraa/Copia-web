# CRI-90 · Material de SHEET, MODAL y BASE técnico

**Fecha:** 2026-08-16 21:45
**Agente:** Codex
**Rama:** crisdlm302/cri-90-materia-formalizar-sheet-y-modal-y-extender-base-a-las-zonas

## Qué cambió

Se formalizó la gramática de seis niveles (`BASE`, `INSET`, `RAISED`, `FLOATING`, `SHEET`, `MODAL`) en el componente tipado y en la hoja central de materia. Los drawers ahora declaran `SHEET`; diálogo y pantalla completa declaran `MODAL`.

`SHEET` usa la sombra ascendente existente, conserva rectos los bordes contra el viewport y sólo redondea sus esquinas de entrada. `MODAL` usa la sombra modal y el velo temático existente. Datasheet, filas técnicas y controles numéricos en reposo quedan explícitamente planos.

## Por qué

CRI-90 exige completar la gramática definida por el Brandbook sin crear tokens, cambiar HEX/radios canónicos ni afectar solver, modelo, schema o presentación responsiva. La corrección de especificidad en `material.css` evita que el CSS lazy de componentes vuelva a convertir SHEET/MODAL en FLOATING.

## Archivos tocados

- `src/design-system/material.css` — niveles INSET/SHEET/MODAL, BASE técnico, guardas contra elevación repetida y cascada de overlays.
- `src/design-system/components/surface.tsx` — `SurfaceLevel` con los seis niveles.
- `src/design-system/components/overlays.tsx` — niveles declarativos en drawers, diálogos y fullscreen.
- `src/design-system/lab/ComponentLab.tsx` — demostración bilingüe de los seis niveles en Día/Noche.
- `src/design-system/lab/componentLab.css` — composición responsive del demo material.
- `src/design-system/components/surface.test.tsx` y `src/design-system/material.test.ts` — contratos de API, tokens, BASE y pressed con capas interiores.
- `reports/evidence/2026-08-16-cri-90/` — capturas de seis niveles, Sheet, Modal con foco y Datasheet BASE.

## Cómo verificar

- `npm run lint` — PASS en worktree limpio con el diff de CRI-90; el checkout compartido contiene directorios no rastreados ajenos con dependencias que hacen fallar el mismo comando fuera del alcance.
- `npx vitest run src/design-system --maxWorkers=1` — 12 archivos y 73 pruebas PASS.
- `npm run typecheck` — PASS.
- `npm run build` — PASS.
- Abrir `/__components`: comprobar los seis niveles con Día/Noche; abrir diálogo y drawer; en K0 el drawer es SHEET con sombra hacia arriba. Abrir la hoja de datos en el workspace y comprobar la rejilla plana.

## Pendiente / siguiente paso

Nada pendiente para CRI-90. No se inició CRI-98, CRI-101, CRI-102, CRI-104 ni CRI-105.
