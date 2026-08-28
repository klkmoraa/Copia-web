# Reporte de entrega: métodos de resolución — Castigliano (trabajo mínimo) para armaduras

**Clasificación:** `AUDIT/TEMPORARY`
**Rama:** `claude/next-analysis-method-4f2j07`
**Commits:** ver el commit que acompaña este reporte

---

## 1. Qué se pidió

Seguir con el siguiente método de la lista tras Trabajo Virtual
(`reports/2026-08-28-1254-metodo-trabajo-virtual.md`). Ese reporte dejaba explícito, en «Lo que
esta fase no hace», que las armaduras indeterminadas quedaban fuera: esta entrega cierra
exactamente ese hueco.

## 2. Por qué éste: completa lo que Trabajo Virtual dejó abierto

Trabajo Virtual responde «¿cuánto se desplaza este nudo?» para una armadura cuyas fuerzas de
barra ya se conocen. El Teorema del Trabajo Mínimo de Castigliano responde una pregunta distinta
que el mismo principio también resuelve: cuando la armadura tiene **más reacciones que las tres
ecuaciones de equilibrio pueden fijar**, ¿qué valor toman esas reacciones de más? Castigliano lo
plantea como que la energía de deformación es estacionaria respecto de cada redundante,
`∂U/∂Xₖ = 0` — y para una armadura articulada, con `U = Σ Nᵢ²Lᵢ/(2AᵢEᵢ)`, esa derivada es
exactamente la misma afirmación de trabajo virtual: el desplazamiento de la estructura liberada
—la «primaria»— en la dirección de cada redundante, bajo las cargas reales y el resto de
redundantes, tiene que ser cero, porque en la estructura real ese apoyo no se mueve.

La arquitectura reutiliza dos patrones ya existentes en vez de inventar uno nuevo:

- **La elección de redundantes**, ficha por ficha, es la misma que `doubleIntegration.ts` usa
  para reacciones de viga: cada combinación candidata se pone a prueba con `analyzeProject` antes
  de adoptarla, así que una que dejara la estructura primaria como mecanismo se descarta en vez de
  narrarse.
- **Las fuerzas de barra reales y virtuales** —`N₀` bajo las cargas reales, `nₖ` bajo un valor
  unitario de cada redundante— salen de `analyzeProject` sobre modelos liberados, el mismo patrón
  de carga unitaria de Doble Integración y de Trabajo Virtual, aplicado ahora para construir una
  **matriz de flexibilidad** (`Σ nₖnₘL/AE`) en vez de una única suma.

`src/analysis-methods/virtualWork.ts` exportó tres funciones pequeñas que este módulo reutiliza
tal cual (`freeComponents`, `memberLength`, `axialForceOf`) en vez de duplicarlas.

## 3. Alcance de esta entrega

- **Sólo redundancia externa.** La fórmula del reticulado justo-rígido, `m = 2n − 3`, distingue si
  el grado de hiperestaticidad viene de reacciones de más (externa) o de una barra de más
  (interna). Cortar una barra para liberarla es un procedimiento distinto —y de implementación
  distinta— que esta entrega no cubre: se retira con `method.rejectedInternalRedundancy` en vez de
  elegir una barra arbitrariamente.
- **Sólo apoyos alineados con los ejes.** Un rodillo oblicuo entre las reacciones redundantes no
  deja claro si `ux` o `uy` es el grado libre real; se retira con `method.rejectedObliqueSupport`.
- Una armadura determinada (`g = 0`) no tiene redundante que resolver — eso ya lo narra Trabajo
  Virtual — y se retira con `method.rejectedDeterminateTruss`.

## 4. Frontera protegida (mismo patrón ya autorizado)

`solutionMethod` gana un séptimo valor, `'castigliano-truss'`, en `src/types.ts` y
`src/data/migrate.ts` — los mismos dos ficheros que tocaron las cinco entregas anteriores, por la
misma razón. Línea base refrescada con `--update`; el gate confirmó que sólo esos dos ficheros
cambiaron dentro de la frontera. **Ninguna matemática del solver cambió.**

## 5. Verificación ejecutada

`npm run verify` completo, en verde (ver la salida del comando que acompaña este reporte).

El gate propio (`castiglianoTruss.test.ts`):

- Sobre la armadura triangular 3-4-5 con un cuarto apoyo (un grado de indeterminación externa),
  la reacción redundante y la fuerza final de cada barra coinciden con el análisis matricial de la
  estructura original, con una diferencia menor a 1e-6 kN — al primer intento, sin necesitar
  ajustar ningún convenio de signo.
- El método se retira ante un pórtico, una armadura determinada, un apoyo oblicuo entre las
  redundantes, y un cuadrado arriostrado con ambas diagonales (indeterminación puramente interna:
  tres reacciones exactas, una barra de más).

`TopBar.test.tsx` no necesitó cambios: ninguna prueba existente cubre el selector de método sobre
una armadura indeterminada.

## 6. Lo que esta fase no hace

- **Redundancia interna** (elegir qué barra cortar) — necesitaría tratar la fuerza de una barra
  concreta como la incógnita, aplicando un par de cargas unitarias iguales y opuestas en sus dos
  extremos en vez de una reacción externa.
- **Los métodos restantes de la lista** (Área de Momentos, Viga Conjugada, Hardy Cross, Kani,
  Takabeya…) — la arquitectura sigue lista para cada uno.
- `npm run qa` sigue sin poder ejecutarse en este entorno (pide el canal `chrome`; falla igual en
  `origin/main`), así que no cuenta como verificación de esta fase — igual que en las cinco
  entregas anteriores.
