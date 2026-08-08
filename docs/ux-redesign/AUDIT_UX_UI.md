# Auditoría UX/UI — Fase 1

Fecha: 2026-07-17  
Versión: structureCo 0.7.0  
Resultado: **aprobada como auditoría; la interfaz actual no cumple todavía la compuerta visual objetivo**.

## Resumen ejecutivo

structureCo ya tiene una base funcional sólida: el flujo modelar–analizar–interpretar funciona, el canvas es el centro del producto, la información del solver conserva trazabilidad y existen respuestas útiles para móvil, teclado, tema oscuro, importación y errores. La automatización confirma estabilidad: 229 pruebas y los recorridos Chromium/WebKit pasan sin errores.

La deuda dominante no está en la capacidad del producto, sino en cómo se comprime y prioriza. La TopBar colisiona en anchos reales de laptop/tableta; resultados y canvas muestran texto técnico de 8–11 px; varios controles frecuentes quedan por debajo de 44 px; y Aula todavía es un modo de ocultamiento/predicción, no una travesía pedagógica persistente. Estos tres primeros puntos incumplen criterios no negociables del brief y se clasifican P0.

## Método

- Inspección de composición, estilos, estados y fronteras con el motor en `src/`.
- Recorrido renderizado con el fixture **Pórtico de ejemplo**.
- Viewports: 1536×960, 1440×900, 1366×768, 1194×834, 834×1194, 430×932 y 390×844.
- Modos y estados: Completo, Aula, claro, oscuro, listo, analizado, predicción, inspector abierto y mecanismo/error.
- Automatización: `verify`, QA Chromium y QA WebKit.
- Revisión de consola: sin errores o warnings durante el recorrido auditado.

## Fortalezas que deben preservarse

1. **Canvas-first real.** El modelo ocupa el centro, con pan, zoom, fit, selección, snapping, gestos y atajos.
2. **Trazabilidad numérica.** Selección, inspector, resultados y diagramas comparten el mismo estado y muestran valores coherentes sin navegación destructiva.
3. **Continuidad entre modos.** Cambiar Completo/Aula conserva modelo y análisis.
4. **Centro de importación.** Es un patrón claro, progresivo, adaptable y con targets grandes; es una referencia interna de buena jerarquía.
5. **Móvil con intención nativa.** Dock inferior, paletas y hoja modal del inspector evitan copiar literalmente el escritorio.
6. **Accesibilidad ya iniciada.** Hay `aria`, navegación semántica, fondo inerte en el inspector móvil, restauración de foco y preferencias de movimiento/transparencia reducidos.
7. **Diagnóstico de errores.** El estado de mecanismo comunica causa y próximos pasos sin perder el contexto del modelo.
8. **Arquitectura defensiva.** Workers, módulos pesados diferidos y pruebas extensas reducen el riesgo de un rediseño puramente presentacional.

## Hallazgos priorizados

### P0 — bloquean la compuerta visual

| ID | Hallazgo | Evidencia | Impacto | Criterio de aceptación futuro |
| --- | --- | --- | --- | --- |
| F1-P0-01 | La TopBar superpone proyecto, caso/combinación, historial, guardado y modo. A 1440 px, el selector ocupa aproximadamente x=555–785 mientras historial y guardado invaden ese mismo rango; a 1194 px la colisión es severa. | [`laptop-1366x768`](evidence/baseline/laptop-1366x768-light-completo-analyzed.png), [`tablet-landscape-1194x834`](evidence/baseline/tablet-landscape-1194x834-light-completo-analyzed.png) | Controles ambiguos o difíciles de accionar en laptop e iPad horizontal. | Cero intersecciones entre controles, texto truncado con alternativa accesible y ruta secundaria para acciones no esenciales en 1180–1440 px. |
| F1-P0-02 | Texto crítico de resultados, diagramas y ayudas se renderiza a 8–11 px. Se observaron títulos de 10 px, ejes de 8 px, valores de 10 px y notas de 9 px en móvil. | [`mobile-390x844`](evidence/baseline/mobile-390x844-light-completo-analyzed.png), [`laptop-1366x768`](evidence/baseline/laptop-1366x768-light-completo-analyzed.png) | Lectura deficiente de magnitudes y significado físico; incumple el mínimo de 12 px del brief. | Ningún texto crítico menor de 12 px; cuerpo preferente ≥14 px; contraste AA y pruebas a 200 % de zoom. |
| F1-P0-03 | Controles táctiles frecuentes miden menos de 44×44 px: Más 36×36, zoom 38×38, Analizar ~43×40 y múltiples campos/acciones de 38 px. | [`tablet-portrait-834x1194`](evidence/baseline/tablet-portrait-834x1194-light-completo-analyzed.png), [`mobile-430x932`](evidence/baseline/mobile-430x932-dark-inspector.png) | Errores de toque y baja accesibilidad en tableta/móvil. | Objetivos frecuentes de 44–48 px como mínimo, separación suficiente y sin superposición del área táctil. |

