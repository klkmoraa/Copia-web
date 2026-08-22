# Space 3D · S3D-1 (experimental funcional)

**Clasificación:** `CANONICAL`

Estado a 2026-08-10. Este documento describe lo que S3D-1 **es** y, con el
mismo detalle, lo que **no** es. Ningún estado de aquí se afirma sin una
ejecución que lo respalde.

## Qué entrega

Un marco espacial elástico lineal de seis grados de libertad por nudo, con
superficie propia: crear, editar, analizar, visualizar, guardar, reabrir,
importar y exportar. Vive completo bajo `src/space3d/**` y
`src/features/space3d/**`.

- Elemento frame Euler–Bernoulli prismático 12×12, con `Iz` en el plano local
  `x–y`, `Iy` en `x–z` y torsión de St. Venant.
- Ensamblaje, restricciones homogéneas, casos y combinaciones lineales.
- Reacciones, acciones de extremo en ejes locales y auditoría de equilibrio 6D.
- Worker aislado con protocolo versionado y cancelación real.
- Códec portable estricto, almacenamiento con copia de seguridad, comandos
  reversibles e historial.
- Escena Three.js con rejilla, ejes globales, apoyos, cargas, triada local del
  miembro seleccionado, picking por identificador y deformada amplificada.

## Convenciones normativas

| Concepto | Valor |
|---|---|
| Ejes globales | `X`, `Y`, `Z` con **`Y` vertical**, igual que el editor 2D |
| GDL nodales | `[ux, uy, uz, rx, ry, rz]` |
| GDL de elemento | seis de `i`, luego seis de `j` |
| Unidades internas | `m`, `kN`, `kN·m`, `kN/m²`, `m²`, `m⁴`, `rad` |
| Triada local | `x` de `i` a `j`; `y` = referencia global proyectada y girada por `roll`; `z = x × y` |
| Inercias | `Iz` gobierna `v`–`rz`; `Iy` gobierna `w`–`ry` |
| Capacidad | 150 nudos / 300 barras, medida (ver más abajo) |

## Validación numérica

Cinco casos manuales con derivación cerrada en
`validation/space3d/manual-cases.md`, cuyos valores esperados produce
`validation/space3d/derive-expected.py` — un script que evalúa **sólo** las
fórmulas del documento y la definición geométrica de la triada, sin invocar el
solver.

| Caso | Qué ejercita | Estado |
|---|---|---|
| `S3D-AXIAL-001` | `EA/L` | PASA |
| `S3D-TORSION-001` | `GJ/L` | PASA |
| `S3D-BENDING-Z-001` | `Iz`, plano `x–y` | PASA |
| `S3D-BENDING-Y-001` | `Iy`, plano `x–z`, signo de `ry` | PASA |
| `S3D-FRAME-001` | miembro inclinado: transformación 12×12 completa | PASA |

Invariantes comprobados: linealidad en las cargas, covarianza ante rotación
rígida global, `roll` de `2π`, renumeración de nudos y barras, simetría con
`Iy = Iz`, y energía de deformación no negativa.

Los guardas de mutación se comprobaron provocando el fallo real: intercambiar
`Iy`/`Iz` rompe 5 pruebas, eliminar el término `GJ` rompe 12, construir la
triada como `cross(y, x)` rompe 9 e interpretar el `roll` en grados rompe 4.

## Oráculos externos — EJECUTADOS

| Motor | Versión | Casos | Resultado |
|---|---|---|---|
| OpenSees (`openseespy`) | 3.8.0 | 5/5 | PASA |
| PyNite (`PyNiteFEA`) | 3.0.0 | 5/5 | PASA |
| Frame3DD | — | 0/5 | `NOT_RUN` |

Dos implementaciones independientes de structureCo y entre sí reproducen los
cinco casos a precisión de máquina: la mayor discrepancia observada es
`4,2e-12` sobre un momento de reacción de `66,4 kN·m` (`6e-14` relativo).
Ninguna se toma como verdad única; se comparan por separado.

`validation/space3d/run-oracles.py` no importa nada de structureCo: construye
cada modelo con el API nativo de cada motor desde el mismo
`expected/*.project.json`, y guarda junto a cada salida el crudo del motor para
que el mapa de signos sea auditable. La comparación es sensible: perturbar `Iz`
un `1e-6` relativo rompe ambas.

Los motores se instalan **fuera del repositorio** (`py -3.12 -m pip install
openseespy PyNiteFEA`); no son dependencias del producto ni entran en el bundle.

**Frame3DD sigue sin ejecutarse.** Los espejos de SourceForge responden `403`,
el paquete de PyPI que comparte nombre es un generador de archivos de entrada y
no el solver, y no hay toolchain de C para compilar la fuente oficial. Sus
`.3dd` están escritos pero su equivalencia de ejes es una afirmación no
verificada; el manifiesto mantiene sus campos de salida en `null` y las pruebas
aparecen como omitidas con esa razón.

## Capacidad medida

`node scripts/check-space3d-capacity.mjs`, política de 2000 ms de resolución y
256 MiB de matrices por escalón:

| Nudos | Barras | GDL | Resolución | Matrices | Residual |
|---|---|---|---|---|---|
| 25 | 50 | 150 | 34 ms | 0,49 MiB | 1,0e-16 |
| 50 | 100 | 300 | 32 ms | 2,02 MiB | 7,4e-17 |
| 100 | 200 | 600 | 99 ms | 8,16 MiB | 7,7e-17 |
| 150 | 300 | 900 | 189 ms | 18,42 MiB | 1,5e-16 |

Capacidad aprobada: **150 nudos / 300 barras**, el límite publicado en
`SPACE3D_LIMITS`.

## Puente desde el editor 2D

El botón 3D de la mesa 2D abre el proyecto abierto convertido al dominio
espacial por `src/space3d/data/bridge2d.ts`. Es un adaptador explícito y de una
sola dirección: los stores no se acoplan y el solver no se vuelve híbrido.

Se conservan nombre, identificadores, unidades, topología, apoyos planos,
cargas nodales, casos y combinaciones; los nudos se levantan a `z = 0`.

Lo que un modelo plano no puede saber **no se inventa**. `G`, `Iy` y `J` quedan
a cero —valor que el validador rechaza y el editor pide completar— y ninguna
restricción fuera del plano se añade sola. Celosías, liberaciones de extremo,
muelles, apoyos inclinados, cargas en barra, desplazamientos impuestos y
efectos iniciales se publican como diagnóstico **bloqueante**: hasta que no se
resuelven o se reconocen explícitamente, la superficie no analiza.

Volver al 2D y reentrar reabre el mismo modelo derivado, que tiene
almacenamiento propio por proyecto de origen. Si el proyecto 2D cambió se
ofrece «Re-derivar desde 2D» en vez de sobrescribir el trabajo 3D.

## Fuera de alcance en S3D-1

- Cargas en barra, térmicas, de vano o de peso propio.
- Liberaciones de extremo, rótulas, muelles, apoyos inclinados y asentamientos.
- Deformación por cortante, alabeo, no linealidad geométrica o de material.
- Certificación de seguridad estructural.
- Compatibilidad con tecnologías de asistencia no probadas.

S3D-2 a S3D-4 no están implementados.
