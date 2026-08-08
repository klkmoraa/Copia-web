# AG-002

# Optimización de Renderizado SVG del Canvas y Algoritmos de Snapping mediante Índice Espacial R-Tree

# Implementada

# 2026-08-05

# Rendimiento / Canvas

---

> ## Nota de implementación (2026-08-05)
>
> Propuesta implementada. La firma pública y los tipos (`SnapCandidate`, `SnapKind`, `SnapSegment`,
> `SnapOptions`, `SnapResult`) quedaron intactos; no se agregaron dependencias.
>
> ### 1. Broad-phase espacial en `buildIntersectionSnapCandidates`
> Cuadrícula uniforme de cubetas (máx. 64×64 celdas, eje dimensionado como `√M`) que indexa las cajas
> envolventes de los miembros. Solo los pares que comparten celda llegan a la prueba exacta de producto
> cruzado, con un rechazo AABB adicional antes de la geometría. Dos segmentos que se cruzan tienen cajas
> traslapadas y por tanto comparten al menos una celda, así que **no se pierde ningún candidato**. Los
> vecinos se emiten en orden ascendente de índice, de modo que el orden del arreglo resultante y de
> `sourceIds` es idéntico al del barrido exhaustivo anterior.
>
> ### 2. Índice de puntos para colapsar coincidencias
> El `candidates.find(...)` lineal (que hacía el deduplicado cuadrático) se sustituyó por un hash espacial
> numérico con celdas de `2·epsilon` y consulta 3×3. Las colisiones de hash son inocuas porque toda
> coincidencia se confirma con la distancia exacta, y se conserva la semántica de *primer* duplicado.
> Se aplica en el constructor de intersecciones y en el de perpendiculares.
>
> ### 3. Barrido sin asignaciones en `resolveSnap`
> Se eliminó la cadena `concat → filter → map → filter → sort` (4 arreglos + un objeto por candidato en
> cada `pointermove`). Ahora es un solo recorrido con rechazo por eje X antes de calcular la distancia
> completa, que mantiene únicamente el mejor candidato. El desempate (rango → distancia → orden de
> aparición) es exactamente el del `sort` estable previo.
>
> ### 4. Perpendiculares memoizadas en el canvas
> `buildPerpendicularSnapCandidates` dependía solo del origen de dibujo y de la geometría, nunca del
> puntero, pero se reconstruía en cada `pointermove`. Ahora vive en un `useMemo` junto a
> `baseSnapCandidates`, y `snapPoint` reutiliza los arreglos memoizados sin copiarlos cuando no hay nada
> que fusionar ni excluir.
>
> ### Mediciones (banco determinista, celosía aleatoria densa)
>
> | Escenario | Antes | Después |
> |---|---|---|
> | Intersecciones, M=150 (2 841 cruces) | 38,0 ms | 19,7 ms |
> | Intersecciones, M=500 (29 272 cruces) | 10 298 ms | 393 ms |
> | `resolveSnap` sobre 3 141 candidatos | 0,264 ms | 0,024 ms |
> | **Coste total por `pointermove`, M=150** | **0,412 ms** | **0,018 ms** |
>
> El criterio de aceptación de $< 2\text{ms}$ por frame para 150 miembros se cumple con margen amplio
> (0,018 ms). El caso M=500 es el techo que ya imponía `StructuralCanvas` y solo se paga al cambiar el
> modelo, no por frame.
>
> ### Fuera de alcance / observaciones
> - La **Fase 3 de la propuesta (capa SVG memoizada)** ya estaba satisfecha por AG-001:
>   `CanvasGeometryLayer`, `CanvasResultLayer` y `CanvasInteractionLayer` ya separan la estructura física
>   del puntero y las guías. No se tocó nada ahí.
> - El diagnóstico original decía que `buildIntersectionSnapCandidates` corría en cada `pointermove`; en
>   el código real ya estaba memoizada por revisión del modelo y limitada a `≤ 500` segmentos. El coste
>   por frame real estaba en `resolveSnap` y en las perpendiculares, que es donde se concentró el trabajo.
> - Mejora no aplicada por requerir decisión de arquitectura: acotar las perpendiculares a los miembros
>   cercanos al puntero exigiría pasar la posición del puntero (o un radio) a
>   `buildPerpendicularSnapCandidates`, lo que cambia su firma pública y su semántica. Con la memoización
>   el coste por frame ya es nulo, así que no se justifica.

