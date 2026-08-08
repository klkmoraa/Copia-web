# Iconografía — Sistema de diseño structureCo

> Fuente de verdad: `src/design-system/icons/structural.tsx` (glifos propios), imports de `lucide-react` en `src/`, `src/components/StructuralToolIcon.tsx` (puente de compatibilidad), `src/components/ToolBar.tsx` (mapa herramienta→icono).
> Complementa el inventario histórico `docs/ux-redesign/ICON_INVENTORY.md`.

## 1 · Gramática común

Compartida por la familia estructural propia y alineada con lucide-react (v1.24), que cubre los conceptos genéricos de interfaz:

| Propiedad | Valor |
| --- | --- |
| ViewBox | `24×24`, tamaño óptico centrado |
| Trazo | `stroke: currentColor`, `strokeWidth: 1.8` |
| Terminales/uniones | Redondeadas (`strokeLinecap/strokeLinejoin: round`) |
| Relleno | Solo puntos focales pequeños (`fill: currentColor`) o máscaras (`fill: var(--surface)`) para "recortar" el trazo que pasa por detrás |
| Tamaño por defecto | `22px` (= `--sc-size-icon-tool`); prop `size` opcional |
| Accesibilidad | `aria-hidden` **por defecto** en el glifo; el texto accesible lo aporta el control contenedor |

Los lucide de la interfaz se renderizan con la misma pluma: `strokeWidth={1.8}` (ver `ToolGlyph` en `ToolBar.tsx`), de modo que ambos orígenes son indistinguibles en pantalla.

**Criterio de origen:** los conceptos genéricos (cerrar, expandir, menú, tema, archivos…) se resuelven con lucide-react; en `structural.tsx` viven únicamente los conceptos de ingeniería estructural que ninguna librería general representa bien.

## 2 · Glifos estructurales propios (`structural.tsx`)

Todos exportan `({ size?, ...SVGProps })` con la firma `StructuralGlyphProps`.

### Modelado

| Componente | Concepto | Uso |
| --- | --- | --- |
| `NodeGlyph` | Nodo (círculo con centro sólido) | Herramienta `node`; propiedades de nodo |
| `MemberGlyph` | Miembro/barra entre dos nodos enmascarados | Herramienta `member` |
| `SupportGlyph` | Apoyo genérico (triángulo + suelo rayado) | Herramienta `support` |
| `PinSupportGlyph` | Apoyo articulado (pin) | Distinción de tipo de apoyo |
| `RollerSupportGlyph` | Apoyo de rodillo (triángulo sobre rodillos) | Distinción de tipo de apoyo |
| `FixedSupportGlyph` | Empotramiento (muro rayado) | Distinción de tipo de apoyo |
| `SpringGlyph` | Resorte (zigzag sobre base) | Apoyos elásticos |
| `HingeGlyph` | Rótula (círculo enmascarado entre dos barras) | Liberaciones de continuidad |
| `ReleaseGlyph` | Liberación (círculo punteado entre segmentos) | Liberaciones de extremo |
| `SplitMemberGlyph` | Dividir miembro (barra interrumpida + punto) | Herramienta `split` |
| `SectionCutGlyph` | Corte de sección (línea de corte discontinua) | Herramienta `cut` |
| `DimensionGlyph` | Cota (extensiones + flechas bidireccionales) | Herramienta `dimension` |

### Cargas

| Componente | Concepto | Uso |
| --- | --- | --- |
| `PointLoadGlyph` | Carga puntual (flecha vertical hacia la viga) | Herramienta `pointLoad` |
| `DistributedLoadGlyph` | Carga distribuida (peine de flechas) | Herramienta `distributedLoad` |
| `MomentLoadGlyph` | Momento aplicado (flecha circular) | Herramienta `moment` |
| `LoadTrainGlyph` | Tren de cargas (flechas + vehículo) | Líneas de influencia / tren de cargas |

### Resultados

