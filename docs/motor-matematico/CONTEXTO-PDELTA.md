# Contexto: análisis P-Delta (segundo orden)

Sesión del 2026-08-03 · rama `main` · versión `0.8.2` · **sin push**

## Alcance

Nuevo modo opcional de análisis elástico de **segundo orden geométrico (P-Delta)**
para pórticos 2D, seleccionable junto al primer orden (que sigue siendo el
modo por defecto, sin cambios). Excluido explícitamente, como se pidió: material
no lineal, plasticidad, dinámica, grandes deformaciones, placas/cascarones, 3D.

## Formulación implementada

- **Rigidez geométrica**: matriz consistente estándar viga-columna 6×6 (`src/engine/solver.ts`,
  `geometricStiffness(L, N)`), local `[ui,vi,θi,uj,vj,θj]`, filas/columnas axiales
  en cero. `N` seguido tensión-positivo (la convención ya existente del motor).
  Solo se aplica a miembros `frame` (no `truss`, no `rigid` — decisión documentada
  como limitación, ver abajo).
- **Matriz tangente**: `K_total = K_elástica + K_geométrica(N)`, ensamblada e
  invertida con el **mismo** sistema KKT/restricciones/escalamiento/factorización/
  refinamiento existente — cero solucionadores nuevos, cero inversa explícita.
- **Iteración**: punto fijo (aproximación sucesiva) sobre `N`: se resuelve con la
  `N` de la iteración anterior, se extrae la nueva `N` de `localEndForces`
  (promedio de los dos extremos, por si el miembro tiene carga axial distribuida),
  se repite hasta convergencia.
- **Aplicación incremental de carga**: adaptativa — cada intento primero prueba
  llegar a la combinación completa (`λ=1`) en un solo paso; solo subdivide
  cuando una iteración falla o se detecta inestabilidad, reduciendo `λ` por
  `stepReductionFactor` hasta `minimumStep`.
- **Detección de pérdida de estabilidad** (revisada en la fase 2, ver abajo):
  1. *Criterio de rechazo.* Inversión de signo del **GDL que más cambia** por
     efecto de segundo orden. Por encima de la crítica el sistema deja de ser
     positivo-definido y puede converger a un punto fijo autoconsistente pero
     físicamente absurdo — una carga lateral hacia la derecha produce un
     desplazamiento hacia la izquierda. Medirlo sobre el GDL gobernante y no
     sobre el vector completo es lo que lo hace fiable en columnas robustas,
     donde el acortamiento axial enmascara la flecha.
  2. *Estimación de aviso.* Factor de carga crítica elástica mediante la
     relación de diseño `B₂ = 1/(1 − 1/λ)` aplicada a la amplificación. Es una
     estimación etiquetada como tal, **no** un análisis de valores propios.

## Fallo silencioso encontrado y corregido en el camino

Al inyectar rigidez geométrica, la auditoría de "equilibrio global no cierra"
del motor (que sirve para primer orden) empezó a rechazar **todo** resultado
P-Delta con efecto real: esa auditoría suma momentos usando la geometría
**sin deformar**, y un análisis P-Delta correctamente convergido conserva un
momento adicional P·Δ que esa contabilidad de primer orden nunca esperó ver.
Se corrigió en `solver.ts` (el residuo se reporta como `info`, no `error`,
cuando la rigidez geométrica está activa) y en `reliability.ts` (los checks
`equilibrium`/`load-audit`/`diagram-closure`/`compatibility` se marcan "no
aplicable" para un resultado P-Delta, reemplazados por un nuevo check
`p-delta-convergence` que sí entiende la proximidad a pandeo). Sin este
arreglo, P-Delta habría rechazado prácticamente cualquier caso con
compresión real — se descubrió con las pruebas, no se dedujo de antemano.

## Benchmarks (referencia analítica independiente)

