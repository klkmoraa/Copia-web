# Reporte de entrega: métodos de resolución — Método de los Nudos

**Clasificación:** `AUDIT/TEMPORARY`
**Rama:** `claude/next-analysis-method-4f2j07`
**Commits:** ver el commit que acompaña este reporte

---

## 1. Qué se pidió

Tras la entrega del Método de los Cortes, el usuario pidió directamente: «método por nodos». Es
el complemento clásico e inseparable del método anterior — cualquier curso de estática los enseña
juntos — y no hay ambigüedad sobre si vale la pena: es el método más fundamental de todos para
armaduras, y el más citado junto con el de Cortes.

## 2. Por qué éste sí es distinto: equilibrio local de un nudo, no de un cuerpo libre completo

El Método de los Cortes resuelve una barra por equilibrio de una **porción completa** de la
armadura (ΣFx, ΣFy, ΣM de un lado del corte). El Método de los Nudos resuelve, en cambio, el
equilibrio de **un solo pin a la vez**: cada nudo tiene sólo dos ecuaciones (ΣFx = 0, ΣFy = 0), así
que un nudo sólo se puede resolver de una vez cuando le quedan como mucho dos fuerzas de barra
desconocidas. El procedimiento recorre los nudos en el orden en que esa condición se va cumpliendo
—normalmente empezando en un apoyo o un extremo libre de dos barras— y usa las fuerzas ya resueltas
de nudos anteriores como dato conocido en los siguientes, hasta agotar la armadura.

Esa dependencia secuencial es la seña de identidad del método, y es lo que el reporte documenta: no
es una tabla plana de fuerzas, sino una secuencia ordenada de nudos, donde cuál nudo se pudo
resolver *a continuación* es parte de lo que el procedimiento demuestra. `methodOfJoints.ts` no
recibe ese orden de una lista fija: en cada pasada recorre los nudos aún sin resolver y toma
cualquiera que en ese momento tenga dos o menos barras con fuerza desconocida, hasta que ninguna
pasada logra avanzar más.

## 3. La arquitectura

| Módulo nuevo | Qué hace |
|---|---|
| `src/analysis-methods/methodOfJoints.ts` | El método. Reutiliza `axialForceOf`/`memberLength` de `virtualWork.ts` sin duplicarlos, y `solveLinearSystem` de `engine/math.ts` para el sistema 2×2 (o 1×1, cuando sólo queda una incógnita) de cada nudo. |

Las reacciones y cargas conocidas de cada nudo salen directamente de `analyzeProject` sobre la
estructura **completa** — igual que el Método de los Cortes, este método tampoco aísla ningún
sub-modelo: la reacción de un apoyo, si el nudo la tiene, y la carga nodal aplicada ahí, si la
tiene, ya están calculadas por el solver de toda la estructura. **`src/engine/**` queda byte a byte
idéntico.**

Alcance: mismas dos restricciones que Cortes, y por la misma razón. Sólo armaduras estáticamente
determinadas (`method.rejectedIndeterminateTruss`) — con dos ecuaciones por nudo no sobra margen
para una incógnita redundante. Sólo cargas nodales, no cargas de miembro (`method.rejectedMemberLoadOnTruss`)
— una carga distribuida a lo largo de una barra rompe la hipótesis de que la barra sólo transmite
fuerza axial entre sus dos extremos, que es lo único que el equilibrio de un nudo puede ver.

## 4. Frontera protegida (mismo patrón ya autorizado)

`solutionMethod` gana un undécimo valor, `'method-of-joints'`, en `src/types.ts` y
`src/data/migrate.ts` — los mismos dos ficheros que tocaron las nueve entregas anteriores, por la
misma razón. Línea base refrescada con `--update`; el gate confirmó que sólo esos dos ficheros
cambiaron dentro de la frontera. **Ninguna matemática del solver cambió.**

## 5. Verificación ejecutada

`npm run verify` completo, en verde (ver la salida del comando que acompaña este reporte).

El gate propio (`methodOfJoints.test.ts`):

- Sobre la misma armadura de dos paneles usada por `methodOfSections.test.ts` (7 barras,
  estáticamente determinada), todas las barras se resuelven, cada fuerza coincide con el análisis
  matricial con una diferencia menor a 1e-6, y cada nudo se resuelve exactamente una vez.
- Sobre una armadura triangular simple con carga oblicua, la misma verificación exacta — un
  segundo caso independiente para no depender de un único fixture.
- El método se retira ante un pórtico, la misma armadura de dos paneles con una diagonal
  redundante (hiperestática por dentro aunque determinada por fuera), y una carga de miembro
  activa — reutilizando las mismas claves de rechazo que el Método de los Cortes.

Ningún fallo de signo ni de secuencia apareció durante la validación: los tres casos de prueba
pasaron en el primer intento, algo inusual en esta serie (todos los métodos anteriores encontraron
al menos un error real durante la depuración dirigida por tests). Se le prestó especial atención a
este resultado — se revisó a mano el sentido de `towardsFarEnd` (vector unitario desde el nudo
hacia el extremo lejano de cada barra, la dirección en la que tira una fuerza de tracción) contra
el mismo convenio de tracción-positiva ya validado en `virtualWork.ts` y `methodOfSections.ts`, y
coincide.

`TopBar.test.tsx` no necesitó cambios.

## 6. Lo que esta fase no hace

- **Armaduras donde ningún nudo llega nunca a dos o menos incógnitas** — geometrías donde la
  secuencia se atasca antes de cubrir todas las barras (poco común en una armadura determinada
  bien formada, pero posible con una numeración de nudos patológica combinada con un grafo
  inusual). El propio módulo lo reporta en `unresolvedMemberIds` en vez de forzar un sistema más
  grande sin verificación.
- `npm run qa` sigue sin poder ejecutarse en este entorno (pide el canal `chrome`; falla igual en
  `origin/main`), así que no cuenta como verificación de esta fase.
