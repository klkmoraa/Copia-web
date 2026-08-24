# Índice elástico estimado (η) — contrato vigente

**Clasificación:** `CANONICAL`

Contrato de la lectura de demanda elástica de StructureCo (`src/features/results/elasticDemand.ts`)
tras CRI-42. Recoge qué significa η, qué **no** significa, cuándo puede publicarse
y por qué las tres superficies que lo muestran —Resumen, Inspector y lienzo— no
pueden contradecirse.

## Qué es η

η es una **estimación orientativa y trazable** de cuánta tensión normal elástica
tiene un miembro respecto del límite elástico declarado de su material:

```text
N*  →  A  →  M*  →  W  →  σ*  →  Fy  →  η

σ* = |N*| / A + |M*| / W
η  = σ* / Fy
```

- `N*` y `M*` son los **máximos absolutos de la envolvente** del miembro
  (`max(|maxAxial|, |minAxial|)` y `max(|maxMoment|, |minMoment|)`).
- `A` es el área del miembro tal y como la usa el solver.
- `W` es `sectionModulusX` del perfil de catálogo identificado. **Sólo se exige
  cuando hay flexión que evaluar**: si `M* = 0` —o el miembro es una barra de
  armadura, sin rigidez a flexión por formulación— la lectura es `σ* = |N*|/A` y
  W no interviene ni se declara.
- `Fy` es `yieldStrength` del material de catálogo identificado.

Todas las magnitudes viven en las unidades base internas (kN, m ⇒ kN/m²). El
sistema de unidades visible es presentación pura y **no puede alterar η**.

## Qué NO es η

- **No es una verificación normativa.** No hay φ ni Ω, ni AISC/LRFD/ASD, ni
  pandeo, ni LTB, ni interacción P-M de código, ni resistencia de sección. Eso
  pertenece al futuro módulo de diseño por norma (CRI-45), separado del Analysis
  Engine.
- **No es un factor de seguridad.** Se publica η, nunca 1/η: un «factor» invita a
  leerse como el coeficiente de una norma.
- **No es una declaración de seguridad estructural.** No existe el estado `safe`
  ni copy equivalente («seguro», «aprobado», «pasa», «salud»).
- **η = 1 no es «falla».** Significa exactamente que la estimación alcanza el Fy
  declarado del material, y nada más.

## Cuándo se publica η

Regla dura: **η sólo se publica cuando cada dato que lo forma es verificable.**
Un dato ausente produce `unavailable` con el nombre exacto de lo que falta;
nunca un ratio fabricado.

| Requisito | Cuándo aplica | Fuente admitida | Si falta |
|---|---|---|---|
| `Fy` | siempre | `materialId` con `materialOrigin === 'catalog'` | `gap: 'yield-strength'` |
| `W` | sólo si `M* ≠ 0` | `sectionId` con `sectionOrigin === 'catalog'` | `gap: 'section-modulus'` |
| Sección utilizable | siempre | miembro no rígido con `A > 0` | `gap: 'section-geometry'` |
| Confiabilidad | siempre | `reliability.level` ∈ {`reliable`, `limited`} | `blocker: 'unreliable'` |

Exigir W en demanda puramente axial dejaba «No disponible» una lectura que estaba
completa, y empujaba al usuario a asignar una sección cualquiera sólo para poder
ver el número. Cuando W no interviene, `section` es `null` y la interfaz lo dice
—«Demanda puramente axial»— en lugar de publicar una procedencia que no participó
en el cálculo.

Lo que se eliminó en CRI-42 y **no debe volver**:

- **`Fy = 250 MPa` de reserva.** Publicaba un η con apariencia de medida sobre un
  material que el producto no reconocía.
- **`W` del rectángulo equivalente `h = √(12·I/A)`.** Deducía un módulo elástico
  que el usuario no podía rastrear hasta ningún perfil real.
- **Inferencia por coincidencia numérica.** Igualar en `E`, `A` o `I` con una
  entrada del catálogo no es identidad; sólo el id explícito lo es (CRI-34).

## Cobertura: `complete` / `partial` / `unavailable`

Un modelo puede tener miembros que no se pueden evaluar junto a otros que sí.
En ese caso el mayor η **entre los evaluables no gobierna la estructura**: el
miembro más exigido puede ser precisamente uno de los que no se pudo leer.

- `complete` — todos los miembros con resultado entraron en la lectura.
  La interfaz puede decir «mayor índice del modelo».
- `partial` — hay miembros no evaluables. La interfaz dice **«mayor índice entre
  X/Y miembros evaluables»** y añade que el más exigido podría ser uno de los no
  evaluados. La palabra «gobernante» no aparece.
- `unavailable` — ningún miembro pudo evaluarse, o el análisis está bloqueado.

El view-model expone `coverage`, `evaluated`, `total` y `unevaluated` (el
conjunto de ids que el lienzo debe dibujar como **no evaluados**). El campo se
llama `highest`, no `governing`, precisamente para que ninguna superficie pueda
afirmar de más.

## `success ≠ reliable ≠ safe`

