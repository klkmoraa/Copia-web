# Sistema de tokens visuales

## Propósito

`src/styles/tokens.css` es la única fuente de verdad para los fundamentos visuales de StructureCo. La Fase 4 consolida lo ya aprobado sin reescribir todas las pantallas ni modificar el motor estructural.

El sistema separa tres niveles:

1. **Primitivos `--sc-*`:** valores crudos de paleta y escalas.
2. **Semánticos `--sc-color-*`, `--sc-font-*`, `--sc-motion-*`:** expresan intención, no apariencia accidental.
3. **Aliases de compatibilidad:** nombres heredados como `--surface`, `--accent` o `--force` que apuntan a un token semántico durante la migración gradual.

## Convención de nombres

La forma general es `--sc-{categoría}-{rol}-{variante}`.

- Correcto: `--sc-color-action-primary`, `--sc-color-technical-moment`, `--sc-motion-control`.
- Incorrecto: `--green-button`, `--red-line`, `--dark-card`.
- Un token semántico describe por qué existe. El valor puede cambiar entre temas sin cambiar el nombre.
- Un valor local nuevo sólo se acepta si no pertenece a una escala existente y queda justificado antes de convertirse en token.

## Color

### Roles de producto y documento

| Familia | Tokens principales | Responsabilidad |
| --- | --- | --- |
| Fondos | `bg-app`, `bg-canvas` | Entorno de aplicación y mesa de trabajo. |
| Superficies | `surface-1`, `surface-2`, `surface-elevated` | Paneles, agrupaciones y capas elevadas. |
| Texto | `text-primary`, `text-secondary`, `text-muted`, `text-disabled` | Jerarquía de lectura. |
| Bordes | `border`, `border-soft` | Separación y estructura. |
| Acción | `action-primary`, `action-hover`, `action-pressed`, `action-foreground` | Marca y acciones principales. |
| Interacción | `focus`, `selection`, `selection-stroke` | Foco de teclado y selección. |
| Canvas | `canvas-grid`, `canvas-grid-strong`, `canvas-member`, `canvas-node-fill` | Documento técnico independiente del chrome. |
| Capas | `overlay-soft`, `overlay-sheet`, `overlay-strong` | Backdrops de inspector, sheets y modales. |
| Estado | `state-success`, `state-warning`, `state-error`, `state-info` | Resultado del sistema, nunca magnitudes técnicas. |
| Modo | `aula` | Identidad educativa secundaria. |

### Roles técnicos

Las cargas y resultados usan tokens propios: `technical-load`, `technical-axial`, `technical-shear`, `technical-moment`, `technical-deformed`, `technical-reaction`, `technical-dimension` y `technical-axis`.

Los colores de herramientas derivan de esos roles cuando existe una representación equivalente en el canvas. Así, el icono conserva la misma identidad visual que el objeto creado. Selección y foco no cambian el color de identidad del icono.

## Espaciado, tamaño y forma

| Escala | Valores | Uso |
| --- | --- | --- |
| Espacio | 4, 8, 12, 16, 20, 24, 32, 40 px | Gaps, padding y ritmo vertical. |
| Iconos | 16, 20, 22, 24 px | Compacto, normal, herramienta y prominente. |
| Targets | 36 y 44 px | Puntero y entrada táctil. |
| Controles | 36, 40 y 44 px | Compacto, escritorio y touch. |
| Bordes | 1, 2 y 3 px de foco | Separación, énfasis y focus ring. |
| Radios | 8, 10, 14 y 20 px | Controles, paneles y sheets. |
| Elevación | `raised`, `floating`, `modal` | Jerarquía, no decoración. |

Los tamaños de layout (`topbar`, `rail`, `inspector`, `results`, `gutter`) son semánticos porque expresan regiones estables de la aplicación.

## Tipografía y números

### Familias

- UI y encabezados: `--sc-font-ui` y `--sc-font-heading`.
- Fórmulas, matrices y datos alineados: `--sc-font-mono`.
- No se incorpora una descarga tipográfica obligatoria; la pila conserva fallbacks del sistema.

### Escala

| Rol | Token | Tamaño base |
| --- | --- | --- |
| Caption | `font-size-caption` | 10 px |
| Etiqueta técnica | `font-size-technical` | 12 px |
| Label | `font-size-label` | 12 px |
| Cuerpo | `font-size-body` | 14 px |
| Control | `font-size-control` | 14 px |
| Título de panel | `font-size-panel` | 17 px |
| Título de pantalla | `font-size-screen` | 26 px |

Los pesos disponibles son 400, 550, 650, 750 y 800. Los line-heights son `tight`, `compact`, `control` y `body`. El tracking de controles y datos técnicos también está tokenizado.

Toda cifra de UI usa números tabulares y alineados mediante `--sc-numeric-variant` y `--sc-numeric-features`. La cantidad de decimales continúa siendo responsabilidad de los formatters existentes; CSS no redondea ni altera resultados matemáticos.

## Motion y capas

| Propósito | Token | Duración |
| --- | --- | --- |
| Presión | `motion-press` | 70 ms |
| Feedback breve | `motion-fast` | 140 ms |
| Control | `motion-control` | 160 ms |
| Cambio de estado | `motion-standard` | 220 ms |
| Panel o diálogo | `motion-slow` | 360 ms |
| Indicador de carga | `motion-loading` | 800 ms por ciclo |

`--sc-transition-control` y `--sc-transition-theme` agrupan propiedades y curvas aprobadas. `prefers-reduced-motion: reduce` neutraliza todas las duraciones en la propia capa de tokens, además de las salvaguardas globales existentes.

La escala z-index es: base, panel, sticky, topbar, drawer, sheet, popover y modal. No se permiten nuevos z-index locales cuando uno de estos roles cubre el caso.

## Temas Light y Dark

- Light es el bloque base `:root`.
- Dark se define explícitamente en `:root[data-theme='dark']`.
- Dark no se calcula invirtiendo Light: canvas, texto, superficies, estado, magnitudes técnicas, overlays y sombras tienen valores diseñados.
- Los aliases resuelven el tema activo automáticamente porque apuntan a roles semánticos.
- `color-scheme` sólo informa al navegador; no sustituye los tokens.

## Uso recomendado

```css
.example-panel {
  padding: var(--sc-space-4);
  border: var(--sc-border-width) solid var(--sc-color-border);
  border-radius: var(--sc-radius-md);
  background: var(--sc-color-surface-1);
  color: var(--sc-color-text-primary);
  transition: var(--sc-transition-control);
}
```

No se debe usar un primitivo directamente en un componente. Si falta un rol, primero se evalúa si es reutilizable; sólo entonces se agrega a `tokens.css` y a este documento.

## Compatibilidad y migración gradual

Los aliases existentes siguen activos para no romper Fases 1 a 3. La migración se hace por superficie:

1. Cambiar el alias heredado por el rol `--sc-*` equivalente.
2. Verificar Light, Dark, foco, disabled y responsive.
3. Eliminar un alias únicamente cuando `rg` confirme cero consumidores.
4. No introducir una segunda paleta en CSS local.

Esta fase migra fundamentos compartidos —foco, números, motion, overlays, canvas y elevación modal— y deja el resto para adopción incremental en fases posteriores.
