# Espaciado, forma, elevación y densidad — Sistema de diseño structureCo

> Fuente de verdad: `src/design-system/tokens.css` (secciones 4, 6 y 7), `src/design-system/components/ui.css`, `src/styles.css`.
> Principio "Mesa Modular": paneles organizados con medidas fijas y previsibles; densidad profesional compacta pero legible.

## Escala de espaciado (base 4px)

| Token | Valor | Uso típico |
| --- | --- | --- |
| `--sc-space-1` | `4px` | Gaps mínimos (segmented interno, badges) |
| `--sc-space-2` | `8px` | Gap icono–texto, padding de tooltips |
| `--sc-space-3` | `12px` | Padding interno de controles, gaps de fila |
| `--sc-space-4` | `16px` | Padding de popovers, headers, gaps de layout |
| `--sc-space-5` | `20px` | Padding de cuerpos de modal, overlay |
| `--sc-space-6` | `24px` | Padding de estados vacíos |
| `--sc-space-7` | `32px` | Reserva de espacio para affordances (select) |
| `--sc-space-8` | `40px` | Separaciones mayores |

No usar valores fuera de escala; los pocos px sueltos legítimos son ópticos (p. ej. `gap: 2px` en copys de dos líneas).

## Radios

| Token | Valor | Uso |
| --- | --- | --- |
| `--sc-radius-sm` | `8px` | Tooltips, iconos contenedores, dismiss |
| `--sc-radius-md` | `10px` | Controles: botones, campos, popover triggers, tool buttons. El segmented interior deriva `calc(radius-md - space-1)` |
| `--sc-radius-lg` | `14px` | Popovers, diálogos, iconos de empty state |
| `--sc-radius-sheet` | `20px` | Drawers y sheets móviles (esquinas del borde que "entra" a pantalla) |

## Bordes

| Token | Valor | Uso |
| --- | --- | --- |
| `--sc-border-width` | `1px` | Borde estándar |
| `--sc-border-width-strong` | `2px` | Subrayado de tab activo, anillo de spinner, borde-identidad de métricas (`.sc-result-metric`) |

## Elevación (4 niveles de sombra)

Sombras en dos capas (difusa + contacto), **recalibradas por tema** — el Noche necesita sombras más profundas sobre grafito:

| Token | Día | Noche | Superficies |
| --- | --- | --- | --- |
| `--sc-shadow-raised` | `0 1px 2px rgba(9,24,18,.05), 0 4px 12px rgba(9,24,18,.06)` | `0 1px 2px rgba(0,0,0,.4), 0 6px 18px rgba(0,0,0,.32)` | Segmento activo, thumb de switch |
| `--sc-shadow-popover` | `0 2px 8px rgba(10,26,19,.08), 0 12px 32px rgba(10,26,19,.14)` | `0 2px 10px rgba(0,0,0,.44), 0 14px 40px rgba(0,0,0,.5)` | Popovers/menús (`.popover` en `styles.css`) |
| `--sc-shadow-floating` | `0 2px 6px rgba(14,34,25,.07), 0 16px 44px rgba(14,34,25,.12)` | `0 2px 8px rgba(0,0,0,.42), 0 18px 52px rgba(0,0,0,.46)` | Superficies flotantes (`.sc-popover__surface`, tooltips); alias legado `--shadow` |
| `--sc-shadow-modal` | `0 8px 24px rgba(10,26,19,.14), 0 28px 80px rgba(10,26,19,.26)` | `0 10px 28px rgba(0,0,0,.5), 0 28px 86px rgba(0,0,0,.62)` | Diálogos y drawers (`.sc-modal-surface`) |

En Noche la elevación se refuerza además con color: `surface-elevated` (`#232a2e`) es más clara que `surface-1` (`#171c1f`).

## Focus rings

| Token | Valor |
| --- | --- |
| `--sc-focus-ring-width` | `3px` |
| `--sc-focus-ring-width-compact` | `2px` (variante para contextos densos) |
| `--sc-focus-ring-offset` | `2px` |

Implementación (en `ui.css`, selector agrupado `:where(...)`): todo control interactivo `sc-*` recibe en `:focus-visible` — y los campos en `:focus-within` — `outline: var(--sc-focus-ring-width) solid var(--sc-color-focus); outline-offset: var(--sc-focus-ring-offset);`. El color de foco es el azul de interacción (3:1 mínimo contra adyacentes, verificado).

## Z-index

