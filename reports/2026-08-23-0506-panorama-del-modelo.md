# Fase 2 del rediseño total · Panorama del modelo

**Fecha:** 2026-08-23 05:06
**Agente:** Claude Code
**Rama:** `claude/redeseno-total-mejoras-gimaf7`

## Qué cambió

El panel derecho ocupa 320 px permanentes. Sin selección, los gastaba en **dos tarjetas
que dicen lo mismo**: el resumen de selección en su estado vacío («Nada seleccionado» +
una raya) y, debajo, una ayuda explicando el mecanismo que el usuario descubre al primer
clic. Ninguna de las dos informa de nada.

Las dos se retiran y en su sitio va el **Panorama del modelo**: censo (nudos · barras ·
apoyos · cargas), extensión de la caja de nudos, casos de carga activos sobre el total,
qué se va a analizar, y el recuento de hallazgos del Model Doctor.

## Por qué

Segunda fase del plan de rediseño total. El criterio de qué entra en el panorama no es
«todo lo que se sepa del modelo», es **sólo lo que hoy no enseña ninguna otra superficie**:

- El **estado del análisis y la fiabilidad** ya viven en la barra superior y **no** se
  repiten aquí. Repetirlos en el hueco recién liberado sería cometer, otra vez, el
  defecto que este rediseño está retirando. Hay un gate que lo fija.
- El **censo del modelo** no tiene sitio en ninguna parte del producto: cuántos nudos,
  cuántas barras, cuántos apoyos, cuánta carga y qué tamaño ocupa.
- El **recuento de hallazgos del Model Doctor** sólo existía como un aviso pasajero que
  se va solo. Un modelo con hallazgos y el aviso ya cerrado no tenía forma de decirlo.

Un modelo sin un solo nudo no tiene censo que enseñar: tiene un primer paso. En ese caso
el panorama no pinta ceros, pinta «Este modelo está vacío» y la puerta al generador.

## Archivos tocados

**El panorama**
- `src/features/inspector/modelOverview.ts` — **nuevo**, puro (de datos a datos, sin
  React ni DOM). `buildModelOverview(project, selectedCombinationId)` y
  `modelExtent(project)`. `modelExtent` devuelve `null` cuando no hay nudos **o cuando
  todos caen en el mismo punto**: una cota de 0 × 0 ocupa un renglón y no informa de nada.
- `src/features/inspector/ModelOverview.tsx` — **nuevo**. Los dos estados. El recuento
  del Doctor se carga por `import()` diferido, igual que lo carga `WorkspaceShell`, para
  que el diagnóstico no entre en el chunk del área de trabajo sólo por enseñar un número;
  los dos llamantes resuelven al mismo chunk.

**Lo que sale**
- `src/features/inspector/InspectorProperties.tsx` — la rama sin selección monta el
  Panorama. **Una selección colgada** —un id de un objeto ya borrado— entra por la misma
  puerta: era el otro caso que caía en aquel estado vacío, y tratarlo igual es lo
  honesto, porque no hay nada que inspeccionar.
- `src/features/inspector/InspectorPrimitives.tsx` — `InspectorSelectionSummary` pierde
  la prop `empty`: el panel ya no monta un resumen cuando no hay nada que resumir.
- `src/styles.css` — `.model-overview*` sustituye a `.inspector-empty-state` y a las dos
  reglas `.inspector-summary.is-empty`, que quedaron sin consumidor. Consume roles, nunca
  literales.
- `src/i18n/catalogs.ts` — 12 claves nuevas en los dos idiomas;
  `inspector.emptyPropertiesHelp` se retira por quedarse huérfana.

**Gates**
- `src/features/inspector/modelOverview.test.ts` — **nuevo**, 8 casos: censo del pórtico
  de ejemplo, modelo vacío, extensión en un eje, extensión nula con nudos superpuestos,
  y una combinación borrada tratada como ausencia y no como error.
- `src/features/inspector/ModelOverview.test.tsx` — **nuevo**, 5 casos de render,
  incluido **que el panorama no repita el estado del análisis ni la fiabilidad**.
- `src/features/inspector/Inspector.test.tsx` — las dos pruebas que describían el estado
  vacío se reescriben contra el panorama, y comprueban además que lo retirado se fue.
- `qa.mjs` — el contrato de materia que medía `.inspector-summary` en su estado vacío no
  se borra, **se reapunta**: `verifyModelOverviewMaterial` mide el censo (agrupado con
  relleno, nunca elevado) y la acción (filete de medio píxel del sistema, sin sombra).
  La espera que buscaba `.inspector-summary.is-empty` pasa a `.model-overview`, y tras
  seleccionar se espera a que **aparezca** `.inspector-summary`, sin clase intermedia.

## Cómo verificar

```bash
npm run verify
PLAYWRIGHT_EXECUTABLE_PATH=/opt/pw-browsers/chromium npm run qa
```

Ambos ejecutados en esta sesión y leídos:

- `npm run verify` — **231 archivos / 2270 pruebas** pasan (8 saltadas), lint sin
  errores, `verify:docs` conforme, `verify:protected` = «Frontera protegida intacta: 38
  archivos verificados» **sin refrescar la línea base**, build correcto. Carga inicial
  877 566 bytes / 224 094 gzip.
- `npm run qa` — **151 checks**, `exit=0`, **ninguno en `false`**, cero mensajes de
  consola y cero errores de página.

**Sobre el conteo de checks, que baja de 153 a 151.** Se comparó el conjunto de claves,
no sólo el total, y la diferencia está entera explicada:

| Cambio | Claves |
|---|---|
| −1 retirado | `inspectorDesktopEmptySummaryIsGroupedNotElevated` — medía un estado que ya no existe. |
| +2 nuevos | `modelOverviewCensusIsGroupedNotElevated`, `modelOverviewActionUsesSystemHairline`. |
| −2 condicionales | `welcome430x932HasScrollableOverflow` y `welcome430x932TouchScroll`. |

Los dos últimos **no los retira este cambio**: `qa.mjs` los emite sólo cuando la
bienvenida desborda a 430×932, y su propio comentario documenta que a ese tamaño el
contenido «cabe exacto, medido: 932 = 932». La corrida de la fase 1 midió `scrollHeight`
935 y los emitió; ésta mide 932 y los omite. Es una medición inestable en ±3 px del
propio QA, ajena al panel derecho, y el contrato real de esa pantalla lo cubren
`FooterReachable`/`StepsReachable`, que sí son incondicionales y siguen en verde.

Evidencia visual en `reports/evidence/2026-08-23-panorama-del-modelo/`, con su README.

## Pendiente / siguiente paso

Un defecto de copia salió en la primera captura y quedó corregido: «1 activos de 2» era
falta de concordancia. La plantilla se reordena a «{active} de {total} activos», que vale
con cualquier número sin necesitar plural.

Sigue abierto, y es preexistente, el solape de la barra superior a 390 px anotado en el
reporte de la fase 1: no lo toca esta fase.

Siguiente fase del plan: **superficie «Datos» unificada** — `results`, `dense`,
`datasheet` y `doctor` se funden en una sola superficie con pestañas Resultados · Tabla ·
Revisión, y Resultados deja de vivir partido en dos componentes con dos lanzadores.

`npm run qa:webkit` no se ejecutó: WebKit no está instalado en este entorno.
