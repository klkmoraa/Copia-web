# CRI-42 — cobertura, demanda axial sin W y escala continua (correcciones pre-merge)

**Fecha:** 2026-08-14 14:00
**Agente:** Claude Code
**Rama:** `crisdlm302/cri-42-p1-replantear-structural-health-como-demanda-elastica`

## Qué cambió

Seis correcciones sobre la primera entrega de CRI-42, antes del merge. Todas
apuntan a lo mismo: que la lectura no afirme más de lo que sabe.

1. **Cobertura explícita `complete` / `partial` / `unavailable`.** Con miembros no
   evaluables, el mayor η entre los evaluables ya no se llama «gobernante» —el
   más exigido del modelo puede ser justo uno de los que no se pudo leer—. El
   campo del view-model pasó de `governing` a `highest`, y la interfaz publica
   **«mayor índice entre X/Y miembros evaluables»** más la advertencia de que el
   más exigido podría estar fuera de la lectura.
2. **Demanda puramente axial sin W.** Si `M* = 0` —o el miembro es una barra de
   armadura, sin rigidez a flexión por formulación— bastan A y Fy. Antes esto
   salía «No disponible · Falta W», que era falso y empujaba a asignar una
   sección cualquiera sólo para ver el número.
3. **Escala continua.** Fuera `low` / `moderate` / `high` y los cortes 1/3–2/3:
   eran cortes inventados igual que el 0,85 al que sustituyeron. η es continua y
   el único punto con significado físico es η = 1.
4. **El mapa conserva magnitud por encima de η = 1.** La rampa sigue creciendo en
   una segunda familia hasta `ELASTIC_SATURATION_RATIO` (= 2); a partir de ahí
   **declara saturación** con el máximo real del modelo en lugar de fingir que
   distingue. Antes 1,01 y 4,00 se veían idénticas.
5. **Miembros no evaluados visibles como tales.** Ya no conservan el trazo técnico
   normal —eran indistinguibles de una η baja—: se dibujan punteados y atenuados
   con su propio token, y el lienzo tiene **leyenda** con cobertura, significado
   de la rampa, referencia y aviso de saturación.
6. **`limited` con causa.** La nota cita el **check gobernante** (etiqueta y
   mensaje literal desde `reliability.governing`) y ofrece abrir el Doctor del
   modelo. «Confiabilidad limitada» a secas no era accionable.

## Por qué

Revisión del usuario sobre la primera entrega. Cada punto era una afirmación de
más o una pérdida de información: llamar «gobernante» a un máximo parcial,
bloquear una lectura axial completa por un W que no interviene, reintroducir
cortes arbitrarios con otro nombre, aplanar la magnitud justo por encima de la
referencia, dejar los miembros no evaluados confundidos con los de demanda baja,
y etiquetar «limitada» sin decir por qué.

## Archivos tocados

- `src/features/results/elasticDemand.ts` — `ElasticCoverage`; `governing` →
  `highest`; `coverage`, `evaluated`, `total`, `unevaluated` y `limitedCheck` en
  el view-model; W exigido sólo con flexión (`section: ElasticSectionSource |
  null`); armadura tratada como libre de flexión por formulación;
  `elasticIndexBand`/`elasticIndexColor` sustituidos por `elasticIndexPaint`
  (`{ color, atReference, saturated }`); nueva constante
  `ELASTIC_SATURATION_RATIO`.
- `src/features/results/elasticDemand.test.ts` — 31 casos: cobertura parcial,
  axial sin W, W obligatorio en cuanto hay flexión, ausencia de bandas,
  monotonía por debajo y por encima de la referencia, saturación declarada y
  check gobernante de `limited`.
- `src/features/results/ElasticDemandCard.tsx` / `.test.tsx` — chip de cobertura,
  línea de alcance, nota de η ≥ 1, causa de `limited` con acceso al Doctor,
  cadena de derivación axial (`N* → A → σ* → Fy → η`).
- `src/features/inspector/InspectorNarrativeCard.tsx` / `.test.tsx` — mismo
  view-model, misma causa de `limited`, mismo tratamiento axial.
- `src/features/canvas/CanvasGeometryLayer.tsx` — `data-elastic-index`,
  `data-demand-at-reference`, `data-demand-saturated`, clase `is-unevaluated` y
  nueva prop `demandMapActive`.
- `src/features/canvas/StructuralCanvas.tsx` — leyenda del mapa de demanda con
  cobertura y saturación; corte contextual sobre `elasticIndexPaint`.
- `src/design-system/tokens.css` / `tokens.test.ts` — nuevos
  `--sc-color-demand-reference-peak` y `--sc-color-demand-unevaluated` en Día y
  Noche, ambos dentro del gate de contraste ≥ 3:1.
- `src/i18n/catalogs.ts` — familia `elastic.*` y `canvas.demandLegend*` en es/en;
  eliminadas las claves de banda.
- `src/styles.css` — chip de cobertura, línea de alcance, nota de referencia,
  causa de `limited`, miembro no evaluado y leyenda del lienzo.
- `docs/architecture/structureco-elastic-index.md` — secciones nuevas de
  cobertura, escala continua con saturación y miembros no evaluados; tabla de
  requisitos con la columna «cuándo aplica».

## Cómo verificar

```bash
npx vitest run src/features/results src/features/inspector src/features/canvas src/design-system src/i18n --maxWorkers=1
```

```bash
npx tsc -b --noEmit
```

`npx oxlint src` limpio. Smoke sobre `npm run dev` (localhost:5173):

- **Cobertura parcial** — «Pórtico de ejemplo» con material y sección de catálogo
  sólo en M1: `data-coverage="partial"`, chip «Cobertura parcial · 1 de 3
  miembros evaluados», alcance «Mayor índice entre 1/3 miembros evaluables ·
  miembro M1. El miembro más exigido del modelo podría ser uno de los no
  evaluados», y la palabra «gobernante» no aparece en la tarjeta.
- **Miembros no evaluados** — M2 y M3 con `data-elastic-index="unevaluated"`,
  trazo `2px, 4px`, opacidad 0,55 y color `--sc-color-demand-unevaluated`; M1
  evaluado con su color de rampa.
- **Leyenda** — «1 de 3 miembros evaluados · 2 sin evaluar» más la explicación de
  la rampa y de los punteados.
- **Saturación** — con IPE 80 en M1, η 2,09: `data-demand-saturated="true"` y la
  leyenda dice «Rampa saturada por encima de η 2.00: el color ya no distingue
  magnitud (máximo del modelo: η 2.09). Lee el número.» El color resuelve a
  `color-mix(… --sc-color-demand-reference-peak 100% …)` y el trazo lleva
  `7px, 3px`.
- **Axial sin W** — «Armadura triangular» con sólo material asignado a M1 (sin
  sección de catálogo): η 0,03 publicado, «W · sección —» y «Demanda puramente
  axial: W no interviene, bastan A y Fy». Antes: «No disponible · Falta W».
- Tokens nuevos: Día `#43206c` / `#8a8f8d`, Noche `#ede2ff` / `#7f8b8f`.
- Móvil 375 px: leyenda 359 px y tarjeta 347 px, sin desbordes ni scroll
  horizontal de página. Consola sin errores.

## Pendiente / siguiente paso

- **Sin merge a `main` y sin publicar Pages**, según lo pedido.
- Sigue vigente el gate documental roto en `main` y ajeno a CRI-42:
  `docs/superpowers/plans/2026-08-14-datasheet-editor-cri-82.md` no tiene línea de
  clasificación. `node scripts/check-docs.mjs` reporta ese único problema, el
  mismo antes y después de esta rama.
