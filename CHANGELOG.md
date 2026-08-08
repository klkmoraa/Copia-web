# Changelog

Todos los cambios notables de structureCo se documentan en este archivo. Los
detalles de ejecución UX/UI permanecen en
`docs/ux-redesign/CHANGELOG_UX.md`.

## 0.8.2 — No publicado · Confiabilidad del motor, P-Delta y programa visual

`package.json` está en 0.8.2 desde el commit `703c474`. Esta sección reúne todo
lo acumulado desde 0.8.1, que hasta ahora no estaba en el changelog. Sigue sin
publicarse: **no se ha usado GitHub** — sin push, sin tag, sin release, sin deploy.

### Añadido

- **Análisis P-Delta de segundo orden** para pórticos 2D, con selector de orden
  de análisis, configuración avanzada (paso, reducción, tolerancias) y
  diagnóstico en la interfaz. Detalle y verificación matemática en
  `docs/motor-matematico/`.
- **Clasificación de confiabilidad** de cada análisis (`reliable` / `limited` /
  `unreliable`), visible en la barra de estado, con umbrales calibrados contra
  una batería de 10 modelos de referencia.
- **Sistema de notificaciones toast** (`ToastNotification`) enganchado al bus de
  comandos tipado, con `aria-live`, tope de 4 simultáneos, cierre manual o
  automático y respeto de `prefers-reduced-motion`. Confirma exportaciones y
  copias sin interrumpir el trabajo.
- **Copiar el proyecto como JSON al portapapeles** desde el menú de exportación,
  con descarga de archivo como alternativa si el portapapeles no está disponible.
- **Filtros por categoría en la pantalla de inicio**: las plantillas de ejemplo
  se muestran todas (antes solo 3 de 6, elegidas a mano) y pueden filtrarse
  entre académicas y modelos.
- **Presupuesto de rendimiento que falla** (`scripts/check-performance-budget.mjs`,
  `npm run verify:perf`): la carga inicial tiene un techo declarado y el gate
  se rompe al superarlo. Antes los presupuestos se medían y documentaban, pero
  ninguna comprobación podía fallar.

### Cambiado

- **Paleta cromática v2** en ambos temas: fondos, superficies, texto, bordes,
  marca, estados y colores técnicos de diagramas recalibrados; la carga puntual
  pasó de naranja a salmón-coral para separarse del resto de familias. Detalle
  y contrastes medidos en `docs/design-system/PALETTE.md`.
- **Pantalla de inicio rediseñada**: tres tarjetas de lanzamiento (lienzo libre,
  Modo Aula, continuar proyecto con su tamaño), vitrina de plantillas con
  insignias de categoría y banner de flujo de trabajo.
- **Símbolos de apoyo redibujados** con detalle tipo CAD (placa base, hachurado
  de terreno, resorte propio para apoyos elásticos), y las **reacciones ahora
  permanecen visibles** en el canvas sin depender de la pestaña de resultados
  activa.
- **Menús y popovers**: fondo de vidrio esmerilado, mayor contraste de texto,
  animación de resorte al abrir y cerrar, y el menú móvil "Más" agrupado en
  secciones tituladas. El menú "Más" ya no se sale de pantalla en viewports
  bajos.
- **Etiquetas del canvas** con mayor separación mínima y fondo legible sobre la
  cuadrícula.
- La librería de animación (`motion`) se carga **después del primer pintado**:
  la aplicación usa los componentes ligeros `m.*` con `LazyMotion`, de modo que
  el bundle de capacidades queda en un chunk diferido.

### Corregido

- Varios defectos del motor P-Delta detectados en revisión adversarial:
  convergencia falsa, configuración sin validar, detección post-crítica,
  medición de amplificación por grado de libertad, y cobertura de reacciones
  nodo por nodo en vez de solo por escenario.
- El modo P-Delta y su configuración se conservaban al recargar.
- Escenarios resueltos ya no se recalculan al cambiar solo la presentación.
- Layout del acordeón de configuración avanzada P-Delta, que heredaba una
  grilla genérica y desbordaba sus campos.
- `--sc-color-canvas-node-fill` en tema Noche, desincronizado del fondo del
  canvas desde la migración de paleta.

### Eliminado

- `--sc-color-state-valid` y `--sc-color-state-invalid`: tokens sin ningún
  consumidor en el proyecto. La validación de formularios usa
  `--sc-color-state-error-foreground`.

### Preservado

- Motor matemático, unidades internas, signos, defaults físicos, topología,
  persistencia y formato de proyecto. La frontera protegida (26 archivos) se
  verificó en cada cambio; el trabajo visual de esta versión no tocó
  `src/engine/**`, `src/workers/**`, `src/data/**`, `src/store/ProjectContext.tsx`
  ni `src/types.ts`.

### Rediseño visual integral (2026-08-02)

#### Añadido

- Sistema de tokens ampliado (`src/design-system/tokens.css`): paleta semántica
  completa Día/Noche (identidad, superficies, texto, estados, roles
  estructurales formalizados), tokens de densidad, easings `emphasized` y
  `spring`, sombras en capas por tema. Los colores técnicos de diagramas
  conservan los valores verificados WCAG AA de 0.8.0.
