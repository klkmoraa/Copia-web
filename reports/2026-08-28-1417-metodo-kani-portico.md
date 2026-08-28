# Reporte de entrega: métodos de resolución — Kani (rotación de nudos) para pórticos

**Clasificación:** `AUDIT/TEMPORARY`
**Rama:** `claude/next-analysis-method-4f2j07`
**Commits:** ver el commit que acompaña este reporte

---

## 1. Qué se pidió

Seguir con el siguiente método de la lista tras Hardy Cross (`reports/2026-08-28-1349-metodo-hardy-cross.md`).

## 2. Por qué éste: Hardy Cross, pero sobre un nudo con más de dos barras

Hardy Cross itera vigas: cada nudo interior tiene exactamente dos vanos, izquierdo y derecho. El
Método de Kani (rotación de nudos) es la misma familia de idea —empotrar cada barra en imaginación,
calcular su momento de empotramiento perfecto, y repartir el desequilibrio hasta que converja— pero
generalizada a un **grafo de nudos genuino**: un nudo de pórtico puede tener tres, cuatro o más
barras concurriendo en él, no sólo dos. Es el primer método iterativo de esta serie que resuelve
pórticos en vez de vigas.

La fórmula de Kani sustituye el reparto-y-acarreo de Hardy Cross por un único «momento de rotación»
`M'ᵢⱼ` por extremo de barra, recalculado en cada pasada:

```
M'ᵢⱼ = μᵢⱼ (ΣFEMᵢ + Σ M'ⱼᵢ),   μᵢⱼ = −½ (Kᵢⱼ / ΣKᵢ)
```

**Esta fórmula no salió de memoria: se derivó del equilibrio de momento en el nudo** (`Σⱼ Mᵢⱼ = 0`
en cada nudo que rota), imponiendo que el momento final `Mᵢⱼ = FEMᵢⱼ + 2M'ᵢⱼ + M'ⱼᵢ` satisfaga ese
equilibrio — la derivación completa está en el comentario de cabecera de `kaniFrame.ts`. Igual que
en Hardy Cross, el momento de empotramiento perfecto de cada barra sale de `analyzeProject` sobre
una aislación de esa barra con sus dos extremos empotrados de verdad.

## 3. Sin término de bamboleo: por qué el filtro de aplicabilidad no confía en la geometría

La fórmula de arriba no lleva ningún término de desplazamiento lateral (`sway`), así que sólo es
exacta cuando el pórtico genuinamente no se desplaza de lado bajo la carga. La primera tentación fue
comprobar eso mirando el desplazamiento horizontal (`ux`) que ya calcula `analyzeProject` — pero un
pórtico simétrico bajo carga simétrica **no tiene por qué dar `ux = 0`**: la rigidez axial real de
la viga (no infinita, como asume la idealización clásica de Kani) permite un ligero «respiro»
simétrico —columnas que se abren o se cierran unas décimas de milímetro— que no es bamboleo
propiamente dicho, pero que sí introduce un error medible (unas centésimas de kN·m, un 0,2% del
momento típico) si la fórmula sin término de bamboleo se aplica de todos modos.

Comprobado con un caso hecho a mano: el mismo pórtico, con la viga de cubierta arriostrada
lateralmente de verdad (`ux` forzado a cero en vez de simplemente pequeño), coincide con el
solver **hasta precisión de máquina** (diferencia ~1e-12). Eso confirmó que la fórmula en sí estaba
bien y que el problema era del criterio de aplicabilidad, no del método. La solución adoptada:
**no adivinar el bamboleo por la geometría — calcular la respuesta y medir la brecha contra el
solver**. Un pórtico genuinamente sin bamboleo cae dentro del ruido numérico; uno que sí bambolea
(o uno que sólo "parece" simétrico pero tiene ese respiro axial) abre una brecha que el propio
método detecta y por la que se retira, en vez de narrar un número ligeramente equivocado sin
decirlo.

## 4. Un defecto real más, cazado por la misma disciplina

Antes de llegar a la brecha de 0,2% de la sección 3, hubo un defecto genuino de signo: la fórmula
del momento final en el extremo `j` de una barra trataba el momento de empotramiento perfecto
`FEMⱼ` como si ya estuviera en el sentido «que la barra ejerce sobre el nudo», cuando en realidad
necesita esa misma negación que sí se aplicó correctamente en la suma `ΣFEM` por nudo. El síntoma
fue inequívoco al contrastar contra el solver: signos invertidos y una diferencia de 54 kN·m en un
pórtico donde el momento típico era 27 kN·m — no un ruido pequeño, un error real. Corregido y
confirmado con el mismo pórtico arriostrado que dio la precisión de máquina de la sección 3.

## 5. La arquitectura

| Módulo nuevo | Qué hace |
|---|---|
| `src/analysis-methods/kaniFrame.ts` | El método. Reutiliza `beamAxis.ts` y `polynomialAlgebra.ts` sin cambios, y la misma técnica de aislar-una-barra-y-empotrarla que `hardyCross.ts` usa para vigas, aplicada aquí a una sola barra en vez de a un vano completo. |

`solveKaniFrame` no re-deriva la estática de ninguna barra: cada aislación se resuelve con
`analyzeProject`. **`src/engine/**` queda byte a byte idéntico.**

Alcance de esta entrega: continuidad completa (`method.rejectedContinuityRequired` ante una rótula
o una barra de armadura dentro del pórtico), y sin bamboleo verificado contra el solver
(`method.rejectedSidesway`). No hay restricción de rigidez uniforme por vano —a diferencia de Tres
Momentos y Hardy Cross— porque Kani trata cada barra individualmente, no un vano que pueda agrupar
varios miembros.

## 6. Frontera protegida (mismo patrón ya autorizado)

`solutionMethod` gana un noveno valor, `'kani-frame'`, en `src/types.ts` y `src/data/migrate.ts` —
los mismos dos ficheros que tocaron las siete entregas anteriores, por la misma razón. Línea base
refrescada con `--update`; el gate confirmó que sólo esos dos ficheros cambiaron dentro de la
frontera. **Ninguna matemática del solver cambió.**

## 7. Verificación ejecutada

`npm run verify` completo, en verde (ver la salida del comando que acompaña este reporte).

El gate propio (`kaniFrame.test.ts`):

- Un pórtico de un vano arriostrado lateralmente (`ux` forzado a cero) bajo carga simétrica
  coincide con el solver en cada extremo de cada barra, con una diferencia menor a 1e-6 —
  confirmado con reparto genuino en varias pasadas, no un caso trivial.
- El método se retira ante una armadura, un pórtico sin arriostrar bajo carga puramente lateral
  (bamboleo real y grande), el mismo pórtico simétrico **sin** arriostrar explícito (el respiro
  axial de la sección 3, una brecha pequeña pero real), y una rótula interna.

## 8. Lo que esta fase no hace

- **El término de bamboleo lateral** — extendería Kani a pórticos que sí se desplazan de lado,
  necesitando una ecuación adicional de corte por planta (parecida en espíritu al cortante de
  planta del Portal, pero integrada en el reparto iterativo).
- **Los métodos restantes de la lista** (Área de Momentos, Viga Conjugada, Takabeya…) — la
  arquitectura sigue lista para cada uno.
- `npm run qa` sigue sin poder ejecutarse en este entorno (pide el canal `chrome`; falla igual en
  `origin/main`), así que no cuenta como verificación de esta fase — igual que en las siete
  entregas anteriores.
