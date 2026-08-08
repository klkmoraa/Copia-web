# AG-004

# Sistema de Diseño UX/UI Móvil y Paneles Responsive Adaptativos

# Implementada

# 2026-08-05

# UX / UI / Responsive

# Resumen ejecutivo

Propone modernizar el layout responsive y la experiencia de usuario en dispositivos móviles y tabletas. Sustituirá los cálculos manuales de altura y escuchadores `window.matchMedia` en React (`ResultsPanel.tsx`, `WorkspaceShell.tsx`) por **CSS Container Queries**, unidades de alto de viewport dinámicas (`dvh`), paneles deslizantes (*bottom sheets*) gestuales con físicas fluidas y aseguramiento estricto de áreas táctiles $\ge 44\text{px}$ en todos los controles del inspector y la barra de herramientas.

# Problema

Actualmente, el layout responsive del espacio de trabajo y el panel de resultados depende de:
1. `window.matchMedia` evaluado en el estado de React (`isMobileResultsViewport`, `isPhoneResultsViewport` en `ResultsPanel.tsx`), lo que fuerza re-renders al cambiar el tamaño de la ventana o rotar el dispositivo.
2. Cálculos de altura en píxeles hardcodeados (`Math.min(330, window.innerHeight * 0.4)`), que no responden adecuadamente cuando el teclado virtual de iOS/Android se despliega.
3. Algunos inputs numéricos en el Inspector y botones secundarios en pantallas táctiles pequeñas poseen alturas efectivas de $32\text{-}36\text{px}$, vulnerando los lineamientos de accesibilidad WCAG AAA y Apple Human Interface Guidelines ($\ge 44\text{px}$).

# Evidencia

- `src/features/results/ResultsPanel.tsx`: Uso de `window.matchMedia` en listeners de estado (líneas 81-85) y cálculo manual de altura.
- `src/features/inspector/InspectorNumericField.tsx`: Campos de entrada que pueden reducir su área táctil en densidades altas.
- `qa-webkit.mjs`: Script de QA dedicado a validar targets táctiles $\ge 44\text{px}$ en WebKit.

# Objetivo

1. Adoptar **CSS Container Queries** (`container-type: inline-size`) para que los paneles (Inspector, ResultsPanel, CanvasChrome) adapten su maquetación según el tamaño de su contenedor y no únicamente del viewport global.
2. Usar unidades `dvh` (*dynamic viewport height*) para evitar que la barra de navegación móvil de Safari/Chrome corte los paneles inferiores.
3. Estandarizar todas las superficies táctiles con un target mínimo de $44\times44\text{px}$.
4. Implementar físicas de deslizamiento fluidas (*Bottom Sheets*) en el panel de resultados para móviles.

# Beneficio esperado

- **Usuarios Móviles (iOS/Android)**: Experiencia táctil nativa, fluida y sin desbordamientos de pantalla.
- **Rendimiento UI**: Eliminación de listeners de resize en JS, delegando el layout 100% al motor CSS del navegador.

# Solución propuesta

1. **Migración a CSS Container Queries**:
   - Definir `@container workspace (min-width: 700px)` en `src/design-system/tokens.css` y `ui.css`.
   - Permitir que el `ResultsPanel` alterne entre vista horizontal y vertical según el espacio disponible en su ranura (*slot*).
2. **Uso de Unidades CSS Modernas**:
   - Sustituir `vh` y cálculos JS de `window.innerHeight` por `height: 100dvh` y `max-height: 80dvh`.
3. **Refactorización de Targets Táctiles en `tokens.css`**:
   - Definir `--sc-touch-target-min: 44px`.
   - Aplicar `min-height: var(--sc-touch-target-min)` a todos los botones de la barra de herramientas, controles del inspector y solapas de pestañas.

# Alternativas consideradas

- **Librería externa de Bottom Sheet (e.g., `vaul`)**: Proporciona excelentes hojas deslizantes, pero agregaría peso al bundle. La combinación de CSS `touch-action`, `snap-points` y la biblioteca de animación existente `motion` (`m.div` con `drag="y"`) permite lograr físicas idénticas sin instalar nuevas librerías.

# Justificación técnica

Las CSS Container Queries son soportadas por el 98%+ de los navegadores modernos y ejecutan los cambios de layout en el hilo de renderizado nativo del navegador, eliminando la latencia de ejecución de JavaScript.

# Impacto en la experiencia del usuario

Garantiza una navegación y edición estructural cómoda en teléfonos inteligentes (iPhone, Galaxy) y tabletas (iPad), permitiendo usar la aplicación en campo o aula sin frustración táctil.

# Impacto visual

