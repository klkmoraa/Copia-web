# Especificación de motion

## Principios

El movimiento de StructureCo explica continuidad, jerarquía y respuesta. No decora cálculos ni retrasa tareas.

- La entrada debe aclarar de dónde aparece una superficie.
- La respuesta de un control debe sentirse inmediata.
- El canvas no anima valores de forma que pueda confundirse con un resultado físico.
- Los cambios de tema y de modo conservan la posición del usuario.
- Toda animación tiene una alternativa con movimiento reducido.

## Duraciones

| Token | Duración | Uso aprobado |
| --- | ---: | --- |
| `motion-press` | 70 ms | Presión de botón o tarjeta. |
| `motion-fast` | 140 ms | Foco, selección, icono y feedback breve. |
| `motion-control` | 160 ms | Hover, active, borde, color y sombra. |
| `motion-standard` | 220 ms | Menús, contenido y cambio de estado. |
| `motion-slow` | 360 ms | Panel, sheet, diálogo y primera entrada. |
| `motion-loading` | 800 ms | Ciclo continuo de un spinner con trabajo real. |

No se agregan duraciones locales si uno de estos propósitos cubre el caso.

## Curvas

| Token | Curva | Uso |
| --- | --- | --- |
| `ease-standard` | `cubic-bezier(.22, 1, .36, 1)` | Transición general con desaceleración natural. |
| `ease-enter` | `cubic-bezier(.22, 1, .36, 1)` | Entrada de superficies y backdrops. |
| `ease-exit` | `cubic-bezier(.4, 0, 1, 1)` | Salida breve sin rebote. |
| `ease-press` | `cubic-bezier(.2, .8, .2, 1)` | Feedback directo de presión. |

`--sc-transition-control` agrupa color, fondo, borde, sombra y transform. `--sc-transition-theme` agrupa fondo, borde y texto para Light/Dark.

## Patrones por superficie

| Superficie | Comportamiento | Tokens |
| --- | --- | --- |
| Botón/control | Color y borde; escala leve sólo al presionar. | control + press |
| Herramienta activa | Fondo y borde suaves; el icono conserva su color. | control |
| Selección en canvas | Aparición inmediata, transición corta de stroke/halo. | fast |
| Popover/menú | Fade con desplazamiento vertical de 5 px. | standard + enter |
| Sheet móvil | Entra desde su borde natural; backdrop por separado. | slow + enter |
| Inspector móvil | Clip/opacity, sin mover el canvas. | slow + fast |
| Diálogo | Fade, 12 px verticales y escala 0.985. | slow + enter |
| Resultados | Altura y contenido coordinados. | slow + standard |
| Loading | Spinner continuo sólo mientras exista trabajo real. | loading |
| Aula/Completo | Cambio de chrome y contenido, sin modificar el modelo. | theme transition |
| Light/Dark | Interpola superficie, borde y texto; no anima geometría. | theme transition |

## Propiedades permitidas

Preferidas:

- `opacity`
- `transform`
- `background-color`
- `border-color`
- `color`
- `box-shadow`
- `clip-path` para drawers existentes

`height`, `min-height` y `max-height` sólo se usan en el panel de resultados porque su continuidad espacial es parte de la interacción aprobada. No se animan posiciones ni dimensiones del modelo estructural.

## Movimiento reducido

Con `prefers-reduced-motion: reduce`:

- Las duraciones de tokens pasan a `0.001ms`.
- Se desactiva el spinner y cualquier loop.
- Se conserva el cambio de estado final, foco y feedback textual.
- No se eliminan backdrops, bordes, selección ni mensajes necesarios.
- El scroll deja de ser suave.

La regla vive en `tokens.css` y está respaldada por las salvaguardas globales de `styles.css`.

## Transparencia reducida

Con `prefers-reduced-transparency: reduce`, topbar, toolbar, popovers, badges y backdrops dejan de usar blur y adoptan una superficie opaca. Esta preferencia es independiente de reduced motion.

## QA de motion

1. Probar mouse, teclado y touch.
2. Confirmar que el estado final es idéntico con y sin animación.
3. Verificar que ningún control queda bloqueado durante una transición.
4. Activar reduced motion y confirmar cero loops o desplazamientos visibles.
5. Revisar Light/Dark, Aula/Completo, panel de resultados, inspector móvil y sheets.
6. Confirmar que no existe animación dentro del motor, workers o datos persistidos.
