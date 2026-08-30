# Oráculos externos ejecutados y mejoras de Space 3D

**Fecha:** 2026-08-10 09:10
**Agente:** Claude Code
**Rama:** main (18 commits locales, sin push)

## Qué cambió

Con autorización explícita se instalaron y **ejecutaron** motores externos de
análisis estructural para validar el solver de Space 3D. El gate 3D-G2, que
quedó pendiente en la sesión anterior, está superado con dos oráculos
independientes. Además se cerraron tres huecos funcionales que el QA dejó a la
vista.

## Por qué

El plan S3D-1 exige comparar contra al menos dos oráculos independientes. En la
sesión anterior ninguno estaba disponible y quedaron como `NOT_RUN`.

## Oráculos: resultado

| Motor | Versión | Casos | Resultado |
|---|---|---|---|
| OpenSees (`openseespy`) | 3.8.0 | 5/5 | **PASA** |
| PyNite (`PyNiteFEA`) | 3.0.0 | 5/5 | **PASA** |
| Frame3DD | — | 0/5 | `NOT_RUN` |

Los tres motores coinciden con las formas cerradas a precisión de máquina: la
mayor discrepancia observada es `4,2e-12` sobre un momento de reacción de
`66,4 kN·m`, es decir `6e-14` relativo.

La comparación no es decorativa: perturbar `Iz` un `1e-6` relativo en el solver
rompe las comparaciones con OpenSees y con PyNite en los casos sensibles a la
flexión.

`run-oracles.py` no importa nada de structureCo: construye cada modelo con el
API nativo de cada motor a partir del mismo `expected/*.project.json`, y guarda
junto a cada salida el crudo del motor para que el mapa de signos sea auditable.

**Los motores no son dependencias del producto.** Se instalan fuera del
repositorio (`py -3.12 -m pip install openseespy PyNiteFEA`), no entran en
`package.json`, en el lockfile ni en el bundle.

### Una diferencia de tolerancia, y por qué

structureCo pone a **cero exacto** la reacción en los grados de libertad libres:
ahí no hay reacción, hay un residuo numérico. OpenSees y PyNite sí lo publican.
Exigirle cero exacto a un motor externo compararía esa decisión de presentación
y no la física, así que la comparación externa usa en los GDL libres el mismo
suelo absoluto que ya emplea en los restringidos: `1e-9 kN`, que sobre acciones
de 100 kN son `1e-11` relativo. Ninguna otra tolerancia cambió.

### Frame3DD sigue pendiente

Razón concreta, no genérica: los espejos de descarga de SourceForge responden
`403`, el paquete de PyPI que comparte nombre (`pyFrame3DD` 0.0.2.1) es un
generador de archivos de entrada y no el solver, y no hay toolchain de C en el
equipo para compilar la fuente oficial. Sus `.3dd` quedan escritos pero **no
ejecutados**, con los campos de salida en `null` y las pruebas omitidas con esa
razón.

## Mejoras

- **Objetivo de análisis seleccionable.** Estaba fijado a `'LC1'`: el contexto
  exponía `setAnalysisTargetId` pero nada lo llamaba. Ni las combinaciones ni un
  proyecto con otros identificadores —importado o derivado de 2D— eran
  analizables; fallaban con `unknown-target` sin explicar por qué. Ahora el
  objetivo sale del proyecto, hay selector junto a Analizar y se realinea solo
  cuando el proyecto cambia y el anterior deja de existir.
- **Obsolescencia al cambiar de objetivo.** Un resultado de `LC1` no describe
  `CO1`.
- **Escala de la deformada.** Duplicar, reducir a la mitad y volver a la
  automática, sin tocar el modelo ni el resultado, con la escala vigente visible
  junto al dibujo.

## Archivos tocados

- `validation/space3d/run-oracles.py` — nuevo; ejecuta OpenSees y PyNite.
- `validation/space3d/build-manifest.py` — integra las corridas reales con
  versión, SO, comando y hashes; razón concreta para lo que sigue `NOT_RUN`.
- `validation/space3d/oracles/{opensees,pynite}/output/` — salidas y crudos.
- `validation/space3d/oracles/{manifest,runs}.json` — registro versionado.
- `validation/space3d/README.md` — estado real y cómo reproducirlo.
- `src/space3d/engine/oracleComparison.test.ts` — compara contra las salidas
  reales; tolerancias propias de la corrida externa.
- `src/space3d/store/Space3DProjectContext.tsx` — objetivo derivado del
  proyecto, realineado y con obsolescencia.
- `src/features/space3d/Space3DWorkspace.tsx` + `space3d.css` — selector de
  objetivo y controles de escala.
- `src/i18n/catalogs.ts` — claves ES/EN de los controles nuevos.
- `docs/architecture/` — gates y documento S3D-1 actualizados.

## Cómo verificar

```bash
npx vitest run src/space3d/engine/oracleComparison.test.ts --maxWorkers=1
```

```bash
npm.cmd run lint && npm.cmd run typecheck && npm.cmd run verify:protected && npm.cmd test && npm.cmd run build && npm.cmd run verify:perf && npm.cmd run verify:space3d
```

Resultados obtenidos:

- Suite completa: **134 archivos, 1011 aprobadas, 8 omitidas, 0 fallos**.
  Las 8 omitidas son 5 de Frame3DD y 3 preexistentes ajenas a Space 3D.
- Oráculos: 17 aprobadas, 5 omitidas (Frame3DD).
- `verify:protected`: 29 archivos de la frontera 2D intactos.
- Capacidad: 150 nudos / 300 barras, 201 ms en el escalón máximo.
- Build y `verify:perf` correctos.
- Navegador: selector con LC1/CO1, escala 4457,9 → 8915,8 → 4457,9, y
  obsolescencia al cambiar de objetivo.

## Pendiente / siguiente paso

- **Frame3DD** como tercer oráculo, si aparece un binario alcanzable o un
  toolchain de C. No bloquea 3D-G2, que ya tiene dos oráculos independientes.
- **Push**: 18 commits sólo en local. Codex no verá nada hasta confirmarlo.
- Space 3D sigue siendo **experimental**: sin certificación de seguridad
  estructural y sin prueba con tecnología de asistencia real.
