# Reporte de entrega: DCL por método, fórmulas trabajadas y ficha de materiales

**Clasificación:** `AUDIT/TEMPORARY`
**Rama:** `claude/pdf-diagrams-improvements-2vopp2`
**Commits:** ver el commit que acompaña este reporte

---

## 1. Qué se pidió

«Mejora los PDFs, la vista, los diagramas; que se pueda elegir el método por el cual se resuelve
y que se vea cada DCL basado en el método — por ejemplo, si es por cortes, que se vea cada DCL de
cada corte. Mejora las fórmulas. Si hay materiales, que se agregue la especificación; si hay una
sección igual, etc.»

Tres decisiones se acordaron antes de empezar: las fórmulas pasan a **símbolo → sustitución →
resultado** *y* mejoran tipográficamente; los materiales van en **parte propia con ficha y dibujo
del perfil**; y se dibujan **todos** los DCL, con **interruptor propio** en la vista previa.

## 2. Qué estaba mal

| Problema | Evidencia |
|---|---|
| **El procedimiento no dibujaba nada.** `grep layout.figure src/utils/pdf/` devolvía cuatro figuras en todo el documento, ninguna dentro de la parte 06. El método de los cortes tabulaba corte por corte y escribía sus tres sumas de equilibrio, pero el lector nunca veía el corte. | Sólo `drawElasticCurve` en doble integración y viga conjugada. |
| **Un apoyo empotrado se dibujaba igual que uno articulado.** | `drawGlobalDcl` distinguía sólo el rodillo. |
| **Las fórmulas no decían qué regla aplicaban.** Los commits `179a3d2`/`c65873a` quitaron las identidades simbólicas porque se imprimían vacías; quedó la aritmética correcta y sin nombre. | `drawWorked(context, caption, ['ΣK(B) = 2500 + 2500 = 5000'])`. |
| **Los cocientes se escribían con barra en línea.** `asFraction` rechazaba cualquier palabra con paréntesis, que es la forma de casi toda la aritmética real del informe. | `if (/[()[\]]/.test(word)) return undefined;` |
| **Las unidades salían en cursiva**, como si `kN·m` fuera el producto de una k, una N y una m. | Todo el texto tras el `=` iba a `translateExpression` sin `\mathrm`. |
| **El PDF nunca decía de qué está hecha la estructura.** El modelo guarda `materialId`/`sectionId` y los catálogos traen la ficha completa; la memoria imprimía `E`, `A`, `I` y nada más. Cuarenta miembros con el mismo perfil lo repetían cuarenta veces. | `pdfModelSection.ts`, tabla «Miembros y secciones». |

## 3. Qué se hizo

### 3.1 Un motor de cuerpos libres, y once métodos que lo usan

- **`pdfScene.ts`** (nuevo) recoge las primitivas que `pdfDiagrams.ts` tenía privadas —proyección,
  flecha, punto de nudo, glifo de apoyo, cargas de miembro— y añade las que faltaban: arco de
  momento, línea discontinua, modelo fantasma y dibujo de sección. `pdfDiagrams.ts` las consume;
  su salida no cambió salvo por una mejora deliberada: **un empotramiento ahora se raya y se
  distingue de una articulación**.
- **`pdfFreeBody.ts`** (nuevo) define `FreeBodyScene`, un objeto plano, y su renderizador. Una
  escena declara qué nudos y miembros quedan en tinta, dónde corre el corte, qué barra queda
  seccionada a media luz, qué flechas y arcos lleva y qué dice su leyenda.
- **`pdfMethodScenes.ts`** (nuevo) construye esas escenas a partir de lo que
  `src/analysis-methods/` **ya había resuelto y contrastado contra el análisis matricial**. No
  recalcula nada. Cobertura por método:

