# Reporte de entrega: métodos de resolución — Método del Voladizo

**Clasificación:** `AUDIT/TEMPORARY`
**Rama:** `claude/next-analysis-method-4f2j07`
**Commits:** ver el commit que acompaña este reporte

---

## 1. Qué se pidió

Seguir con el siguiente método de la lista después del Método del Portal
(`reports/2026-08-28-0620-metodo-portal.md`). El Voladizo era el segundo método aproximado
autorizado de antemano junto con el Portal, con la misma advertencia: al llegar su turno, el PDF
tiene que declarar la diferencia frente al método exacto, no exigir que coincida.

## 2. Cómo se relaciona con el Portal

El Voladizo comparte con el Portal la primera hipótesis (punto de inflexión a media altura de
cada columna y a media luz de cada viga, con la misma excepción de apoyo sin restricción de giro
en el primer piso) pero sustituye la segunda por completo. Donde el Portal reparte el cortante de
planta por ancho tributario, el Voladizo trata la fila de columnas de cada planta como la sección
de un voladizo vertical que resiste el momento de vuelco: la axial de cada columna es proporcional
a su área y a su distancia al centroide de áreas de esa planta — la fórmula de flexión aplicada a
columnas discretas.

Esa sustitución invierte el orden del procedimiento. El Portal conoce el cortante primero y saca
los momentos a partir de él; el Voladizo conoce la axial primero, y tiene que llegar al cortante
por el camino largo:

1. **Axial de columna**, por la analogía de flexión.
2. **Momento de viga**, con la *misma* ecuación de equilibrio vertical de nudo que el Portal usa
   para hallar la axial de columna — resuelta para la incógnita contraria, barrida de izquierda a
   derecha en cada planta igual que el Portal barre el momento de viga.
3. **Cortante de viga**, de su momento (`V = −2m/L`, la misma relación que en el Portal).
4. **Cortante y ambos momentos de extremo de columna**, con la *misma* ecuación de equilibrio de
   momento de nudo que el Portal usa para hallar el momento de viga — resuelta para la incógnita
   contraria, barrida desde la cubierta hacia abajo.

Ningún signo de esto salió de memoria: se fijaron reutilizando el mismo pórtico de un vano hecho a
mano que valida `portalMethod.test.ts`, resuelto también aquí con `analyzeProject`.
`cantileverMethod.test.ts` reproduce esa misma comprobación para este método.

## 3. Un defecto real, cazado por la prueba que existe para eso

La primera versión del barrido de momento de viga (paso 2) confundía la ecuación de equilibrio
*vertical* de nudo (que necesita `2·m⁄L`, la fuerza que la viga anterior ejerce sobre el nudo
compartido) con la de equilibrio de *momento* del Portal (que usa `m` directo) — arrastraba el
momento crudo de la viga anterior en vez de dividirlo entre su luz. En un pórtico de un solo vano
el error no se manifestaba (no hay viga a la izquierda que arrastrar), así que el primer caso de
prueba pasaba con el error todavía dentro. Fue la prueba de cierre en un pórtico de dos vanos —la
misma clase de comprobación que ya usa `portalMethod.test.ts` para su barrido de momento— la que
lo cazó: una ecuación redundante que el algoritmo nunca usa para resolver nada tiene que cumplirse
sola, y no se cumplía. **Ningún signo llegó a esta entrega sin ese contraste.**

## 4. La arquitectura

| Módulo nuevo | Qué hace |
|---|---|
| `src/analysis-methods/cantileverMethod.ts` | El método. Reutiliza `frameGeometry.ts` (`buildFrameGrid`, `restrainsRotation`) tal cual, sin cambios. |

Igual que el Portal, `solveCantileverMethod` aísla la carga lateral del proyecto en un modelo
derivado y lo resuelve con `analyzeProject` para la comparación honesta — nada re-deriva la
estática de ese modelo. **`src/engine/**` queda byte a byte idéntico.**

Una restricción propia de este método, que el Portal no necesita: el primer piso tiene que tener
**una única condición de apoyo** (todas las columnas restringen el giro, o ninguna) — la analogía
de flexión corta la estructura por una sola altura compartida, y un primer piso con bases mixtas
no es un único cuerpo libre. El método se retira (`method.rejectedMixedBase`) en vez de elegir una
altura de corte arbitraria.

## 5. Frontera protegida (mismo patrón ya autorizado)

`solutionMethod` gana un cuarto valor, `'cantilever-method'`, en `src/types.ts` y
`src/data/migrate.ts` — los mismos dos ficheros que tocaron las dos entregas anteriores, por la
misma razón. Línea base refrescada con `--update`; el gate confirmó que sólo esos dos ficheros
cambiaron dentro de la frontera. **Ninguna matemática del solver cambió.**

## 6. Verificación ejecutada

`npm run verify` completo, en verde:

```
Frontera protegida intacta: 50 archivos verificados.
Test Files  296 passed (296)
     Tests  2869 passed | 8 skipped (2877)
Chunk de entrada limpio
```

El gate propio (`cantileverMethod.test.ts`):

- El pórtico de un vano coincide con el cálculo algebraico independiente — axial, cortante y
  momentos de columna, momento y cortante de viga — y con el signo de cada cantidad que reporta el
  análisis matricial en el mismo pórtico.
- Un pórtico de dos vanos con vanos y áreas desiguales cierra dos ecuaciones redundantes que el
  algoritmo nunca usa para resolver nada: la axial de cada planta suma cero (autoequilibrada por
  construcción, ya que la fórmula de flexión reparte alrededor del centroide de áreas) y la última
  columna de la planta deja su propia ecuación de equilibrio vertical satisfecha, no resuelta —
  la comprobación que cazó el defecto de la sección 3.
- El método se retira ante una armadura, un modelo sin carga lateral activa, un modelo con cargas
  de miembro activas, y un primer piso con bases mixtas.

`TopBar.test.tsx` no necesitó cambios: el pórtico de ejemplo ya ofrecía el selector de método
desde la entrega del Portal, y un tercer método aplicable no cambia el número de controles que la
prueba cuenta.

## 7. Lo que esta fase no hace

- **Los métodos exactos restantes de la lista** (Tres Momentos, Área de Momentos, Viga Conjugada,
  Trabajo Virtual, Castigliano, Hardy Cross, Kani, Takabeya…) — la arquitectura sigue lista para
  cada uno.
- **Retículas irregulares** y **primeros pisos con bases mixtas** — ambos casos se retiran en vez
  de aproximar una lectura que no podrían sostener.
- `npm run qa` sigue sin poder ejecutarse en este entorno (pide el canal `chrome`; falla igual en
  `origin/main`), así que no cuenta como verificación de esta fase — igual que en las dos entregas
  anteriores.
