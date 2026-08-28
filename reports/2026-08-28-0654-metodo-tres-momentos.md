# Reporte de entrega: métodos de resolución — Teorema de los Tres Momentos

**Clasificación:** `AUDIT/TEMPORARY`
**Rama:** `claude/next-analysis-method-4f2j07`
**Commits:** ver el commit que acompaña este reporte

---

## 1. Qué se pidió

Seguir con el siguiente método de la lista tras los dos aproximados autorizados (Portal y
Voladizo, `reports/2026-08-28-0620-metodo-portal.md` y
`reports/2026-08-28-0634-metodo-voladizo.md`). Con esos dos completos, esta entrega vuelve a un
método exacto para vigas — el mismo compromiso que Doble Integración, no una aproximación que
declarar.

Elegido: el Teorema de los Tres Momentos (ecuación de Clapeyron), el complemento natural de Doble
Integración sobre vigas continuas — misma familia de estructura, incógnita y camino de solución
completamente distintos.

## 2. Cómo se relaciona con Doble Integración

Doble Integración elige **reacciones** como redundantes y las resuelve integrando la ecuación de
la elástica dos veces. Los Tres Momentos eligen el **momento en cada apoyo interior** como
redundante, y lo resuelven con una ecuación de compatibilidad distinta: cada vano se resuelve
primero como viga simplemente apoyada bajo sus propias cargas — el «momento libre» — y la ecuación
de Clapeyron impone, en cada apoyo interior, que la pendiente que ese momento libre produciría a
cada lado, corregida por los momentos de apoyo todavía desconocidos, coincida entre ambos vanos:

```
(Lₙ/EIₙ)·Mₙ₋₁ + 2(Lₙ/EIₙ + Lₙ₊₁/EIₙ₊₁)·Mₙ + (Lₙ₊₁/EIₙ₊₁)·Mₙ₊₁
  = −6·[Aₙaₙ/(EIₙLₙ) + Aₙ₊₁bₙ₊₁/(EIₙ₊₁Lₙ₊₁)]
```

`Aₙaₙ` y `Aₙbₙ` — el primer momento del diagrama de momento libre respecto de cada extremo del
vano — salen de `analyzeProject` sobre un modelo de un solo vano, simplemente apoyado, aislado del
resto de la viga: el mismo patrón que usa Doble Integración para su `M₀`, y el mismo principio de
"nada aquí re-deriva la estática de un vano, se integra el polinomio que el solver ya produjo".
Con los momentos de apoyo resueltos, el momento final en cualquier punto es
`M(x) = M_libre(x) + Mₗ(1 − x/L) + Mᵣ(x/L)` — y ése es el que se contrasta contra el diagrama del
solver en el modelo original, sin liberar nada, punto a punto.

**A diferencia de los dos métodos aproximados anteriores, éste es exacto: tiene que coincidir con
el análisis matricial**, igual que Doble Integración. Eso simplificó mucho la validación: no hizo
falta un pórtico de prueba hecho a mano para fijar convenios de signo — la comprobación de cierre
cerrado `M = −wL²/8` del caso clásico de dos vanos iguales bajo carga uniforme salió correcta al
primer intento, y el contraste punto a punto contra el solver en un tramo de tres vanos con luces
y cargas distintas también.

## 3. La arquitectura

| Módulo nuevo | Qué hace |
|---|---|
| `src/analysis-methods/threeMoment.ts` | El método. Reutiliza `beamAxis.ts` y `polynomialAlgebra.ts` sin cambios; no necesitó ningún módulo de geometría nuevo. |

`solveThreeMoment` no re-deriva la estática de ningún vano: cada uno se aísla y se resuelve con
`analyzeProject`, exactamente como el `M₀` de Doble Integración. **`src/engine/**` queda byte a
byte idéntico.**

Alcance de esta entrega (dejado explícito, no descubierto a medias):

- Sólo apoyos simples (pasador o rodillo) en toda la viga — un extremo empotrado necesita el truco
  del «vano ficticio» que esta entrega no incluye, y se retira con `method.rejectedFixedEnd` en
  vez de improvisarlo.
- Continuidad completa: cualquier rótula interna o liberación de momento se retira
  (`method.rejectedContinuityRequired`), porque el teorema asume que la pendiente es continua a
  cada lado de un apoyo interior.
- EI uniforme dentro de cada vano — la forma generalizada `Lₙ/EIₙ` del teorema asume una única
  rigidez por vano; un vano con dos miembros de EI distinta se retira
  (`method.rejectedNonUniformSpanEI`) en vez de promediar algo que no tendría sentido físico.

## 4. Frontera protegida (mismo patrón ya autorizado)

`solutionMethod` gana un quinto valor, `'three-moment'`, en `src/types.ts` y `src/data/migrate.ts`
— los mismos dos ficheros que tocaron las tres entregas anteriores, por la misma razón. Línea base
refrescada con `--update`; el gate confirmó que sólo esos dos ficheros cambiaron dentro de la
frontera. **Ninguna matemática del solver cambió.**

## 5. Verificación ejecutada

`npm run verify` completo, en verde:

```
Frontera protegida intacta: 50 archivos verificados.
Test Files  297 passed (297)
     Tests  2872 passed | 8 skipped (2880)
Chunk de entrada limpio
```

El gate propio (`threeMoment.test.ts`):

- Un tramo de dos vanos iguales bajo carga uniforme da exactamente `M = −wL²/8` en el apoyo
  central — la solución cerrada de libro, independiente del solver.
- Un tramo de tres vanos con luces y cargas distintas coincide con el momento que el análisis
  matricial reporta en cada apoyo interior, y el diagrama final reconstruido —momento libre más la
  corrección lineal— coincide con el diagrama del solver en **todo** el tramo, no sólo en los
  apoyos: se comprobó punto a punto contra cada estación muestreada de `analysis.memberResults`.
- El método se retira ante un pórtico, una viga isostática sin apoyo interior, un extremo
  empotrado, una rótula interna y un vano con rigidez EI no uniforme.

`TopBar.test.tsx` no necesitó cambios: el tercer método aplicable en una viga continua no cambia
el número de controles que la prueba cuenta, y la prueba que enumera las opciones exactas del
selector usa una viga simple de dos apoyos, donde los Tres Momentos no aplican (no hay apoyo
interior).

## 6. Lo que esta fase no hace

- **El truco del vano ficticio para extremos empotrados** — extendería esta misma entrega, no es
  un método nuevo, pero queda fuera de alcance por ahora.
- **Vanos con EI no uniforme** — necesitaría la forma general de la ecuación con `M/EI(x)`
  integrado directamente, en vez de asumir un único `Lₙ/EIₙ` por vano.
- **Los métodos restantes de la lista** (Área de Momentos, Viga Conjugada, Trabajo Virtual,
  Castigliano, Hardy Cross, Kani, Takabeya…) — la arquitectura sigue lista para cada uno.
- `npm run qa` sigue sin poder ejecutarse en este entorno (pide el canal `chrome`; falla igual en
  `origin/main`), así que no cuenta como verificación de esta fase — igual que en las tres
  entregas anteriores.
