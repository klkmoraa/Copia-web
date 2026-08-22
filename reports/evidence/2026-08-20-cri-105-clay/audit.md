# CRI-105 · Auditoría de materia — inventario antes / decisiones / después

**Clasificación:** `AUDIT/TEMPORARY`
**Baseline:** `c7f0bdeaeaf0d9b97e36e17810099e5446d1e415` (`origin/main`, CRI-108 integrado)
**Autoridad visual:** `brand/brandbook-clay.html` — V-02, V-04, V-05, V-09, V-12, V-13, V-14.

---

## 1 · Inventario mecánico previo

Ejecutado sobre `main` antes de tocar nada.

| Búsqueda | Resultado |
|---|---|
| `rg -c "box-shadow" src` | 218 en `styles.css`, 43 en `ui.css`, 36 en `space3d.css`, 18 en `phase1.css`, 13 en `material.css`, resto por debajo de 10 |
| `rg -n "box-shadow:\s*(?!.*var\()(?!.*none)" -P src` | **3** literales, todos en `styles.css` (3439, 3506, 3596) |
| `rg -c "border-radius" src` | 263 en `styles.css`, 35 en `space3d.css`, 32 en `ui.css`, 25 en `phase1.css` |
| `rg -c "linear-gradient\|radial-gradient" src` | 23 en `styles.css`, 6 en `tokens.css`, resto ≤ 4 |
| Literales de hundimiento en estado pulsado | **18** repartidos entre `styles.css`, `phase1.css`, `projectHub.css`, `space3d.css` + la regla global `:where(...):active { scale(.975) }` de `ui.css` |
| `rg -n "canvas-layer-switch" src` | 10 líneas, **dos definiciones base incompatibles** (2237 y 3716) y **ningún marcado que las use** |
| Consumidores de `--sc-shadow-contact` | 8, todos estados `active`/`aria-pressed` |
| Consumidores de `--sc-glow-accent` / `--sc-glow-aula` | **0** |

## 2 · Clasificación de gradientes

| Clase | Casos | Decisión |
|---|---|---|
| A · materia/luz | `--sc-gradient-clay-action`, `--sc-gradient-sheen` (tokens) | Se conservan; sólo cambia la geometría de su sombra asociada |
| B · identidad | `.welcome-launcher-card`, `--classroom`, `--sc-gradient-display`, `--sc-gradient-brand-soft` | **Intactos** (CRI-91/CRI-104) |
| C · técnico/dominio | `.canvas-demand-ramp`, retícula de demanda, cruceta de `+`, `.inspector-property-group.is-derived` | **Intactos** |
| D · decorativo permitido | Retícula de papel de la bienvenida, máscara de desvanecido `to bottom`, conector del flujo | **Intactos** |
| E · sospechoso | `.toggle-row input::after` (volumen con dos superficies), `.toggle-row input:checked` y `#workspace-canvas .canvas-layer-switch[checked]` (reproducción literal de la arcilla teñida) | **Reemplazados por token**; el tercero desapareció con el CSS muerto |

## 3 · Radios por rol — escala oficial aplicada (V-05)

| Rol | Token | Valor | Quién lo usa |
|---|---|---|---|
| Dato técnico | `--sc-radius-data` | `0` | Celdas del Datasheet, `.results-table`, editor de celda, rejillas comparables |
| Control | `--sc-radius-control` | `10px` | Botones, icon buttons, campos, herramientas, segmentos, chrome del lienzo, tooltips, `LayerToggle` |
| Tarjeta | `--sc-radius-card` | `18px` | `.result-extreme-card`, banner, tira de estado, resumen del Inspector, `.cut-tooltip`, `.repeat-preview`, `peek` |
| Panel / hoja | `--sc-radius-panel` | `24px` | `.sc-popover__surface`, sheets y drawers, `.canvas-layer-panel`, `.structural-edit-surface`, `.structure-generator` |
| Modal | `--sc-radius-modal` | `28px` | `.sc-modal-surface--dialog`, `.command-palette` |
| Pastilla | `--sc-radius-pill` | `999px` | Badges, chips, `.canvas-mode-badge`, `.canvas-status`, `.canvas-hint`, `.repeat-action-control`, pista del interruptor |

Los alias de migración (`xs`/`sm`/`md`/`lg`/`xl`/`2xl`/`hero`/`sheet`) ya no declaran valor propio: cada uno resuelve a un escalón de la tabla. Antes eran ocho valores (8/12/14/26/26/32/26/28) y **ninguno** coincidía con los cinco del Brandbook.

