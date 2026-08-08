# S11 — Política numérica

- **Agente:** Claude Code (agente principal)
- **Modelo:** Opus 5 (`claude-opus-5`)
- **Fecha:** 2 de agosto de 2026
- **Estado de GitHub:** NO UTILIZADO

## Objetivo

Una sola política de presentación numérica para toda la aplicación, los documentos y las
exportaciones, sin reducir la precisión interna.

## Hallazgos

### 1. Cinco formateadores con umbrales incompatibles

| Origen | Umbral científico | Dígitos | `-0` | No finito |
|---|---|---|---|---|
| `features/inspector/numericFormatting.ts` | `1e-4` / `1e7` | 6 sig. | sí | `—` |
| `features/results/resultFormatting.ts` | `1e-4` / `1e7` | 6 sig., mantisa sin recortar | sí | `—` |
| `utils/resultsExport.ts` (`csvNumber`) | — | 15 sig. | sí | `''` |
| `utils/calculationPdf.ts` (`number`) | `1e-5` / `1e7` | 6 sig. | parcial | `n/d` |
| `utils/calculationPdf.ts` (`clearNumber`) | `1e-4` / `1e8` | 5 sig. | sí | `n/d` |

Consecuencia comprobable: el mismo valor almacenado `1e-14` se leía **`1e-14` en el Inspector
y `1.0000e-14` en Resultados**; y un valor de `5e-5` entraba en notación científica en la
interfaz pero no en el PDF, porque el PDF usaba `1e-5` como frontera.

### 2. `-0.000` y `NaN` llegaban a la pantalla

51 llamadas directas a `.toFixed(n)` en `StructuralCanvas.tsx`, 15 en `ResultsPanel.tsx` y
5 en `InfluenceLineView.tsx` formateaban **valores de ingeniería**: reacciones `Rx`/`Ry`/`Mᵣ`,
fuerzas de corte `N`/`V`/`M`, cargas y coordenadas.

`(-0.0004).toFixed(3)` es `"-0.000"`. Un cortante que cruza cero produce exactamente eso, y se
imprimía tanto en el canvas como en las etiquetas `aria-label`. `Number.NaN.toFixed(3)` es
`"NaN"`, que también llegaba tal cual.

### 3. `toPrecision` y `toExponential` sueltos

38 llamadas más en resultados, influencia y matrices, cada una con su propio criterio de
dígitos y sin tratamiento de valores no finitos.

## Decisiones

- `src/utils/numberFormat.ts` es ahora la **única** política. Tres invariantes valen para todos
  los contextos: la presentación nunca vuelve al modelo; ausencia, error y cero permanecen
  distinguibles; `-0` se lee `0`.
- Ocho contextos declarados (`canvas`, `chart`, `inspector`, `table`, `tooltip`, `report`,
  `annex`, `clipboard`). Los dígitos crecen con el espacio y la atención que tiene la
  superficie; la ventana científica se ensancha con los dígitos.
- Resultados adopta la regla del Inspector. Se actualizó `resultFormatting.test.ts` con la
  justificación: la variante anterior rellenaba la mantisa y no era mejor, sólo distinta.
- El PDF adopta la misma frontera que la interfaz. `number` y `clearNumber` sobreviven como
  envoltorios finos sobre `formatNumber` y `formatNearZero`.
- Se añadió `formatFixed`, que conserva la alineación de columna que el producto ya usaba,
  pero normaliza `-0` y los valores no finitos.
- `src/utils/numericPolicy.test.ts` recorre `features/`, `design-system/` y `education/` y
  **falla el build** si reaparece un `toFixed`, `toPrecision` o `toExponential` crudo. No es
  documentación: es una puerta.

## Archivos tocados