### P1 — estructura e interacción

| ID | Hallazgo | Evidencia/causa | Impacto | Criterio de aceptación futuro |
| --- | --- | --- | --- | --- |
| F1-P1-01 | El breakpoint de 1180 px deja al iPad horizontal de 1194 px en la composición de escritorio. | CSS actual y captura de 1194×834. | Rail de 164 px + inspector de 320 px + resultados de 285 px comprimen el canvas y disparan colisiones. | Breakpoints por ajuste de contenido; composición compacta activada antes de la primera colisión. |
| F1-P1-02 | Resultados móviles usan una hoja fija de ~330 px con una tira horizontal de nueve pestañas; varias quedan fuera de la primera vista sin indicación fuerte. | [`mobile-390x844`](evidence/baseline/mobile-390x844-light-completo-analyzed.png) | Interpretar obliga a descubrir scroll horizontal y reduce simultáneamente el canvas. | Estados cerrado/compacto/expandido/pantalla completa; categorías claras y pestaña activa siempre visible. |
| F1-P1-03 | Aula no presenta un viaje persistente. La guía aparece sólo sin selección y el estado observado usa el mismo verde del producto, sin acento violeta educativo. | [`desktop-dark-aula`](evidence/baseline/desktop-1440x900-dark-aula-prediction.png) y condición de render de `ClassroomGuide`. | El alumno pierde etapa, objetivo y siguiente acción al seleccionar objetos. | Stepper persistente Modelo→Predicción→Cálculo→Comparación→Reflexión, con avance no destructivo y acento violeta secundario. |
| F1-P1-04 | La cámara no se reajusta al cambiar el viewport/orientación durante la sesión. | Recorrido 1440→390→1440 sin pulsar Fit. | El modelo puede quedar recortado o demasiado pequeño, aunque el archivo siga correcto. | Preservar centro/escala útil o proponer Fit al cambiar de composición, sin alterar coordenadas del modelo. |
| F1-P1-05 | El inspector es una lista larga y plana; propiedades esenciales, frecuentes y avanzadas compiten en el mismo nivel. | Inventario de nodo/miembro/carga y captura móvil. | Aumenta búsqueda, scroll y riesgo de editar el campo equivocado. | Resumen + grupos Básico/Frecuente/Avanzado, disclosure progresivo y estado por selección. |
| F1-P1-06 | El verde representa marca, acción activa, éxito y parte de resultados/cargas; otros colores también cambian de papel entre UI y física. | Tokens y estados observados. | La semántica depende del contexto y pierde valor pedagógico. | Tokens separados para marca, interacción, estado y magnitud física, validados en claro/oscuro y daltonismo. |
| F1-P1-07 | Nueve pestañas de resultados mezclan magnitudes físicas, aprendizaje y diagnóstico como opciones equivalentes. | `summary`, `reactions`, `axial`, `shear`, `moment`, `influence`, `deformed`, `learn`, `issues`. | Sobrecarga y navegación lateral extensa, especialmente en móvil. | Agrupar Resumen/Esfuerzos/Deformada/Aprender/Problemas; conservar acceso a cada dato existente. |
| F1-P1-08 | Eliminar es una herramienta persistente en escritorio y una opción de paleta en móvil, no una acción contextual de selección. | Rail y paleta Más. | Facilita entrada accidental a un modo destructivo y ocupa jerarquía primaria. | Eliminar desde selección/contexto, confirmación proporcional y deshacer visible; conservar atajo. |
| F1-P1-09 | Etiquetas de geometría, cargas, leyenda y diagramas compiten en el canvas móvil; no hay decluttering suficiente. | [`mobile-390x844`](evidence/baseline/mobile-390x844-light-completo-analyzed.png) | Solapamientos y pérdida de lectura al analizar. | Niveles de detalle por escala, prioridad semántica y controles de capas sin ocultar resultados esenciales. |
| F1-P1-10 | Las reglas responsive se acumulan en varias capas de overrides y mantienen supuestos fijos de 66/164/320/285 px. | `styles.css` y comportamiento observado. | Mayor riesgo de corregir un viewport y romper otro. | Consolidar tokens de layout, consultas por contenedor/contenido y pruebas de no colisión en la matriz objetivo. |