| Método | DCL que dibuja |
|---|---|
| Cortes | Uno por corte: lado conservado en tinta, resto en fantasma, corte discontinuo por los puntos medios, y la axial de cada barra seccionada saliendo (T) o entrando (C) del cuerpo, más reacciones y cargas de ese lado. |
| Nudos | Uno por nudo, en encuadre local, con cada barra concurrente en su dirección real. |
| Portal · Voladizo | Uno por planta (corte por los puntos de inflexión, cortante de planta y lo que toma cada columna) y uno por columna entre puntos de inflexión. |
| Tres momentos · Hardy Cross | Uno por vano, con sus cargas y los momentos de apoyo como arcos; Hardy Cross añade el FEM de partida. |
| Kani | Uno por barra, con los momentos de extremo convergidos y el FEM. |
| Doble integración · Viga conjugada | Uno por tramo: la viga cortada dentro del tramo, la porción izquierda en tinta con su carga truncada en el corte, y `V(x)` y `M(x)` en la cara. |
| Trabajo virtual | Sistema real y sistema virtual (carga unitaria) emparejados. |
| Castigliano | Estructura primaria liberada, y una escena por redundante. |

  Cada constructor devuelve `[]` cuando el resultado del método no da para una escena honesta —el
  mismo criterio que `freeBodyEquations` aplica a la aritmética.

### 3.2 Fórmulas

- **`pdfEquation.ts`** (nuevo): `WorkedEquation` apila `lhs`, la regla en símbolos, la misma con
  los números de este proyecto y el resultado con su unidad, en un `\begin{aligned}` que TeX
  alinea por el `=`. Si no cabe o MathJax no puede con él, cae a una línea que sí se parte.
- **La regla del repositorio se mantiene**: una fila simbólica **nunca** se dibuja sin su
  sustitución. `buildAlignedLatex({ lhs, symbolic })` devuelve `undefined`, y hay una prueba que
  lo fija. Los `agrees(...)` que ya cerraban cada bloque siguen intactos.
- `mathLatex.ts`: los cocientes se detectan a nivel de expresión y con conciencia de paréntesis
  (`(2 · 45.0)/(6.0)` → `\dfrac`), en `\dfrac` para que no encojan; se rechaza lo ambiguo
  (`a/b/c`, `f(a/b)`). Vocabulario nuevo: `‖ ≅ ≪ ≫ ⌊⌋ ⌈⌉ ∓ ↺ ↻`.
- `mathTypeset.ts` acepta modo *display*, así `\sum` e `\int` llevan sus límites arriba y abajo.
- Las unidades se graban en redonda (`\mathrm`), reconocidas contra el vocabulario cerrado que
  `engine/units` publica —no contra una heurística de forma que italizaría una variable.
- Se corrigió un fallo introducido en el camino: la relación se parte por el primer `=` **de
  primer nivel**. `dθ/dx (x = 0) = M/EI` se partía por el `=` de dentro del paréntesis y dejaba
  un miembro izquierdo `dθ/dx (x` y una sustitución que abría con un `)` suelto.

### 3.3 Parte «Materiales y secciones»

`pdfMaterialsSection.ts` (nuevo), entre «Procedimiento» y «Modelo y acciones». Reutiliza
`buildStructuralBom` (agrupado, cantidades y avisos de identidad), `findStandardMaterial` /
`findStandardSection` y `resolveSectionGeometry` / `sectionShapeLayout`. Lleva: cifras de
conjunto; una ficha por material (E, G, ν, f_y, γ, ρ, α, con los símbolos tipografiados);
una ficha por sección **con el perfil dibujado a escala y acotado** más A, I_x, I_y, S_x, Z_x,
r_x, espesores y peso lineal; la asignación miembro → material · sección · origen; las cantidades
por combinación; y los avisos de identidad.

**La regla del dominio es la del producto**: la forma real sólo se dibuja con identidad de
catálogo explícita. Sin ella se dibuja la rectangular equivalente `h = √(12·I/A)` y se rotula
como tal — deducir un perfil comercial de `A` e `I` sería inventar una identidad que el modelo
no guarda. Un `sectionId` que el catálogo no reconoce se declara como tal, no se disfraza de
«personalizada».

### 3.4 Vista previa