Mayor holgura en los controles, mejor jerarquía tipográfica en paneles estrechos y animaciones de deslizamiento suaves.

# Impacto en la arquitectura

Limpia la lógica de estado en `ResultsPanel.tsx` y `WorkspaceShell.tsx`, trasladando la responsabilidad del responsive a CSS (`tokens.css` y `ui.css`).

# Complejidad

**Media**. Requiere ajustar reglas CSS y verificar compatibilidad en WebKit/Chromium.

# Prioridad

**Alta**. Afecta directamente la usabilidad en dispositivos móviles.

# Riesgos

- Incompatibilidad menor en navegadores muy antiguos (mitigado por el soporte nativo amplio de Container Queries).

# Dependencias

Ninguna nueva dependencia.

# Librerías o tecnologías recomendadas

Nativas en CSS (Container Queries, Flexbox, Grid, `dvh`).

# Archivos y módulos probablemente afectados

- **Modificación probable**:
  - `src/design-system/tokens.css`
  - `src/design-system/components/ui.css`
  - `src/features/results/ResultsPanel.tsx`
  - `src/features/inspector/Inspector.tsx`
  - `src/features/workspace/WorkspaceShell.tsx`
- **Solo revisión**:
  - `qa-webkit.mjs`

# Plan de implementación

## Fase 1: Actualización de Tokens CSS
- Agregar variables de dimensión táctil `--sc-touch-target-min: 44px` y configurar contenedores `@container`.

## Fase 2: Refactorización de ResultsPanel
- Remover los listeners `window.matchMedia` y los cálculos manuales de pixeles en JavaScript.
- Aplicar estilos basados en Container Queries.

## Fase 3: Pruebas WebKit
- Ejecutar `npm run qa:webkit` para validar que todos los targets táctiles cumplan $\ge 44\text{px}$ en emulación de iPhone 13 e iPad Pro.

# Estrategia de implementación

Ejecutar los scripts de prueba de QA de WebKit para confirmar cero regresiones táctiles.

# Criterios de aceptación

- `npm run qa:webkit` pasa en verde sin advertencias de tamaño táctil.
- `ResultsPanel` se adapta suavemente al redimensionar la ventana sin parpadeos.
- No existen desbordamientos de scroll en pantallas de $390\text{px}$ de ancho.

# Pruebas necesarias

- `qa-webkit.mjs` (Playwright WebKit).
- `qa.mjs` (Playwright Chromium Mobile).

# Restricciones

- Mantener la accesibilidad por teclado y foco visible en todos los botones modificados.

# Estrategia de reversión

Restaurar los componentes CSS y listeners de JavaScript anteriores.

# Definición de terminado

Propuesta implementada, validada por `qa:webkit` y probada en emulación móvil.

---

# PROMPT PARA CLAUDE CODE

Lee e implementa la propuesta ubicada en:

`Antigravity-propuestas/aprobadas/AG-004-sistema-diseno-ux-movil-y-paneles.md`

Valida la propuesta contra el código real antes de modificar archivos.

Implementa únicamente el alcance aprobado: migra la lógica responsive de `ResultsPanel.tsx` a CSS Container Queries y unidades `dvh`, asegurando targets táctiles $\ge 44\text{px}$.

CRITERIO DE MEJORA AUTÓNOMA:
- Si al analizar el código real o durante la implementación detectas una oportunidad de mejora directa (técnica, de rendimiento o de calidad de código) que enriquezca la solución sin alterar la lógica de negocio ni romper la frontera matemática, agrégala.
- Si detectas una mejora más compleja que requiera una decisión de arquitectura mayor, no la fuerces; explícala brevemente en el informe final.
- Si la solución de la propuesta ya es óptima y suficiente, implementa estrictamente lo necesario sin añadir complejidad innecesaria ni código superfluo.

Conserva los comportamientos y restricciones indicados en el documento.

Ejecuta lint, tests, build y QA WebKit (`npm run verify` y `npm run qa:webkit`).

Al terminar:
- resume los cambios
- lista los archivos modificados
- indica las pruebas ejecutadas
- documenta si aplicaste alguna mejora adicional o te apegaste estrictamente al plan
- actualiza el estado de la propuesta a Implementada
- mueve el documento a `Antigravity-propuestas/implementadas/AG-004-sistema-diseno-ux-movil-y-paneles.md`

---

# Nota de implementación (2026-08-05)

Validación contra el código real antes de tocar nada reveló que buena parte de la premisa del documento ya estaba resuelta o era distinta de lo descrito:

