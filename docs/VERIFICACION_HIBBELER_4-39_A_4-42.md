# Verificación de los marcos Hibbeler 4-39 a 4-42

## Alcance y convención

Los cuatro ejercicios se modelaron en structureCo con conversión real de las
unidades de entrada `kip-ft` a las unidades internas `kN-m`. Se usaron elementos
de marco Euler-Bernoulli con propiedades comunes arbitrarias; al ser sistemas
isostáticos, `E`, `A` e `I` solo afectan las deformaciones, no las reacciones ni
los diagramas `V-M`.

Las ecuaciones siguientes reproducen la convención local del programa:

- columnas izquierdas: coordenada `y` de A hacia B;
- vigas: coordenada `x` de B hacia C;
- columnas derechas: coordenada `y` de D hacia C;
- fuerzas en `k`, distancias en `ft` y momentos en `k·ft`;
- un signo distinto en dos barras que llegan a un nudo no implica desequilibrio:
  cada barra tiene ejes locales propios.

Los valores menores que `1e-10` se consideran cero numérico.

---

## Ejercicio 4-40

### Cálculo manual de reacciones

La carga distribuida equivale a `W = 2(8) = 16 k`, aplicada a 4 ft de B.
Tomando momentos alrededor de D y sentido antihorario positivo:

```text
ΣFx = 0:  Dx - 3 = 0                                  => Dx = 3.000 k
ΣMD = 0: -12 Ay + 16(8) + 3(15) = 0                 => Ay = 173/12 = 14.4167 k
ΣFy = 0:  Ay + Dy - 16 - 4 = 0                      => Dy = 67/12 = 5.5833 k
```

El término `3(15)` es esencial: la carga horizontal aplicada en C produce
momento respecto de D.

### Diagramas por miembro

| Miembro | Cortante `V` | Momento `M` | Ordinadas principales |
|---|---|---|---|
| AB | `V(y)=0` | `M(y)=0` | Columna de dos fuerzas; `N=-14.4167 k` |
| BC, `0 ≤ x ≤ 8` | `V=14.4167-2x` | `M=14.4167x-x²` | `V(0)=14.4167`, `V(8)=-1.5833`, `M(0)=0`, `M(8)=51.3333` |
| BC, `8 ≤ x ≤ 12` | `V=-1.5833` | `M=51.3333-1.5833(x-8)` | `M(12)=45.0000` |
| DC | `V(y)=-3` | `M(y)=-3y` | `M(D)=0`, `M(C)=-45.0000`; `N=-5.5833 k` |

En BC, `V=0` en `x=7.20833 ft`, por lo que:

```text
Mmax = 51.96007 k·ft
```

El diagrama de BC es parabólico hasta `x=8` y lineal desde allí hasta C. El
de DC es triangular.

### Comparación con structureCo

| Magnitud | Manual | Software |
|---|---:|---:|
| `Ay` | 14.416667 | 14.416667 |
| `Dx` | 3.000000 | 3.000000 |
| `Dy` | 5.583333 | 5.583333 |
| `Mmax,BC` | 51.960069 | 51.960069 |
| `Mmin,DC` | -45.000000 | -45.000000 |

---

## Ejercicio 4-39

### Cálculo manual de reacciones

Las resultantes son `H=0.6(16)=9.6 k` a 8 ft sobre A y
`W=0.8(20)=16 k` a 10 ft de A.

```text
ΣFx = 0:  Ax + 9.6 = 0                                => Ax = -9.600 k
ΣMA = 0: 20 Dy - 16(10) - 9.6(8) = 0                => Dy = 11.840 k
ΣFy = 0:  Ay + Dy - 16 = 0                          => Ay = 4.160 k
```

### Diagramas por miembro

| Miembro | Cortante `V` | Momento `M` | Ordinadas principales |
|---|---|---|---|
| AB | `V(y)=9.6-0.6y` | `M(y)=9.6y-0.3y²` | `V(A)=9.6`, `V(B)=0`; `M(A)=0`, `M(B)=76.8` |
| BC | `V(x)=4.16-0.8x` | `M(x)=76.8+4.16x-0.4x²` | `M(B)=76.8`, `M(C)=0` |
| DC | `V(y)=0` | `M(y)=0` | Columna de dos fuerzas; `N=-11.84 k` |

En BC, `V=0` en `x=5.2 ft`, por lo que:

```text
Mmax,BC = 76.8 + 4.16(5.2) - 0.4(5.2²) = 87.616 k·ft
```

Los diagramas de momento de AB y BC son parabólicos; DC no tiene cortante ni
momento.

### Comparación con structureCo

| Magnitud | Manual | Software |
|---|---:|---:|
| `Ax` | -9.600000 | -9.600000 |
| `Ay` | 4.160000 | 4.160000 |
| `Dy` | 11.840000 | 11.840000 |
| `Mmax,AB` | 76.800000 | 76.800000 |
| `Mmax,BC` | 87.616000 | 87.616000 |