| Token | Valor | Capa |
| --- | --- | --- |
| `--sc-z-base` | `0` | Contenido |
| `--sc-z-panel` | `10` | Paneles |
| `--sc-z-sticky` | `20` | Elementos sticky |
| `--sc-z-topbar` | `30` | Barra superior |
| `--sc-z-drawer` | `60` | Drawers |
| `--sc-z-sheet` | `70` | Sheets |
| `--sc-z-popover` | `80` | Popovers y tooltips |
| `--sc-z-modal` | `1200` | Overlay modal (`.sc-overlay`) — deliberadamente muy por encima del resto |

## Tamaños de icono y objetivos táctiles

| Token | Valor | Uso |
| --- | --- | --- |
| `--sc-size-icon-sm` | `16px` | Icono dentro de botones de texto, spinner sm |
| `--sc-size-icon-md` | `20px` | Iconos de banners, status strips |
| `--sc-size-icon-lg` | `24px` | Spinner lg |
| `--sc-size-icon-tool` | `22px` | Glifos del rail de herramientas (tamaño por defecto de los glifos estructurales) |
| `--sc-size-target-pointer` | `36px` | Objetivo mínimo con puntero fino |
| `--sc-size-target-touch` | `44px` | Objetivo mínimo táctil |

### Alturas de control

| Token | Valor | Correlato |
| --- | --- | --- |
| `--sc-control-height-sm` | `36px` | = target pointer; `sc-button--sm`, `sc-icon-button--sm` |
| `--sc-control-height-md` | `40px` | Altura por defecto de botones, campos, triggers |
| `--sc-control-height-touch` | `44px` | = target touch; variantes `--touch`, tabs, acordeones, cierre de modal |

## Layout "Mesa Modular"

| Token | Valor | Superficie |
| --- | --- | --- |
| `--sc-layout-topbar` | `68px` | Barra superior (alias `--topbar-h`) |
| `--sc-layout-rail` | `164px` | Rail de herramientas expandido (alias `--toolbar-w`) |
| `--sc-layout-rail-compact` | `76px` | Rail compacto (solo iconos) |
| `--sc-layout-inspector` | `320px` | Inspector (alias `--inspector-w`; redimensionable por el usuario con clamps en `useWorkspaceLayoutPreferences`) |
| `--sc-layout-inspector-compact` | `290px` | Inspector en viewports intermedios |
| `--sc-layout-results` | `285px` | Panel de resultados |
| `--sc-layout-gutter` | `18px` | Canaleta entre módulos |

## Densidades

Tres alturas de fila declaradas en tokens:

| Token | Valor | Densidad | Destinatario |
| --- | --- | --- | --- |
| `--sc-density-row-compact` | `30px` | Compacta | Modo profesional: densa pero legible |
| `--sc-density-row-comfortable` | `36px` | Cómoda | **Modo Aula** usa esta densidad (según el contrato de tokens) |
| `--sc-density-row-touch` | `44px` | Táctil | Se activa por breakpoint/pointer |

**Estado real de implementación:** los tres tokens `--sc-density-row-*` están definidos en `tokens.css` pero **hoy ningún CSS de `src/` los consume** — funcionan como contrato documentado/reservado. La densidad táctil efectiva se activa hoy por dos mecanismos que elevan controles a `--sc-control-height-touch` (44px):

1. **`@media (pointer: coarse)`** en `styles.css`: iconos y selects del topbar, botones de popover y de historial móvil pasan a mínimo 44×44; además crecen los blancos de interacción del canvas (`.member-hit`/`.load-hit` stroke 44, `.node-hit` r 22px, botones de controles de canvas 44×44) y se intercambian los hints de gesto (`.desktop-gesture-hint` → `.touch-gesture-hint`).
2. **`@media (max-width: 700px)`** en `ui.css`: `sc-button--sm/--md`, `sc-icon-button--sm/--md`, triggers de popover, dismiss de banners y segmented suben a 44px; los popovers se anclan al borde inferior con `safe-area-inset`, y los diálogos/drawers se vuelven sheets de borde inferior.

Breakpoints estructurales complementarios (en `styles.css`): `1440px+` (layout amplio), `1024–1439px` (inspector compacto), `≤1023px` (shell móvil: inspector modal, dock de herramientas inferior), `≤700px` y `≤460px` (compactaciones progresivas), más `(max-width:1023px) and (max-height:600px)` para viewports apaisados bajos.

## Reglas

- Ningún control interactivo por debajo de 36px de objetivo con puntero fino, ni de 44px en contexto táctil.
- Las filas de propiedades (`.sc-property-row`) garantizan `min-height: var(--sc-control-height-touch)` con padding vertical `--sc-space-3`.
- La elevación siempre sale de los 4 tokens de sombra; no se escriben `box-shadow` ad hoc.
- El apilamiento siempre sale de los tokens `--sc-z-*`; no se inventan z-index numéricos.
