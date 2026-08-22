# CRI-42 — «Structural Health» pasa a Índice elástico estimado, sin apariencia normativa

**Fecha:** 2026-08-14 12:50
**Agente:** Claude Code
**Rama:** `crisdlm302/cri-42-p1-replantear-structural-health-como-demanda-elastica`

## Qué cambió

La lectura de demanda elástica deja de ser un medidor de «salud» con semáforo y
pasa a ser un **Índice elástico estimado (η)** trazable, con dos estados
explícitos: `available` y `unavailable`. η sólo se publica cuando **cada** dato
que lo forma es verificable; si falta uno, la interfaz dice exactamente cuál en
lugar de rellenarlo.

Desaparecen, por contrato: el `Fy = 250 MPa` de reserva, el `W` deducido de A e I
(rectángulo equivalente `h = √(12·I/A)`), el estado `safe`, el umbral visual de
0,85 y el semáforo verde/ámbar/rojo. Se integra `reliability`: `unreliable` y
`failed` bloquean η, `limited` lo publica marcado como limitado.

Resumen, Inspector y lienzo consumen ahora **el mismo view-model**
(`elasticDemand`), así que no pueden contradecirse en valor, estado ni
significado.

## Por qué

Tarea CRI-42 (P1) en Linear. La lectura anterior tenía apariencia de verificación
normativa sin serlo: publicaba un ratio con datos inventados cuando el modelo no
los tenía, lo clasificaba como «seguro / carga elevada / sobre el límite» y
marcaba un umbral de aviso en 0,85 sin derivación técnica documentada. Un usuario
podía leer «régimen elástico holgado» sobre un η calculado con un acero A36
supuesto y un módulo elástico deducido de A e I — ninguno de los dos auditable.

Los patrones competitivos revisados en la tarea (Dlubal, RISA-3D, ETABS, SkyCiv)
coinciden en el principio aplicado aquí: si el check no puede realizarse, debe
existir un estado **no evaluado**, no un ratio inventado.

## Archivos tocados

### Contrato (Fase A)
- `src/features/results/elasticDemand.ts` — reescrito. Nuevo contrato
  `available / unavailable` con procedencia por dato. `memberSectionModulus` y
  `memberYieldStrength` devuelven `null` en lugar de un valor de reserva.
  Nuevos: `sectionElasticIndex`, `memberElasticIndex`, `elasticDemandGate`,
  `memberElasticIndexView`, `elasticDemandView`, `elasticIndexBand`,
  `elasticIndexColor`, `ELASTIC_REFERENCE_RATIO`. Eliminados:
  `FALLBACK_YIELD_STRENGTH`, `DEMAND_WARNING_RATIO`, `demandTone`,
  `demandToneColorVariable`, `demandColorVariable`, `memberDemandRatios`.
- `src/features/results/elasticDemand.test.ts` — reescrito (23 casos): límites
  exactos, `unavailable` por cada dato, reliability, identidad explícita,
  invariancia de unidades y consistencia entre superficies.
- `src/engine/units.ts` + `units.test.ts` — añadida la cantidad de presentación
  `sectionModulus` (m³ / mm³ / cm³ / in³). W se mostraba en m³ fijo dentro de un
  proyecto imperial. Es tabla de presentación: no toca solver, teoría ni schema.

### Interfaz (Fase B)
- `src/features/results/ElasticDemandCard.tsx` — **nuevo**, sustituye a
  `StructuralHealthMeter.tsx`. Publica `η 0.52 · 52 % de Fy de referencia`,
  miembro gobernante con acción **Localizar**, procedencia de Fy y de W con su id
  de catálogo, N* y M* con la nota de envolvente conservadora, disclosure
  **Cómo se obtiene** (`N* → A → M* → W → σ* → Fy → η` con la cadena numérica),
  la nota de que η = 1 sólo alcanza el Fy de referencia, y el estado
  **No disponible** con el dato que falta y su acción contextual.
- `src/features/results/ElasticDemandCard.test.tsx` — **nuevo**, 13 casos.
- `src/features/results/StructuralHealthMeter.tsx` / `.test.tsx` — **eliminados**.
- `src/features/results/ResultSummary.tsx` — monta la tarjeta nueva.
- `src/features/inspector/InspectorNarrativeCard.tsx` — conserva la narrativa de
  régimen (axil / flexión / combinado, que describe mecánica y no seguridad) y
  sustituye veredicto y medidor por el view-model compartido. Recibe `analysis`
  para compartir la puerta de confiabilidad.
- `src/features/inspector/InspectorNarrativeCard.test.tsx` — **nuevo**, 7 casos.
- `src/features/inspector/InspectorProperties.tsx` — pasa `analysis`.
- `src/features/canvas/StructuralCanvas.tsx` — el mapa consume
  `elasticDemandView(...).ratios`; el corte contextual usa `sectionElasticIndex`
  con la misma puerta y muestra `η n/d` cuando no hay dato verificable.
