# Corpus de validación de Space 3D

Este directorio contiene la evidencia numérica de S3D-1. No es código de
producto: nada bajo `validation/` viaja en el bundle.

```
derive-expected.py        deriva los esperados desde las formas cerradas (no usa el solver)
emit-oracle-inputs.py     genera los modelos nativos OpenSees/Frame3DD desde los JSON
run-oracles.py            ejecuta OpenSees y PyNite y escribe sus salidas
build-manifest.py         reconstruye manifest.json con hashes, observables y corridas
manual-cases.md           entrada completa y derivación de cada caso
oracles/manifest.json     índice versionado de casos, observables y corridas externas
oracles/expected/*.json   modelo y resultado esperado de cada caso
oracles/opensees/*.tcl    modelos nativos OpenSees (ndm 3, ndf 6)
oracles/frame3dd/*.3dd    modelos nativos Frame3DD
oracles/*/output/*.json   salidas reales de cada motor, con su crudo al lado
oracles/runs.json         registro de ejecución con versión, SO y hashes
```

La prueba `src/space3d/engine/oracleComparison.test.ts` consume el manifiesto:
ejecuta el solver sobre cada modelo y compara **todos** los grados de libertad
declarados. Si un valor del archivo esperado no está cubierto por ningún
observable, la prueba falla — no existe la posibilidad de que un número quede
sin comparar en silencio.

## Regenerar el corpus

Desde la raíz del repositorio, en este orden:

```bash
python validation/space3d/derive-expected.py
python validation/space3d/emit-oracle-inputs.py
python validation/space3d/build-manifest.py
npx vitest run src/space3d/engine/oracleComparison.test.ts --maxWorkers=1
```

## Estado de los oráculos

| Fuente | Estado | Evidencia |
| --- | --- | --- |
| Formas cerradas manuales (5 casos) | **PASS** | `oracleComparison.test.ts` en verde |
| OpenSees 3.8.0 (`openseespy`) | **PASS** (5/5) | `oracles/opensees/output/`, `runs.json` |
| PyNite 3.0.0 (`PyNiteFEA`) | **PASS** (5/5) | `oracles/pynite/output/`, `runs.json` |
| Frame3DD | **NOT_RUN** | ejecutable inalcanzable — ver abajo |

Los tres motores coinciden con las formas cerradas a precisión de máquina: la
mayor discrepancia observada es `4,2e-12` sobre un momento de reacción de
`66,4 kN·m`, es decir `6e-14` relativo.

La comparación no es decorativa: perturbar `Iz` un `1e-6` relativo en el solver
rompe las comparaciones con OpenSees y con PyNite en los casos sensibles a la
flexión.

### Por qué las tolerancias externas no son las manuales

structureCo pone a **cero exacto** la reacción en los grados de libertad
libres: ahí no hay reacción, hay un residuo numérico, y publicarlo sería ruido
con aspecto de dato. OpenSees y PyNite sí lo publican. Exigirle cero exacto a
un motor externo compararía esa decisión de presentación y no la física, así
que la comparación externa usa en los GDL libres el mismo suelo absoluto que ya
emplea en los restringidos (`1e-9 kN`, es decir `1e-11` relativo sobre acciones
de 100 kN). El resto de tolerancias no cambia.

### Frame3DD sigue pendiente

Los espejos de descarga de SourceForge responden `403`, el paquete de PyPI que
comparte nombre (`pyFrame3DD` 0.0.2.1) es un generador de archivos de entrada y
no el solver, y no hay toolchain de C en el equipo para compilar la fuente
oficial. Los `.3dd` están escritos y versionados, pero **nunca se han
ejecutado**: su equivalencia de ejes es una afirmación no verificada,
`manifest.json` mantiene sus campos de salida en `null` y las pruebas aparecen
como `skipped` con esa razón concreta.

### Reproducir las corridas externas

```bash
python validation/space3d/run-oracles.py
python validation/space3d/build-manifest.py
npx vitest run src/space3d/engine/oracleComparison.test.ts --maxWorkers=1
```

`run-oracles.py` no importa nada de structureCo: construye cada modelo en el
API nativo de cada motor a partir del mismo `expected/*.project.json`. Junto a
cada salida se guarda el crudo del motor (`*.raw.json`) para que el mapa de
signos sea auditable.

Dependencias de los motores, instaladas **fuera del repositorio** y ausentes
del bundle:

```bash
py -3.12 -m pip install openseespy PyNiteFEA
```

No se copia código GPL de ningún proyecto al repositorio: sólo archivos de
entrada propios y las salidas que producen.

## Convenciones de traducción a los modelos nativos

- **OpenSees**: `geomTransf Linear $tag vecxz` — la documentación define
  `y_local = vecxz × x_local`. Con la terna diestra de S3D-1 eso se satisface
  tomando `vecxz = ẑ_local`, que es lo que emite `emit-oracle-inputs.py`.
  `element elasticBeamColumn` recibe las propiedades en el orden
  `A E G J Iy Iz`, con el mismo significado que en structureCo.
- **Frame3DD**: se emiten `Asy = Asz = 0` para desactivar la deformación por
  cortante e igualar la hipótesis Euler–Bernoulli. El ángulo `roll` se emite en
  grados, que es la unidad que espera el formato. Sin ejecución, sigue sin
  verificar.
- **PyNite**: para un miembro horizontal toma `y = [0,1,0]`; para uno inclinado,
  `z` horizontal y `y = z × x`. Ambas coinciden con la referencia `[0,1,0]` de
  S3D-1, así que `rotation` se deja en cero. La coincidencia no se asume: los
  casos de flexión con `Iy ≠ Iz` son los únicos sensibles a la orientación, y
  son los que la comprueban.
