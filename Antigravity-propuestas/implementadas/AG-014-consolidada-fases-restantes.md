# AG-014 Consolidada — Fases Restantes (Aula, Móvil y PDF)

# Estado: **Implementada** (2026-08-05) | Fecha: 2026-08-05 | Área: Educación / UX / Publicación

> **Notas de implementación** — reporte: `reports/2026-08-05-2300-ag014-consolidada.md`.
> Cuatro desviaciones deliberadas respecto a este texto, todas por contraste con el código real:
>
> 1. **Fase 2** — las claves `results.numericalSubstitutionTitle`, `results.axialStiffnessLabel`
>    y `results.bendingStiffnessLabel` **no existían** en `catalogs.ts`; se crearon (más ocho
>    auxiliares) en ES y EN. La sustitución se hace en unidades base del motor, no en unidades
>    de presentación, porque `MatrixView` tampoco convierte y si no, los números no cuadrarían.
> 2. **Fase 3** — el diagnóstico no se reproduce. Medido en navegador a 375px y 320px con
>    `(pointer: coarse)`: 0 traslapes en el Inspector, 0 desbordes, 0 controles bajo 44px; ya
>    existían seis bloques `@media (pointer:coarse)`, el token `--sc-control-height-touch` y
>    `dvh` en todo lo relevante. La violación real era otra: la regla cubría
>    `button,input,select` pero **no `a[href]`** (enlace de fuente a 296×33). Corregido y
>    automatizado en `qa-webkit.mjs`.
> 3. **Fase 4.1** — la "descarga múltiple" no se reproduce: un solo blob, un solo click, y el
>    JSON va adjunto *dentro* del PDF. Se fijó esa forma con `portableDownload.test.ts` en vez
>    de modificar un orquestador correcto.
> 4. **Fase 4.2** — `PdfLayout` no tenía primitiva de tabla; se añadió `table()` al
>    micro-framework antes de maquetar el anexo.

# Resumen ejecutivo

Este documento fusiona las fases restantes (2, 3 y 4) del Plan Maestro de UX para ser ejecutadas en una sola pasada usando Claude 3.5 Opus Max con Superpowers y Agentes. El objetivo es entregar una sustitución numérica real en Modo Aula, una interfaz táctil impecable sin superposiciones y un anexo técnico PDF de calidad editorial ejecutiva.

---

# Fase 2: Sustitución Numérica con Datos Reales en Modo Aula

**Problema:**
En el explorador de rigidez del Modo Aula, los estudiantes ven las matrices y las variables simbólicas ($E, A, I, L$), pero necesitan ver el cálculo intermedio explícito con los números reales para entender de dónde sale la rigidez final de la barra.

**Solución Detallada:**
1. En `src/features/results/ResultsPanel.tsx`, dentro del renderizado de la etapa `element` (explorador de rigidez), integra un nuevo bloque visual: `className="education-numerical-substitution"`.
2. Extrae las propiedades físicas del miembro seleccionado:
   - $E$ (Módulo de elasticidad), $A$ (Área), $I$ (Inercia) del `selectedMember` correspondiente a `element.memberId`.
   - $L$ (Longitud) directamente de `element.length`.
3. Renderiza las ecuaciones sustituidas usando literales dinámicos (ej. `k_ax = (A × E) / L = ({A} × {E}) / {L} = {kAxial}`).
4. Aplica el formato matemático usando las funciones existentes `formatScientific` y `formatSignificant` para mantener la consistencia visual.
5. Consume las traducciones ya creadas en `catalogs.ts`: `results.numericalSubstitutionTitle`, `results.axialStiffnessLabel` y `results.bendingStiffnessLabel`.

---

# Fase 3: Rediseño Responsive Móvil y Ajustes de Interfaz

**Problema:**
En pantallas de dispositivos móviles ($\le 768\text{px}$), algunos textos de la barra superior y los inputs del Inspector se superponen. Las áreas de toque (touch targets) en botones y menús no cumplen con el mínimo de usabilidad ($\ge 44\text{px}$). 

