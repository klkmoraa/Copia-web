# Motion — Sistema de diseño structureCo

> Fuente de verdad: `src/design-system/tokens.css` (sección 7), `src/design-system/components/ui.css` (keyframes `sc-*`), `src/styles.css` (capa "REDISEÑO 2026-08"), y los componentes `m.*` de `motion` en las superficies listadas más abajo.
> Filosofía: microinteracciones discretas de instrumento — el movimiento confirma, nunca decora. Todo anima **transform + opacity**; nada produce layout shifts.

## Tokens de duración

| Token | Valor | Uso |
| --- | --- | --- |
| `--sc-motion-instant` | `70ms` | Respuestas inmediatas |
| `--sc-motion-press` | `70ms` | Pulsación de botones (escala al presionar) |
| `--sc-motion-fast` | `140ms` | Tooltips, switches, hovers de fila, menús rápidos (`.popover`) |
| `--sc-motion-control` | `160ms` | Transición estándar de controles (color, borde, sombra, transform) |
| `--sc-motion-standard` | `220ms` | Superficies: popovers `sc-*`, overlays, cambio de tema |
| `--sc-motion-slow` | `360ms` | Entradas de diálogo/drawer, animaciones de bienvenida |
| `--sc-motion-loading` | `800ms` | Ciclo del spinner |

## Tokens de easing

| Token | Curva | Carácter |
| --- | --- | --- |
| `--sc-ease-standard` | `cubic-bezier(.22, 1, .36, 1)` | Curva base: desaceleración limpia |
| `--sc-ease-enter` | `cubic-bezier(.22, 1, .36, 1)` | Entradas (= standard) |
| `--sc-ease-exit` | `cubic-bezier(.4, 0, 1, 1)` | Salidas: aceleración franca |
| `--sc-ease-press` | `cubic-bezier(.2, .8, .2, 1)` | Pulsaciones |
| `--sc-ease-emphasized` | `cubic-bezier(.32, .72, 0, 1)` | Movimientos con intención (subrayado de tabs) |
| `--sc-spring-soft` | `cubic-bezier(.3, 1.18, .35, 1)` | Rebote suave (overshoot leve) |
| `--sc-spring-panel` | `cubic-bezier(.26, 1.08, .32, 1)` | Paneles con asentamiento elástico contenido |

## Librería de animación (`motion`)

Desde 0.8.2 conviven dos mecanismos. **CSS sigue siendo el predeterminado**; la
librería se reserva para lo que CSS no puede hacer: animaciones de **salida**
(un elemento que se desmonta) y **reflow de listas** (`layout`).

- Se importan los componentes ligeros **`m.*`, nunca `motion.*`**. Los segundos
  arrastran todas las capacidades de la librería al chunk que los importe; eso
  es lo que empujó la carga inicial un 31 % antes de corregirse.
- El conjunto de capacidades vive aislado en `src/design-system/motionFeatures.ts`
  y lo carga `LazyMotion` de forma **asíncrona** desde `src/main.tsx`, de modo
  que llega después del primer pintado.
- `LazyMotion` está en modo `strict`: un `motion.*` perdido **lanza un error**
  en vez de reintroducir el bundle completo en silencio.
- El proveedor se monta en `main.tsx` y no en `App.tsx` porque `ComponentLab`
  (`/__components`) se renderiza en lugar de `App` y también anima.
- Se usa `domMax` (no `domAnimation`) porque la pila de toasts y la vitrina de
  plantillas animan su `layout`.
- El techo de carga inicial lo vigila `npm run verify:perf`.

## Paquetes de transición

| Token | Composición | Consumidores |
| --- | --- | --- |
| `--sc-transition-control` | `background-color`, `border-color`, `color`, `box-shadow`, `transform` — todo a `control/standard-ease` | Todos los controles `sc-*` (selector agrupado en `ui.css`), `.tool-button`, segmented, `.welcome-filter-tab` |
| `--sc-transition-control-no-transform` | Igual que el anterior **sin `transform`** | Elementos cuyo `transform` ya lo conduce el resorte de `motion`: `.welcome-launcher-card`, `.welcome-import-card`, `.welcome-template-card`. Si ambos animaran `transform`, el navegador interpolaría por su cuenta lo que la librería ya está animando |
| `--sc-transition-theme` | `background-color` y `border-color` a `standard` (220ms), `color` a `fast` (140ms) | Cambio Día/Noche coordinado: `.app-shell`, `.topbar`, `.toolbar`, `.inspector-panel`, `.results-panel`, `.center-stage`, `.welcome-screen`, `.professional-note` |

## Qué anima cada superficie