| Componente | Concepto | Uso |
| --- | --- | --- |
| `AxialGlyph` | Fuerza axial (flechas opuestas entre extremos) | Pestaña/capa axial |
| `ShearGlyph` | Diagrama de cortante (escalón sobre línea base discontinua) | Pestaña/capa cortante |
| `MomentDiagramGlyph` | Diagrama de momento (parábola + punto crítico) | Pestaña/capa momento |
| `DeformedShapeGlyph` | Deformada (curva bajo línea base punteada, apoyos sólidos) | Capa deformada |
| `ReactionGlyph` | Reacción (flecha vertical hacia arriba) | Capa/tabla de reacciones |
| `InfluenceLineGlyph` | Línea de influencia (onda sobre base discontinua + punto) | Análisis de influencia |
| `EnvelopeGlyph` | Envolvente (lente doble curva sobre base) | Envolventes de combinaciones |
| `CriticalPointGlyph` | Punto crítico (parábola + círculo objetivo) | Marcado de extremos |

### Expedientes portables

| Componente | Concepto | Uso |
| --- | --- | --- |
| `PortableCaseGlyph` | Expediente portable (documento con check) | Import/export de expedientes |
| `ChecksumGlyph` | Integridad (escudo con check) | Verificación de checksum |

### Puente de compatibilidad

`src/components/StructuralToolIcon.tsx` conserva la API histórica `tool → icono` que consumen ToolBar y el dock móvil. `STRUCTURAL_TOOL_IDS` = { `node`, `member`, `support`, `pointLoad`, `distributedLoad`, `moment`, `dimension`, `split`, `cut` }: estas nueve herramientas renderizan glifo estructural propio; el resto cae a lucide.

## 3 · Iconos lucide-react reutilizados

### Rail de herramientas (`ToolBar.tsx`)

El mapa `toolIcons` declara un lucide por **cada** herramienta (exigencia del tipo `Record<Tool, LucideIcon>`), pero solo se renderizan los de herramientas fuera de `STRUCTURAL_TOOL_IDS`:

| Herramienta | Lucide declarado | ¿Se renderiza? |
| --- | --- | --- |
| `select` | `MousePointer2` | Sí |
| `pan` | `Hand` | Sí |
| `delete` | `Delete` | Sí |
| `node` / `member` / `support` | `CircleDot` / `GitCommitHorizontal` / `Component` | No — glifo estructural |
| `pointLoad` / `distributedLoad` / `moment` | `MoveDiagonal2` / `Sigma` / `RotateCcw` | No — glifo estructural |
| `dimension` / `split` / `cut` | `Ruler` / `Scissors` / `Crosshair` | No — glifo estructural |

ToolBar importa además `BoxSelect`, `ChevronRight` y `MoreHorizontal` para affordances propias del rail/dock (selección, expansión de grupos, desbordamiento).

### Genéricos por superficie (imports reales en `src/`)