---

## Ejercicio 4-41

### Cálculo manual de reacciones

La viga BC está articulada en ambos extremos y sus cargas verticales son
simétricas. Su carga total es `18 k`; por tanto, las fuerzas transmitidas en B y
C son `9 k` cada una. La columna CD es de dos fuerzas, de modo que `Dy=9 k`.
La carga horizontal sobre AB equivale a `H=0.8(15)=12 k`, aplicada a 7.5 ft.

```text
Ax = -12.000 k
Ay =  9.000 k
Dy =  9.000 k
MA = 12(7.5) = +90.000 k·ft
```

### Diagramas por miembro

| Miembro/tramo | Cortante `V` | Momento `M` | Forma y ordinadas |
|---|---|---|---|
| AB | `V(y)=12-0.8y` | `M(y)=-90+12y-0.4y²` | `V: 12→0`; parábola `M: -90→0` |
| BC, `0<x<8` | `V=+6` | `M=6x` | Recta `0→48` |
| BC, `8<x<16` | `V=0` | `M=48` | Meseta constante |
| BC, `16<x<24` | `V=-6` | `M=48-6(x-16)` | Recta `48→0` |
| DC | `V(y)=0` | `M(y)=0` | Columna de dos fuerzas; `N=-9 k` |

Las cargas de 6 k producen saltos de `-6 k` en el cortante en `x=8` y
`x=16`. Las cargas de 3 k están aplicadas exactamente en B y C; combinadas con
las fuerzas de apoyo de 9 k, dejan `V=+6 k` al inicio y `V=-6 k` al final de la
viga.

### Comparación con structureCo

| Magnitud | Manual | Software |
|---|---:|---:|
| `Ax` | -12.000000 | -12.000000 |
| `Ay` | 9.000000 | 9.000000 |
| `MA` | 90.000000 | 90.000000 |
| `Dy` | 9.000000 | 9.000000 |
| `Mmin,AB` | -90.000000 | -90.000000 |
| `Mmax,BC` | 48.000000 | 48.000000 |

---

## Ejercicio 4-42

### Descomposición de la carga y reacciones

La dirección `3-4-5` de la carga de 20 k da:

```text
Px = 20(4/5) = +16 k   (hacia la derecha)
Py = 20(3/5) = -12 k   (hacia abajo)
```

Para la viga BC articulada en B y apoyada sobre rodillo en C:

```text
ΣMB = 0: 12 Cy - 12(6) = 0                          => Cy = 6 k
ΣFy = 0: By + Cy - 12 = 0                          => By = 6 k
ΣFx = 0: Bx + 16 = 0                               => Bx = -16 k
```

La fuerza que la viga aplica sobre la columna en B es la opuesta: `+16 k`
horizontal y `-6 k` vertical. La carga distribuida horizontal sobre AB equivale
a `0.5(8)=4 k`, aplicada a 4 ft de A. Por equilibrio de la columna:

```text
Ax = -(16+4) = -20 k
Ay = +6 k
MA = 16(8) + 4(4) = +144 k·ft
```

### Diagramas por miembro

| Miembro/tramo | Cortante `V` | Momento `M` | Ordinadas principales |
|---|---|---|---|
| AB | `V(y)=20-0.5y` | `M(y)=-144+20y-0.25y²` | `V(A)=20`, `V(B⁻)=16`; `M(A)=-144`, `M(B)=0` |
| BC, `0<x<6` | `V=+6` | `M=6x` | `M: 0→36` |
| BC, `6<x<12` | `V=-6` | `M=36-6(x-6)` | `M: 36→0` |

En `x=6 ft`, el cortante salta de `+6` a `-6 k` y el momento alcanza
`Mmax=36 k·ft`. Como comprobación adicional, el axial de BC es `+16 k`
(tensión) entre B y la carga, y cero entre la carga y C.

### Comparación con structureCo

| Magnitud | Manual | Software |
|---|---:|---:|
| `Ax` | -20.000000 | -20.000000 |
| `Ay` | 6.000000 | 6.000000 |
| `MA` | 144.000000 | 144.000000 |
| `Cy` | 6.000000 | 6.000000 |
| `Mmin,AB` | -144.000000 | -144.000000 |
| `Mmax,BC` | 36.000000 | 36.000000 |

---

## Conclusión de la verificación

Los cuatro modelos fueron resueltos correctamente por structureCo. Las
reacciones, saltos, extremos y funciones de los diagramas coinciden con los
cálculos manuales. Las diferencias impresas por el motor son del orden de
`1e-8 k` o menores y provienen del redondeo decimal de los factores de conversión
kip-ft; el residuo global normalizado informado por el solucionador es cero en
los cuatro casos.

La verificación automatizada reproducible está en
`src/engine/hibbelerFrames.test.ts`.