Dos casillas nuevas: «Diagramas de cuerpo libre del método» (deshabilitada si se apaga
«Procedimiento», igual que la traza depende del anexo) y «Materiales y secciones». Claves en
`es` y `en`. `includeMethodFreeBodies` e `includeMaterials` son `true` por defecto, así que
ningún llamador existente cambia de comportamiento.

## 4. Fronteras

`npm run verify:protected` pasa **sin `--update`**: 50 archivos verificados, frontera intacta.
No se tocó `src/engine/**`, `src/workers/**`, `src/data/**`, `src/store/ProjectContext.tsx` ni
`src/types.ts` — sólo se leen. `src/analysis-methods/**` tampoco se tocó: los resultados que ya
publicaba llevaban toda la topología que un DCL necesita.

## 5. Verificación ejecutada

```
npm run verify
  lint                     ✓
  verify:docs              ✓
  verify:protected         ✓  Frontera protegida intacta: 50 archivos verificados.
  test                     ✓  313 archivos · 2996 pruebas · 8 omitidas
  build                    ✓
  verify:perf              ✓  822 617 bytes / 212 951 gzip (sin techo bloqueante)
  verify:entry             ✓  chunk de entrada limpio
  verify:browser-bundle    ✓  84 archivos sin construcciones de Node
```

`pdf-lib` y MathJax siguen fuera del chunk de entrada (`grep PDFDocument dist/assets/index-*.js`
→ 0): los módulos nuevos importan `pdf-lib` sólo como tipo, igual que el resto de `utils/pdf/`.

**Pruebas nuevas (28):**

- `pdfMethodScenes.test.ts` (10): la dirección de la axial según el extremo conservado y según el
  signo; el corte perpendicular a una barra y su rebase con dos o más; qué nudos conserva cada
  corte; el encuadre por nudo; la estación del corte dentro del tramo; el corte de planta a la
  altura del punto de inflexión y qué queda por encima.
- `pdfEquation.test.ts` (8): la partición por el `=` de primer nivel, la unidad separada contra
  vocabulario cerrado, el apilado sobre el mismo `=`, y **que la identidad sola no se dibuja**.
- `pdfMaterialsSection.test.ts` (5): la ficha completa cuando hay identidad; un perfil repetido
  en una sola ficha; que **no** se inventa un perfil a partir de `A` e `I`; el identificador
  desconocido declarado; y la parte apagable sin hueco en la numeración.
- `pdfMethodSection.test.ts` (+11): los once métodos dibujan al menos una figura más con el
  interruptor encendido que apagado, y apagarlo no se lleva la aritmética.
- `mathLatex.test.ts` (+2), `calculationPdf.test.ts` (actualizado: 8 → 9 partes).

**Revisión visual**: se generó una memoria por método (armadura, viga continua, viga
empotrada-apoyada, pórtico con carga lateral) y por familia de material, se rasterizaron las
páginas con el mismo `pdfjs-dist` que usa la vista previa, y se corrigieron sobre lo visto: la
leyenda que pisaba la reacción, el rótulo que caía sobre el glifo de apoyo, el rótulo del corte
que chocaba con el cortante de la columna extrema, y la mitad descartada de la viga que se
dibujaba en tinta como si formara parte del cuerpo libre.
`node scripts/inspect-pdf.mjs` no reporta hallazgos nuevos: los tres de margen izquierdo son la
portada, y son previos a este cambio.

## 6. Límites de lo entregado

- La masa y el peso propio siguen sin calcularse cuando un miembro no lleva `density` propia.
  Asignar un material de catálogo no la copia al miembro, y la parte **lo dice** en vez de
  sustituirla por la de la ficha y reportar una masa que el modelo no tiene.
- Las escenas de método no dibujan cargas distribuidas sobre porciones de armadura, porque
  `freeBodyEquations` tampoco integra su contribución: las dos se retiran juntas y por la misma
  razón.
- No se añadió ninguna comprobación normativa. `f_y` se reporta como dato del material; el
  documento sigue reportando solicitaciones, no verificaciones.
