# Verificación AISC 360 (LRFD) — CRI-45, primera fase

**Clasificación:** `CANONICAL`

Contrato de la primera verificación por norma real de StructureCo
(`src/features/results/aisc360Design.ts`), la pieza que
[Índice elástico estimado (η)](structureco-elastic-index.md) señalaba como
ausente. Recoge qué comprueba, qué deja fuera a propósito y por qué un dato
faltante produce un `gap` con su nombre exacto en vez de un ratio fabricado —
la misma regla dura que gobierna η, aplicada a un módulo distinto.

## Qué es, y en qué se diferencia de η

η es una estimación elástica orientativa: σ*/Fy, sin φ, sin pandeo, sin
interacción de código. Este módulo es la verificación normativa que η nunca
pretendió ser: AISC 360-16, método LRFD, con sus propios factores φ, su propia
mecánica de pandeo (E3) y su propia interacción axil-flexión (H1). Los dos
leen el mismo axil, momento y cortante ya resueltos por el solver —ninguno
altera el Analysis Engine— pero no comparten fórmula ni significado, y ninguno
sustituye al otro.

## Alcance de esta fase

- **Sólo perfiles I doblemente simétricos de catálogo** (`shapeType === 'I'`,
  catálogo AISC o Eurocódigo indistintamente: la forma física es la misma y
  las ecuaciones no distinguen de qué tabla salió un ala o un alma). Cualquier
  otra forma, o una sección sin `sectionOrigin === 'catalog'`, es
  `section-not-supported`.
- **Sólo material de catálogo** (`materialOrigin === 'catalog'`): Fy y E salen
  los dos de ahí, nunca de `member.E`. Sin esa identidad, `material-catalog`.
- **Flexión mayor únicamente.** El motor de análisis es plano: no hay momento
  fuera de plano, así que la interacción H1 nunca lleva término Mry.
- **Compresión (E3), las dos direcciones.** El plano del pórtico usa la
  longitud propia del miembro; fuera de plano exige que el modelo declare
  `designUnbracedLengthMinor` — el modelo 2D no sabe nada de lo que pasa fuera
  de su plano, así que ausente equivale a «sin arriostramiento intermedio»,
  la lectura conservadora.
- **Tracción (D2-a), sólo fluencia:** `φPn = 0,90·Fy·Ag`. La rotura en sección
  neta (D2-b) exige Fu y área neta —agujeros de pernos, que este modelo no
  representa— y se declara `tensionRuptureNotEvaluated`, nunca un Fu supuesto.
- **Flexión (F2), sólo la meseta plástica:** `Mn = Mp = Fy·Zx`, y sólo si el
  perfil es compacto (B4) y `Lb ≤ Lp`. Más allá de Lp, la fórmula exige `Lr`,
  que depende de la constante torsional J y de `rts` — ausentes del catálogo
  de secciones. Se declara `ltb-inelastic`, nunca un Mn con un J supuesto.
- **Cortante (G2.1), sólo alma compacta** (`h/tw ≤ 2,24·√(E/Fy)`, Cv1 = 1,
  φv = 1). Con alma esbelta hace falta `kv`, con o sin rigidizadores, que este
  módulo no modela: se declara `shear-slender-web`.
- **`h` del alma se aproxima como `d − 2·tf`.** El catálogo no tabula el radio
  de acuerdo `k` de cada perfil; es la aproximación estándar cuando falta `k`,
  ligeramente del lado seguro, y se declara como aproximación en el código en
  vez de fingir una `h` exacta.
- **La envolvente es la del análisis activo**, no la de todas las
  combinaciones LRFD a la vez — mismo alcance y mismo motivo que η. Verificar
  todas las combinaciones y quedarse con la peor por miembro queda para una
  fase posterior.

Un dato o condición ausente produce un `Aisc360Gap` con su causa exacta
(`section-not-supported`, `material-catalog`, `non-compact-section`,
`ltb-inelastic`, `shear-slender-web`) y **nunca** un ratio fabricado. Una
barra de armadura no tiene flexión ni cortante por formulación: eso es
`not-applicable`, no un gap — no le falta un dato, no le aplica el estado
límite.

## Metadatos nuevos, fuera del Analysis Engine

`MemberModel` declara cuatro campos opcionales que **sólo lee este módulo**:
`designEffectiveLengthFactorMajor/Minor` (K por eje) y
`designUnbracedLengthMinor` / `designUnbracedLengthLateralTorsional` (Ly y Lb,
en metros). El solver, la matriz de rigidez y cualquier resultado existente
son idénticos con o sin ellos declarados; ausentes equivalen a K = 1 y a la
longitud geométrica del miembro respectivamente.

## Qué gobierna

Cada barra evaluable publica hasta cuatro lecturas — axil, flexión, cortante,
interacción H1 — y `governingRatio` es **el mayor ratio entre las
disponibles**, nunca el de la interacción a solas: con demanda de flexión nula
la interacción no se calcula (`not-applicable` la bloquea antes), así que no
hay caso en que H1 esconda un ratio axial mayor.

## Qué falta

- Envolvente sobre todas las combinaciones LRFD activas, no sólo el análisis
  desplegado.
- Perfiles no compactos (F3) y tramo inelástico/elástico de pandeo
  lateral-torsional (F2, `Lb > Lp`): exigen J y `Cw`/`rts`, que el catálogo de
  secciones no tabula todavía.
- Rotura en sección neta a tracción (D2-b): exige Fu y área neta.
- Cortante con alma esbelta y rigidizadores (G2.1 con `kv` reducido).
- Flexión menor y torsión: el motor de análisis 2D no calcula ninguna de las
  dos.
- Un recorrido de QA con navegador real dedicado a este panel — por ahora la
  cobertura es de pruebas unitarias (`aisc360Design.test.ts`) y el QA general
  de la aplicación, que no ejercita específicamente esta tarjeta.

## Verificación

```bash
npx vitest run src/features/results/aisc360Design.test.ts src/features/inspector --maxWorkers=1
```