Cantiléver fijo-libre, L=4 m, E=200 000 000 kN/m², I=8×10⁻⁵ m⁴ (EI=16 000 kN·m²),
H=10 kN lateral en la punta. Solución cerrada viga-columna: `δ = H(tan(kL)−kL)/(Pk)`,
`k=√(P/EI)`; `Pcr` exacta (fijo-libre) = 2467.40 kN. Deducida independientemente
por un subagente y auto-verificada (recupera el primer orden en `P→0`, coincide
con el factor de amplificación B1 de Timoshenko/AISC dentro de 0.7 %).

| P/Pcr | structureCo (m) | Exacta (m) | Diferencia | Conclusión |
| --- | --- | --- | --- | --- |
| 0 | 0.013333 | 0.013333 | 0.00 % | coincide exactamente con primer orden |
| 0.1 | 0.014794 | 0.014795 | 0.01 % | dentro de tolerancia |
| 0.5 | 0.026392 | 0.026484 | 0.35 % | dentro de tolerancia |
| 0.9 | 0.124265 | 0.131616 | 5.59 % | error crece cerca de la crítica (ver limitación) |

Tensión axial T=0.5·Pcr (misma columna): structureCo=0.008935 m, exacta=0.008944 m,
diferencia 0.10 % — confirma que la tensión **reduce** el desplazamiento en vez
de amplificarlo, sin ningún caso especial en el código (el signo de `N` en la
matriz geométrica ya lo resuelve).

Por encima de la crítica (P=1.2·Pcr): `success=false`,
`pDelta.converged=false`, rechazado con
`pdelta-not-converged` en vez de devolver un número — requisito cumplido.

**Nota honesta sobre la exactitud cerca de la crítica**: el error crece con
P/Pcr (0.01 %→5.6 % entre 0.1 y 0.9) porque la rigidez geométrica de UN solo
elemento por columna estima su propia carga crítica ~0.7 % por encima de la
exacta (verificado a mano resolviendo el problema de autovalores 2×2 reducido
del elemento). Es la limitación conocida y documentada de este método
(consistente con la literatura de análisis matricial), no un error de signo o
de ensamblaje — mitigable subdividiendo columnas críticas en varios elementos,
que el motor ya soporta sin cambios (cada elemento recibe su propia N).

## Pruebas ejecutadas

`src/engine/pDelta.test.ts` — 17 pruebas dirigidas, escritas primero (fallaron
contra la implementación incompleta antes de cada arreglo), cubriendo los 15
requisitos pedidos: coincidencia sin fuerza axial, acercamiento con compresión
pequeña, amplificación creciente, tensión no amplifica, voladizo con carga
axial+lateral, pórtico simple con cargas gravitacionales y laterales,
convergencia estable ante distintas políticas de paso, reducción automática de
paso, caso cercano a la crítica, rechazo por encima de la crítica, conservación
de equilibrio (residuo algebraico) y de restricciones, compatibilidad de
primer orden sin cambios, determinismo. Más `geometricStiffness` (matriz
verificada término a término).

## Resultado de la verificación

```bash
npm run typecheck && npm run lint && npm run verify:protected && npm test && npm run build
```

| Comprobación | Resultado |
| --- | --- |
| typecheck | ✅ |
| lint (oxlint) | ✅ |
| verify:protected | ✅ 26 archivos (línea base refrescada — expansión autorizada) |
| suite completa | ✅ **86 archivos / 600 pruebas** tras la revisión independiente (línea base de la sesión anterior: 85/578; primera pasada de esta sesión: 86/595) |
| build | ✅ |

Verificación manual en navegador (dev server propio):
- Ejemplo "Pórtico de ejemplo" (6×4 m), modo P-Delta → **"Convergió · 1 pasos de
  carga · 4 iteraciones · Amplificación ×1.034 respecto a primer orden"**, sin
  errores en consola.
- Mismo modelo en primer orden → sin bloque P-Delta (correcto, no se muestra
  cuando no aplica).
- Selector "Orden del análisis" y configuración avanzada plegable (6 campos:
  pasos máximos, iteraciones máximas, tolerancias de equilibrio/desplazamiento,
  factor de reducción, paso mínimo) verificados interactivamente — edición
  persiste en `project.settings.pDeltaConfig`.

## Archivos principales modificados

