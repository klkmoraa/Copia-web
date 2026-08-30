# CRI-78 · Fase 1 de CRI-38 — Core determinista de generación y contratos

**Fecha:** 2026-08-13 19:40
**Agente:** Claude Code
**Rama:** main (local, sin push)

## Qué cambió

Se añadió el núcleo puro de generación de estructuras 2D en `src/data/generators/`, separado
de React, comandos y persistencia. Una sola entrada, `generateStructure(params)`, traduce
parámetros en nodos, miembros y conectividad deterministas para cinco familias: viga continua,
pórtico, marco multicrujía/multinivel, cerchas Pratt/Warren/Howe y retícula estructural. Todas
las familias aceptan separaciones uniformes y listas no uniformes con el mismo contrato.

No hay UX, solver, cargas ni 3D: esta fase entrega contratos, geometría, validación y pruebas.

## Por qué

Es exactamente el alcance de CRI-78 (fase 1 de CRI-38): fijar el core determinista y sus
contratos antes de la fase 2 (preview, generación atómica y reversibilidad, CRI-79). Separarlo
de React desde el principio evita que la matemática de generación termine dentro de un
componente, y deja la geometría probada antes de conectarla a un comando de proyecto.

## Decisiones de contrato

- **Determinismo**: los mismos parámetros producen los mismos IDs (`N1…`, `M1…` densos y
  ordenados), las mismas coordenadas y el mismo orden de creación. Cada familia documenta su
  orden. Toda coordenada pasa por el mismo redondeo (12 cifras significativas) para que el ruido
  de punto flotante no dependa del orden de la suma.
- **IDs locales**: la geometría generada usa identidad propia. Reubicarla dentro de un
  `ProjectModel` real es responsabilidad de la fase de confirmación, no del núcleo.
- **Nada no solicitado**: sin apoyos por defecto (`baseSupport` ausente o `'none'` ⇒ modelo sin
  apoyos, con aviso), sin cargas de ningún tipo, y sin material o sección inventados: o se elige
  identidad de catálogo —y los números salen del catálogo, igual que en la edición múltiple— o
  se entregan números explícitos marcados como `custom`.
- **Cerchas explícitas y verificables**: Pratt, Warren y Howe se definen por índices de panel, no
  por coordenadas. El cordón superior sólo crea nudo donde llega un montante o una diagonal, así
  que la Warren sin montantes intermedios no deja nudos colgados sobre el cordón.
- **Reutilización**: la validación proyecta la geometría sobre un proyecto en blanco y la somete
  a `validateStructuralEditBoundary` (identidad, referencias, longitud cero, coherencia
  catálogo/procedencia), y encima añade lo que sólo el generador puede afirmar: nodos no
  coincidentes, roles completos, apoyos declarados = apoyos aplicados y resumen exacto.
- **Presupuesto**: 2.000 entidades por generación, el mismo tope que la replicación estructural,
  con aviso a partir de 400 para que la fase 2 sepa cuándo exigir preview.

## Archivos tocados

- `src/data/generators/generatorTypes.ts` — nuevo. Contratos: familias, parámetros, roles,
  avisos, resumen y `GeneratedStructure`.
- `src/data/generators/generatorSpacing.ts` — nuevo. `SpacingSpec` uniforme/lista, estaciones
  acumuladas y el redondeo compartido de coordenadas.
- `src/data/generators/generatorProperties.ts` — nuevo. Resolución de material y sección desde
  el catálogo o desde números explícitos.
- `src/data/generators/structureGenerators.ts` — nuevo. `generateStructure` y las cinco familias.
- `src/data/generators/generatorValidation.ts` — nuevo. Frontera de validación de lo generado.
- `src/data/generators/generatorFixtures.ts` — nuevo. Diez fixtures manuales (geometría escrita
  a mano, nodo por nodo y miembro por miembro) como referencia independiente.
- `src/data/generators/*.test.ts` — nuevos. 205 pruebas: fixtures, determinismo, topología,
  avisos, validación de parámetros y frontera estructural.
- `src/data/structuralEditing.ts` — se exporta `cleanCoordinate` para que el núcleo de generación
  use exactamente la misma limpieza de coordenadas que la edición estructural. Sin cambio de
  comportamiento.
- `scripts/protected-baseline.sha256` — refresco de la línea base protegida: los archivos nuevos
  viven bajo `src/data/**`. No cambió ninguna matemática existente.

## Cómo verificar

```bash
npm test
```

Sólo el núcleo de generación:

```bash
npx vitest run src/data/generators --maxWorkers=1
```

Resto de compuertas ejecutadas: `npm run lint`, `npm run typecheck`, `npm run verify:docs`,
`npm run verify:protected`, `npm run build`, `npm run verify:perf`. Todo en verde; el tamaño del
bundle no cambia porque el núcleo aún no lo importa ninguna superficie.

## Pendiente / siguiente paso

- **CRI-79 (fase 2)**: preview no persistente, comando atómico de generación con un solo
  undo/redo, reubicación de IDs dentro del proyecto real, detección de coincidencias contra el
  modelo existente y la UX de parámetros. Nada de eso está en esta fase.
- El reporte y el cambio quedan **commiteados en local, sin push**, por indicación explícita del
  usuario. Codex no los verá hasta que se haga `git push origin main`.