### P2 — consistencia y eficiencia

| ID | Hallazgo | Impacto | Criterio de aceptación futuro |
| --- | --- | --- | --- |
| F1-P2-01 | Al elegir Completo/Aula desde Más en móvil, el menú permanece abierto. | Se requiere una acción extra sin beneficio. | Cerrar al confirmar o comunicar explícitamente que existen cambios pendientes. |
| F1-P2-02 | El estado global de análisis depende sobre todo del texto del botón y del panel; no hay indicador compacto estable listo/calculando/error/desactualizado. | La vigencia de resultados puede pasar inadvertida. | Estado persistente, accesible y cercano a Analizar, alimentado por el estado ya existente. |
| F1-P2-03 | La galería de ejemplos de bienvenida queda parcialmente cortada en móvil sin una pista clara de continuidad horizontal. | Menor descubrimiento de plantillas. | Mostrar affordance de desplazamiento, paginación o tarjetas completas. |
| F1-P2-04 | Ayudas y contenido técnico no siempre comparten el mismo nivel de traducción. | Experiencia bilingüe inconsistente. | Inventario ES/EN completo y términos estructurales normalizados. |
| F1-P2-05 | La documentación visible del proyecto reporta 39 archivos/227 pruebas, pero la línea base real tiene 40/229. | Reduce confianza en el estado del producto. | Actualizar cifras o derivarlas automáticamente en una fase posterior. |

## Lectura por frente visual del brief

| Frente | Estado actual | Diagnóstico |
| --- | --- | --- |
| TopBar | Funcional, demasiado densa | Transformar por zonas y prioridades. |
| Herramientas | Completa y con atajos | Conservar capacidad; reagrupar y contextualizar. |
| Canvas | Centro real del producto | Conservar; añadir capas, decluttering y continuidad responsive. |
| Inspector | Potente | Transformar jerarquía y estados móviles. |
| Resultados | Exactos y ricos | Transformar arquitectura de información y legibilidad. |
| Aula | Predicción funcional | Convertir en viaje guiado persistente. |
| Color | Buen punto de partida | Separar marca, estado, selección y física. |
| Escritorio/tableta | Sin overflow de página | Resolver breakpoint y compresión interna. |
| Móvil | Composición específica útil | Elevar targets, tipografía y resultados a pantalla completa. |
| Accesibilidad | Fundamentos presentes | Completar contraste, zoom, targets y recorrido de teclado. |

## Conclusión

No se recomienda “redibujar todo”. La dirección adecuada es preservar motor, canvas, datos, shortcuts y patrones maduros, y reconstruir la jerarquía alrededor de ellos. El backlog de [`PRIORITY_BACKLOG.md`](PRIORITY_BACKLOG.md) convierte estos hallazgos en entregables verificables sin autorizar todavía su implementación.