| Archivo | Cambio |
| --- | --- |
| `src/engine/pDelta.ts` | Nuevo · orquestación P-Delta completa |
| `src/engine/pDelta.test.ts` | Nuevo · 17 pruebas dirigidas |
| `src/engine/solver.ts` | `geometricStiffness`, inyección vía `options.pDeltaAxialForces`, ajuste del check de equilibrio global bajo P-Delta |
| `src/engine/reliability.ts` | Nuevo check `p-delta-convergence`; los checks de primer orden se marcan no aplicables bajo P-Delta |
| `src/engine/reliability.test.ts` | Actualizado con el nuevo id de check |
| `src/engine/projectSignature.ts` | Incluye `analysisMode`/`pDeltaConfig` en la firma |
| `src/engine/analysisWorkerProtocol.ts`, `src/store/ProjectContext.tsx` | Usan `analyzeProjectAuto` (despacha por `analysisMode`) |
| `src/types.ts` | `PDeltaConfig`, `PDeltaDiagnostics`, `PDeltaStepIteration`; `ProjectSettings.analysisMode`/`pDeltaConfig`; `AnalysisResult.pDelta` |
| `src/features/topbar/TopBar.tsx` | Selector primer orden/P-Delta + configuración avanzada plegable |
| `src/features/results/ResultSummary.tsx` | Bloque de estado P-Delta (convergencia, iteraciones, amplificación, advertencia) |
| `src/i18n/catalogs.ts` | Claves `analysis.order*`, `pdelta.*` (es/en) |

## Commits locales

```
a178a9f chore(release): refrescar la línea base protegida tras la ampliación P-Delta
e0199e7 feat(ui): agregar selector de orden de análisis y diagnóstico P-Delta
b3e1e0c feat(engine): implementar análisis P-Delta de segundo orden para pórticos 2D
```

## Limitaciones reales

- **Exactitud con un elemento por miembro.** El error crece con `P/Pcr`:
  −0.35 % a 0.5, −5.6 % a 0.9, −11.7 % a 0.95, y es **siempre por defecto** (la
  Kg consistente sobre-rigidiza). Dos elementos por miembro comprimido lo
  reducen a −0.41 % a 0.9·Pcr y cuatro a −0.026 %. La interfaz avisa de esta
  sensibilidad cuando la carga se acerca a la crítica.
- **El factor de carga crítica es una estimación**, derivada de la
  amplificación mediante `B₂`. Supone un modo de pandeo dominante y hereda el
  sesgo de discretización (+0.75 % con un elemento). No es un análisis de
  valores propios y no debe citarse como carga crítica calculada. Un modo de
  pandeo esencialmente ortogonal al patrón de cargas no se detecta.
- **Rigidez geométrica solo en miembros `frame`.** Los `truss` y `rigid` no la
  reciben; un `truss` no tiene GDL transversales sobre los que actuar.
- **Envolventes y líneas de influencia** siguen siendo de primer orden.
- **Timoshenko**: el término geométrico usa la formulación Euler-Bernoulli
  aunque el miembro declare `beamTheory: 'timoshenko'` — una corrección de
  segundo orden sobre un efecto de segundo orden.
- **No es análisis de grandes desplazamientos.** La geometría del elemento
  (`c`, `s`, `L`) se calcula una sola vez sobre la configuración indeformada.
  Válido mientras las rotaciones sean pequeñas (`θ ≲ 1/50`).
- **Mensajes del motor en español**, como el resto de `ValidationIssue`. Lo que
  se muestra en la interfaz sí está traducido (es/en).

## Revisión independiente (subagente) y hallazgos reales corregidos

Se usó el tercer subagente previsto en el plan original (revisión adversarial
del diff completo, sin contexto de la sesión). Encontró 5 hallazgos; 4 eran
reales y se corrigieron, uno quedó documentado como limitación no confirmada:

1. **(Bloqueante, corregido)** `analyzeProject` sella `reliability` en el
   resultado *antes* de que `pDelta` exista en el objeto, así que todo
   resultado P-Delta real leía como `unreliable` por el mismo residuo de
   equilibrio de primer orden que ya se había relajado en `solver.ts` — el
   arreglo de `reliability.ts` de esta sesión nunca se activaba. Se corrigió
   recalculando `reliability` en `pDelta.ts` después de adjuntar `pDelta`.