Tres preguntas distintas, tres respuestas separadas por construcción:

- `analysis.success` — ¿terminó el cálculo?
- `reliability.level` — ¿cuánto puede confiarse en los números? (`src/engine/reliability.ts`)
- η — ¿cuánta demanda elástica estimada hay? **Nunca** ¿es seguro?

`elasticDemandGate` es la única puerta:

- `reliable` → η se publica como lectura ordinaria.
- `limited` → η se publica **marcada como limitada**, junto con el **check que la
  gobierna** (`limitedCheck`: su etiqueta y su mensaje literal) y un acceso al
  Doctor del modelo. «Confiabilidad limitada» a secas es una etiqueta sobre la
  que el usuario no puede actuar.
- `unreliable` / `failed` → η **no se publica**; la superficie muestra el estado
  «No disponible» y el motivo.

## Escala: continua, con una sola referencia

**η es continua y no tiene bandas.** No hay umbral en 0,85 —no tenía derivación
técnica y funcionaba como un aviso normativo— y tampoco hay tercios
`low` / `moderate` / `high`: eran cortes inventados igual que el que
sustituyeron, y nombraban tramos que la física no distingue.

El único punto con significado propio es **η = 1**, y sólo significa «la
estimación alcanza el Fy declarado del material».

`elasticIndexPaint(ratio)` devuelve `{ color, atReference, saturated }`:

- **Por debajo de 1** — rampa continua `--sc-color-demand-base` →
  `--sc-color-demand-peak`.
- **Por encima de 1** — la rampa **sigue creciendo** en una segunda familia,
  `--sc-color-demand-reference` → `--sc-color-demand-reference-peak`, hasta
  `ELASTIC_SATURATION_RATIO` (= 2). Aplanar toda la sobre-referencia en un solo
  tono hacía que η 1,01 y η 4,00 se vieran idénticas, borrando la magnitud justo
  donde más importa.
- **Por encima del techo** — `saturated: true`. El color deja de distinguir y la
  leyenda **lo declara en palabras**, con el máximo real del modelo, en lugar de
  fingir que la rampa sigue midiendo.

El semáforo verde/ámbar/rojo original codificaba un juicio de seguridad y
desapareció por completo.

## Miembros no evaluados en el lienzo

Un miembro sin η publicable **no puede quedarse con su trazo técnico normal**:
sería indistinguible de uno con η baja, y el mapa parecería completo cuando no lo
está. Se dibuja punteado y atenuado con `--sc-color-demand-unevaluated`, lleva
`data-elastic-index="unevaluated"`, y la leyenda del lienzo declara la cobertura
(`X de Y evaluados · Z sin evaluar`), qué significa la rampa, dónde está la
referencia y si hay saturación.

## Envolvente conservadora

`N*` y `M*` pueden proceder de **secciones distintas** del mismo miembro.
Sumarlos es el caso más desfavorable posible, no la tensión real de ningún punto,
y así se etiqueta en todas las superficies. La lectura de un corte concreto
(`sectionElasticIndex`) sí usa los `N` y `M` de esa estación.

## Una sola fuente para tres superficies

```text
elasticDemand.ts
├── elasticDemandView(project, analysis)      → Resumen (ElasticDemandCard) + lienzo (mapa de demanda)
├── memberElasticIndexView(member, result, …) → Inspector (InspectorNarrativeCard)
└── sectionElasticIndex(member, N, M)         → corte contextual del lienzo
```

Ninguna superficie define umbrales, colores ni semántica propios. Un miembro sin
η publicable no recibe color de demanda —nunca un valor inventado— pero tampoco
pasa desapercibido: se marca como no evaluado y se cuenta en la cobertura.

## Accesibilidad

- El riel de magnitud es **decorativo** (`aria-hidden="true"`). No usa
  `role="meter"`: η puede superar 1 y el contrato ARIA de `meter` exige
  `aria-valuenow ≤ aria-valuemax`, así que el medidor anterior publicaba un
  contrato imposible.
- El valor (`η 0.52 · 52 % de Fy de referencia`), el alcance de la lectura y la
  cobertura van en **texto**: no hay información que dependa sólo del color.
- Alcanzar la referencia se redunda en forma —textura del relleno,
  `stroke-dasharray` en el lienzo— además de en color y en palabras.
- Los miembros no evaluados se distinguen por trazo punteado y opacidad, no sólo
  por color.
- Los cinco tokens de demanda cumplen ≥ 3:1 contra el lienzo en Día y Noche,
  verificado en `src/design-system/tokens.test.ts`.

## Qué falta

Una comprobación por norma real —con criterio, código y estado «no evaluado»
cuando el check no puede ejecutarse— es CRI-45 y **no pertenece a este
módulo**. Su primera fase, AISC 360 LRFD sobre perfiles I compactos de
catálogo, ya está implementada por separado: ver
[Verificación AISC 360 (LRFD)](structureco-aisc360-design-check.md).

## Verificación

```bash
npx vitest run src/features/results src/features/inspector src/design-system --maxWorkers=1
```
