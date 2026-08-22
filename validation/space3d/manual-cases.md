# Casos manuales de Space 3D (S3D-1)

Cada caso declara la entrada completa y la derivación cerrada del resultado. Los
valores numéricos de `oracles/expected/*.result.json` los produce
`derive-expected.py`, que evalúa **sólo** las fórmulas de este documento y la
definición geométrica de la triada local: no invoca el solver de structureCo.

## Convenciones comunes

- Ejes globales `X`, `Y`, `Z` con **`Y` vertical**; unidades `kN`, `m`, `rad`.
- Orden nodal de GDL `[ux, uy, uz, rx, ry, rz]`.
- Triada local: `x̂ = (j − i)/|j − i|`; `ŷ` es la referencia global proyectada
  perpendicular a `x̂`, normalizada y girada `roll` alrededor de `x̂`;
  `ẑ = x̂ × ŷ`.
- `Iz` gobierna la flexión en el plano `x–y` local (pareja `v`–`rz`) e `Iy` la
  del plano `x–z` (pareja `w`–`ry`).
- Sección común a todos los casos: `E = 2·10⁸ kN/m²`, `G = 8·10⁷ kN/m²`,
  `A = 0,01 m²`, `Iy = 3·10⁻⁵ m⁴`, `Iz = 8·10⁻⁵ m⁴`, `J = 2·10⁻⁵ m⁴`.
- Todos los voladizos tienen el nudo `I` empotrado (seis GDL restringidos) y el
  nudo `J` completamente libre. Caso de carga `LC1`.

## S3D-AXIAL-001 · Voladizo axial

Geometría: `I = (0, 0, 0)`, `J = (2, 0, 0)`, `L = 2 m`. Referencia de
orientación `[0, 1, 0]`, `roll = 0` ⇒ `x̂ = (1,0,0)`, `ŷ = (0,1,0)`, `ẑ = (0,0,1)`.

Carga: `fx = 100 kN` en `J`.

Derivación — barra sometida a esfuerzo axil constante `N = P`:

```
ux(J) = P·L / (E·A) = 100 · 2 / (2·10⁸ · 0,01) = 1,0·10⁻⁴ m
```

Reacción: el único camino de carga es axial, luego `Rux(I) = −P = −100 kN` y el
resto de componentes es nulo. Ningún otro GDL se activa: la matriz local no
acopla `u` con `v`, `w`, `rx`, `ry` ni `rz`.

## S3D-TORSION-001 · Voladizo a torsión

Geometría idéntica al caso axial. Carga: `mx = 10 kN·m` en `J`.

Derivación — torsión uniforme de St. Venant:

```
rx(J) = T·L / (G·J) = 10 · 2 / (8·10⁷ · 2·10⁻⁵) = 1,25·10⁻² rad
```

Reacción `Rrx(I) = −T = −10 kN·m`; el resto es nulo. Este caso es el que muere
si desaparece el término `GJ/L` de la matriz local.

## S3D-BENDING-Z-001 · Flexión en el plano `x–y` (usa `Iz`)

Geometría idéntica. Carga: `fy = 10 kN` en `J`.

Derivación — voladizo Euler–Bernoulli con carga puntual en el extremo:

```
uy(J) = P·L³ / (3·E·Iz) = 10 · 8 / (3 · 2·10⁸ · 8·10⁻⁵) = 1,6666…·10⁻³ m
rz(J) = P·L² / (2·E·Iz) = 10 · 4 / (2 · 2·10⁸ · 8·10⁻⁵) = 1,25·10⁻³ rad
```

Reacciones: `Ruy(I) = −P = −10 kN`, `Rrz(I) = −P·L = −20 kN·m`.

`uz(J)` y `ry(J)` son exactamente cero: la carga no toca el plano `x–z`.

## S3D-BENDING-Y-001 · Flexión en el plano `x–z` (usa `Iy`)

Geometría idéntica. Carga: `fz = 10 kN` en `J`.

Derivación — mismo voladizo, plano perpendicular. El giro cambia de signo
porque `w(x) = P/(6EIy)·(3Lx² − x³)` y `θy = −dw/dx`:

```
uz(J) = P·L³ / (3·E·Iy) = 10 · 8 / (3 · 2·10⁸ · 3·10⁻⁵) = 4,4444…·10⁻³ m
ry(J) = −P·L² / (2·E·Iy) = −10 · 4 / (2 · 2·10⁸ · 3·10⁻⁵) = −3,3333…·10⁻³ rad
```

Reacciones: `Ruz(I) = −P = −10 kN`, `Rry(I) = +P·L = +20 kN·m`.

El par S3D-BENDING-Z/Y es el que detecta un intercambio de `Iy` con `Iz`: sus
resultados difieren en el factor `Iz/Iy = 8/3`.

## S3D-FRAME-001 · Voladizo inclinado en el espacio

Este es el caso que ejercita la matriz de transformación completa: ningún eje
local coincide con un eje global.

Geometría: `I = (0, 0, 0)`, `J = (2, 3, 6)`. La longitud es exacta:

```
L = √(2² + 3² + 6²) = √49 = 7 m
x̂ = (2, 3, 6)/7 = (0,285714…, 0,428571…, 0,857142…)
```

Con referencia `[0, 1, 0]` y `roll = 0`:

```
proyección = (0,1,0) − (x̂·(0,1,0))·x̂ = (−6, 40, −18)/49
ŷ = (−6, 40, −18)/√1960 = (−0,135526…, 0,903507…, −0,406578…)
ẑ = x̂ × ŷ = (−3, 0, 1)/√10 = (−0,948683…, 0, 0,316227…)
```

Carga en `J`, definida directamente en ejes locales y expresada en global:

```
F = Px·x̂ + Py·ŷ    con Px = 100 kN, Py = 10 kN
F = (27,216166…, 51,892221…, 81,648500…) kN
```

Derivación — superposición de los dos casos ya derivados, expresada en global:

```
u(J) = (Px·L / (E·A))·x̂ + (Py·L³ / (3·E·Iz))·ŷ
θ(J) = (Py·L² / (2·E·Iz))·ẑ
```

con `Px·L/(E·A) = 3,5·10⁻⁴ m` y `Py·L³/(3·E·Iz) = 7,1458333…·10⁻²  m` y
`Py·L²/(2·E·Iz) = 1,53125·10⁻² rad`.

Reacciones en `I`: la resultante es `−F`. El momento de empotramiento es
`−r_J × F`; como `r_J = L·x̂` es paralelo a `x̂`, la componente axial `Px·x̂` no
produce momento y queda

```
Mreacción(I) = −L·Py·(x̂ × ŷ) = −L·Py·ẑ = −70·ẑ kN·m
```

Este caso falla si la triada se construye como `ŷ × x̂`, si el roll se
interpreta en grados o si la transformación no se aplica en los cuatro bloques
3×3 de la matriz 12×12.

## Qué NO cubre este corpus

- Cargas en barra (repartidas, térmicas, de vano): fuera del alcance S3D-1.
- Liberaciones de extremo, muelles y apoyos inclinados.
- Deformación por cortante, alabeo, no linealidad geométrica o de material.
- Validación contra un motor independiente: ver `README.md`, sección
  «Oráculos externos».