2. **(Bloqueante, corregido)** `respondsAgainstFirstOrder` rechazaba cualquier
   modelo con desplazamiento nulo en ambos vectores (producto punto = 0 ≤ 0)
   — es decir, **cualquier modelo completamente restringido o sin carga**,
   el estado exacto en que está un proyecto recién cambiado a P-Delta. Se
   corrigió con una guarda de magnitud (si el vector de referencia de primer
   orden es ~0, el chequeo no aplica) y, adicionalmente, usando como
   referencia el primer orden de *cada paso de carga* en vez de uno fijo en
   λ=1 (evita también la premisa rota de que la dirección de primer orden es
   independiente de λ cuando hay asentamientos absolutos).
3. **(Corregido)** El umbral absoluto de `conditionEstimate > 1e10` para la
   advertencia de estabilidad nunca se activaba en la práctica — medido: solo
   ~1.4×10⁶ incluso a 0.99·Pcr. Se reemplazó por la razón contra la condición
   de primer orden del mismo modelo (`> 20`), calibrada empíricamente
   (razón≈1 lejos de la crítica, ≈100+ cerca de ella).
4. **(Corregido)** `pDeltaActive` en `solver.ts` era verdadero para un `Map`
   vacío (proyecto sin miembros `frame`), relajando checks de equilibrio que
   no tenían nada que ver con P-Delta. Ahora exige `.size > 0`.
5. **(No confirmado, no instanciado)** Posible interacción entre
   asentamientos prescritos por caso de carga y el escalado por λ — mitigada
   como efecto colateral del punto 2 (referencia de primer orden por paso),
   no se construyó un caso de prueba dedicado.

