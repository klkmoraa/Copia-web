# Reporte de entrega: métodos de resolución — Doble Integración

**Clasificación:** `AUDIT/TEMPORARY`
**Rama:** `claude/pdf-preview-before-download-5r1bp3`
**Commits:** `a03d667`, `201d6fb`, `e5ef258`, `ba43083`

---

## 1. Qué se pidió

Poder elegir entre 19 métodos de resolución según el tipo de estructura, y que el PDF
genere el procedimiento con cálculos y diagramas reales. El usuario propuso apoyarse en
alguna librería.

## 2. Tres cosas que la exploración cambió respecto de la petición

1. **No hay librería, y no hace falta.** Ningún paquete npm resuelve Hardy Cross, Kani,
   Takabeya o Castigliano con narración paso a paso: son métodos de cálculo a mano. Y el
   motor ya publica coeficientes polinómicos exactos por tramo (`DiagramSegment` para
   N/V/M, `DeformationSegment` para u, θ, v), así que integrar es aritmética sobre
   arreglos. **Cero dependencias nuevas.**
2. **Dos de los 19 ya existían.** «Matricial de la Rigidez» es lo que hace
   `analyzeProject`; y para marcos, «Elementos Finitos» con elementos Euler–Bernoulli
   exactos es el mismo método. Se registran como el método por defecto, no se
   reimplementan.
3. **19 métodos no caben en una entrega.** Se acordó con el usuario entregar **uno
   completo** —Doble Integración, el de su ejemplo— con la arquitectura lista para los
   demás.

## 3. La arquitectura: el motor sigue siendo la verdad

Cada método es un **narrador que calcula de verdad y se contrasta con el solver**. No hay
dos fuentes de resultados: si la Doble Integración no aterriza en las reacciones que ya
calculó `analyzeProject`, es un error, y la prueba lo caza.

El momento se construye por superposición sobre la estructura liberada,
`M(x) = M₀(x) + Σ Xᵢ mᵢ(x)`, y tanto `M₀` como cada `mᵢ` salen de `analyzeProject` sobre
modelos derivados — el mismo patrón que ya usan `influence.ts`, `certificate.ts` y
`buckling.ts`. Nada re-deduce la estática del solver: compone resultados que el solver ya
produjo. **`src/engine/**` queda byte a byte idéntico.**

| Módulo nuevo | Qué hace |
|---|---|
| `src/analysis-methods/polynomialAlgebra.ts` | Integrar, evaluar, superponer coeficientes. La constante de integración se deja en cero a propósito: es la incógnita que el método existe para responder. |
| `src/analysis-methods/structureClassification.ts` | Viga simple / continua / armadura / marco, y grado de hiperestaticidad. |
| `src/analysis-methods/beamAxis.ts` | Aplana los miembros sobre un eje continuo. |
| `src/analysis-methods/doubleIntegration.ts` | El método. |
| `src/analysis-methods/methodRegistry.ts` | Qué métodos existen y cuáles aplican. |
| `src/utils/pdf/pdfMethodSection.ts` | La sección 5 escrita por el método. |

## 4. Defectos encontrados por el camino

Ninguno se buscó: todos los cazaron las pruebas o la revisión visual.

- **El eje se orientaba según el primer nodo declarado.** Una viga capturada de derecha a
  izquierda se leía C, B, A. Ahora se orienta hacia +X.
- **Las liberaciones de los extremos se contaban como condiciones**, lo que hacía que una
  viga biapoyada se declarara mecanismo (`g = −1`). Sólo cuentan las interiores.
- **La reflexión de un miembro invertido ocurría después de la traslación**, espejando el
  diagrama respecto del punto equivocado.
- **Un miembro declarado al revés no cambiaba de signo.** Tiene el eje local *y*
  invertido: lo que él llama flexión positiva, el eje la llama negativa.
- **`X₁` salía `X_1` literal**: `needsMath` comparaba los dos saneadores y un subíndice
  Unicode se deletrea igual por ambos caminos.
- **`theta(0) = 0 x A`**: el separador `·` se traduce a « x » para unidades como
  «kip x ft», y θ en columna de prosa se deletrea.

## 5. Frontera protegida (autorizado)

Con autorización explícita del usuario: un campo opcional `solutionMethod` en
`ProjectSettings` (`src/types.ts`) y su lectura en `normalizeProject`
(`src/data/migrate.ts`) — sin esa segunda línea el campo se descartaría en cada guardado,
porque los ajustes se reconstruyen con lista blanca. Línea base refrescada con `--update`;
el gate confirmó que sólo esos dos ficheros se tocaron. **Ninguna matemática cambió.**

## 6. Verificación ejecutada

`npm run verify` completo, en verde:

```
Frontera protegida intacta: 50 archivos verificados.
Test Files  293 passed (293)
     Tests  2855 passed | 8 skipped (2863)
Chunk de entrada limpio
```

**El gate que hace confiable todo lo demás** (`doubleIntegration.test.ts`): sobre una
biapoyada, una empotrada-apoyada y la viga del ejemplo —empotramiento, dos rodillos y
voladizo—, las redundantes narradas coinciden con las reacciones de `analyzeProject` y la
flecha integrada coincide con la del motor, que llegó a ella por un camino distinto. En la
empotrada-apoyada la redundante sale exactamente **3qL/8**, la solución cerrada de libro:
comprobación independiente del solver, no sólo coincidencia con él.

Comprobado además a ojo en Chromium sobre el build real: el selector aparece en la viga y
no en el pórtico, y la sección 5 del PDF muestra la clasificación, la redundante contra el
matricial, M(x)/EIθ(x)/EIy(x) con coeficientes reales, las condiciones y la curva elástica.

## 7. Lo que esta fase no hace

- **Los otros 17 métodos.** La arquitectura queda lista —registro, aplicabilidad,
  narración, gate contra el solver— pero cada uno es su propia entrega.
- **Portal y Voladizo**: el usuario los autorizó, no están incluidos. Son aproximados y
  dan a propósito resultados distintos del exacto, así que cuando toquen el PDF tendrá que
  decirlo y mostrar la diferencia, para que nadie firme una aproximación creyéndola exacta.
- **Marcos y armaduras en Doble Integración**: el método no aplica ahí y el selector no lo
  ofrece.
- `npm run qa` sigue sin poder ejecutarse en este entorno (pide el canal `chrome`; falla
  igual en `origin/main`), así que no cuenta como verificación de esta fase.