| Archivo | Iconos lucide |
| --- | --- |
| `App.tsx` | `LoaderCircle` (carga del workspace) |
| `components/TopBar.tsx` | `Check`, `ChevronDown`, `CloudOff`, `Download`, `FileArchive`, `FileText`, `FilePlus2`, `FolderOpen`, `Maximize2`, `Minimize2`, `Moon`, `MoreHorizontal`, `PanelLeftClose`, `PanelLeftOpen`, `PanelRightClose`, `PanelRightOpen`, `Play`, `Redo2`, `Save`, `Sun`, `Undo2` |
| `components/AnalysisStatus.tsx` | `CheckCircle2`, `Circle`, `CircleX`, `Clock3`, `LoaderCircle`, `TriangleAlert` |
| `components/CanvasChrome.tsx` | `Crosshair`, `LocateFixed`, `Minus`, `Plus`, `X` (controles de zoom/centrado) |
| `components/CanvasLayers.tsx` | `Box`, `ChartNoAxesCombined`, `HelpCircle`, `Layers3`, `Ruler`, `Tags`, `TriangleAlert`, `X`, `Zap` (conmutador de capas) |
| `components/ClassroomGuide.tsx` | `Check`, `ChevronRight`, `Lightbulb`, `TriangleAlert` |
| `components/ImportCenterDialog.tsx` | `AlertTriangle`, `ArrowLeft`, `ArrowRight`, `Check`, `CheckCircle2`, `FileArchive`, `FileJson`, `FileText`, `LoaderCircle`, `Save`, `ShieldCheck`, `Upload`, `X` |
| `components/Inspector.tsx` | `ChevronRight`, `CircleHelp`, `MoveDown`, `Plus`, `RotateCcw`, `Sigma`, `X` |
| `components/inspector/InspectorPrimitives.tsx` | `CircleHelp`, `LockKeyhole`, `PencilLine` |
| `components/inspector/InspectorProperties.tsx` | `AlertTriangle`, `Anchor`, `CircleDot`, `Layers3`, `Minus`, `MoveDown`, `MousePointer2`, `Plus`, `RotateCcw`, `Sigma`, `Trash2` |
| `components/ResultsPanel.tsx` | `AlertCircle`, `Check`, `ChevronDown`, `ChevronUp`, `CircleDotDashed`, `GripHorizontal`, `LoaderCircle` |
| `components/ResultSummary.tsx` | `Download`, `GitCompareArrows`, `LocateFixed`, `Printer`, `RefreshCw` |
| `components/StructuralCanvas.tsx` | `X` |
| `components/WelcomeScreen.tsx` | `ArrowRight`, `FilePlus2`, `FolderOpen`, `GitCommitHorizontal`, `Play`, `Triangle`, `Upload` |
| `components/WorkspaceShell.tsx` | `SlidersHorizontal` (toggle móvil del inspector) |
| `ui/controls.tsx` | `ChevronDown` (selects) |
| `ui/disclosure.tsx` | `ChevronDown` (acordeón/tabs) |
| `ui/editor.tsx` | `CheckCircle2`, `Circle`, `CircleAlert`, `Clock3`, `TriangleAlert` (status strip) |
| `ui/feedback.tsx` | `CheckCircle2`, `CircleAlert`, `Info`, `TriangleAlert`, `X` (badges/banners) |
| `ui/overlays.tsx` | `X` (cierre de diálogo/drawer) |
| `ui/ComponentLab.tsx` (solo dev, ruta `/__components`) | `BarChart3`, `BoxSelect`, `CircleDot`, `Component`, `Crosshair`, `Eye`, `Gauge`, `Grid3X3`, `MousePointer2`, `PanelRightOpen`, `Plus`, `Ruler`, `Save`, `Sparkles`, `Trash2`, `Triangle`, `Waves` |
| `ui/TopBarLab.tsx` (solo dev) | `Check`, `ChevronDown`, `Circle`, `Download`, `MoreHorizontal`, `Play`, `Redo2`, `Undo2` |

Convenciones recurrentes: `X` = cerrar; `ChevronDown/Right/Up` = expandir/navegar; `Check`/`CheckCircle2` = confirmación; `TriangleAlert`/`AlertTriangle`/`CircleAlert`/`AlertCircle` = advertencia/error; `LoaderCircle` = progreso; `Sun`/`Moon` = tema Día/Noche.

## 4 · Reglas de accesibilidad

1. **`aria-hidden` en el glifo, siempre.** Los glifos estructurales lo llevan por defecto en su factoría `base()`; los lucide dentro de controles se consideran decorativos. El glifo nunca aporta el nombre accesible.
2. **El label vive en el control.** Botones de icono usan `aria-label` (p. ej. el toggle del inspector móvil: `aria-label={t('inspector.open')}`); los tool buttons llevan `label` visible u oculto para lector según variante compacta (el copy se oculta con clip-rect, no con `display:none`).
3. **Color del icono = identidad de la herramienta** (`--sc-color-tool-*`), conservada en hover/active/focus; el estado activo añade fondo/borde suave sin sustituir el color propio. Disabled reduce prominencia (opacidad 0.62) manteniendo forma y nombre accesible.
4. **El icono nunca es la única señal**: acompaña texto, tooltip o etiqueta según la regla de redundancia perceptiva de `PALETTE.md`.
5. Los tamaños salen de tokens (`--sc-size-icon-sm/md/lg/tool`); no se escalan iconos con valores arbitrarios.