| Superficie | Keyframe / mecanismo | Duración · easing | Movimiento |
| --- | --- | --- | --- |
| Menús del topbar (`.popover`: proyecto, exportar, "Más") | `m.div` + `AnimatePresence` (`TopBar.tsx`) | resorte `stiffness 400 / damping 30`; salida 100ms | opacity + `y -10px` + `scale .95` → identidad. `transform-origin: top right` sigue en CSS |
| Popover de librería (`.sc-popover__surface`) | `m.section` + `AnimatePresence` (`overlays.tsx`) | 150ms · `[.16,1,.3,1]` | opacity + `y -6px` + `scale .96` |
| Overlay modal (`.sc-overlay`) | `m.div` + `AnimatePresence` | 200ms | opacity solamente |
| Diálogo (`.sc-modal-surface--dialog`) | `m.section` | resorte `400 / 30` | opacity + `y 8px` + `scale .94` → identidad |
| Drawer (`.sc-modal-surface--drawer`) | `m.section`, variante por `side` | resorte `380 / 32` | Entra desde su borde (`x ±100%` o `y 100%`) |
| Toasts (`.sc-toast-card`) | `m.div` + `AnimatePresence` + `layout` | resorte `420 / 28` | opacity + `y 20px` + `scale .94`; `layout` reacomoda la pila al descartar uno |
| Bienvenida, secciones (`.welcome-hero`, `.welcome-showcase`) | `m.section` | 350ms · `easeOut`, delay 0/80ms | opacity + `y 16px` → 0 |
| Bienvenida, tarjetas | `whileHover` / `whileTap` | resorte por defecto | `scale 1.015 / y -2px` al pasar, `scale .985` al pulsar |
| Bienvenida, vitrina de plantillas | `m.button` + `AnimatePresence` + `layout` | resorte `380 / 28` | Entrada/salida con `scale .95`; `layout` reacomoda la grilla al filtrar |
| Tabs de Inspector/Resultados | `::after` con `transform: scaleX(0→1)` | control · **emphasized** | Subrayado que crece desde el centro; el color del subrayado activo hereda la magnitud (axial/shear/moment/influence) |
| Pulsación de botones `sc-*` | `:active { transform: scale(0.975) }` | press (70ms) | Compresión táctil; `.tool-button` usa `.97`. Las tarjetas de bienvenida **no** entran aquí: su pulsación la conduce `whileTap` |
| Switch de capas (`.sc-layer-toggle__switch`) | transición de `background-color` y `transform` del thumb (`translateX(14px)`) | fast · standard | — |
| Tooltip (`.sc-tooltip__content`) | transición opacity + transform con `visibility` diferida | fast · enter | Desplazamiento de 4px hacia su lado |
| Acordeón (chevron) | `transform: rotate(180deg)` | standard · standard | Solo el icono rota |
| Filas de tablas de resultados | transición `background-color` | fast · standard | Hover discreto |
| Spinner (`.sc-spinner__ring`, `.spin`) | `sc-spin` / `spin` | loading (800ms) · linear · infinite | Rotación 360° |
| Cambio de tema | `--sc-transition-theme` | standard/fast | Superficies coordinadas, color de texto más rápido que fondos |

Existe además una familia legada `native-*` en `styles.css` (`native-screen-in`, `native-menu-in`, `native-dialog-in`, `native-content-in`, `native-fade-in`) anterior a la capa 2026-08; mismas reglas de transform+opacity. Debe migrar a los keyframes `sc-*` conforme se toquen esas superficies.

**Al migrar una superficie a `motion`, retirar su animación CSS.** Si la
keyframe se queda, las dos animan el mismo elemento a la vez. Durante 0.8.2
esto ocurrió cuatro veces (`.popover` con `sc-pop-in`, y `sc-surface-in` /
`sc-dialog-in` / `sc-drawer-in` en `ui.css`) y las cuatro hubo que corregirlas
después. Lo mismo aplica a un `transform` fijo en `:hover`/`:active` cuando el
elemento ya usa `whileHover`/`whileTap`.

## Reglas

1. **Solo transform + opacity** en animaciones de entrada; las transiciones de controles añaden color/borde/sombra pero nunca propiedades que relayouten (width, height, top/left).
2. **Sin layout shifts**: las superficies se montan en su posición final y entran con desplazamientos ≤ 16px; el subrayado de tabs vive en un pseudo-elemento absolutamente posicionado.
3. **Los popovers declaran `transform-origin`** coherente con su anclaje (top).
4. Los delays escalonados se limitan a un nivel (120ms en bienvenida); no hay cascadas largas.
5. Duraciones y easings **siempre** salen de tokens; no se escriben ms o beziers ad hoc.

## `prefers-reduced-motion`: mecanismo de anulación

Cuatro capas de defensa, todas activas:

1. **Anulación en la fuente (tokens)** — `tokens.css` redefine dentro de `@media (prefers-reduced-motion: reduce)` **todas** las duraciones a `0.001ms` (instant, press, fast, control, standard, slow, loading) y degrada `--sc-ease-emphasized`, `--sc-spring-soft` y `--sc-spring-panel` a `linear`. Como cada animación/transición del sistema consume estos tokens, el media query las colapsa a efectivamente instantáneas **sin tocar ningún selector**: es el mecanismo principal y cubre también código futuro que use los tokens. (Se usa `0.001ms` y no `0` para que los eventos `transitionend`/`animationend` sigan disparándose.)
2. **Apagado explícito en `styles.css`** — el mismo media query pone `transition: none` en el subrayado de tabs, `.tool-button`, las tarjetas y filtros de bienvenida, `.segmented-control button` y en las superficies del cambio de tema.
3. **Apagado del spinner en `ui.css`** — `.sc-spinner__ring { animation: none; opacity: 0.72 }`: la animación infinita no debe quedar ni siquiera "instantánea", se sustituye por un estado estático semitransparente.
4. **`useReducedMotion()` en cada componente que anima con la librería** — `TopBar`, `ToastNotification`, `WelcomeScreen` y `overlays`. **La capa 1 no alcanza a estas animaciones**: las conduce JavaScript, no el motor de CSS, así que redefinir los tokens de duración no las toca. Cada componente elige una variante degradada (fundido casi instantáneo, sin desplazamiento ni escala) cuando el hook devuelve `true`.

Reglas para código nuevo:

- Si una animación es infinita o comunica progreso, debe declarar su propio apagado explícito (capa 3).
- **Si anima con `m.*`, debe consultar `useReducedMotion()`** (capa 4). Es el error fácil de cometer, porque el resto del sistema da la impresión de que el media query global ya cubre todo.
- Todo lo demás queda cubierto por la capa 1 siempre que consuma tokens.
