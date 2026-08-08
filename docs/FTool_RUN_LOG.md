# Ejecución externa de FTool - SC-FT-01

Fecha: 2026-07-11  
Herramienta: FTool 4.01 para Windows  
Archivo reproducible: [`SC-FT-01.ftl`](./SC-FT-01.ftl)

## Modelo comparado

- Viga simplemente apoyada, luz total `L = 8 m`.
- Dos elementos colineales de `4 m`; el nodo central permite ingresar en FTool
  la carga puntual de miembro como carga nodal, tal como exige su interfaz.
- Acero isotrópico: `E = 200000 MPa`.
- Sección genérica: `A = 20000 mm²`, `I = 80000000 mm⁴`.
- Apoyo izquierdo articulado (`ux = uy = 0`) y derecho móvil vertical
  (`uy = 0`).
- Carga puntual central global: `Fy = -24.0 kN`.

La representación es mecánicamente equivalente al fixture de structureCo:
un único elemento con carga puntual a `x/L = 0.5`, apoyos articulado/móvil y
liberaciones de momento en los extremos.

## Lecturas tomadas en FTool

| Magnitud | FTool | structureCo / referencia cerrada | Diferencia |
|---|---:|---:|---:|
| Reacción `RAy` | `12.0 kN` | `12.0 kN` | `0` |
| Reacción `RBy` | `12.0 kN` | `12.0 kN` | `0` |
| Reacción horizontal | `0.0 kN` | `0.0 kN` | `0` |
| Cortante, tramo izquierdo | `+12.0 kN` | `+12.0 kN` | `0` |
| Cortante, tramo derecho | `-12.0 kN` | `-12.0 kN` | `0` |
| Momento máximo central | `48.0 kN m` | `48.0 kN m` | `0` |
| Desplazamiento vertical central | `-16.0 mm` | `-16.0 mm` | `0` |

El desplazamiento se comprueba además con

`δmid = -P L³ / (48 E I) = -16.0 mm`.

## Conclusión

SC-FT-01 coincide con FTool dentro de la precisión mostrada por FTool. El salto
de cortante y el máximo de momento se observan exactamente en el nodo central;
structureCo debe conservar ese mismo comportamiento al representar una carga
puntual dentro de un único miembro.

---

# Ejecución externa de FTool - SC-FT-02 (preliminar)

Fecha: 2026-07-11  
Herramienta: FTool 4.01 para Windows  
Archivo reproducible: [`SC-FT-02.ftl`](./SC-FT-02.ftl)

## Modelo cargado

- Viga simplemente apoyada.
- Material: `E = 200000 MPa`; sección genérica: `A = 20000 mm²`,
  `I = 80000000 mm⁴`.
- Apoyo izquierdo articulado y derecho móvil vertical.
- Carga uniforme `w6`, local: `Qx = 0.0`, `Qy = -6.0 kN/m`.

## Lecturas tomadas en FTool

| Magnitud | Lectura FTool |
|---|---:|
| Longitud real del elemento | `9.99 m` |
| Reacción `RAy` | `30.0 kN` |
| Reacción `RBy` | `30.0 kN` |
| Cortante | `+30.0 → -30.0 kN` (recta) |
| Momento máximo | `74.9 kN m` a `x = 5.00 m` |
| Escala superior de momento | `75.0 kN m` |

## Estado

La forma física del cortante lineal y del momento parabólico coincide con la
referencia. Sin embargo, el miembro se creó con ratón y FTool informa `L=9.99 m`;
por esa diferencia de geometría no se considera una comparación cerrada contra
el caso objetivo `L=10.00 m`. Se conservará como evidencia de interfaz y se
repetirá mediante entrada con coordenadas exactas antes de marcar SC-FT-02 como
aprobado.

## Repetición cerrada con coordenada exacta

Se reconstruyó el archivo `SC-FT-02.ftl` con cuadrícula de `1.00 m` y *snap*
activos. FTool informa `L = 10.00 m` y el archivo actual reemplaza la corrida
preliminar anterior.

| Magnitud | FTool exacto | Referencia cerrada | Diferencia visible |
|---|---:|---:|---:|
| Reacción `RAy` | `30.0 kN` | `30.0 kN` | `0` |
| Reacción `RBy` | `30.0 kN` | `30.0 kN` | `0` |
| Cortante en extremos | `+30.0`, `-30.0 kN` | `+30.0`, `-30.0 kN` | `0` |
| Momento máximo en `x=5.00 m` | `75.0 kN m` | `75.0 kN m` | `0` |
| Flecha vertical central | `-48.83 mm` | `-48.828125 mm` | `0.001875 mm` |

La flecha se comprueba con
`δmid = -5 w L⁴ / (384 E I) = -48.828125 mm`. Por tanto SC-FT-02 queda
aprobada con la resolución de presentación de FTool.