---

# Resumen ejecutivo

Propone optimizar los algoritmos de detección de snapping CAD (puntos medios, intersecciones, perpendiculares) y el renderizado SVG en el lienzo gráfico. Al introducir una estructura de datos de indexación espacial ligera (R-Tree o cuadrícula espacial en memoria) en `src/utils/snapping.ts`, la búsqueda de candidatos de acoplamiento reducirá su complejidad computacional de $\mathcal{O}(N^2)$ a $\mathcal{O}(\log N)$, manteniendo una frecuencia constante de 60 FPS incluso en estructuras complejas con cientos de miembros.

# Problema

En `src/utils/snapping.ts` y `StructuralCanvas.tsx`, cada vez que el usuario mueve el puntero o dibuja un miembro, el sistema recorre iterativamente todos los nodos y miembros existentes para calcular candidato a intersecciones y perpendiculares:
- `buildIntersectionSnapCandidates` realiza una comparación cruzada cuadrática $\mathcal{O}(M^2)$ entre todos los miembros.
- `buildPerpendicularSnapCandidates` prueba proyecciones ortogonales sobre cada segmento.
Para modelos pequeños (10-20 miembros) el tiempo de cálculo es imperceptible, pero para pórticos o cerchas densas (100+ miembros), esto genera caídas de frames (*lag*) perceptibles en la respuesta del puntero.

# Evidencia

- `src/utils/snapping.ts`: Algoritmos de snapping que recorren arreglos planos de nodos y miembros en cada evento `pointermove` (líneas 1-200).
- `src/features/canvas/StructuralCanvas.tsx`: Invocación directa de `resolveSnap` en la ráfaga de eventos del puntero.

# Objetivo

1. Optimizar los cálculos de snapping CAD para que se ejecuten en $< 2\text{ms}$ por evento.
2. Implementar un índice espacial (R-Tree / Spatial Hash Grid) en `snapping.ts` que filtre candidatos por su Bounding Box antes de ejecutar la geometría precisa.
3. Memoizar la representación gráfica de miembros y apoyos vectoriales estáticos.

# Beneficio esperado

- **Usuarios**: Dibujo y snapping instantáneo en modelos grandes sin retardo en el cursor.
- **Rendimiento**: Reducción del tiempo de cálculo por frame de $16\text{ms}$ a $<2\text{ms}$.

# Solución propuesta

1. **Spatial Hash Grid / R-Tree Nactivo**:
   - Implementar un índice espacial ligero e inmutable en `snapping.ts` que organice los bounding boxes de los miembros.
   - Actualizar el índice únicamente cuando el modelo cambie (`project.nodes` o `project.members`), no en cada evento del ratón.
2. **Filtrado Práctico por Cuadrante**:
   - `buildIntersectionSnapCandidates` solo evaluará pares de miembros cuyos rectángulos envolventes se traslapen (*broad-phase filtering*).
3. **Capa SVG Memoizada**:
   - Separar el renderizado de la estructura física del renderizado del puntero temporal y guías de snapping.

# Alternativas consideradas

- **Librería externa `rbush`**: Es una solución R-Tree excelente (2KB), pero una implementación nativa simple de Spatial Grid (cuadrícula de celdas fijas) en TypeScript satisface el requerimiento de 2D sin agregar dependencias externas.

# Justificación técnica

El patrón *Broad-Phase + Narrow-Phase* es el estándar en motores CAD y de física. Reducir las comparaciones geométricas mediante cajas envolventes es la solución computacional más eficiente.

# Impacto en la experiencia del usuario

Mayor precisión y respuesta inmediata del snapping magnético al dibujar miembros o colocar cargas.