5 pruebas nuevas en `pDelta.test.ts` (sección "hallazgos de la revisión
independiente") demuestran cada corrección con un caso que fallaba antes del
arreglo. Suite completa tras los arreglos: **86 archivos / 600 pruebas**
(22 en `pDelta.test.ts`, antes 17).

## Fase 2 — endurecimiento, validación y verificación matemática

Segunda pasada dedicada a corregir, validar y pulir la capacidad ya integrada.
La formulación no cambió; cambiaron los criterios, la detección de
inestabilidad, la validación y la honestidad de lo que se afirma.

### Verificación matemática de la formulación (sin cambios necesarios)

Dos revisiones independientes con cálculo numérico propio confirmaron, sin
tocar el código:

- `geometricStiffness(L, N)` coincide **término a término y hasta el redondeo**
  (máx. 7.1e-15) con la matriz de rigidez geométrica consistente de
  Przemieniecki, *Theory of Matrix Structural Analysis*, §5.11 — la misma que
  publican McGuire/Gallagher/Ziemian cap. 9 y Cook/Malkus/Plesha §18.3. Las tres
  fuentes la escriben con **N positivo en tensión y suma `K = Ke + Kg`**, que es
  exactamente la convención del motor: no hace falta ningún cambio de signo.
- Las filas/columnas axiales nulas son correctas **por derivación**, no por
  truncamiento: la energía de segundo orden `U₂ = (N/2)∫(v′)²dx` no contiene `u`.
- El sesgo de un elemento por miembro es **+0.7522 %** en la carga crítica,
  resuelto a mano desde el problema de valores propios 2×2 reducido:
  `P_cr,1elem = (52 − 8√31)/3 · EI/L² = 2.4859617 EI/L²` frente a
  `π²/4 = 2.4674011`. Reproduce el resultado clásico de libro de texto.
- La convergencia espacial es **O(h⁴)** (error ÷16 al duplicar la malla),
  verificada hasta 32 elementos: razones 14.69, 15.63, 15.90, 15.98, 16.03.
- Corrección a lo que este documento afirmaba antes: la Kg **consistente**
  captura **P-Δ y P-δ**, no solo P-Δ. La forma «lumped» que usa el método
  clásico de cargas laterales ficticias da +21.6 % con un elemento y converge
  solo O(h²); la consistente da +0.75 % con uno. El software puede afirmar más
  de lo que afirmaba.
- Corrección a lo que se creía de la iteración: su razón de contracción medida
  es **0.0005–0.026** hasta 0.95·Pcr, no `P/Pcr`. La amplificación se captura
  exacta *dentro* de cada resolución lineal; el bucle externo solo resuelve la
  realimentación débil `N(u)`. La convergencia no se degrada cerca de la
  crítica — solo la **exactitud**.

### Defectos reales encontrados y corregidos

| # | Defecto | Evidencia medida |
| --- | --- | --- |
| 1 | Convergencia falsa por un piso absoluto `max(1, ‖x‖)` en unidades base | Modelo rígido con ‖u‖≈1e-6 m: un cambio **real del 1 %** se reportaba como 2.3e-8 y pasaba una tolerancia de 1e-6 |
| 2 | Configuración sin validar en el motor | `maxIterationsPerStep: Infinity` dejaba el bucle interno girando indefinidamente |
| 3 | Estados post-críticos aceptados como éxito | A 3·Pcr y 5·Pcr el desplazamiento lateral estaba invertido y el motor devolvía éxito |
| 4 | Heurística de condición κ₁ > 20 fallando en ambos sentidos | No avisaba a 0.90·Pcr (9.7) ni a 0.95 (19.3); **ciega** por encima de la crítica, donde la razón *baja* a 0.43 a 3·Pcr |
| 5 | Amplificación engañosa | Columna rígida: se reportaba ×1.0000 con la flecha realmente duplicada (×1.9794), porque el acortamiento axial dominaba `max|u|` |
| 6 | Coste desproporcionado | Pórtico de 77 nodos: 3360 ms frente a 83 ms de primer orden (**40.6×**) |
| 7 | Detección post-crítica ciega para columnas robustas | L/r ≈ 22 a 10·Pcr: proyección 0.9999996 con la flecha invertida → aceptado |
| 8 | Compuerta por «fuerza axial gobernante» | Un tirante con mayor \|N\| **ocultaba** pandeo real y **abortaba** análisis válidos |
| 9 | Bisección saltando al segundo punto crítico | Predicado no monótono (90.2, −25.3, −0.48, **+1.50**, +33.9, −8.6): pórtico al 91 % de pandeo reportado con λ_cr = 2.01 y sin aviso |
| 10 | «Tercer criterio» vacío | `residualNorm` mide 1e-18…1e-16, nueve órdenes bajo su límite de 1e-7: nunca podía fallar |
| 11 | Topes de configuración insuficientes | 200 × 500 = 100 000 resoluciones (~6 h) pasaba la validación campo a campo |
| 12 | Modo P-Delta no persistía | `normalizeProject` descartaba `analysisMode` y `pDeltaConfig`; al recargar todo volvía a primer orden y el autoguardado consolidaba la pérdida |

### Decisiones finales

- **Criterios de convergencia.** Referencia tomada del propio modelo (la
  respuesta de primer orden del paso), no de una constante en unidades base;
  un modelo sin escala reporta 0 en vez de inventarse un piso. El residuo
  algebraico se publica **por trazabilidad, no como criterio**, con la razón
  documentada.
- **Detección post-crítica.** Se aplica al GDL que **más cambia** por efecto de
  segundo orden, `argmax|u₂−u₁|`, que por construcción es sobre el que actúa la
  rigidez geométrica. Ni una medida global (dominada por el GDL más grande, que
  no es el que pandea) ni «cualquier GDL invertido» (demasiado estricto: los
  efectos de segundo orden redistribuyen legítimamente) sirven. Sin compuerta
  tensión/compresión: la tensión pura nunca invierte nada.
- **Factor de carga crítica.** Relación de diseño `B₂ = 1/(1 − 1/λ)` aplicada a
  la amplificación. Coincide con la bisección dentro del **0.5 %** en todo el
  rango medido, es gratuita y **no puede saltar de modo**. Es una **estimación**
  —supone un modo dominante y hereda el sesgo de discretización del 0.75 %— y
  así se etiqueta en la interfaz, en español y en inglés.
- **Clasificación.** Criterio matemático: la inversión de signo del GDL
  gobernante (rechazo). Estimación: el factor de carga crítica (aviso, que
  además degrada la confiabilidad a `limited`). Ninguna heurística se presenta
  como carga crítica exacta ni como análisis de valores propios.

### Estudio de discretización (medido)

Voladizo L=4 m, EI=16000 kN·m², H=10 kN, contra la solución cerrada
`δ = H(tan kL − kL)/(Pk)`:

| P/Pcr | 1 elem. | 2 elem. | 4 elem. | 8 elem. | orden |
| --- | --- | --- | --- | --- | --- |
| 0.5 | −0.345 % | −0.025 % | −0.0016 % | −0.0001 % | ~4.0 |
| 0.9 | −5.59 % | −0.411 % | −0.026 % | −0.0017 % | ~4.0 |

El error es **de un solo signo**: la Kg consistente siempre sobre-rigidiza, así
que el motor queda siempre por debajo del valor exacto. Las pruebas lo asertan
de forma asimétrica, porque una cota simétrica dejaría pasar una Kg demasiado
blanda. **Dos elementos por miembro comprimido eliminan prácticamente la
limitación**; cuatro la dejan en ~0.03 % incluso a 0.9·Pcr.

### Rendimiento (medido)

Pórticos regulares con carga gravitatoria y lateral, tiempo de P-Delta frente
al de primer orden en el mismo modelo:

| Modelo | Nodos | Miembros | Primer orden | P-Delta | Razón |
| --- | --- | --- | --- | --- | --- |
| 1×1 | 4 | 3 | 35 ms | 26 ms | 0.7× |
| 3×2 | 12 | 15 | 14 ms | 41 ms | 2.9× |
| 6×4 | 35 | 54 | 42 ms | 180 ms | 4.3× |
| 10×6 | 77 | 130 | 132 ms | 505 ms | 3.8× |

Antes del cribado analítico el caso 10×6 costaba 3360 ms (40.6×). Hay una
prueba de presupuesto (< 15×) para que no vuelva a degradarse.

### Compatibilidad verificada

Asentamientos prescritos (convergencia con carga axial y lateral, resultado
final independiente del número de pasos de carga, asentamiento no amplificado),
miembros inclinados (invariancia bajo rotación a 30°, 90° y 210°), invariancia
por traslación, invariancia de escala del criterio de convergencia, modelos sin
miembros `frame`, modelos totalmente restringidos y sin carga, y mezclas de
tensión y compresión en el mismo modelo.

## Instrucciones para que Codex revise el trabajo

1. Punto de entrada único: `analyzeProjectPDelta` en `src/engine/pDelta.ts`.
   Revisar primero `geometricStiffness` en `solver.ts` (la única fórmula
   matemática nueva) contra cualquier referencia de análisis matricial
   (Przemieniecki, McGuire/Gallagher/Ziemian) — es la matriz consistente
   estándar, sin variaciones.
2. El punto más delicado del cambio es el ajuste a `global-equilibrium` en
   `solver.ts` y a los checks de `reliability.ts`: confirmar que **solo**
   se relajan cuando `options.pDeltaAxialForces`/`result.pDelta?.enabled` es
   verdadero — un análisis de primer orden ordinario no debe verse afectado
   (cubierto por el requisito 14, "compatibilidad del modo de primer orden
   existente", que compara dos corridas de `analyzeProject` sin la opción y
   exige igualdad exacta).
3. `respondsAgainstFirstOrder` en `pDelta.ts` es el chequeo de estabilidad
   más importante del PR — sin él, el motor converge silenciosamente a
   soluciones post-pandeo con el desplazamiento invertido de signo (se
   verificó manualmente antes de implementarlo, ver arriba). Revisar que el
   producto punto se calcula contra el vector de primer orden correcto.
4. Ejecutar `npm run verify` completo; no se tocó ninguna otra parte del
   motor de primer orden salvo lo listado arriba.

**No se hizo push.** Todos los cambios de esta sesión están commiteados
localmente en `main`, pendientes de confirmación explícita del usuario para
subir a GitHub.
