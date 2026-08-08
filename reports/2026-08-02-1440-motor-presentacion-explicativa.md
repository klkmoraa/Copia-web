# Motor — presentación numérica del texto explicativo (cambio autorizado)

- **Agente:** Claude Code (agente principal)
- **Modelo:** Opus 5 (`claude-opus-5`)
- **Fecha:** 2 de agosto de 2026
- **Estado de GitHub:** NO UTILIZADO
- **Autorización:** solicitada en el reporte de S14 y **concedida expresamente por el usuario**
  antes de tocar `src/engine/**`.

## Procedimiento seguido (§31)

1. Prueba mínima escrita **antes** del cambio: `src/engine/explanationPresentation.test.ts`.
2. Entrada, salida real y salida esperada documentadas en la cabecera de esa prueba.
3. Subsistema identificado: `src/engine/solver.ts`, función `explanationSteps`.
4. Detención y solicitud de autorización.
5. Cambio aplicado sólo tras el «autorizo».
6. Baseline protegido actualizado de forma deliberada y verificada.

## Defecto documentado

**Entrada:** viga simple de 8 m con carga uniforme de 12 kN/m; sin acción axial.

**Salida real antes del cambio:**

```
El desplazamiento traslacional máximo fue 1.0377e-21 m
qₑˡ = [-2.93915e-15, 4.80000e+1, 0.00000e+0, 2.93915e-15, 4.80000e+1, 3.55271e-14]ᵀ
```

**Salida esperada:**

```
El desplazamiento traslacional máximo fue 0 m
qₑˡ = [0, 4.80000e+1, 0, 0, 4.80000e+1, 0]ᵀ
```

Ambas cadenas se reproducen **literalmente** en la memoria de cálculo PDF, así que el
documento afirmaba una fuerza axial medible de −2,9·10⁻¹⁵ kN en una viga cargada sólo
transversalmente, y un desplazamiento de 10⁻²¹ m.

## Cambio realizado

Un único helper de presentación en `solver.ts`:

```ts
const explanationValue = (value: number, reference: number, digits = 5): string => {
  if (!Number.isFinite(value)) return 'n/d';
  const scale = Number.isFinite(reference) ? Math.abs(reference) : 0;
  if (value === 0 || (scale > 0 && Math.abs(value) <= 1e-9 * scale)) return '0';
  return value.toExponential(digits);
};
```

Aplicado en **tres** puntos, todos construcción de cadenas:

| Punto | Referencia usada | Motivo |
|---|---|---|
| desplazamiento máximo | tamaño del modelo | un máximo no tiene hermano mayor con quien compararse |
| reacción máxima | magnitud de las acciones aplicadas | ídem |
| vector `qₑˡ` | mayor componente del propio vector | una componente 10⁻¹⁶ veces sus vecinas no es una fuerza pequeña |
| `N` de armadura | reacción máxima del modelo | ídem |

## Garantía de que no cambió ninguna matemática

- `explanationValue` devuelve `string`. TypeScript impide que su resultado alcance ningún
  campo numérico.
- El diff completo consiste en: el helper, dos constantes de escala derivadas de datos de
  entrada, y tres interpolaciones de cadena. **Ninguna operación aritmética sobre resultados.**
- `explanation[].inputs` y `explanation[].outputs` siguen llevando **números en crudo**; una
  prueba comprueba que `outputs['Residuo normalizado'].value === result.residualNorm`.
- Las **22 suites del motor pasan sin tocar una sola tolerancia**: 159 pruebas, incluidas la
  matriz FTool `SC-FT-01…11` (valores externos exactos), los benchmarks analíticos cerrados
  y los 12 invariantes. Si algún valor calculado hubiera cambiado, habrían fallado.
- El diff del baseline protegido contiene **exactamente una línea**: `src/engine/solver.ts`.

## Archivos tocados

| Archivo | Cambio |
|---|---|
| `src/engine/solver.ts` | helper de presentación + 3 puntos de interpolación |
| `src/engine/explanationPresentation.test.ts` | **nuevo**: 7 pruebas (defecto + no regresión numérica) |
| `src/utils/calculationPdfEditorial.test.ts` | se retiran las dos excepciones que ya no hacen falta |
| `docs/releases/0.8.1/PROTECTED_BASELINE.sha256` | actualizado deliberadamente (1 línea) |

## Pruebas ejecutadas

| Comando | Resultado |
|---|---|
| `npx oxlint` | limpio |
| `npm run typecheck` | limpio |
| `npx vitest run src/engine` | 22 archivos, 159 pruebas en verde |
| `npx vitest run` | **78 archivos, 528 pruebas, todas en verde** (49,9 s) |
| `npm run build` | correcto |
| `node scripts/check-protected-baseline.mjs` | 22 archivos verificados |

Delta: 521 → 528 pruebas (**+7**).

## Evidencia en el documento real

PDF regenerado e inspeccionado con `node scripts/inspect-pdf.mjs`:

```
desplazamiento traslacional máximo fue 0 m
```

El barrido de exponentes ≤ 10⁻¹² sobre las 10 páginas **no encuentra ninguno** fuera de las
cifras de residuo y precisión. Hallazgos del inspector editorial: **0**.

La prueba `calculationPdfEditorial.test.ts` ya no necesita excepciones: la afirmación cubre
ahora el documento completo. Lo que era una limitación documentada es ahora una garantía
comprobada.

## Riesgos

- El umbral relativo es 10⁻⁹ de la referencia, el mismo que ya usaba `clearNumber` en el PDF.
  Un resultado legítimo que fuera mil millones de veces menor que su referencia se leería como
  cero en el **texto explicativo**; seguiría apareciendo con toda su precisión en tablas,
  diagramas, CSV, JSON y el expediente portable.

## Limitaciones

- Sin capturas: el panel del navegador no compone frames en esta sesión.

## Siguiente paso

S05–S08: canvas, inspector, resultados y Aula.

## Commit local

`fix(engine): stop publishing floating-point noise as engineering quantities`