- Iconografía estructural propia (`src/design-system/icons/structural.tsx`):
  26 glifos con gramática común (24 px · trazo 1.8 · terminales redondeados),
  incluidos glifos nuevos para Corte de sección y Dividir miembro que
  sustituyen iconos genéricos.
- Documentación del sistema de diseño (`docs/design-system/`): paleta,
  tipografía, espaciado/densidad, motion e iconografía; arquitectura frontend
  en `docs/architecture/FRONTEND.md`.
- Capa de refinamiento de microinteracciones: transición de subrayado en tabs,
  hover de filas en tablas de resultados, feedback de pulsación en
  herramientas y acciones, scrollbars finas tematizadas, animaciones de
  entrada en Bienvenida y popovers, transición coordinada Día/Noche; todo
  anulado bajo `prefers-reduced-motion`.

#### Cambiado

- Tema Noche recalibrado a grafito frío profundo ("Laboratorio Nocturno") con
  capas de elevación diferenciadas; tema Día en porcelana técnica editorial.
- Reorganización frontend profesional: `src/components|ui|shell|styles` →
  `src/design-system/` (tokens, componentes, laboratorio) y `src/features/`
  (welcome, workspace, topbar, canvas, inspector, results, classroom,
  import-export). 80 archivos movidos con imports reescritos; sin cambios en
  `src/engine/`, `src/workers/`, `src/data/`, `src/store/` ni `src/types.ts`
  (frontera matemática intacta, suite 388/388 en verde).

## 0.8.1 — 2026-08-02 · Programa de endurecimiento (certificado localmente, sin publicar)

Versión certificada en local. **No se ha usado GitHub**: sin push, sin tag, sin release, sin
deploy. Detalle completo por slice en
[docs/releases/0.8.1/STATUS.md](docs/releases/0.8.1/STATUS.md).

### Corregido

- **Seguridad de importación**: `.structureco`/PDF/JSON se rechazan por tamaño
  antes de leerse por completo; los paquetes `.structureco` tienen presupuesto
  de entradas, tamaño descomprimido y relación de compresión (protección
  contra zip bombs). 50 pruebas adversariales nuevas.
- **Exportación SVG/PNG**: el SVG exportado ya no depende de la hoja de
  estilos de la aplicación — resuelve clases y variables CSS a valores
  computados antes de servirse como archivo independiente. El PNG rasteriza
  ese mismo SVG a su tamaño final, sin escalar una versión pequeña.
- **Memoria PDF**: la versión de la aplicación ya no queda fija en un
  literal desactualizado; el documento declara unidades, convenciones de
  signo, alcance y limitaciones en una página propia, y el ruido de coma
  flotante (`-2.93915e-15 kN` en una viga sin acción axial) ya no se publica
  como cantidad medible, ni en la interfaz ni en el texto que el motor
  escribe a la explicación.
- **Centro de importación**: una inspección de archivo pesada ya puede
  cancelarse (antes el botón de retroceso quedaba deshabilitado sin
  alternativa); el paso de confirmación muestra el texto de carga correcto
  en vez de reutilizar el de inspección.
- **Contraste**: seis parejas de color sólido (acción, éxito, error en
  ambos temas) que incumplían WCAG AA por literales `#fff` codificados a
  mano en `styles.css` ahora usan tokens medidos y verificados por prueba.

### Cambiado

- Política numérica unificada en `utils/numberFormat.ts`: ocho contextos de
  presentación (canvas, inspector, tabla, tooltip, informe, anexo,
  portapapeles) reemplazan cinco formateadores independientes con umbrales
  incompatibles.
- Los paneles del workspace se comunican mediante una fachada de comandos
  tipada (`workspaceCommands.ts`) en vez de `CustomEvent` con nombres
  escritos a mano.

### Añadido

- Suite de 12 invariantes deterministas del motor (homogeneidad, inversión,
  subdivisión de miembro, traslación, rotación, round-trip) — no reemplazan
  los casos analíticos ni la comparación con FTool, los complementan.
- Presupuestos de rendimiento medidos y reproducibles (`scripts/measure-performance.mjs`).
- Gate de CI preparado localmente (`.github/workflows/`, no conectado a GitHub).

### Preservado

- Motor matemático, unidades internas, signos, defaults físicos, topología y
  formato de proyecto. La frontera protegida se verificó archivo por archivo
  en cada slice; el único cambio dentro de `src/engine/**` fue autorizado
  explícitamente por el usuario y es de presentación de texto, no de cálculo.

## 0.8.0 — 2026-07-27

### Añadido

- Sistema visual, biblioteca de componentes y navegación canvas-first.
- Inspector responsive con edición numérica segura, unidades y validación inline.
- Centro analítico de Resultados y recorrido Aula guiado.
- Matrices de accesibilidad, i18n, responsive, touch, rendimiento y release QA.
- Documentación de baseline, mantenimiento, rollback y contribución.

### Cambiado

- Composición adaptativa para desktop, tablet y móvil.
- Carga diferida de superficies analíticas para reducir costo temprano.
- Feedback, foco, teclado, Light/Dark y presentación ES/EN.

### Preservado

- Motor matemático, unidades internas, signos, defaults físicos, precisión,
  topología, persistencia y formato de proyecto.

Consulta `docs/ux-redesign/RELEASE_NOTES_0.8.0.md` para el detalle de usuario y
`docs/ux-redesign/RELEASE_QA_REPORT.md` para la evidencia técnica.
