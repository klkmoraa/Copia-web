# Matriz reproducible de comparación — structureCo / FTool

## Estado y regla de evidencia

El banco reproducible de structureCo está automatizado en
`src/engine/ftoolComparison.test.ts`. Sus once referencias son fórmulas cerradas
de estática, resistencia de materiales o rigidez matricial. Se ejecuta con:

```text
npm test -- --run src/engine/ftoolComparison.test.ts
```

La primera ejecución externa ya fue realizada con **FTool 4.01** en Windows, el
11 de julio de 2026. Su modelo y el registro numérico se conservan en
[`SC-FT-01.ftl`](./SC-FT-01.ftl) y
[`FTool_RUN_LOG.md`](./FTool_RUN_LOG.md). Las filas restantes siguen pendientes:
un resultado calculado por structureCo nunca se copiará en la columna FTool como
si fuera evidencia externa.

## Convenciones comunes para la comparación

- Eje global `+X` a la derecha y `+Y` hacia arriba.
- Rotación positiva antihoraria.
- Axial positivo en tensión.
- Cargas distribuidas en kN/m de longitud real, salvo indicación expresa.
- Geometría en m, fuerzas en kN, momentos en kN·m, `E` en kN/m².
- Las liberaciones se modelan en el extremo del miembro, no mediante `I` pequeño.
- En miembros inclinados se debe registrar si la carga se ingresó en ejes locales
  o globales antes de comparar fuerzas de extremo.

## Casos cerrados

| ID | Modelo reproducible | Referencia independiente y valores objetivo | rtol | FTool |
|---|---|---|---:|---|
| SC-FT-01 | Viga simple, `L=8`, `P=24` central | `RA=RB=P/2=12`; `Mmax=PL/4=48`; `δmid=-16 mm` | `3e-7` | **Aprobada** — FTool: `RAy=12`, `RBy=12`, `V=±12`, `Mmax=48`, `δmid=-16 mm` |
| SC-FT-02 | Viga simple, `L=10`, `w=6` | `RA=RB=wL/2=30`; `Mmax=wL²/8=75`; `δmid=-5wL⁴/(384EI)=-48.828 mm` | `3e-7` | **Aprobada** — [`SC-FT-02.ftl`](./SC-FT-02.ftl): `L=10.00`, `RAy=RBy=30.0`, `V=+30.0→-30.0`, `Mmax=75.0`, `δmid=-48.83 mm`. |
| SC-FT-03 | Viga simple, triangular `0→12`, `L=9` | `RA=wL/6=18`; `RB=wL/3=36`; `Mmax=wL²/(9√3)` | `3e-7` | Pendiente |
| SC-FT-04 | Voladizo, `L=4`, `P=25` | `RAy=P`; `MA=PL`; `δB=-PL³/(3EI)` | `3e-7` | Pendiente |
| SC-FT-05 | Voladizo, `L=5`, `w=8` | `RAy=wL`; `MA=wL²/2`; `δB=-wL⁴/(8EI)` | `3e-7` | Pendiente |
| SC-FT-06 | Empotrada-empotrada, `L=6`, `w=10` | `RA=RB=wL/2`; `|MA|=|MB|=wL²/12`; `Mcentro=wL²/24` | `3e-7` | Pendiente |
| SC-FT-07 | Pórtico desplazable, dos columnas `H=4`, dintel rígido `b=6`, `P=40` | Derivación condensada de dos columnas con flexibilidad axial; ecuaciones abajo | `3e-7` | Pendiente |
| SC-FT-08 | Miembro 3–4–5, UDL vertical global `w=10` | Resultante global `50` hacia abajo; `RAy=RBy=25`; equilibrio global nulo | `3e-7` | Pendiente |
| SC-FT-09 | Voladizo 3–4–5, UDL transversal local `w=10` | `RAx=-wLs=-40`; `RAy=wLc=30`; `MA=wL²/2=125` | `3e-7` | Pendiente |
| SC-FT-10 | Barra axial `L=2`, `EA/L` en paralelo con `k=10000`, `P=50` | `u=P/(EA/L+k)`; reacción del resorte `-ku` | `3e-7` | Pendiente |
| SC-FT-11 | Empotrada-articulada, `L=8`, `w=9`, liberación en j | `RA=5wL/8`; `RB=3wL/8`; `|MA|=wL²/8`; `Mj=0` | `3e-7` | Pendiente |

### Derivación de SC-FT-07

Para desplazamiento horizontal común `u` y giro del dintel `θ`, después de
condensar el desplazamiento vertical de cuerpo rígido:

\[
K_u=\frac{24EI}{H^3},\qquad
K_{u\theta}=\frac{12EI}{H^2},\qquad
K_\theta=\frac{8EI}{H}+\frac{EA b^2}{2H}
\]

\[
u=\frac{P}{K_u-K_{u\theta}^2/K_\theta},\qquad
\theta=-\frac{K_{u\theta}}{K_\theta}u
\]

\[
|M_A|=|M_D|=\frac{6EI}{H^2}u+\frac{2EI}{H}\theta,qquad
R_{Ax}=R_{Dx}=-\frac{P}{2}
\]

La contribución `EA b²/(2H)` es importante: omitirla equivale a suponer columnas
axialmente inextensibles y produce una referencia ligeramente distinta.

## Protocolo para llenar la columna FTool

1. Registrar versión exacta de FTool, sistema operativo y fecha.
2. Crear el modelo con las propiedades indicadas por el fixture automatizado.
3. Confirmar unidades, orientación `i→j`, ejes locales, sentido y base de cada carga.
4. Exportar o capturar geometría, apoyos, cargas y resultados con todos los dígitos
   que FTool muestre.
5. Guardar el archivo del modelo y la evidencia bajo un identificador SC-FT.
6. Comparar cada magnitud mediante:

\[
|a-b|\leq atol+rtol\max(|a|,|b|,1)
\]

7. Usar inicialmente `atol=1e-9` y la `rtol` de la tabla. Si la interfaz de FTool
   redondea el valor, registrar la resolución visible y ajustar solo la tolerancia
   de presentación, nunca la prueba analítica interna.
8. Documentar diferencias de convención separadamente; invertir el lado visual de
   un diagrama no autoriza a cambiar su signo numérico.

Una fila solo puede cambiar de **Pendiente** a **Aprobada** cuando estén archivados
el modelo FTool, su versión, la salida y la comparación numérica reproducible.