**Solución Detallada:**
1. **Inspector y Resultados**: En `src/features/inspector/InspectorProperties.tsx` y componentes de UI subyacentes (en `src/design-system/`), ajusta los paddings y alineaciones (flexbox gap/wrap) para evitar que los inputs colisionen con los labels en anchos pequeños.
2. **Targets Táctiles**: Garantizar que botones, pestañas de etapa (`education-stage-tabs`) y controles de lienzo tengan áreas clicables de mínimo `44px` en `tokens.css` o archivos `.css` correspondientes, activándose preferentemente bajo `@media (pointer: coarse)`.
3. **Alturas Responsivas**: Confirmar el uso de unidades dinámicas `dvh` (Dynamic Viewport Height) en lugar de `vh` tradicional para evitar que la barra de navegación del navegador móvil oculte la interfaz inferior.

---

# Fase 4: Rediseño Editorial del Expediente PDF y Anexo Técnico

**Problema:**
La exportación a PDF actual produce a veces descargas múltiples o residuales (textos crudos) y el Anexo Técnico Verificable (la memoria de cálculo) carece de una maquetación profesional ejecutiva, viéndose desordenado.

**Solución Detallada:**
1. **Descarga Única**: Verificar el orquestador de exportación para asegurar que solo se genere y descargue un blob (el archivo `.pdf`) sin side-effects.
2. **Maquetación Ejecutiva**: En `src/utils/pdf/pdfAnnexSection.ts`, refactoriza la presentación de los datos. 
   - Implementa tablas ordenadas (con columnas alineadas a la derecha para los números) para nodos, barras, fuerzas de fijación y matrices.
   - Aplica tipografía consistente, jerarquía de encabezados (niveles de título bien demarcados) y espaciado que simule un reporte de ingeniería formal, usando el micro-framework PDF interno (`PdfLayout`).

---

# Archivos afectados (estimación)

- `src/features/results/ResultsPanel.tsx`
- Componentes de UI / CSS (`tokens.css` y afines)
- `src/features/inspector/InspectorProperties.tsx`
- `src/utils/pdf/pdfAnnexSection.ts`

---

# PROMPT PARA CLAUDE CODE (OPUS MAX)

Lee e implementa la propuesta ubicada en:

Antigravity-propuestas/aprobadas/AG-014-consolidada-fases-restantes.md

Instrucciones de ejecución:
1. Valida la propuesta contra el código real antes de modificar archivos.
2. ACTIVACIÓN OBLIGATORIA DE SUPERPOWERS Y AGENTES:
   - Activa tus Superpowers (`using-superpowers`, `brainstorming`, `writing-plans`, `executing-plans`, `test-driven-development`, `verification-before-completion`, `systematic-debugging`).
   - Usa a fondo las herramientas de Agentes integradas en Superpowers para paralelizar la investigación de los módulos de interfaz (Fase 3) y PDF (Fase 4).
   - Aplica los plugins configurados (`frontend-design`, `ui-theme-designer`, `code-simplifier`, `typescript-lsp`, `security-guidance`).
3. LIBERTAD ARQUITECTÓNICA Y OPTIMIZACIÓN AUTÓNOMA:
   - Eres Claude 3.5 Opus Max. Tienes completa autonomía técnica y de diseño. No te limites estrictamente a la letra de esta propuesta: si descubres integraciones, abstracciones, patrones de UX/UI, u optimizaciones de rendimiento que consideres más elegantes, óptimas o robustas, **hazlas inmediatamente**. Confío en tu criterio para elevar la calidad del producto al máximo nivel posible, siempre y cuando respetes la frontera matemática.
4. Tareas a ejecutar:
   - Implementar Sustitución Numérica real en `ResultsPanel.tsx`.
   - Limpiar el responsive táctil ($\ge 44\text{px}$, eliminar traslapes de UI).
   - Maquetar `pdfAnnexSection.ts` con diseño editorial ejecutivo (tablas precisas y estéticas).
5. VERIFICACIÓN:
   - Ejecuta `npm run verify` asegurando 100% de éxito en tests, types y build.

Al terminar:
- Genera el reporte completo en `reports/YYYY-MM-DD-HHmm-ag014-consolidada.md`.
- Mueve este documento a `Antigravity-propuestas/implementadas/AG-014-consolidada-fases-restantes.md`.