- `--sc-touch-target-min: 44px` (Fase 1) ya existía como `--sc-control-height-touch` en `tokens.css`, aplicado en decenas de selectores y ya con un patrón `@media (pointer:coarse)` establecido en todo el código. No se duplicó el token.
- El problema #2 (teclado virtual cortando paneles) ya tenía una solución más robusta que `dvh` puro: `WorkspaceShell.tsx` mantiene un listener de `window.visualViewport` que publica `--sc-visual-viewport-height/top/bottom` como custom properties CSS, ya consumidas con `dvh` como fallback en gran parte de `styles.css`. `ResultsPanel.tsx` era la única pieza que aún calculaba con `window.innerHeight` crudo en vez de reusar ese sistema.
- `qa-webkit.mjs` valida targets táctiles solo en los botones de `.import-center-footer` (Centro de Importación), no en el panel de resultados — el criterio de aceptación "qa:webkit en verde valida targets táctiles del panel" no es literalmente cierto; qa:webkit no ejerce esa superficie.
- Se encontró un bug real y acotado: `.results-mode-control button` (30px) y `.result-tabs button` (40px por defecto) quedaban por debajo de 44px en dispositivos táctiles porque una regla `@media (pointer:coarse)` genérica anterior en el archivo perdía el empate de especificidad/orden contra reglas más tardías del mismo archivo — visible en iPad o portátiles táctiles con el inspector abierto (`.results-mode-control` está oculto en móvil).

## Implementado

- **`src/styles.css`**: `.results-panel` ahora es un contenedor de Container Queries (`container-type: inline-size; container-name: results-panel`) con una regla `@container results-panel (max-width: 560px)` que oculta las etiquetas de familia de pestañas y el contexto del comandbar cuando el panel se angosta por el ancho del inspector, no solo por el viewport — caso real que las media queries actuales no cubrían. Se convirtieron a `dvh` los `vh` restantes ligados a `.results-panel` (72vh, 58vh×2, 42vh×2, 56vh). Se corrigió el bug de especificidad de los targets táctiles de `.results-mode-control button` y `.result-tabs button` bajo `@media (pointer:coarse)`.
- **`src/features/results/ResultsPanel.tsx`**: se añadió `getViewportHeightPx()`, que lee `--sc-visual-viewport-height` (ya mantenido por `WorkspaceShell.tsx`) vía `getComputedStyle` con fallback a `window.innerHeight`. Reemplazó los 6 usos post-montaje de `window.innerHeight * 0.4/0.72` en el cálculo de altura, el drag-resize, el redimensionado por teclado y `aria-valuemax`. No se añadió ningún listener nuevo — se reutiliza el que ya existe en `WorkspaceShell`.

## Explícitamente NO implementado (decisión de arquitectura mayor, no forzada)

- **Eliminación total de los `window.matchMedia` de `isMobileResultsViewport`/`isPhoneResultsViewport`**: estos no solo controlan estilos — gobiernan comportamiento real (rol `dialog`/`aria-modal`, trampa de foco, `inert` de hermanos, listener de Escape, `phoneCanvasInteractive`). `qa.mjs` ejerce explícitamente ese contrato (`mobile-collapsed` tras Escape, altura del panel en modo influencia ≥280px). Las Container Queries no pueden expresar comportamiento de accesibilidad, solo layout — sustituirlos habría roto pruebas existentes sin ganar nada. Se documenta como el punto donde la propuesta original sobreestimaba cuánta lógica JS era "solo responsive".
- **Bottom sheets con físicas de arrastre (`motion`, `drag="y"`)**: fuera del alcance acotado por la instrucción de ejecución (limitada a Container Queries + `dvh` + targets táctiles). El panel ya tiene un resize-handle arrastrable con teclado accesible; añadir físicas de gesto adicionales es una decisión de UX/arquitectura separada, no un ajuste de responsive.

## Pruebas ejecutadas

- `npm run verify` (lint + `verify:protected` + 649 tests + build + `verify:perf`): **verde**. Frontera matemática protegida intacta (no se tocó `engine/workers/data/store/types`).
- `npm run qa:webkit`: falla en `iPhone 13: welcomeStepsReachable` — confirmado con `git stash` que este fallo **ya existe en `main` sin los cambios de AG-004**, en la pantalla de bienvenida (`.welcome-steps`), sin relación con el panel de resultados. Ningún check de touch targets ni de layout falló. Se reportó como tarea separada.
- `npm run qa`: mismo patrón, falla en `welcome390x844StepsReachable`/`welcome430x932StepsReachable` (mismo bug preexistente). Ningún check relacionado con `.results-panel`, `.mobile-collapsed`, `.results-mobile-toggle` o `influenceMobilePanelHeight` falló.
