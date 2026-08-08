# Política de verificación numérica de structureCo 0.8.1

## Por qué FTool no forma parte del ciclo diario

FTool es una herramienta gráfica externa de Windows. Requiere intervención manual, no puede
automatizarse de forma reproducible y no puede ejecutarse en integración continua. Usarla en
cada cambio haría la verificación lenta, irrepetible y dependiente de una persona.

La verificación cotidiana la hace una suite determinista propia. FTool queda reservada para
comprobaciones externas puntuales.

## Las tres capas de verificación

### 1. Casos analíticos cerrados

Resultados con solución exacta conocida, comparados contra la fórmula, no contra otra
herramienta. Viven en `src/engine/benchmarks.test.ts`, `hibbelerFrames.test.ts`,
`advancedAnalysis.test.ts` y `connections.test.ts`.

Cubren voladizos con carga puntual y uniforme, viga empotrada-empotrada, carga triangular,
carga parcial, momento concentrado, miembro inclinado, carga por proyección, resorte axial,
vínculo rígido, liberación de extremo, peso propio, rodillo inclinado, asentamiento,
temperatura, curvatura inicial, Timoshenko y conexión semirrígida.

### 2. Invariantes

Relaciones que deben cumplirse sea cual sea el modelo. Un solver puede acertar un benchmark
por casualidad; no puede cumplir homogeneidad, superposición, subdivisión e invariancia de
cuerpo rígido por casualidad.

`src/engine/invariants.test.ts`:

| Invariante | Qué comprueba |
|---|---|
| Homogeneidad | escalar las cargas por `k` escala la respuesta por `k`, para `k` = 0,25 · 2 · 3,5 · 100 |
| Inversión | negar las cargas niega la respuesta, e intercambia el papel de máximo y mínimo |
| Carga nula | anular las cargas anula la respuesta, sin residuo espurio |
| Subdivisión | dividir un miembro en dos colineales conserva reacciones y momento máximo; el nodo introducido no recibe reacción |
| Traslación | trasladar el modelo (hasta 10⁵ m) no cambia reacciones ni esfuerzos |
| Rotación | rotar el modelo rota las reacciones globales y conserva N, V y M locales |
| Giro completo | una rotación de 2π reproduce el modelo original |
| Round-trip | guardar como JSON, normalizar y reabrir reproduce el análisis bit a bit |
| Orden | reordenar nodos, miembros y cargas no cambia el resultado |
| Reproducibilidad | dos ejecuciones dan resultados idénticos |

Además, `loadAudit.test.ts` verifica el equilibrio por dos rutas independientes
(estática global y trabajo virtual), y `formulation.test.ts` comprueba simetría, modos de
cuerpo rígido y conservación de energía en la transformación local-global.

### 3. Comparación externa con FTool

`docs/FTOOL_COMPARISON_MATRIX.md` y `src/engine/ftoolComparison.test.ts` conservan once
casos (`SC-FT-01` … `SC-FT-11`) contrastados contra FTool 4.01. Los archivos `.ftl` y `.pos`
reproducibles están en `docs/`.

**Esos once casos se ejecutaron externamente en su momento y quedan como referencia
congelada. En el programa 0.8.1 no se ejecutó FTool.** La prueba automatizada compara contra
los valores registrados entonces; no vuelve a abrir FTool.

## Cuándo volver a usar FTool

Sólo en estos casos:

1. Un cambio real en el motor o en la formulación.
2. Una discrepancia que los casos analíticos y los invariantes no expliquen.
3. Una certificación especial solicitada expresamente.
4. La incorporación de un tipo de elemento o de carga que la matriz actual no cubra.

En cualquiera de ellos se registra la ejecución en `docs/FTool_RUN_LOG.md` con fecha, versión
de FTool y archivo reproducible. **No se declara ninguna comparación nueva con FTool que no se
haya ejecutado de verdad.**

## Frontera protegida

`node scripts/check-protected-baseline.mjs` verifica 22 archivos fuente de `src/engine/**`,
`src/workers/**`, `src/data/**`, `src/store/ProjectContext.tsx` y `src/types.ts`.

Los archivos de prueba dentro de esas carpetas quedan excluidos a propósito: añadir una prueba
nunca cambia la matemática, y exigir un `--update` por cada prueba nueva acostumbraría a
ejecutarlo, que es justamente como se cuela una modificación real del solver.