- `src/features/canvas/CanvasGeometryLayer.tsx` — rampa secuencial
  (`elasticIndexColor`) y `data-demand-band` para redundar la magnitud sin color.

### Diseño y documentación
- `src/design-system/tokens.css` — nuevos roles `--sc-color-demand-base`,
  `--sc-color-demand-peak`, `--sc-color-demand-reference` en Día y Noche.
- `src/design-system/tokens.test.ts` — los tres entran en el gate de contraste
  ≥ 3:1 contra el lienzo, en ambos temas.
- `src/styles.css` — bloque de estilos reescrito: `.elastic-demand`,
  `.elastic-index-*`, `.elastic-how`. Sin clases `tone-safe/warning/overstressed`
  ni marca del 0,85.
- `src/i18n/catalogs.ts` — familia `elastic.*` en es/en; eliminadas
  `results.health*` y `inspector.narrative{Utilization,Safe,Warning,Overstressed,Basis*}`.
- `docs/architecture/structureco-elastic-index.md` — **nuevo**, `CANONICAL`.
- `docs/README.md` — el doc entra en el índice canónico.

## Accesibilidad

- Eliminado `role="meter"` de las dos superficies. η puede superar 1 y el
  contrato ARIA exige `aria-valuenow ≤ aria-valuemax`: el medidor anterior
  publicaba un contrato imposible. El riel es ahora decorativo
  (`aria-hidden="true"`) y el valor y la banda viajan en texto.
- Nada depende sólo del color: banda nombrada en texto, estilo de borde por
  banda, textura del relleno al alcanzar la referencia y `stroke-dasharray` en el
  lienzo.
- Objetivos táctiles de 44 px en Localizar, acción contextual y disclosure.

## Cómo verificar

```bash
npx vitest run src/features/results src/features/inspector src/features/canvas src/design-system src/i18n src/engine/units.test.ts --maxWorkers=1
```

```bash
npx tsc -b --noEmit
```

Smoke visual ejecutado sobre `npm run dev` (localhost:5173), modelo académico
Hibbeler:

- Miembro **sin** identidad de catálogo ⇒ `status="unavailable"`,
  `blocker="no-evaluable-member"`, «Falta Fy» + «Falta W» y acción «Localizar AB
  y asignar material o sección del catálogo». Antes este mismo caso publicaba un
  η con A36 supuesto.
- Tras asignar A992 + W8x31 ⇒ `status="available"`, `η 0.05` idéntico en Resumen
  e Inspector, `W · sección = 27.5 in³` (Sx real de W8x31), procedencia con id de
  catálogo, cadena de derivación completa.
- Cambio de unidades kip-ft ⇄ kN-m: **η no se mueve** (0.05 en ambos); la cadena
  convierte (`18.8039 MPa / 345 MPa` ⇄ `2.72727 ksi / 50.038 ksi`).
- `document.querySelectorAll('[role="meter"]').length === 0`.
- Lienzo: barra con `data-demand-ratio="0.055"`, `data-demand-band="low"` y color
  de rampa; la selección sigue ganando sobre el color de demanda.
- Tokens: Día `#5f8f9e / #0f4c5c / #6a3fa0`, Noche `#6f9fb0 / #a9dcea / #c4a6f5`.
- Móvil 375×812: la tarjeta mide 347 px, la rejilla colapsa a una columna, sin
  scroll horizontal de página, objetivos táctiles de 44 px.
- Consola sin errores.

## Fuera de alcance (respetado)

No se tocó el solver ni la teoría estructural. No se añadieron checks AISC,
LRFD/ASD, φ/Ω, pandeo, LTB, interacción normativa P-M ni resistencia de sección
— eso es CRI-45. No se añadieron campos al schema ni propiedades custom de
resistencia.

## Pendiente / siguiente paso

- **Sin merge a `main` y sin publicar Pages**, según lo pedido.
- Las skills recomendadas en CRI-42 (`visualization-strategy-and-critique`,
  `statistical-and-uncertainty-visualization`,
  `accessibility-and-inclusive-visualization`, `testing-data-visualizations`,
  `frontend-testing-debugging`, `react-best-practices`) **no están instaladas en
  este entorno**; se buscaron y no aparecen en el registro. Se trabajó con las
  disponibles: `superpowers:test-driven-development` (todo el contrato y las tres
  tarjetas se escribieron test-first, con RED verificado) y
  `superpowers:verification-before-completion`.
- **Gate documental roto en `main`, ajeno a CRI-42:**
  `docs/superpowers/plans/2026-08-14-datasheet-editor-cri-82.md` no tiene línea
  de clasificación, así que `npm run verify:docs` falla con 1 problema desde el
  commit de CRI-82. Esta rama no lo toca y no añade problemas nuevos; conviene
  arreglarlo aparte.
- `src/features/canvas/ToolBar.test.tsx` falló una vez en una tanda grande y pasó
  en la repetición de la misma tanda y en aislamiento, en esta rama y en `main`.
  Es un flake de temporización del sheet móvil, no una regresión de este cambio.
