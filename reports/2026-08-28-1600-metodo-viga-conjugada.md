# Reporte de entrega: métodos de resolución — Método de la Viga Conjugada

**Clasificación:** `AUDIT/TEMPORARY`
**Rama:** `claude/next-analysis-method-4f2j07`
**Commits:** ver el commit que acompaña este reporte

---

## 1. Qué se pidió

El usuario pidió proponer el siguiente método clásico a entregar. Se propuso el Método de la Viga
Conjugada — el complemento estático de la Doble Integración: en vez de resolver el problema de
contorno con cálculo directo, convierte cada apoyo por una tabla fija y lee el giro y la flecha
reales como el cortante y el momento de una viga ficticia cargada con `M(x)/EI`. El usuario
confirmó continuar.

## 2. Por qué éste sí es distinto: estática sobre una viga ficticia, no cálculo directo

La Doble Integración plantea `EI y″(x) = M(x)` y lo integra dos veces, con las condiciones de
contorno y continuidad cerrando un sistema de ecuaciones. La Viga Conjugada llega al mismo par
`θ(x), y(x)` por un camino físico distinto: construye una segunda viga —la conjugada— cargada con
la carga ficticia `w*(x) = M(x)/EI`, con cada apoyo real convertido por una tabla fija (`T' = ¬R`,
`R' = ¬T`, donde `T`/`R` son la restricción real de traslación y giro): un apoyo simple sigue
siendo simple, un empotramiento pasa a extremo libre, un extremo libre pasa a empotramiento. El
giro real es entonces el cortante de esa viga ficticia y la flecha real es su momento — la misma
estática que un lector ya sabe aplicar a una viga cargada cualquiera, sin escribir una integral.

Esa tabla de conversión sólo cierra limpiamente cuando no hay nada entre los dos extremos de la
viga: un apoyo interior necesitaría convertirse en una rótula del conjugado, y una rótula interior
en un apoyo del conjugado — ninguno de los dos casos se construye en esta entrega. Por eso el
alcance se restringe a un único tramo isostático (`indeterminacy === 0`, sin apoyo ni rótula entre
sus dos extremos), aunque ese tramo puede estar modelado con varios miembros: la viga simplemente
apoyada y el voladizo, con o sin cargas puntuales intermedias, quedan cubiertos.

## 3. La arquitectura

| Módulo nuevo | Qué hace |
|---|---|
| `src/analysis-methods/conjugateBeam.ts` | El método. Reutiliza `buildBeamAxis` (el mismo eje global que usa `doubleIntegration.ts`) para leer `M(x)` de `analyzeProject`, y `solveLinearSystem` de `engine/math.ts` para las constantes de integración por tramo — sin redundantes que buscar, porque el alcance garantiza grado 0. |

`M(x)` sale directamente del análisis ya calculado, igual que en `doubleIntegration.ts`: este
método no re-deriva el momento, sólo la curva elástica sobre él. **`src/engine/**` queda byte a
byte idéntico.**

Alcance declarado en `method.rejectedNotBeamConjugate` (no es una viga recta),
`method.rejectedIndeterminateConjugate` (grado > 0 — esta entrega no resuelve reacciones
redundantes, a diferencia de la Doble Integración) y `method.rejectedInteriorSupportConjugate`
(hay un apoyo o una rótula entre los dos extremos, incluida la combinación apoyo+rótula de una
viga Gerber). El registro (`methodRegistry.ts`) sólo comprueba la condición superficial —
`indeterminacy === 0` sobre una viga— y deja el resto, incluida la comprobación de apoyos
interiores, al propio `solveConjugateBeam`.

## 4. Frontera protegida (mismo patrón ya autorizado)

`solutionMethod` gana un duodécimo valor, `'conjugate-beam'`, en `src/types.ts` y
`src/data/migrate.ts` — los mismos dos ficheros que tocaron las diez entregas anteriores, por la
misma razón. Línea base refrescada con `--update`; el gate confirmó que sólo esos dos ficheros
cambiaron dentro de la frontera. **Ninguna matemática del solver cambió.**

## 5. Verificación ejecutada

`npm run verify` completo, en verde (ver la salida del comando que acompaña este reporte).

El gate propio (`conjugateBeam.test.ts`):

- Viga biapoyada: ambos extremos son apoyo simple real y conjugado simple, con reacción de fuerza
  presente y reacción de momento ausente en los dos; giro y flecha coinciden con el solver con
  diferencia menor a 1e-9.
- Voladizo con carga uniforme: el extremo empotrado real se convierte en extremo libre del
  conjugado (sin ninguna reacción) y el extremo libre real en empotramiento del conjugado (con
  las dos); la reacción de momento en la punta —la flecha real ahí— coincide con `uy` que reporta
  el propio solver en ese nudo, con diferencia menor a 1e-6.
- Viga de dos miembros sin apoyo interior: la continuidad de giro y flecha en la frontera entre
  tramos se mantiene, y ambos residuos siguen por debajo de 1e-9.
- Rechazo correcto ante un pórtico y ante una armadura.
- Rechazo con `method.rejectedIndeterminateConjugate` ante una viga empotrada-apoyada (grado 1) —
  el caso que la Doble Integración sí resuelve y éste, deliberadamente, no.
- Rechazo con `method.rejectedInteriorSupportConjugate` ante una viga Gerber isostática en
  conjunto (tres apoyos y una rótula que la devuelve a grado 0): confirma que el rechazo mira el
  apoyo interior en sí, no sólo el grado de indeterminación global.

`TopBar.test.tsx` necesitó un ajuste: el selector de método sobre una viga biapoyada ahora ofrece
tres opciones (`matrix-stiffness`, `double-integration`, `conjugate-beam`) en vez de dos.

## 6. Lo que esta fase no hace

- **Vigas continuas con apoyo interior o rótula interior** (vigas Gerber, vigas de varios vanos
  determinadas por hiperestaticidad compensada) — la tabla de conversión de apoyos necesitaría un
  apoyo o una rótula del lado del conjugado que esta entrega no construye. Se rechaza
  explícitamente en vez de narrar una conversión a medias.
- **Vigas hiperestáticas** — a diferencia de la Doble Integración, esta entrega no busca
  redundantes: el método clásico se enseña sobre el tramo isostático, y extenderlo requeriría ya
  conocer `M(x)` por otra vía (lo que rompería el propósito de una segunda opinión independiente).
- `npm run qa` sigue sin poder ejecutarse en este entorno (pide el canal `chrome`; falla igual en
  `origin/main`), así que no cuenta como verificación de esta fase.
