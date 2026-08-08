# Fix de layout del acordeón "Configuración avanzada P-Delta"

**Fecha:** 2026-08-03 20:38
**Agente:** Claude Code
**Rama:** main

## Qué cambió

Se corrigió `PDeltaAdvancedConfig` (`TopBar.tsx`), portado tal cual desde
`remix-structureco/google-ai-diffs/009-pdelta-advanced-menu-fix`. El
`<details>` que envuelve la configuración avanzada de P-Delta usaba la clase
genérica `.mobile-menu-field` (grid fijo de 2 columnas, pensada para una sola
fila `<label>`) directamente sobre sí mismo — como `display:grid` aplica a
todos sus hijos directos (`<summary>` y cada `<label>` de campo), el
acordeón entero quedaba forzado a esa grilla de 2 columnas, desbordando sus
campos. En Structure ya existía una clase huérfana sin ninguna regla CSS
(`overflow-pdelta-advanced`) que sugiere un intento previo de arreglarlo que
nunca se completó.

Cambios:

- `<details className="mobile-menu-field overflow-pdelta-advanced">` →
  `<details className="pdelta-advanced-details">`, con los campos ahora
  envueltos en `<div className="pdelta-advanced-content">` en vez de quedar
  como hijos directos del `<details>`.
- Nuevo bloque CSS `.pdelta-advanced-details` / `summary` / `summary:hover` /
  `.pdelta-advanced-content` / `input[type="number"]` — tarjeta con borde,
  cabecera clicable con hover, contenido con los campos apilados
  verticalmente (cada `<label className="mobile-menu-field">` interno
  conserva su propio grid de 2 columnas, que es donde sí tiene sentido).

Solo CSS + reestructuración de wrapper; no se tocó el valor de ningún campo
ni el flujo de datos hacia `updateProjectView`/el análisis.

## Por qué

Sexta propuesta aprobada del backlog. Bug de layout real y de bajo riesgo:
la configuración avanzada de P-Delta (paso de reducción, paso mínimo, etc.)
podía desbordar su contenedor en el menú móvil/popover.

## Archivos tocados

- `src/features/topbar/TopBar.tsx` — `PDeltaAdvancedConfig`.
- `src/styles.css` — nuevo bloque `.pdelta-advanced-*`.

## Cómo verificar

```bash
npx vitest run src/features/topbar
npm run typecheck
node scripts/check-protected-baseline.mjs   # 26 archivos intactos
npm test        # 87 archivos / 631 pruebas en verde
```

No se pudo completar verificación visual en navegador en esta sesión (mismo
bloqueo de permisos del panel de vista previa que en los cambios anteriores).
Se recomienda abrir el acordeón "Configuración avanzada" con modo de análisis
P-Delta activo en `npm run dev`, en un viewport móvil, antes de cerrar
definitivamente este cambio.

## Pendiente / siguiente paso

Ninguno funcional. Sin push (instrucción explícita del usuario: trabajo solo
local, sin GitHub).
