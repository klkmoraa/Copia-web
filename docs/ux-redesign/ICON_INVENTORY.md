# Inventario de iconografía

## Sistema base

StructureCo combina:

- **Lucide React** para acciones genéricas, navegación, archivos y estados.
- **SVG técnico propio** en `StructuralToolIcon.tsx` cuando la metáfora estructural necesita coincidir con el canvas.

No se sustituyen iconos técnicos por emojis, caracteres de texto ni una metáfora genérica aproximada.

## Reglas visuales

| Propiedad | Regla |
| --- | --- |
| Caja | `viewBox="0 0 24 24"` para SVG técnico. |
| Trazo de herramienta | 1.8 px, extremos y uniones redondeados. |
| Color | `currentColor`; el contenedor decide el rol semántico. |
| Tamaños | 16 px compacto, 20 px normal, 22 px herramienta, 24 px prominente. |
| Relleno | Ninguno por defecto; sólo señales cerradas intencionales, como el centro del nodo. |
| Alineación | Centro óptico dentro del target, no sólo centro geométrico. |
| Target | 36 px con puntero y 44 px en touch. |
| Dark | Misma geometría; cambia el token de color, no el SVG. |

## Herramientas del editor

| Herramienta | Fuente | Metáfora | Color de identidad |
| --- | --- | --- | --- |
| Seleccionar | Lucide `MousePointer2` | Cursor | Navegación neutral; selección azul. |
| Pan | Lucide `Hand` | Mano | Navegación neutral. |
| Nodo | SVG técnico | Círculo con centro | Estructura. |
| Miembro | SVG técnico | Barra entre nodos | Estructura. |
| Apoyo | SVG técnico | Nodo, triángulo y terreno | Estructura. |
| Carga puntual | SVG técnico | Flecha individual | `technical-load`. |
| Carga distribuida | SVG técnico | Flechas repetidas | `technical-shear`. |
| Momento | SVG técnico | Flecha circular | `technical-moment`. |
| Cota | SVG técnico | Línea de dimensión | `technical-dimension`. |
| Dividir miembro | Lucide `Scissors` | Corte local | Estructura. |
| Corte | Lucide `Crosshair` | Sección/eje | `technical-axis`. |
| Eliminar | Lucide `Delete` | Borrado | `state-error`. |

Los SVG propios actuales son: `node`, `member`, `support`, `pointLoad`, `distributedLoad`, `moment` y `dimension`. El registry, IDs, handlers y atajos permanecen sin cambios.

## Inventario Lucide por superficie

| Superficie | Iconos |
| --- | --- |
| Shell y carga | `LoaderCircle`, `SlidersHorizontal` |
| TopBar y proyecto | `Check`, `ChevronDown`, `CloudOff`, `Download`, `FileArchive`, `FileText`, `FilePlus2`, `FolderOpen`, `LoaderCircle`, `Moon`, `MoreHorizontal`, `Play`, `Redo2`, `Save`, `Sun`, `Undo2` |
| Welcome | `ArrowRight`, `FilePlus2`, `FolderOpen`, `GitCommitHorizontal`, `Play`, `Triangle`, `Upload` |
| Estado de análisis | `CheckCircle2`, `Circle`, `CircleX`, `Clock3`, `LoaderCircle`, `TriangleAlert` |
| Capas del canvas | `Box`, `ChartNoAxesCombined`, `HelpCircle`, `Layers3`, `Ruler`, `Tags`, `TriangleAlert`, `X`, `Zap` |
| Canvas y zoom | `Crosshair`, `LocateFixed`, `Minus`, `Plus`, `X` |
| Inspector | `AlertTriangle`, `ChevronRight`, `CircleHelp`, `MoveDown`, `Plus`, `RotateCcw`, `Sigma`, `Trash2`, `X` |
| Resultados | `AlertCircle`, `Check`, `ChevronDown`, `ChevronUp`, `CircleDotDashed`, `GripHorizontal` |
| Resumen/exportación | `Download`, `GitCompareArrows`, `LocateFixed`, `Printer`, `RefreshCw` |
| Importación | `AlertTriangle`, `ArrowLeft`, `ArrowRight`, `Check`, `CheckCircle2`, `FileArchive`, `FileJson`, `FileText`, `LoaderCircle`, `Save`, `ShieldCheck`, `Upload`, `X` |

## Estados interactivos

- **Default:** color por función; fondo transparente o superficie base.
- **Hover:** conserva el icono y suma un fondo de 6–7 % del mismo rol.
- **Active:** conserva el icono y suma fondo de 10–11 % más borde interno suave.
- **Focus:** focus ring azul alrededor del control; no recolorea el icono.
- **Disabled:** conserva la silueta, reduce prominencia y mantiene nombre accesible.
- **Selected object:** usa geometría redundante azul en el canvas, independiente de la herramienta activa.

## Criterio para nuevos iconos

1. Reutilizar Lucide si la acción es universal y la metáfora coincide exactamente.
2. Crear SVG técnico si el símbolo representa convención estructural o debe coincidir con el canvas.
3. Añadir el icono a este inventario y documentar tamaño, color, estados y etiqueta accesible.
4. Probar 16, 20, 22 y 24 px en Light y Dark.
5. Validar que no cambie IDs, handlers, shortcuts ni hit targets.
