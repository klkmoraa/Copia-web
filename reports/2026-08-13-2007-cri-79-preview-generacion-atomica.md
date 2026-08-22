# CRI-79 · Fase 2 de CRI-38 — Preview, generación atómica y reversibilidad

**Fecha:** 2026-08-13 20:07
**Agente:** Claude Code
**Rama:** main (local, sin push)

## Qué cambió

El núcleo determinista de la fase 1 (CRI-78) quedó conectado al proyecto real. Ahora una
geometría generada se puede previsualizar sin tocar el modelo y confirmar como un solo lote
reversible:

- **Reubicación de identidad** — `placeGeneratedStructure` traduce los IDs locales del núcleo
  (`N1…`, `M1…`) a IDs libres del proyecto destino, con la misma regla que el resto del editor.
- **Ghost no persistente** — `createStructureGenerationGhost(params)` devuelve la geometría que
  se vería, sin IDs de entidad y sin forma de `ProjectModel`.
- **Comando atómico** — nuevo `ProjectCommand` de tipo `structure.generate`, con precondición de
  estado y verificación de la geometría revisada.
- **Preparación y confirmación** — `prepareStructureGeneration` / `applyPreparedStructureGeneration`,
  el mismo contrato que ya usan la edición estructural (CRI-36/37) y la reparación topológica.
- **Un solo undo/redo e invalidación de resultados** — `executePreparedStructureGeneration` en
  `ProjectContext`, por la ruta reversible compartida.

No hay UX final, panel de parámetros, cargas automáticas, 3D ni asociaciones paramétricas
persistentes: ese es el alcance de CRI-80 (fase 3).

## Por qué

Es exactamente el alcance de CRI-79. La fase 1 dejó la geometría probada pero aislada; esta fase
la mete en el proyecto sin romper ninguna de las garantías que el editor ya daba: cancelar no
muta, un preview obsoleto no se aplica, generar 22 entidades no llena el historial de 22 pasos y
un resultado de análisis previo no sobrevive a un cambio de modelo.

## Decisiones de contrato

- **El comando lleva parámetros, no geometría.** `structure.generate` transporta `params`,
  `sourceSnapshot` y `generatedSnapshot`; al compilar, regenera la geometría con el núcleo
  determinista y la rechaza si no coincide con la que se revisó. Un comando que transportara
  nodos y miembros sería un bus para inyectar cualquier geometría — exactamente lo que el
  comentario de `topology.repair` advierte —; éste no puede crear nada que el núcleo no produzca
  a partir de esos mismos parámetros. Es la garantía de determinismo de la fase 1 usada como
  mecanismo de seguridad, no sólo como propiedad probada.
- **Cancelar es no confirmar.** Preparar calcula todo sobre copias: no muta el proyecto, no
  reserva identidad y no deja rastro. Dos previews consecutivos descartados reclaman los mismos
  IDs, porque no se gastó ninguno.
- **El ghost no puede persistirse.** Sus claves (`structure-generation-ghost-N1`) no son IDs de
  entidad y no lleva ningún campo `id`, igual que el ghost de la edición estructural: ninguna
  ruta de guardado, análisis o historial puede confundirlo con estado confirmado. Se deriva sólo
  de los parámetros, así que dibujar el preview no clona el proyecto.
- **Confirmar reconstruye la operación autoritativa.** `applyPreparedStructureGeneration` no
  confía en los parches que trae el objeto preparado: recompila el comando sobre el proyecto
  actual y compara parche a parche, resultado incluido. Un preparado manipulado —geometría
  inyectada en `previewProject`, parámetros cambiados, operaciones recortadas— falla con un
  mensaje distinto en cada caso, sin escribir nada.
- **Coincidir no es fundir.** Un nodo generado que cae sobre un nodo existente produce el aviso
  `coincident-with-existing` y la geometría se inserta completa. Fundir nudos es una decisión del
  usuario (o de la reparación topológica), nunca un efecto oculto de generar. La tolerancia del
  aviso es la del proyecto **fusionado**, que es la que de verdad se aplicaría después.
- **Lo confirmado deja de ser «generador».** El proyecto resultante no guarda marca de
  procedencia ni asociación paramétrica: los nodos creados sólo tienen `id`, `x`, `y` y `support`,
  y los miembros se editan y se borran con los comandos ordinarios.
- **Un lote, un undo.** Todo el parche entra por `commitReversibleProjectChange`, así que la
  geometría completa ocupa un punto de historial y el resultado vigente se invalida una vez, no
  una vez por entidad creada.

## Archivos tocados

- `src/data/generators/generatorPlacement.ts` — nuevo. Reubicación de IDs locales a IDs del
  proyecto y aviso de coincidencia con geometría existente.
- `src/data/generators/generatorGhost.ts` — nuevo. Ghost de generación, sin IDs y congelado.
- `src/commands/structureGeneration.ts` — nuevo. `prepareStructureGeneration` y
  `applyPreparedStructureGeneration`.
- `src/commands/projectCommand.ts` — nuevo tipo de comando `structure.generate` y su resultado
  (`nodeIds`/`memberIds` creados). No cambia ningún comando existente.
- `src/data/modelOperations.ts` — se exporta `nextEntityId` (antes `nextId`, privado) para que la
  reubicación reparta identidad con exactamente la misma regla que pegar, dividir o duplicar. Sin
  cambio de comportamiento.
- `src/store/ProjectContext.tsx` y `src/store/ProjectModelContext.tsx` —
  `executePreparedStructureGeneration` por la ruta reversible compartida.
- Pruebas nuevas: `generatorPlacement.test.ts` (10), `generatorGhost.test.ts` (8),
  `structureGenerateCommand.test.ts` (9), `structureGeneration.test.ts` (18),
  `ProjectContext.structureGeneration.test.tsx` (6). Cubren cancelación sin mutación, rechazo por
  estado obsoleto, rechazo por preparado manipulado, referencias e IDs válidos, undo/redo exacto
  con un solo paso, invalidación de resultados y salida como `ProjectModel` normal editable.
- `scripts/protected-baseline.sha256` — refresco deliberado: dos archivos nuevos bajo
  `src/data/**` más `modelOperations.ts` y `ProjectContext.tsx`. Ninguna matemática existente
  cambió.

## Cómo verificar

```bash
npx vitest run src/data/generators src/commands src/store/ProjectContext.structureGeneration.test.tsx --maxWorkers=1
```

Suite completa y compuertas ejecutadas: `npm run lint`, `npm run typecheck`, `npm test`
(185 archivos, 1711 pruebas en verde, 8 omitidas), `npm run verify:docs`,
`npm run verify:protected`, `npm run build`, `npm run verify:perf`. El bundle no crece de forma
apreciable porque ninguna superficie importa todavía la generación.

## Pendiente / siguiente paso

- **CRI-80 (fase 3)**: UX integrada —panel de parámetros, punto de inserción, resumen y avisos
  antes de confirmar, dibujo del ghost en el canvas— y QA Chromium/WebKit en escritorio y
  compacto. Nada de eso está en esta fase: aquí sólo existe el contrato que esa UX consumirá.
- El cambio y este reporte quedan **commiteados en local, sin push**, por indicación explícita del
  usuario. Codex no los verá hasta que se haga `git push origin main`.
