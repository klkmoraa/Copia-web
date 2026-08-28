# Reporte de entrega: métodos de resolución — Método de los Cortes

**Clasificación:** `AUDIT/TEMPORARY`
**Rama:** `claude/next-analysis-method-4f2j07`
**Commits:** ver el commit que acompaña este reporte

---

## 1. Qué se pidió

El usuario señaló, tras la pausa acordada en la entrega anterior, que faltaban métodos como el de
Cortes. Con razón: no estaba en la evaluación de solape que llevó a parar la serie de 8 métodos
previos, y es un método clásico y genuinamente distinto de todo lo hecho hasta ahora.

## 2. Por qué éste sí es distinto: estática global, no equilibrio de nudo ni energía

Trabajo Virtual encuentra el desplazamiento de un nudo con energía; Castigliano encuentra
reacciones redundantes con el mismo principio. El Método de los Cortes encuentra la fuerza de una
barra **directamente por equilibrio de una porción completa** de la armadura: un corte imaginario
la divide en dos, atravesando como mucho tres barras, y el equilibrio del lado que se conserva
(ΣFx = 0, ΣFy = 0, ΣM = 0, con las reacciones y cargas de ese lado ya conocidas) basta para hallar
esas tres fuerzas — sin resolver la armadura nudo por nudo. Es la única entrega de esta serie
construida enteramente sobre estática de cuerpo libre, ni iterativa ni energética.

El corte no se elige a mano desde un dibujo: para cada barra, `methodOfSections.ts` busca —primero
sola, luego con una barra más, luego con dos más— un conjunto de barras cortadas cuya eliminación
divida el grafo de la armadura en exactamente dos piezas conectadas, con cada barra cortada
cruzando genuinamente de una pieza a la otra (no una barra "cortada" que en realidad queda entera
dentro de un mismo lado, lo que la contaría por error como incógnita externa). Eso es exactamente
lo que «un corte imaginario a través de la armadura» significa, expresado como propiedad de grafo
en vez de un trazo sobre un dibujo.

## 3. La arquitectura

| Módulo nuevo | Qué hace |
|---|---|
| `src/analysis-methods/methodOfSections.ts` | El método. Reutiliza `axialForceOf`/`memberLength` de `virtualWork.ts` sin duplicarlos. |

Las reacciones y cargas conocidas del lado conservado salen directamente de `analyzeProject` sobre
la estructura **completa**, sin ningún modelo derivado ni sub-análisis — a diferencia de casi todos
los métodos anteriores de esta serie, éste no necesita aislar nada: el equilibrio de un cuerpo
libre usa las reacciones que el solver ya calculó para la armadura entera. **`src/engine/**` queda
byte a byte idéntico.**

Alcance: sólo armaduras estáticamente determinadas (`method.rejectedIndeterminateTruss`) — el
equilibrio puro no basta para hallar fuerzas de barra en una armadura hiperestática, a diferencia de
Trabajo Virtual, que no necesita esa restricción. Sólo cargas nodales, la misma restricción que
Trabajo Virtual y Castigliano (`method.rejectedMemberLoadOnTruss`).

## 4. Frontera protegida (mismo patrón ya autorizado)

`solutionMethod` gana un décimo valor, `'method-of-sections'`, en `src/types.ts` y
`src/data/migrate.ts` — los mismos dos ficheros que tocaron las ocho entregas anteriores, por la
misma razón. Línea base refrescada con `--update`; el gate confirmó que sólo esos dos ficheros
cambiaron dentro de la frontera. **Ninguna matemática del solver cambió.**

## 5. Verificación ejecutada

`npm run verify` completo, en verde (ver la salida del comando que acompaña este reporte).

El gate propio (`methodOfSections.test.ts`):

- Sobre una armadura de dos paneles (7 barras, estáticamente determinada), todas las barras se
  resuelven, cada fuerza coincide con el análisis matricial con una diferencia menor a 1e-6, y al
  menos un corte deja más de un nudo en el lado conservado — la comprobación explícita de que el
  método está cortando de verdad la armadura, no simplemente reproduciendo el equilibrio de un
  único nudo (que sería, en el fondo, el método de los nudos, no el de los cortes).
- El método se retira ante un pórtico, la misma armadura con una diagonal redundante
  (hiperestática por dentro aunque determinada por fuera), y una carga de miembro activa.

`TopBar.test.tsx` no necesitó cambios.

## 6. Lo que esta fase no hace

- **Armaduras donde ninguna barra tiene un corte de tres barras o menos** — el propio módulo lo
  reporta como «sin resolver» en vez de forzar un corte más grande sin verificación.
- `npm run qa` sigue sin poder ejecutarse en este entorno (pide el canal `chrome`; falla igual en
  `origin/main`), así que no cuenta como verificación de esta fase.