| Archivo | Cambio |
|---|---|
| `src/utils/numberFormat.ts` | **nuevo**: política única, 8 contextos, 7 funciones |
| `src/utils/numberFormat.test.ts` | **nuevo**: 23 pruebas, incluida la tabla de valores del §15 |
| `src/utils/numericPolicy.test.ts` | **nuevo**: 4 pruebas de guardia sobre el árbol de presentación |
| `src/features/inspector/numericFormatting.ts` | delega en la política; comportamiento idéntico |
| `src/features/results/resultFormatting.ts` | delega; adopta la regla del Inspector |
| `src/features/results/resultFormatting.test.ts` | prueba la paridad con el Inspector |
| `src/features/canvas/StructuralCanvas.tsx` | 58 llamadas migradas |
| `src/features/results/ResultsPanel.tsx` | 40 llamadas migradas |
| `src/features/results/InfluenceLineView.tsx` | 9 llamadas migradas |
| `src/features/results/ResultSummary.tsx` | 2 llamadas migradas |
| `src/features/canvas/CanvasChrome.tsx` | 1 llamada migrada |
| `src/features/import-export/ImportCenterDialog.tsx` | 2 llamadas migradas |
| `src/features/import-export/portableImportAdapter.ts` | 1 llamada migrada |
| `src/utils/resultsExport.ts` | `csvNumber` delega en `formatMachineNumber` |
| `src/utils/calculationPdf.ts` | `number`/`clearNumber` delegan en la política |
| `.claude/launch.json` | apuntaba a la copia `structureCo/`; ahora al proyecto real |

## Archivos protegidos comprobados

`node scripts/check-protected-baseline.mjs` → «Frontera protegida intacta: 45 archivos verificados.»
La migración es exclusivamente de presentación: ningún archivo del motor cambió.

## Pruebas ejecutadas

| Comando | Resultado |
|---|---|
| `npx oxlint` | limpio |
| `npm run typecheck` | limpio |
| `npx vitest run` | **71 archivos, 467 pruebas, todas en verde** (49,8 s) |
| `npm run build` | correcto |

Delta: 69 → 71 archivos, 439 → 467 pruebas (**+28**).

## Evidencia funcional

Servidor de desarrollo en `http://localhost:5173`, ejemplo de viga con carga distribuida y
carga puntual, análisis ejecutado. Lecturas comprobadas en la aplicación real:

- Canvas: `w = 5.00 kN/m`, `P = 20.00 kN`, `8.000 m`, `Ry = 32.500 kN`, `Ry = 27.500 kN`
- Tabla de reacciones: `32.5`, `27.5`, `-1.68389e-15`
- Diagrama de cortante: máx. `32.500 kN`, mín. `-27.500 kN`; críticos `32.50 / 17.50 / -2.50 / -27.50`;
  marcas del eje `0.00 … 8.00`
- Estado sin cursor: `X — · Y — m` (marcador de ausencia, no `0`)
- Consola del navegador: **sin errores**

No aparece ningún `-0.00`, `NaN` ni `Infinity` en ninguna superficie inspeccionada.

## Riesgos

- La migración tocó 113 puntos de formateo. Está cubierta por typecheck, lint, 467 pruebas y
  verificación funcional en el navegador, pero conviene revisarla visualmente en S17 en móvil
  y en tema oscuro.

## Limitaciones

- **No se pudieron tomar capturas de pantalla:** el panel del navegador no está visible en esta
  sesión, así que no compone frames. La verificación fue textual (árbol de accesibilidad y texto
  de página), que es evidencia real pero no visual. Las capturas se generarán con Playwright en S17.

## Pendientes

- La tabla de reacciones muestra ruido numérico a precisión completa: `Ux = -7.70372e-37 m`.
  Es cero físico. `formatNearZero` ya existe para colapsarlo, pero elegir la referencia por
  cantidad (¿respecto al máximo desplazamiento del modelo? ¿respecto a la tolerancia del
  solver?) es una decisión de producto que corresponde a S07, no a una migración de formato.
  **No se cambió silenciosamente.**
- Falta migrar el PDF a los contextos `report`/`annex` diferenciados (S14).

## Siguiente paso

S12 — SVG: `exportSvgElement` serializa el SVG vivo sin resolver ni las clases CSS ni las
variables `var(--force)`, `var(--shear)`, `var(--axial)`, por lo que el archivo exportado no
puede reproducir los colores del producto.

## Commit local

`refactor(results): centralize numeric presentation`
