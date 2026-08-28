# Reporte de entrega: métodos de resolución — Hardy Cross (distribución de momentos)

**Clasificación:** `AUDIT/TEMPORARY`
**Rama:** `claude/next-analysis-method-4f2j07`
**Commits:** ver el commit que acompaña este reporte

---

## 1. Qué se pidió

Seguir con el siguiente método de la lista tras Castigliano para armaduras
(`reports/2026-08-28-1330-metodo-castigliano-armaduras.md`).

## 2. Por qué éste: la misma respuesta que Tres Momentos, por un camino de verdad distinto

El Teorema de los Tres Momentos resuelve el momento en cada apoyo interior planteando un sistema
de ecuaciones simultáneas. Hardy Cross llega exactamente al mismo número sin resolver ningún
sistema: cada vano se empotra en imaginación en sus dos extremos, se calcula el momento que
desarrollaría así bajo sus propias cargas —el momento de empotramiento perfecto—, y cada apoyo
interior reparte su desequilibrio entre los vanos que concurren en él, en proporción a la rigidez
relativa de cada uno, transmitiendo la mitad de lo repartido al extremo lejano. Repetido apoyo por
apoyo, el desequilibrio se hace cada vez más pequeño hasta desaparecer.

Es, con Tres Momentos, el sexto y séptimo método de esta serie que resuelven de verdad — pero el
primero cuyo procedimiento no es "plantear y resolver algo", sino "iterar hasta que converja". Esa
diferencia de naturaleza es la razón de ofrecerlo junto a Tres Momentos y no en su lugar: los dos
se contrastan entre sí, no sólo contra el solver.

Igual que en las entregas anteriores, ningún tramo se resuelve a mano ni de memoria: el momento de
empotramiento perfecto de cada vano sale de `analyzeProject` sobre una aislación del vano con sus
dos extremos empotrados de verdad — la misma técnica de aislar-y-resolver que ya usa
`threeMoment.ts` para su propio "momento libre", aplicada aquí a una idealización distinta.

## 3. Un defecto real, y por qué el contraste contra otro método (no sólo contra el solver) lo cazó

La modificación estándar de Hardy Cross para el extremo simple de una viga —"libera el momento de
empotramiento del extremo exterior de una vez, transmitiendo la mitad al apoyo vecino"— tiene una
trampa: lo que se transmite no es la mitad del momento de empotramiento original, sino la mitad de
la **corrección** que lo cancela (su negativo). La primera versión de este módulo usaba el
momento original directamente, sin negarlo. En el tramo de dos vanos iguales bajo carga uniforme
—simétrico, así que el reparto en el apoyo central da desequilibrio cero desde el principio y
**ninguna** iteración corrige nada— ese error nunca se manifestaba a través del reparto normal:
el resultado salía mal por un factor de −3 exacto, silenciosamente, sin que ninguna pasada de
iteración lo delatara.

Lo que lo cazó fue la propia prueba del caso cerrado (`M = −wL²/8`, el mismo cierre analítico que
ya valida `threeMoment.test.ts`) — y quedó confirmado, no sólo corregido a ciegas, comparando
contra una simulación completa sin el atajo (tratando los dos extremos simples como nudos
genuinos, con factor de reparto 1, e iterando de verdad) hasta que ambos caminos coincidieron en
el mismo número.

## 4. La arquitectura

| Módulo nuevo | Qué hace |
|---|---|
| `src/analysis-methods/hardyCross.ts` | El método. Reutiliza `beamAxis.ts` y `polynomialAlgebra.ts` sin cambios, y el mismo patrón de aislar-un-vano de `threeMoment.ts` (duplicado localmente, parametrizado por el tipo de extremo idealizado: simple para el momento libre, empotrado para el momento de empotramiento perfecto). |

`solveHardyCross` no re-deriva la estática de ningún vano: cada aislación se resuelve con
`analyzeProject`. **`src/engine/**` queda byte a byte idéntico.**

Mismo alcance que Tres Momentos, por la misma razón: sólo apoyos simples en toda la viga
(`method.rejectedFixedEnd` en un extremo empotrado), continuidad completa
(`method.rejectedContinuityRequired` ante una rótula), y EI uniforme por vano
(`method.rejectedNonUniformSpanEI`). Un tope de 2000 pasadas evita un bucle infinito si algún caso
no convergiera (`method.rejectedNotConverged`, no alcanzado por ningún caso de prueba).

## 5. Frontera protegida (mismo patrón ya autorizado)

`solutionMethod` gana un octavo valor, `'hardy-cross'`, en `src/types.ts` y `src/data/migrate.ts`
— los mismos dos ficheros que tocaron las seis entregas anteriores, por la misma razón. Línea base
refrescada con `--update`; el gate confirmó que sólo esos dos ficheros cambiaron dentro de la
frontera. **Ninguna matemática del solver cambió.**

## 6. Verificación ejecutada

`npm run verify` completo, en verde (ver la salida del comando que acompaña este reporte).

El gate propio (`hardyCross.test.ts`):

- El tramo clásico de dos vanos iguales bajo carga uniforme converge exactamente a `M = −wL²/8`
  en el apoyo central — el mismo cierre analítico que valida Tres Momentos.
- Un tramo de tres vanos con luces y cargas distintas converge a los **mismos** momentos de apoyo
  que `threeMoment.ts` calcula por su sistema de ecuaciones, y coincide con el momento que reporta
  el análisis matricial en cada apoyo — con reparto genuino en más de una pasada, a diferencia del
  caso simétrico. El diagrama final reconstruido coincide con el diagrama del solver en todo el
  tramo, no sólo en los apoyos.
- El método se retira ante un pórtico, una viga isostática, un extremo empotrado y un vano con
  rigidez EI no uniforme — las mismas comprobaciones que Tres Momentos.

## 7. Lo que esta fase no hace

- **Extremos empotrados y pórticos con desplazamiento lateral (sidesway)** — Hardy Cross los
  admite en su forma general; esta entrega mantiene el mismo alcance que Tres Momentos para poder
  contrastar ambos métodos entre sí sobre el mismo tramo.
- **Los métodos restantes de la lista** (Área de Momentos, Viga Conjugada, Kani, Takabeya…) — la
  arquitectura sigue lista para cada uno.
- `npm run qa` sigue sin poder ejecutarse en este entorno (pide el canal `chrome`; falla igual en
  `origin/main`), así que no cuenta como verificación de esta fase — igual que en las seis
  entregas anteriores.
