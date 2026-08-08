# Rail y referencias oficiales de la identidad Clay

**Fecha:** 2026-08-07 18:48
**Agente:** Codex
**Rama:** main

## Qué cambió

- Se completó el tratamiento visual del rail de herramientas expandido y contraído: iconos centrados, grupos separados, color semántico por herramienta y estados elevado, hover, pressed, focus y reduced-motion con las recetas del brandbook.
- Se corrigieron superficies y controles restantes de Workspace/Inspector/Results para mantener iluminación, profundidad, radios, gradientes y densidad técnica coherentes en light/dark.
- Se hizo más visible el logo oficial vectorial y se alineó Aula al rosa oficial `#C15B8F`.
- Se conservaron los contratos funcionales, la viga 3D de Welcome y la disposición de Results debajo del canvas.
- Se guardaron las referencias en `design-reference/brandbook/` para trazabilidad local.

## Por qué

La barra contraída todavía mostraba iconos oscuros y una superficie plana que no pertenecían al sistema visual oficial. La segunda pasada necesitaba una referencia local estable y una aplicación consistente del lenguaje físico del brandbook, no una mezcla de estilos heredados y prototipo.

## Archivos tocados

- `src/styles.css` — rail compacto/expandido, estados físicos, superficies, controles, overlays, Inspector, capas, Results, Welcome y reduced-motion.
- `src/design-system/tokens.css` — roles Clay, sombras, superficies y Aula en la paleta oficial.
- `src/features/topbar/BrandMark.tsx` — vector del logo adjunto con `currentColor`.
- `src/features/topbar/TopBar.tsx` — presencia mayor del logo en la cabecera.
- `scripts/check-performance-budget.mjs` — techo documentado de carga inicial actualizado para el CSS visual adicional de esta pasada.
- `design-reference/brandbook/brandbook-clay.html` — copia local del brandbook oficial.
- `design-reference/brandbook/structureco-real-clay.html` — copia local de la referencia de mesa de trabajo.
- `reports/2026-08-07-1848-rail-brandbook-fidelidad.md` — este reporte.

## Cómo verificar

```text
npm.cmd run verify
npm.cmd run qa
npm.cmd run verify:protected
```

Resultado final: `verify` en verde, `qa` en verde, `verify:protected` confirma 29 archivos protegidos intactos, y la batería completa reporta 97 archivos/738 tests pasados. QA valida Welcome y Workspace en light/dark, desktop/tablet/móvil, rail, Inspector, Results, overlays, animaciones, reduced-motion y ausencia de overflow móvil.

## Pendiente / siguiente paso

Nada pendiente para esta pasada. El cambio queda en un commit local; no se hizo `git push`.
