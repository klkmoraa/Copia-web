# Fix: doble animación en `.popover` (CSS + motion a la vez)

**Fecha:** 2026-08-03 21:44
**Agente:** Claude Code
**Rama:** main

## Qué cambió

Al migrar los tres popovers de `TopBar.tsx` a `motion`/`AnimatePresence`
(commit `0d596ca`), se sacó `.popover` de la regla compartida
`native-menu-in`, pero se pasó por alto que la regla **base** de `.popover`
(`styles.css`, la que trae el fondo/blur/radio) también traía su propia
animación CSS independiente: `animation:sc-pop-in var(--sc-motion-fast)
var(--sc-ease-enter) both;`. Resultado: los tres popovers corrían **dos
animaciones de entrada a la vez** (la keyframe CSS `sc-pop-in` y la
animación JS de `motion`), exactamente el mismo tipo de problema que el
propio `notes.md` de Remix señalaba como pendiente para su versión
(`010-topbar-redesign-animations`), y que yo mismo había prometido evitar en
el reporte de esa migración.

Se quitó `animation:sc-pop-in ...` de la regla base `.popover`, y se
consolidó `transform-origin` en un solo lugar (`top right`, el valor que
tenía la regla compartida con `native-menu-in` antes de separarla; había
quedado duplicado en dos reglas distintas tras el commit anterior).

## Por qué

Corrección de un defecto real introducido por mí en el commit anterior de
esta misma sesión, encontrado durante la preparación del siguiente cambio
(rediseño de la pantalla de inicio) al revisar el CSS de `.popover` para
evitar repetir el mismo patrón ahí.

## Archivos tocados

- `src/styles.css` — regla base `.popover` (se quitó `animation`, se
  consolidó `transform-origin`).

## Cómo verificar

```bash
npx vitest run src/features/topbar/TopBar.test.tsx
npm run lint
npm run typecheck
node scripts/check-protected-baseline.mjs   # 26 archivos intactos
npm test        # 88 archivos / 636 pruebas en verde, sin cambios de cantidad
```

## Pendiente / siguiente paso

Ninguno. Sin push (instrucción explícita del usuario: trabajo solo local,
sin GitHub).