## 4 · Profundidad por tamaño (V-04) y tope de desenfoque

| Token de profundidad | Radio emparejado | Blur Día | Blur Noche | Consumidores representativos |
|---|---|---|---|---|
| `--sc-shadow-clay-xs` | control · 10px | 8px | 8px | Botón secundario en reposo, icon button, herramienta, pulgar del interruptor, `LayerToggle` |
| `--sc-shadow-clay-sm` | control · 10px | 10px | 10px | Hover de control, chrome del lienzo (badge, zoom, status, leyenda, quick-entry, disparador de capas, pastilla de repetición), enlace de salto, tooltip del riel |
| `--sc-shadow-clay-md` | tarjeta · 18px | 16px | 16px | `RAISED`: topbar, ToolRail, Inspector, Results, cabecera de la bienvenida; `.cut-tooltip`, `.repeat-preview`, `.contextual-actions`, `.duplicate-preview-panel` |
| `--sc-shadow-clay-lg` / `-floating` | panel · 24px | 22px | 22px | `FLOATING`: popovers, toast, `.canvas-layer-panel`, `.structural-edit-surface`, `.structure-generator` |
| `--sc-shadow-sheet` | panel · 24px | 18px | 18px | `SHEET`: Datasheet, Model Doctor, drawers |
| `--sc-shadow-modal` | modal · 28px | 26px | 26px | `MODAL`: diálogo, pantalla completa, paleta de comandos |
| `--sc-shadow-clay-pressed` | control · 10px | 7px | 7px | Todo estado pulsado / elegido, campos en reposo, bandeja del riel |

Antes: `clay-md` desenfocaba 34px y `clay-lg`/`-floating` 39px, con radios de 10-14px debajo. Ningún escalón cumplía el tope.

**Único caso en que la desigualdad no muerde:** paneles a sangre completa contra el viewport (topbar, Inspector acoplado, Results acoplado). CRI-90 les quita el redondeo contra el borde, así que su radio es `0` y no hay esquina que acotar; quien los separa del lienzo es el canto de 1px, que ahí es obligatorio precisamente por eso.

## 5 · Elevaciones anidadas corregidas

| Caso | Antes | Después |
|---|---|---|
| `.inspector-summary` dentro de `.inspector-panel` | Los dos en el grupo `RAISED` de `material.css`, y además `styles.css:3670` le daba `--sc-clay-edge` + `--sc-shadow-clay-xs` con especificidad (0,2,0) | El resumen baja a BASE: fondo, trazo fino de 1px y `box-shadow:none`. La elevación la pone el panel una sola vez. Su rejilla de métricas sigue en `INSET`, que **sí** es un cambio de nivel |
| Chrome del lienzo | Todo el grupo compartía `--sc-shadow-clay-floating` | Repartido por tamaño: pastillas a `clay-sm`, tarjetas (`cut-tooltip`, `repeat-preview`) a `clay-md`, panel de capas a `clay-lg` |
| Tabla dentro de tarjeta | Ya plana (CRI-101) | Sin cambios, ahora con el token `--sc-radius-data` en vez de un `0` literal |

## 6 · Antes / después medidos con `getComputedStyle`

Columna "capas exteriores" = capas de `box-shadow` sin `inset`. Un pulsado correcto vale **0**.

