# AG-013

# Generación Diferida (Lazy Loading) y Optimización de Trazas Educativas de Matrices (`educationTrace`)

# Implementada

# 2026-08-05

# Solver / Rendimiento

# Resumen ejecutivo

Propone diferir la generación de la traza de matriz educativa (`educationTrace` en `solver.ts`) para que se ejecute **únicamente a demanda** cuando el usuario abra la pestaña de exploración de matrices ("Aprender" / `ResultTab = 'learn'`) o en el modo Aula. La auditoría empírica realizada en **AG-011** reveló que construir las trazas de las matrices completas de rigidez $K$ y restricciones $C$ en cada ciclo de `analyzeProject` consume entre el **58% y el 64% del tiempo total de análisis** (1.38 segundos de los 2.17 segundos en un modelo de 300 miembros). Diferir esta construcción reducirá instantáneamente el tiempo de cálculo interactivo del lienzo en cerca de un **60%**, pasando de $2.17\text{ s} \to <0.80\text{ s}$ en estructuras grandes sin ninguna alteración visual o de exactitud en los diagramas $N, V, M$.

# Problema

En `src/engine/solver.ts`, las líneas finales de `analyzeProject` generan incondicionalmente el objeto `educationTrace`:
```typescript
const educationTrace: EducationTrace = {
  schemaVersion: 1,
  formulation: ...,
  dofs: ...,
  elements: elementTraces,
  assembly: {
    stiffness: toMatrixTrace(K, dofLabels, dofLabels, 'stiffness'),
    constraintMatrix: toMatrixTrace(C, constraintLabels, dofLabels, 'constraints'),
    ...
  }
};
```
La función `toMatrixTrace` escanea celda a celda matrices cuadradas gigantes de tamaño $\text{ndof} \times \text{ndof}$ (e.g. $980 \times 980$ en 300 vanos), creando objetos de entrada dispersa y filtrando ceros. Esto ocurre en el $100\%$ de las corridas de análisis, aun cuando el usuario solo está arrastrando un nodo o inspeccionando los diagramas de cortante o momento en la pantalla principal.

# Evidencia

- `reports/2026-08-05-1518-ag011-perfilado-analisis-completo.md`: La fase `educationTrace` representa **25.8% (50 miembros)**, **41.0% (150 miembros)** y **63.7% (300 miembros)** del tiempo total de `analyzeProject`.
- `src/engine/solver.ts`: Invocación incondicional de `toMatrixTrace(K, ...)` y `toMatrixTrace(C, ...)` dentro del retorno principal de `analyzeProject`.

# Objetivo

1. Condicionar la construcción pesada de `educationTrace` en `analyzeProject` mediante una opción o flag `includeEducationTrace?: boolean`.
2. Durante las corridas automáticas en el Canvas o cambios de cargas/nodos, ejecutar `analyzeProject` con `includeEducationTrace: false` para respuesta ultra-rápida.
3. Generar `educationTrace` a demanda cuando el usuario haga clic en la pestaña "Aprender / Matriz de Rigidez" o cuando se active la inspección detallada.

# Beneficio esperado

- **Rendimiento**: **Aceleración global inmediata de 2.5x a 3x** en el tiempo de análisis interactivo del lienzo. En modelos de 300 miembros, el tiempo cae de $2,178\text{ ms} \to \sim 800\text{ ms}$.
- **Experiencia de Usuario**: Sensación de respuesta ultra-fluida al editar geometrías medianas y grandes.

# Solución propuesta

1. **Parámetro Opcional en `analyzeProject`**:
   - Agregar el parámetro `options?: { includeEducationTrace?: boolean }` a `analyzeProject` en `src/engine/solver.ts` (con valor por defecto `false` en corridas rápidas).
2. **Generación a Demanda (Lazy Evaluation)**:
   - Exportar un helper en el motor `buildEducationTrace(project, result)` que construya la traza detallada solo cuando la vista educativa la requiera.
3. **Mantenimiento de Paridad**:
   - Garantizar que los diagramas $N, V, M$, reacciones, desplazamientos y fiabilidad sigan funcionando exactamente igual.

# Justificación técnica

El cálculo de la traza de matriz es una representación puramente presentacional/educativa de los pasos de ensamblaje. No afecta el vector de solución $U$ ni las fuerzas internas de las barras. Separar la fase computacional pura de la generación de la traza informativa es el patrón de arquitectura óptimo.

# Impacto en la experiencia del usuario

Respuesta casi instantánea al editar proyectos complejos. Transición fluida y sin latencia en el canvas.

# Impacto en la arquitectura

Optimización interna en `src/engine/solver.ts`. Requiere actualizar la firma de baseline si corresponde y verificar que la pestaña educativa solicite la traza si no está presente en el objeto `AnalysisResult`.

# Complejidad

**Media**. Requiere actualizar la invocación desde `ProjectContext.tsx` / `analysis.worker.ts` y asegurar que la pestaña educativa solicite la traza diferida.

# Prioridad

**CRÍTICA (Máximo impacto de rendimiento comprobado)**.

# Riesgos

- Que la pestaña "Aprender" o "Learn" no muestre la matriz si se olvida generar la traza diferida al abrir ese panel.

# Dependencias

Ninguna nueva dependencia.

# Archivos y módulos probablemente afectados

- `src/engine/solver.ts`
- `src/engine/analysisWorkerProtocol.ts`
- `src/workers/analysis.worker.ts`
- `src/store/ProjectContext.tsx`
- `src/features/results/ResultsPanel.tsx`

# Plan de implementación

## Fase 1: Opción de Carga Diferida en solver.ts
- Permitir omitir `educationTrace` en `analyzeProject` si `options.includeEducationTrace` es `false`.
- Crear `buildEducationTrace` para cálculo diferido.

## Fase 2: Integración en Worker y Store
- Pasar la opción desde el protocolo del worker.
- Generar la traza cuando el usuario navegue a `resultTab === 'learn'`.

## Fase 3: Pruebas y Verificación
- Confirmar reducciones de tiempo en `src/engine/benchmarks.test.ts`.

---

# PROMPT PARA CLAUDE CODE

Lee e implementa la propuesta ubicada en:

`Antigravity-propuestas/aprobadas/AG-013-lazy-loading-trazas-educativas-matrices.md`

Valida la propuesta contra el código real antes de modificar archivos.

Implementa únicamente el alcance aprobado: condicione o difiera la generación pesada de `educationTrace` (`toMatrixTrace` sobre K y C) en `src/engine/solver.ts` para que solo se ejecute a demanda cuando la UI consulte la pestaña educativa ("Aprender").

ATENCIÓN: Si este cambio modifica el baseline protegido de la frontera matemática en `solver.ts`, actualiza el baseline con `node scripts/check-protected-baseline.mjs --update` una vez confirmada la paridad numérica.

CRITERIO DE MEJORA AUTÓNOMA:
- Si al analizar el código real o durante la implementación detectas una oportunidad de mejora directa que enriquezca la solución sin alterar la lógica de negocio ni romper la frontera matemática, agrégala.
- Si la solución de la propuesta ya es óptima y suficiente, implementa estrictamente lo necesario sin añadir complejidad innecesaria.

Conserva los comportamientos y restricciones indicados en el documento.

Ejecuta lint, tests, baseline y build (`npm run verify`).

Al terminar:
- resume los cambios
- presenta las mediciones de tiempo comparativas antes y después del cambio en benchmarks.test.ts
- lista los archivos modificados
- actualiza el estado de la propuesta a Implementada
- mueve el documento a `Antigravity-propuestas/implementadas/AG-013-lazy-loading-trazas-educativas-matrices.md`