# Impacto visual

Ninguno. El comportamiento de los indicadores visuales de snapping se mantiene exactamente igual.

# Impacto en la arquitectura

Optimización interna en `src/utils/snapping.ts` y desacoplamiento en las capas de renderizado del Canvas.

# Complejidad

**Media**. Requiere implementar un algoritmo espacial eficiente en 2D y verificar casos borde (líneas verticales, miembros coincidentes).

# Prioridad

**Alta**. Mejora la usabilidad central de la herramienta de edición.

# Riesgos

- Omisión de candidatos de acoplamiento si la celda de la cuadrícula o bounding box es demasiado pequeña.

# Dependencias

Ninguna nueva dependencia.

# Librerías o tecnologías recomendadas

Implementación propia en TypeScript dentro de `src/utils/snapping.ts`.

# Archivos y módulos probablemente afectados

- **Modificación probable**:
  - `src/utils/snapping.ts`
  - `src/features/canvas/StructuralCanvas.tsx`
- **Solo revisión**:
  - `src/utils/snapping.test.ts`

# Plan de implementación

## Fase 1: Implementación de Spatial Index
- Crear la clase/función `buildSpatialIndex` en `src/utils/snapping.ts`.
- Filtrar candidatos de intersección y perpendicularidad usando la caja envolvente del puntero.

## Fase 2: Integración en Canvas
- Actualizar `StructuralCanvas` para reconstruir el índice solo ante cambios del modelo.

## Fase 3: Testing
- Ampliar `src/utils/snapping.test.ts` con estructuras densas (100+ miembros).

# Estrategia de implementación

Garantizar paridad exacta de resultados con las funciones actuales de snapping mediante tests unitarios antes de reemplazar los algoritmos.

# Criterios de aceptación

- `npm run verify` pasa sin errores.
- Todos los tests de `snapping.test.ts` continúan en verde.
- El tiempo de cálculo de snapping para 150 miembros es menor a $2\text{ms}$ por frame.

# Pruebas necesarias

- Pruebas unitarias de límites geométricos en Vitest.
- Pruebas de rendimiento en `scripts/check-performance-budget.mjs`.

# Restricciones

- Mantener los tipos de `SnapCandidate` y `SnapKind` intactos.

# Estrategia de reversión

Restaurar los algoritmos lineales en `src/utils/snapping.ts`.

# Definición de terminado

Propuesta integrada, con pruebas de rendimiento verdes y respuesta fluida verificada.

---

# PROMPT PARA CLAUDE CODE

Lee e implementa la propuesta ubicada en:

`Antigravity-propuestas/aprobadas/AG-002-optimizacion-canvas-rendering-y-snapping.md`

Valida la propuesta contra el código real antes de modificar archivos.

Implementa únicamente el alcance aprobado: optimiza la búsqueda de candidatos de snapping en `src/utils/snapping.ts` mediante filtrado broad-phase/spatial grid sin alterar la firma pública ni los tipos.

CRITERIO DE MEJORA AUTÓNOMA:
- Si al analizar el código real o durante la implementación detectas una oportunidad de mejora directa (técnica, de rendimiento o de calidad de código) que enriquezca la solución sin alterar la lógica de negocio ni romper la frontera matemática, agrégala.
- Si detectas una mejora más compleja que requiera una decisión de arquitectura mayor, no la fuerces; explícala brevemente en el informe final.
- Si la solución de la propuesta ya es óptima y suficiente, implementa estrictamente lo necesario sin añadir complejidad innecesaria ni código superfluo.

Conserva los comportamientos y restricciones indicados en el documento.

Ejecuta lint, tests y build (`npm run verify`).

Al terminar:
- resume los cambios
- lista los archivos modificados
- indica las pruebas ejecutadas
- documenta si aplicaste alguna mejora adicional o te apegaste estrictamente al plan
- actualiza el estado de la propuesta a Implementada
- mueve el documento a `Antigravity-propuestas/implementadas/AG-002-optimizacion-canvas-rendering-y-snapping.md`