| Pieza | Radio antes → después | Canto | Capas exteriores antes → después | Blur después |
|---|---|---|---|---|
| `button-primary-rest-light` | 14px → 10px | 1px | 1 → 2 | 8px |
| `button-primary-focus-light` | 14px → 10px | 1px | 1 → 2 | 10px |
| `button-primary-pressed-light` | 14px → 10px | 1px | 0 → 0 | 7px |
| `icon-button-rest-light` | 14px → 10px | 1px | 2 → 2 | 8px |
| `icon-button-pressed-light` | 14px → 10px | 1px | 2 → 0 | 7px |
| `tool-button-rest-light` | 14px → 10px | 1px | 0 → 0 | 7px |
| `tool-button-pressed-light` | 14px → 10px | 1px | 0 → 0 | 7px |
| `segmented-rest-light` | 10px → 10px | 0px | 0 → 0 | 7px |
| `segmented-pressed-light` | 10px → 10px | 0px | 0 → 0 | 7px |
| `field-light` | 14px → 10px | 1px | 0 → 0 | 7px |
| `unit-field-light` | 14px → 10px | 1px | 0 → 0 | 7px |
| `property-row-light` | 0px → 0px | 0px | 0 → 0 | 0px |
| `button-primary-rest-dark` | 14px → 10px | 1px | 1 → 2 | 8px |
| `button-primary-focus-dark` | 14px → 10px | 1px | 1 → 2 | 10px |
| `button-primary-pressed-dark` | 14px → 10px | 1px | 0 → 0 | 7px |
| `icon-button-rest-dark` | 14px → 10px | 1px | 2 → 2 | 8px |
| `icon-button-pressed-dark` | 14px → 10px | 1px | 2 → 0 | 7px |
| `tool-button-rest-dark` | 14px → 10px | 1px | 0 → 0 | 7px |
| `tool-button-pressed-dark` | 14px → 10px | 1px | 0 → 0 | 7px |
| `segmented-rest-dark` | 10px → 10px | 0px | 0 → 0 | 7px |
| `segmented-pressed-dark` | 10px → 10px | 0px | 0 → 0 | 7px |
| `field-dark` | 14px → 10px | 1px | 0 → 0 | 7px |
| `unit-field-dark` | 14px → 10px | 1px | 0 → 0 | 7px |
| `property-row-dark` | 0px → 0px | 0px | 0 → 0 | 0px |
| `reduced-motion-no-preference-rest` | 14px → 10px | 1px | 2 → 2 | 8px |
| `reduced-motion-no-preference-pressed` | 14px → 10px | 1px | 0 → 0 | 7px |
| `reduced-motion-reduce-rest` | 14px → 10px | 1px | 2 → 2 | 8px |
| `reduced-motion-reduce-pressed` | 14px → 10px | 1px | 0 → 0 | 7px |
| `topbar-light` | 0px → 0px | 1px | 2 → 2 | 16px |
| `toolrail-light` | 0px → 0px | 1px | 0 → 0 | 7px |
| `inspector-light` | 0px → 0px | 1px | 2 → 2 | 16px |
| `inspector-summary-light` | 12px → 10px | 1px | 2 → 0 | 0px |
| `canvas-controls-light` | 11px → 10px | 1px | 2 → 2 | 10px |
| `canvas-mode-badge-light` | 999px → 999px | 1px | 2 → 2 | 10px |
| `results-light` | 0px → 0px | 1px | 2 → 2 | 16px |
| `results-card-light` | 10px → 18px | 1px | 2 → 2 | 16px |
| `results-table-light` | 0px → 0px | 0px | 0 → 0 | 0px |
| `datasheet-cell-light` | 0px → 0px | 0px | 0 → 0 | 0px |
| `datasheet-scroll-light` | 12px → 10px | 1px | 0 → 0 | 0px |
| `datasheet-surface-light` | 28px 28px 0px 0px → 24px 24px 0px 0px | 1px | 1 → 1 | 18px |
| `topbar-dark` | 0px → 0px | 1px | 2 → 2 | 16px |
| `toolrail-dark` | 0px → 0px | 1px | 0 → 0 | 7px |
| `inspector-dark` | 0px → 0px | 1px | 2 → 2 | 16px |
| `inspector-summary-dark` | 12px → 10px | 1px | 2 → 0 | 0px |
| `canvas-controls-dark` | 11px → 10px | 1px | 2 → 2 | 10px |
| `canvas-mode-badge-dark` | 999px → 999px | 1px | 2 → 2 | 10px |
| `results-dark` | 0px → 0px | 1px | 2 → 2 | 16px |
| `results-card-dark` | 10px → 18px | 1px | 2 → 2 | 16px |
| `results-table-dark` | 0px → 0px | 0px | 0 → 0 | 0px |
| `datasheet-cell-dark` | 0px → 0px | 0px | 0 → 0 | 0px |
| `datasheet-scroll-dark` | 12px → 10px | 1px | 0 → 0 | 0px |
| `datasheet-surface-dark` | 28px 28px 0px 0px → 24px 24px 0px 0px | 1px | 1 → 1 | 18px |
Lecturas completas en `computed-styles.before.json` y `computed-styles.after.json`; capturas emparejadas en `before/` y `after/`.

## 7 · Cómo se reproduce

```
node scripts/qa-clay-reconciliation.mjs before   # sobre el baseline
node scripts/qa-clay-reconciliation.mjs after    # sobre el cambio
```
