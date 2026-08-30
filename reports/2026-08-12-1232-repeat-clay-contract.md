# Restaura el contrato Clay de Cancelar en Repeat

**Fecha:** 2026-08-12 12:32
**Agente:** Codex
**Rama:** main

## Qué cambió

Se restauró la receta visual Clay del botón Cancelar dentro de la vista previa de Repeat. El botón vuelve a usar el borde Clay y la superficie elevada existentes, manteniendo las sombras Clay de reposo, hover y active ya presentes.

No se modificaron la lógica de Repeat, el atajo `R`, la receta, selección, cancelación ni componentes React.

## Por qué

El contrato de `tokens.test.ts` para Cancelar exigía `--sc-clay-edge` y `--sc-color-surface-elevated`, pero el rediseño posterior había dejado el selector con `border:0` y `--sc-color-surface-2`. La prueba roja reproducía exactamente esa contradicción.

## Archivos tocados

- `src/features/workspace/phase1.css` — restaura el borde Clay y el fondo elevado de `.repeat-preview button`; se preservan geometría, focus-visible, reduced motion, hover y active.
- `reports/2026-08-12-1232-repeat-clay-contract.md` — documenta alcance, evidencia y verificación de este ajuste.

## Cómo verificar

Ejecutar:

```text
npx.cmd vitest run src/design-system/tokens.test.ts --maxWorkers=1
npx.cmd vitest run src/design-system/tokens.test.ts src/features/canvas/RepeatActionOverlay.test.tsx src/App.test.tsx --maxWorkers=1
npm.cmd test -- --maxWorkers=1
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run verify:protected
npm.cmd run build
npm.cmd run qa:topbar
git diff --check
```

En Chromium, seleccionar un miembro, activar Repeat con `R` y comprobar en Day y Night que Cancelar tiene borde Clay, superficie elevada y sombra neutra, diferenciada del preview. Activar Cancelar debe retirar la vista previa y devolver la herramienta Seleccionar sin limpiar el miembro seleccionado.

## Pendiente / siguiente paso

No se hizo commit ni push por instrucción explícita del usuario. En esta sesión, la instancia de navegador disponible no expuso navegación nativa con Tab y no había Chrome externo conectado; la comprobación de foco mediante Tab requiere repetirla en una instancia con soporte de teclado nativo. No se guardaron screenshots.
