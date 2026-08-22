# CRI-42 — `unreliable` deja de leerse como «limitada», y la causa respeta el idioma

**Fecha:** 2026-08-14 14:15
**Agente:** Claude Code
**Rama:** `crisdlm302/cri-42-p1-replantear-structural-health-como-demanda-elastica`

## Qué cambió

Dos correcciones finales antes del merge.

1. **`unreliable` / `failed` ya no se presentan como `limited`.** La puerta
   devolvía `confidence: 'limited'` al bloquear, así que la tarjeta pintaba la
   nota «Confiabilidad limitada» —una lectura que sí se publica— sobre un
   análisis que precisamente **no** se publica, y encima duplicaba el botón del
   Doctor del modelo (uno dentro de la nota, otro como acción del estado). Ahora
   `confidence` es `null` cuando hay bloqueo, la causa se muestra como
   *«Control que lo impide»* con su propio estilo, y hay **un solo** acceso al
   Doctor del modelo.
2. **La causa de confiabilidad sigue el idioma activo.** `ReliabilityCheck.label`
   y `.message` los redacta el motor en español fijo: son diagnóstico interno,
   escritos para un log. Se publicaban tal cual, así que una interfaz en inglés
   mostraba «Condición κ₁ del sistema equilibrado: 4.200e+10 supera 1e+10.».
   Ahora la causa se **reconstruye** en la capa de presentación desde los campos
   estructurados que el check ya trae (`id`, `value`, `limitedAbove`,
   `unreliableAbove`, `level`), traducida por `id`. El motor no cambia.

## Por qué

Revisión del usuario. El primero es una afirmación falsa sobre el estado del
resultado —`limited` y `unreliable` son cosas distintas por contrato, y la
interfaz las fundía— más un control repetido. El segundo dejaba texto interno en
español dentro de la interfaz en inglés, en el único punto donde el usuario
necesita entender por qué no puede confiar en el número.

## Archivos tocados

- `src/features/results/reliabilityCopy.ts` — **nuevo**. `reliabilityCheckLabel`
  y `describeReliabilityCheck`: traducen el check por `id` y rearman la frase
  desde sus campos numéricos, con caso aparte para los dos checks booleanos
  (`refinement`, `p-delta-convergence`) y para un valor no finito.
- `src/features/results/reliabilityCopy.test.ts` — **nuevo**, 5 casos: cobertura
  de los 11 ids en ambos idiomas, no filtrar `label`/`message` del motor, umbral
  correcto según el nivel, checks booleanos sin magnitud inventada, valor no
  acotable.
- `src/features/results/elasticDemand.ts` — `elasticDemandGate` devuelve
  `confidence: ElasticDemandConfidence | null` (null al bloquear) y renombra
  `limitedCheck` → `governingCheck`, que ahora también viaja en el estado
  bloqueado para poder citarlo. `MemberElasticIndexView` bloqueada expone
  `governingCheck`.
- `src/features/results/elasticDemand.test.ts` — caso explícito de que
  `unreliable` y `failed` nunca reportan `'limited'`, conservando la causa.
- `src/features/results/ElasticDemandCard.tsx` / `.test.tsx` — causa localizada,
  bloque `elastic-blocked-cause` distinto de la nota de `limited`, un único
  botón del Doctor, y pruebas de que la interfaz en inglés no contiene el texto
  del motor.
- `src/features/inspector/InspectorNarrativeCard.tsx` / `.test.tsx` — lo mismo en
  el panel.
- `src/i18n/catalogs.ts` — familia `reliability.check*` / `reliability.cause*` y
  `elastic.blockedGoverning`, en es/en.
- `src/styles.css` — `.elastic-demand-blocked-cause`, con borde de error para no
  confundirse con la nota ámbar de `limited`.

## Cómo verificar

```bash
npx vitest run src/features/results src/features/inspector src/features/canvas src/design-system src/i18n --maxWorkers=1
```

48 archivos / 349 tests en verde. `npx tsc -b --noEmit` y `npx oxlint src`
limpios.

Smoke sobre `npm run dev`: con el idioma en English la tarjeta se publica
íntegra en inglés («Elastic index — Not available», «Fy missing: …», «Locate AB
and assign a catalogue material or section»). Las ramas `limited` y `unreliable`
exigen un análisis mal condicionado que los modelos de ejemplo no producen; están
cubiertas por las pruebas de componente, que afirman el texto renderizado en
ambos idiomas y la ausencia del texto interno del motor.

## Pendiente / siguiente paso

- **`NumericQualityCard` sigue publicando `reliability.governing.message` y la
  lista `reasons` en español fijo.** Es una superficie anterior a CRI-42 y no
  entra en su alcance; además, `reasons` mezcla mensajes de incidencias del
  solver que no tienen forma estructurada que traducir. Ahora existe
  `reliabilityCopy` para arreglarlo por separado.
