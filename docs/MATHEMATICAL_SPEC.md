# structureCo — Especificación matemática del motor 2D

**Versión del documento:** 0.7.0  
**Unidades internas:** kN, m, kN·m  
**Alcance verificado:** análisis estático lineal, elástico, de primer orden y pequeñas deformaciones.

> Este documento es la referencia interna del código. Una modificación del motor debe actualizar las fórmulas y sus pruebas de regresión.

## 1. Convenciones

- Eje global: `+X` a la derecha y `+Y` hacia arriba.
- Rotación positiva: antihoraria alrededor de `+Z`.
- Un miembro se orienta del nodo local `i` al nodo local `j`.
- Eje local `x`: de `i` a `j`.
- Eje local `y`: giro de 90° antihorario desde `x`.
- Axial interno positivo: tensión.
- Momento interno positivo en el diagrama: sagante.
- El lado gráfico del diagrama puede invertirse sin cambiar el signo numérico.

Las relaciones diferenciales usadas por el motor de diagramas son:

\[
\frac{dN}{dx}=-p_x(x),\qquad
\frac{dV}{dx}=p_y(x),\qquad
\frac{dM}{dx}=V(x)
\]

Estas relaciones corresponden exactamente al DCL local implementado en `src/engine/diagram.ts`.

## 2. Geometría y transformación

Para los nodos `i` y `j`:

\[
\Delta X=X_j-X_i,\qquad \Delta Y=Y_j-Y_i
\]

\[
L=\sqrt{\Delta X^2+\Delta Y^2},\qquad
c=\frac{\Delta X}{L},\qquad s=\frac{\Delta Y}{L}
\]

El vector de desplazamientos global de un elemento de marco es:

\[
\mathbf d_g=
[u_{Xi},u_{Yi},\theta_i,u_{Xj},u_{Yj},\theta_j]^T
\]

El vector local es:

\[
\mathbf d_l=
[u_i,v_i,\theta_i,u_j,v_j,\theta_j]^T
\]

con:

\[
\mathbf d_l=\mathbf T\mathbf d_g
\]

\[
\mathbf T=
\begin{bmatrix}
 c&s&0&0&0&0\\
-s&c&0&0&0&0\\
0&0&1&0&0&0\\
0&0&0&c&s&0\\
0&0&0&-s&c&0\\
0&0&0&0&0&1
\end{bmatrix}
\]

## 3. Elemento de marco plano Euler–Bernoulli

Hipótesis:

1. Material lineal-elástico.
2. Secciones planas permanecen planas.
3. Se desprecia deformación por cortante.
4. `E`, `A` e `I` son constantes en cada elemento.
5. Pequeñas rotaciones y desplazamientos.

Orden local:

\[
[u_i,v_i,\theta_i,u_j,v_j,\theta_j]
\]

Matriz de rigidez local:

\[
\mathbf k_l=
\begin{bmatrix}
EA/L&0&0&-EA/L&0&0\\
0&12EI/L^3&6EI/L^2&0&-12EI/L^3&6EI/L^2\\
0&6EI/L^2&4EI/L&0&-6EI/L^2&2EI/L\\
-EA/L&0&0&EA/L&0&0\\
0&-12EI/L^3&-6EI/L^2&0&12EI/L^3&-6EI/L^2\\
0&6EI/L^2&2EI/L&0&-6EI/L^2&4EI/L
\end{bmatrix}
\]

Transformación:

\[
\mathbf k_g=\mathbf T^T\mathbf k_l\mathbf T
\]

### 3.1 Elemento de marco Timoshenko

Para vigas en las que la deformación por cortante no es despreciable puede
seleccionarse la formulación de Timoshenko. Se define la rigidez cortante efectiva

\[
K_s=G A_s
\]

donde `As` ya debe incorporar el factor de corrección por cortante, y el parámetro

\[
\phi=\frac{12EI}{K_sL^2}.
\]

El bloque axial no cambia. En el bloque de flexión se emplean

\[
b=\frac{12EI}{L^3(1+\phi)},\qquad
c=\frac{6EI}{L^2(1+\phi)},
\]

\[
d=\frac{(4+\phi)EI}{L(1+\phi)},\qquad
e=\frac{(2-\phi)EI}{L(1+\phi)},
\]

en las mismas posiciones de la matriz de la sección 3. Al hacer
`K_s→∞`, `φ→0` y se recupera Euler–Bernoulli. La interpolación de cargas
consistentes y la recuperación de la deformada usan las funciones compatibles de
la teoría seleccionada; no se añade la deformación cortante como una corrección
gráfica posterior.

## 4. Elemento de armadura 2D

La barra solo resiste fuerza axial. Su matriz global traslacional es:

\[
\mathbf k_g=\frac{EA}{L}
\begin{bmatrix}
c^2&cs&-c^2&-cs\\
cs&s^2&-cs&-s^2\\
-c^2&-cs&c^2&cs\\
-cs&-s^2&cs&s^2
\end{bmatrix}
\]

En el motor se conserva la estructura de seis grados del nodo de marco, pero las filas y columnas locales transversales/rotacionales de la barra son cero. Los grados rotacionales que no participan se restringen como grados contables, no como restricciones físicas.

Fuerza axial:

\[
N=\frac{EA}{L}[-c,-s,c,s]\mathbf d_g
\]

- `N > tolerancia`: tensión.
- `N < -tolerancia`: compresión.
- `|N| ≤ tolerancia`: fuerza prácticamente nula.

Las barras de armadura no aceptan cargas entre nodos; el validador exige crear un nodo en la posición de la carga.

## 5. Funciones de forma y cargas consistentes

Coordenada normalizada:

\[
\xi=x/L
\]

Interpolación axial lineal:

\[
N_{u1}=1-\xi,\qquad N_{u2}=\xi
\]

Interpolación transversal cúbica de Hermite:

\[
N_1=1-3\xi^2+2\xi^3
\]

\[
N_2=L(\xi-2\xi^2+\xi^3)
\]

\[
N_3=3\xi^2-2\xi^3
\]

\[
N_4=L(-\xi^2+\xi^3)
\]

La definición general es:

\[
\mathbf f_l=\int_a^b\mathbf N^T(x)\mathbf p(x)\,dx
\]

La implementación integra polinomios lineales mediante cuadratura de Gauss de cinco puntos, exacta con margen suficiente para el producto de carga lineal y funciones cúbicas.

### 5.1 Carga axial uniforme

\[
\mathbf f_l=
[q_xL/2,0,0,q_xL/2,0,0]^T
\]

### 5.2 Carga transversal uniforme

Para `q_y` positivo hacia `+y` local:

\[
\mathbf f_l=
[0,q_yL/2,q_yL^2/12,0,q_yL/2,-q_yL^2/12]^T
\]

### 5.3 Carga transversal lineal

Si cambia de `q_i` a `q_j`:

\[
F_{yi}=\frac{L}{20}(7q_i+3q_j)
\]

\[
M_i=\frac{L^2}{60}(3q_i+2q_j)
\]

\[
F_{yj}=\frac{L}{20}(3q_i+7q_j)
\]

\[
M_j=-\frac{L^2}{60}(2q_i+3q_j)
\]

El motor no contiene una fórmula separada para este caso: la obtiene de la integral general, lo cual permite cargas triangulares, trapezoidales y parciales con la misma ruta de cálculo.

### 5.4 Fuerza puntual transversal

Para `P_y` en `ξ=a/L`:

\[
\mathbf f_l=P_y[0,N_1,N_2,0,N_3,N_4]^T
\]

### 5.5 Fuerza puntual axial

\[
\mathbf f_l=P_x[1-\xi,0,0,\xi,0,0]^T
\]

### 5.6 Momento puntual

\[
\mathbf f_l=M\frac{d\mathbf N_v^T}{dx}
\]

No se aproxima mediante un par de fuerzas.

## 6. Cargas globales, locales y miembros inclinados

Una carga global se transforma con:

\[
\begin{bmatrix}q_x\\q_y\end{bmatrix}
=
\begin{bmatrix}c&s\\-s&c\end{bmatrix}
\begin{bmatrix}q_X\\q_Y\end{bmatrix}
\]

Toda carga distribuida se integra únicamente en el dominio normalizado guardado:

\[
a=\min(start,end)L_f,\qquad b=\max(start,end)L_f
\]

donde `L_f` es la longitud flexible. El reporte debe conservar `start`, `end`,
`a`, `b`, la cobertura porcentual y la base de longitud; omitir el dominio cambia
la interpretación física aunque las intensidades sean correctas.

La base de longitud se convierte antes de integrar:

- Por longitud real:
  \[
  w_{real}=w
  \]
- Por proyección horizontal:
  \[
  w_{real}=w_h|c|,\qquad W=w_h|\Delta X|
  \]
- Por proyección vertical:
  \[
  w_{real}=w_v|s|,\qquad W=w_v|\Delta Y|
  \]

Una base horizontal sobre miembro vertical o una base vertical sobre miembro horizontal se rechaza porque la proyección correspondiente es nula.

## 7. Peso propio

Para densidad de masa `ρ`:

\[
\gamma=\rho g,
\qquad g=9.80665\;m/s^2
\]

\[
w=\gamma A
\]

En unidades internas:

\[
w[kN/m]=\rho[kg/m^3]\;g[m/s^2]\;A[m^2]/1000
\]

Actúa en `−Y` global. Cada caso de carga puede definir un `selfWeightFactor` independiente.

## 8. Apoyos inclinados y resortes

Una restricción general se escribe:

\[
\mathbf C\mathbf U=0
\]

Para un rodillo cuya normal forma un ángulo `α` con `+X`:

\[
\cos\alpha\,u_X+\sin\alpha\,u_Y=0
\]

Resorte traslacional orientado según el vector unitario `n`:

\[
\mathbf K_s=k\mathbf n\mathbf n^T
\]

Resorte rotacional:

\[
K_{\theta\theta}\mathrel{+}=k_\theta
\]

La reacción del resorte es:

\[
\mathbf R_s=-\mathbf K_s\mathbf U
\]

### 8.1 Asentamientos y desplazamientos prescritos

Una restricción puede imponer un valor distinto de cero:

\[
\mathbf C\mathbf U=\mathbf g.
\]

`g` puede contener `Ux`, `Uy`, `Rz` o, para un rodillo orientado, el
desplazamiento normal. Los valores permanentes del apoyo y los valores asociados
a casos de carga se suman con los factores de la combinación activa. El validador
rechaza componentes que el apoyo no restringe y restricciones duplicadas o
proporcionales con valores prescritos incompatibles.

### 8.2 Temperatura y deformaciones iniciales

Para un miembro se combinan la deformación axial y la curvatura iniciales:

\[
\varepsilon_0=\varepsilon_{inicial}+\alpha\Delta T,
\qquad
\kappa_0=\kappa_{inicial}-\alpha g_T,
\]

donde `gT` es el gradiente térmico hacia `+y` local. El vector nodal equivalente
antes de liberaciones o conexiones de extremo es

\[
\mathbf f_0=
[-EA\varepsilon_0,0,-EI\kappa_0,
 EA\varepsilon_0,0,EI\kappa_0]^T.
\]

Los efectos pertenecen a casos de carga y participan linealmente en las
combinaciones. Una barra de armadura admite deformación axial inicial o
temperatura uniforme, pero no curvatura ni gradiente térmico.

## 9. Liberaciones de extremo

Los grados retenidos son `a` y los liberados `b`:

\[
\begin{bmatrix}K_{aa}&K_{ab}\\K_{ba}&K_{bb}\end{bmatrix}
\begin{bmatrix}d_a\\d_b\end{bmatrix}
=
\begin{bmatrix}f_a\\f_b\end{bmatrix}
\]

En el grado liberado la fuerza es cero. La condensación estática es:

\[
\bar K=K_{aa}-K_{ab}K_{bb}^{-1}K_{ba}
\]

En la implementación no se forma explícitamente `Kbb⁻¹`. Se resuelven los sistemas
`Kbb X = Kba` y `Kbb y = fb`, y se calculan `K̄ = Kaa - Kab X` y
`f̄ = fa - Kab y`. Esta forma conserva la ecuación matemática y reduce el error
numérico asociado a construir una inversa.

\[
\bar f=f_a-K_{ab}K_{bb}^{-1}f_b
\]

Recuperación:

\[
d_b=K_{bb}^{-1}(f_b-K_{ba}d_a)
\]

La prueba de regresión exige que el momento liberado sea numéricamente cero.

### 9.1 Articulación interna nodal

Una articulación interna conserva una sola traslación global `uX,uY` compartida
por todos los miembros incidentes, pero no transmite momento entre ellos. El
preprocesador la compila como liberación rotacional en cada extremo de marco que
llega al nodo:

\[
M_{e,n}=0\qquad\forall e\text{ incidente en la articulación }n
\]

Cada extremo se condensa con la misma formulación exacta de esta sección. La
rotación nodal sin rigidez se mantiene solo como grado contable para conservar el
orden global; no es una restricción física. Por ese motivo se rechaza un momento
nodal aplicado directamente a una articulación cuya rotación no tenga resorte o
restricción físicamente definida.

Se valida además que una articulación nodal no coincida silenciosamente con la
cara interior de una zona rígida: si ambos conceptos se requieren, debe existir
un nodo explícito en la cara de la zona rígida.

### 9.2 Conexiones semirrígidas

Cada extremo de un marco puede conectar la rotación de la viga `θb` con la
rotación del nudo `θn` mediante un resorte:

\[
U_s=\frac{1}{2}k_\theta(\theta_n-\theta_b)^2.
\]

La rotación de la viga se introduce como grado interno y el sistema aumentado se
condensa estáticamente. No se aproxima una conexión semirrígida modificando `EI`.
La ausencia del resorte representa continuidad rígida, `kθ=0` reproduce una
liberación de momento y un valor finito positivo representa rigidez parcial. Una
liberación explícita prevalece sobre el valor del resorte.

## 10. Vínculos rígidos exactos

Para un nodo esclavo separado del maestro por `(Δx,Δy)`:

\[
u_s=u_m-\Delta y\,\theta_m
\]

\[
v_s=v_m+\Delta x\,\theta_m
\]

\[
\theta_s=\theta_m
\]

Estas relaciones se agregan a `C U=0`. No se usa `E` o `I` artificialmente grande.

### 10.1 Zonas rígidas colineales en extremos de marco

Un miembro de longitud geométrica `Lg` puede definir offsets rígidos `ri` y `rj`.
Su longitud deformable es:

\[
L=L_g-r_i-r_j>0
\]

En coordenadas locales, los grados de las caras deformables se obtienen de los
grados en los nodos mediante:

\[
\mathbf d_{cara}=\mathbf R_o\mathbf T\mathbf d_g
\]

\[
\mathbf R_o=
\begin{bmatrix}
1&0&0&0&0&0\\
0&1&r_i&0&0&0\\
0&0&1&0&0&0\\
0&0&0&1&0&0\\
0&0&0&0&1&-r_j\\
0&0&0&0&0&1
\end{bmatrix}
\]

La rigidez y la carga consistente que llegan a los nodos son:

\[
\mathbf K_g=(\mathbf R_o\mathbf T)^T\mathbf k_l
(\mathbf R_o\mathbf T),\qquad
\mathbf f_g=(\mathbf R_o\mathbf T)^T\mathbf f_l
\]

Las cargas de miembro y los diagramas se parametrizan sobre la longitud
deformable. La interfaz coloca el origen gráfico del diagrama en `ri`, de modo que
una zona rígida no se dibuje falsamente como parte flexible. Los offsets solo son
válidos en miembros de marco, deben ser finitos/no negativos y su suma debe dejar
una longitud flexible positiva.

### 10.2 División topológica de miembros

La operación **Dividir** crea un nodo en una posición interior, reemplaza el
miembro por dos elementos con las mismas propiedades y conserva las liberaciones
y zonas rígidas únicamente en los extremos exteriores originales. Las cargas se
remapean por intersección de dominios; para una carga lineal se interpola la
intensidad exacta en el punto de división. Una fuerza o momento exactamente en el
corte se convierte en carga nodal.

Para un miembro prismático sin articulación añadida, esta operación debe conservar
reacciones, desplazamientos en los nodos originales y funciones `N,V,M` dentro de
la tolerancia numérica. Se rechaza dividir dentro de una zona rígida.

## 11. Ensamblaje y solución

Antes del ensamblaje se normaliza la topología geométrica. Un nodo activo que
coincide con el interior de un miembro deformable divide ese miembro y conserva
las cargas, propiedades y liberaciones exteriores. Los nodos coincidentes se
fusionan únicamente cuando sus apoyos y conexiones son compatibles; los casos
ambiguos se conservan y se reportan para que el usuario decida. La reparación es
una operación reversible en el historial del proyecto.

Los nodos aislados sin apoyo, carga, resorte ni desplazamiento prescrito se
clasifican como geometría de dibujo y sus grados contables no participan en la
prueba de estabilidad. En cambio, un apoyo o una carga situado sobre un miembro
sin conexión topológica es un error explícito. Un modelo conectado solo al suelo
mediante resortes positivos puede ser estable y se admite sin exigir un apoyo
convencional.

\[
\mathbf K=\sum_e\mathbf A_e^T\mathbf k_e\mathbf A_e
\]

\[
\mathbf F=\mathbf F_{nodal}+
\sum_e\mathbf A_e^T\mathbf f_e
\]

Con restricciones y vínculos:

\[
\begin{bmatrix}
K&C^T\\
C&0
\end{bmatrix}
\begin{bmatrix}U\\\lambda\end{bmatrix}
=
\begin{bmatrix}F\\g\end{bmatrix}
\]

Aquí `g=0` para apoyos sin asentamiento y vínculos homogéneos. Las reacciones se
recuperan del mismo sistema aumentado, incluso cuando la acción externa es un
desplazamiento impuesto en vez de una fuerza.

Antes de formar el sistema aumentado se selecciona un conjunto linealmente
independiente de filas de `C` mediante ortogonalización modificada con
reortogonalización. Así, vínculos rígidos redundantes pero compatibles no crean
una singularidad artificial. Si una fila redundante exige un valor afín
incompatible, el modelo se rechaza con un diagnóstico de restricciones
contradictorias.

El sistema aumentado se equilibra simétricamente. Si `D` es diagonal y
`Dii = 1/sqrt(max_j |Aij|)`, se resuelve:

\[
DAD\,y=Db, \qquad x=Dy
\]

El escalamiento simétrico conserva la simetría del sistema. Después de resolver se
aplica refinamiento iterativo usando el residuo `r=b-Ax`.

La matriz equilibrada se factoriza por una de dos vías. Las restricciones cinemáticas
producen una matriz aumentada simétrica **indefinida**, sobre la que una factorización
de Cholesky simple no es válida. Sin embargo, una fila de restricción con diagonal nula
y un único coeficiente significativo es la condición de Dirichlet `c·x_j = b_i`: tanto
`x_j` como su multiplicador `x_i` se despejan fuera del sistema lineal. Eliminarlas
—apoyos empotrados, articulados y de restricción directa, filas contables y apoyos
deslizantes alineados a los ejes— deja un bloque de rigidez definido positivo que sí
admite una factorización `L·D·Lᵀ` sin pivoteo, almacenada en formato disperso por filas
(CSR) y reordenada con Cuthill-McKee inverso para acotar el rellenado.

Esa vía se abandona, y se factoriza la matriz original completa mediante LU con pivoteo
parcial escalado, siempre que: el sistema sea pequeño, sobrevivan restricciones de varios
grados (vínculos rígidos, apoyos deslizantes inclinados), el rellenado simbólico crezca
más allá del beneficio, o cualquier pivote resulte no positivo. Este último caso incluye
mecanismos y rigidez geométrica cerca de una carga crítica, donde el bloque reducido deja
de ser definido positivo.

La elección no es observable desde el resultado: el residuo, la estimación de condición y
el refinamiento se miden siempre contra la matriz original.

Un coeficiente por debajo de `1e-12` respecto al mayor de su propia fila se considera
nulo para esta clasificación. La distinción importa porque un apoyo deslizante vertical
construye su fila con `cos(π/2)`, que vale `6.1e-17` y no cero exacto.

El condicionamiento se diagnostica con una estimación de `κ₁(A)=||A||₁||A⁻¹||₁`
mediante iteraciones de Hager sobre la matriz equilibrada. La relación de pivotes
se conserva únicamente como dato interno y no se presenta como número de condición.

Si la factorización detecta singularidad, se aplica una reducción de Gauss-Jordan
con tolerancia relativa a la matriz equilibrada para obtener rango, nulidad y un
vector `z` tal que:

\[
DAD\,z \approx 0
\]

Se prefiere un vector del espacio nulo con participación en el bloque de
desplazamientos. Al regresar a las coordenadas físicas mediante `x = Dz`, las
componentes nodales se agrupan como `(Ux, Uy, Rz)`. Para comparar traslaciones y
giros se utiliza una longitud característica del modelo. El resultado identifica
los nodos dominantes del mecanismo; no representa una forma deformada bajo carga.

Reacción de apoyo:

\[
R_{apoyo}=-C_{apoyo}^T\lambda
\]

Los multiplicadores de vínculos rígidos son fuerzas internas de restricción y no se reportan como apoyos.

Residuo:

\[
r=KU+C^T\lambda-F
\]

\[
r_n=\frac{\|r\|_\infty}
{\max(1,\|KU\|_\infty+\|C^T\lambda\|_\infty+\|F\|_\infty)}
\]

Esta escala también es válida para asentamientos sin fuerzas externas. Se informa
por separado el residuo normalizado de compatibilidad `CU−g`. El producto entre la
estimación de condición y el residuo lineal se presenta como una cota aproximada
del error hacia delante y como estimación de dígitos confiables; es un diagnóstico
numérico, no una garantía física del modelo.

### 11.1 Auditoría independiente de las acciones

Además del residuo matricial, el motor vuelve a integrar las cargas fuente sin
usar el vector nodal equivalente. La auditoría tiene dos niveles independientes.

En estática global, para una intensidad lineal se calculan analíticamente
`∫q(x)dx` y `∫xq(x)dx`; fuerzas puntuales, momentos, cargas nodales y peso propio
se acumulan con suma compensada respecto al centro de la caja envolvente del
modelo. Ese origen es independiente del orden de los nodos y mantiene cortos los
brazos de palanca aun si las coordenadas globales son muy grandes. Se compara:

\[
\Delta R_{load}=R_{assembled}-R_{source}
\]

La comparación de tres resultantes no basta para detectar una distribución
nodal autoequilibrada. Por ello, para cada miembro se recalculan `c`, `s`, la
longitud bruta y la longitud flexible directamente desde el modelo, y se integra
por trabajo virtual el vector completo, antes de liberaciones o condensación:

\[
\mathbf f_{src}=\int \mathbf N_u^Tq_x\,dx
+\int \mathbf N_v^Tq_y\,dx
+\sum\mathbf N_u^TP_x+\sum\mathbf N_v^TP_y+\sum\mathbf N_\theta^TM
\]

Las funciones cerradas Euler–Bernoulli/Timoshenko se escriben en `ξ=x/L` en un
módulo separado del interpolador del solver. Las cargas lineales se integran en
una coordenada desplazada `t∈[0,1]`, evitando diferencias de potencias y la misma
cuadratura del ensamblaje. Se comparan las seis componentes locales
`[Fxi,Fyi,Mi,Fxj,Fyj,Mj]`, separando acciones mecánicas de deformaciones iniciales.
Así se detectan errores autoequilibrados que dejan intactos `Fx`, `Fy` y `M`.

El equilibrio global publicado suma reacciones contra `R_source`, no contra `F`,
y normaliza `Fx`, `Fy` y `M` por separado con la actividad absoluta de cada
familia de términos.

### 11.2 Clasificación de confiabilidad del resultado

Terminar un cálculo, obtener un resultado legible y obtener un resultado
confiable son tres condiciones distintas. El motor las publica por separado en
`AnalysisResult.reliability`:

- `completed`: la solución numérica llegó al final sin abortar;
- `usable`: la corrida produjo resultados nodales que pueden leerse;
- `level ∈ {reliable, limited, unreliable, failed}`: cuánto de esos resultados
  puede utilizarse.

`success` solo indica que ninguna incidencia alcanzó severidad de error. No es
suficiente: todas las advertencias numéricas —condicionamiento, residuo lineal,
compatibilidad de restricciones, cierre de diagramas— conservan `success = true`.
Por eso la clasificación se construye a partir de diez comprobaciones
independientes, cada una con su propio umbral:

| Comprobación | `limited` por encima de | `unreliable` por encima de |
| --- | --- | --- |
| `condition` — κ₁ del sistema equilibrado | 1e10 | 1e12 |
| `backward-error` — residuo relativo del sistema lineal | 1e-12 | 1e-8 |
| `forward-error` — cota de error hacia delante | 1e-9 | 1e-4 |
| `refinement` — refinamiento iterativo agotado sin alcanzar 5e-15 | — | — |
| `structural-residual` — `r_n` | 1e-9 | 1e-7 |
| `constraints` — `‖CU−g‖` normalizado | 1e-9 | 1e-6 |
| `equilibrium` — residuo físico global | 1e-8 | 1e-6 |
| `load-audit` — auditoría independiente de cargas | 1e-10 | 1e-8 |
| `diagram-closure` — cierre `N–V–M` relativo por miembro | 1e-9 | 1e-7 |
| `compatibility` — compatibilidad de la deformada | 1e-9 | 1e-7 |

El nivel publicado es el peor de las comprobaciones. Una comprobación obligatoria
sin valor finito se clasifica como `unreliable`: si la magnitud del error no puede
acotarse, no hay evidencia de calidad. Una corrida que produjo números pero
conserva alguna incidencia de error se clasifica como mínimo `unreliable`; una que
no produjo resultados nodales se clasifica `failed`. Solo los niveles `reliable` y
`limited` pueden alimentar envolventes, selección de escenario gobernante y
líneas de influencia.

## 12. Recuperación de fuerzas

\[
\mathbf q_l=\mathbf k_l\mathbf d_l-\mathbf f_l
\]

Orden:

\[
[N_i,V_i,M_i,N_j,V_j,M_j]
\]

El motor transforma estos esfuerzos de extremo en funciones internas por equilibrio, no mediante ajuste gráfico.

## 13. Diagramas exactos

Puntos de discontinuidad:

1. Extremos del miembro.
2. Inicio y fin de cada carga distribuida parcial.
3. Fuerzas puntuales.
4. Momentos puntuales.

En un tramo con carga lineal:

- `N(x)` es cuadrático como máximo.
- `V(x)` es cuadrático como máximo.
- `M(x)` es cúbico como máximo.

Los coeficientes se almacenan en coordenada local de tramo `η=x-x₀`.

Saltos:

\[
\Delta N=-P_x
\]

\[
\Delta V=P_y
\]

\[
\Delta M=-M_{puntual}
\]

Los ceros se obtienen resolviendo polinomios de grado uno, dos o tres. Los extremos de momento se buscan entre las raíces exactas de `V(x)` y los límites/saltos.

### 13.1 Precisión de raíces y puntos críticos

Los polinomios se resuelven en la coordenada adimensional `t=x/L`. Los
coeficientes se escalan por su mayor magnitud antes de decidir el grado efectivo;
así una misma forma de diagrama conserva sus raíces al cambiar de m a mm.

- La ecuación cuadrática usa la forma estable
  `q=-½(b+sign(b)√(b²-4ac))`, con raíces `q/a` y `c/q`, para evitar cancelación.
- La cúbica se divide en intervalos monótonos usando las raíces de su derivada.
  Se detectan raíces tangentes en los extremos de esos intervalos y las raíces
  con cambio de signo se refinan por bisección.
- La tolerancia de valor depende de la norma de coeficientes; la tolerancia de
  coordenada depende de `L`.

Todos los extremos de tramo participan como candidatos de máximo/mínimo, incluso
cuando no existe un salto. Esto cubre cambios de pendiente en el inicio o fin de
cargas parciales. En una discontinuidad se conservan por separado los límites
izquierdo y derecho.

Las cargas distribuidas superpuestas se suman como polinomios antes de integrar;
los máximos de una combinación se buscan en la función combinada, no combinando
máximos aislados de casos.

### 13.2 Renderizado exacto

Cada polinomio de grado máximo tres se transforma exactamente en un segmento Bézier cúbico. No se dibuja conectando muestras rectas. Para una función normalizada:

\[
y(t)=a_0+a_1t+a_2t^2+a_3t^3
\]

los controles verticales son:

\[
B_0=y(0)
\]

\[
B_1=B_0+\frac{y'(0)}{3}
\]

\[
B_3=y(1)
\]

\[
B_2=B_3-\frac{y'(1)}{3}
\]

Esto hace que el SVG represente la curva analítica exacta del tramo.

La propiedad se verifica evaluando la curva Bézier y el polinomio original en
puntos interiores, no únicamente en sus extremos. El muestreo visible se usa para
interacción y etiquetas; no es la fuente de la curva ni de los extremos.

### 13.3 Cierres obligatorios

Para cada miembro se comprueban:

1. continuidad de `N,V,M` en límites sin acción concentrada;
2. salto exacto de `N` o `V` ante fuerza puntual;
3. salto exacto de `M` ante momento puntual;
4. relaciones diferenciales coeficiente por coeficiente;
5. cierre del extremo `j` contra las fuerzas locales recuperadas;
6. inclusión de extremos, raíces y límites laterales en el conjunto crítico.

Un error de cierre se reporta como advertencia numérica; no se corrige moviendo
la curva ni sustituyendo el valor por una muestra gráfica. Los cierres `ΔN`,
`ΔV` y `ΔM` se normalizan por separado; nunca se compara una fuerza en kN contra
una escala de momento en kN·m. El cierre relativo de cada miembro se conserva en
`MemberResult.endCompatibilityError` y participa en la clasificación de §11.2.

Cada acción concentrada pertenece exactamente a una frontera de tramo. Los saltos
se asignan a la abscisa de corte más cercana y su coordenada se ajusta a ella, en
lugar de buscarlos por tolerancia en cada frontera: cuando otra frontera —el
borde de una carga distribuida, por ejemplo— cae dentro de esa tolerancia, la
búsqueda por proximidad aplicaría el mismo salto dos veces y falsearía todo el
diagrama aguas abajo de la carga.

### 13.4 Envolventes de N, V y M

La envolvente analiza cada caso de carga y cada combinación definida como un
escenario completo. En cada intervalo común se comparan los polinomios de dos
escenarios y se resuelven sus intersecciones interiores. Los puntos de cruce
subdividen el dominio para conservar, en cada subtramo, el polinomio y el nombre
del escenario que gobiernan el mínimo o el máximo.

Este procedimiento acepta factores positivos o negativos y evita construir una
envolvente a partir de máximos aislados o de una malla de muestreo. La exactitud
es la del modelo lineal y de los tipos de carga admitidos.

Todos los escenarios solicitados se analizan y se conservan, incluidos los que
fallaron o resultaron poco confiables; ninguno desaparece de la lista. Solo los
escenarios con nivel `reliable` o `limited` alimentan la envolvente. Cada
envolvente —de diagramas, de reacciones y de deformadas— publica por ello:

- `complete`: verdadero únicamente si contribuyeron todos los escenarios;
- `includedScenarioIds` y `excludedScenarios` con la causa de cada exclusión;
- `level`: el peor nivel de confiabilidad entre los escenarios que contribuyeron.

Cada tramo de la envolvente se evalúa en sus dos extremos, de modo que una carga
puntual o un momento concentrado aportan su límite izquierdo y su límite derecho
al mínimo, al máximo y a la identidad del escenario gobernante. `evaluateEnvelopeAt`
y `evaluateDeformationEnvelopeAt` reciben el lado (`left` o `right`) como argumento
explícito, porque en una discontinuidad los dos límites son números distintos.

### 13.5 Líneas de influencia y trenes de ejes

La trayectoria móvil es una cadena abierta, continua y no ramificada de miembros
`frame`. Sus miembros se orientan automáticamente desde un extremo y se expresan
con una abscisa común `s`. Las cargas estáticas del proyecto se excluyen del
cálculo de influencia. Para cada posición se aplica una fuerza vertical global
unitaria descendente y se evalúa en el corte objetivo:

\[
\psi_Q(s)=Q(x_t;P_y=-1),\qquad Q\in\{N,V,M\}
\]

La ordenada es adimensional para `N` y `V`, y tiene dimensión de longitud para
`M`. En cada intervalo delimitado por extremos de miembro y por el corte objetivo,
la respuesta se representa mediante un polinomio cúbico. Cuatro análisis en
puntos interiores determinan sus coeficientes y dos análisis adicionales,
distintos de los anteriores, certifican la reconstrucción. Se conservan por
separado los límites izquierdo y derecho de todo salto. Los extremos globales se
obtienen de los extremos de intervalo y de las raíces interiores de la derivada;
no proceden de una cuadrícula gráfica.

La certificación es vinculante, no informativa. Un punto de comprobación falla
solo si excede a la vez la tolerancia absoluta y la relativa —cerca de un cero de
la línea, un error relativo aislado no significa nada—. Los valores por omisión
son `1e-6` relativo, `1e-9` absoluto y hasta cuatro subdivisiones sucesivas. Si un
intervalo no cumple, se divide por la mitad y cada mitad se vuelve a ajustar y a
certificar de forma independiente. Si tras agotar el límite de subdivisión algún
intervalo sigue sin cumplir, la línea se rechaza con `InfluenceFitError`, que
transporta el diagnóstico completo (`accepted`, `subdivisions`,
`maxSubdivisionDepth`, `rejectedIntervals`). Una línea rechazada nunca se entrega
al resto de la aplicación. Además, cada análisis de carga unitaria se clasifica
según §11.2 y un nivel `unreliable` interrumpe la construcción en lugar de
propagarse a la línea.

Como la reconstrucción es exacta para esta biblioteca de elementos —los
desplazamientos bajo una carga puntual móvil son cúbicos por tramos en la
posición de la carga—, estos límites vigilan la degradación numérica, no el error
de discretización.

Para un tren de ejes concentrados con cargas positivas descendentes `P_a`,
offsets `d_a` respecto de un eje de referencia y factor de impacto estático
`\gamma\ge1`, la respuesta es:

\[
R(s)=\gamma\sum_a P_a\,\psi_Q(s+d_a)
\]

Los cambios de polinomio trasladados por cada `d_a` forman la partición exacta
del recorrido. En cada subintervalo se suman los coeficientes y se resuelven las
raíces de `R'(s)` para localizar los máximos y mínimos. El algoritmo no depende
de un paso de avance elegido por el usuario. Esta exactitud es analítica dentro
del elemento lineal y numérica en la solución global IEEE-754; se reportan los
residuos, condicionamiento, cota de error y error de certificación.

## 14. Forma deformada

Por tramo:

\[
\frac{du}{dx}=\frac{N(x)}{EA}+\varepsilon_0
\]

\[
\frac{d\theta}{dx}=\frac{M(x)}{EI}+\kappa_0
\]

\[
\frac{dv}{dx}=\theta(x)-\frac{V(x)}{GA_s}
\]

El último término se toma como cero en Euler–Bernoulli. Para cargas distribuidas
lineales, `u`, `θ` y `v` alcanzan como máximo grados 3, 4 y 5 por tramo. El motor
conserva esos coeficientes, encuentra ceros y extremos interiores mediante las
raíces de los polinomios y compara el extremo integrado con los desplazamientos
nodales recuperados. La diferencia normalizada se guarda como
`compatibilityError`; el SVG adaptativo es solo una representación de estas
funciones analíticas.

### 14.1 Modo Aula

El modo Aula no cambia las ecuaciones del solucionador. Oculta propiedades y
efectos avanzados y conserva valores automáticos `E`, `A` e `I` en los miembros
para que el flujo se limite a geometría, apoyos, liberaciones y cargas.

En una estructura isostática, las reacciones y los esfuerzos `N`, `V`, `M` se
determinan por equilibrio. En una estructura hiperestática, el reparto depende
de las rigideces automáticas; el diagnóstico educativo emite una advertencia para
evitar presentar ese reparto como independiente del material o la sección.

## 15. Unidades

Todos los cálculos se hacen en la base interna. La interfaz convierte únicamente entrada/salida:

- `kN-m`
- `N-mm`
- `kgf-m`
- `kip-ft`

Cambiar el selector de unidades no modifica el modelo físico almacenado.

## 16. Tolerancias y validación

Comparación general:

\[
|a-b|\le atol+rtol\max(|a|,|b|)
\]

Reglas actuales:

- Geometría casi coincidente: `1e-9 × longitud de referencia`.
- Residuo normalizado mayor a `1e-7`: advertencia.
- Estimación `κ₁` mayor a `1e12`: advertencia de condicionamiento.
- Residuo lineal relativo mayor a `1e-12` después del refinamiento: advertencia.
- Cierre N-V-M: tolerancia relativa `1e-7`.
- Diferencia fuente/ensamblaje entre `1e-10` y `1e-8`: advertencia; mayor a
  `1e-8`: error de auditoría y el análisis no se marca como exitoso.
- Equilibrio físico normalizado entre `1e-8` y `1e-6`: advertencia; mayor a
  `1e-6`: error.
- Si `max(||u_j-u_i||/L)>0.05`, la separación interior respecto a la cuerda
  supera `0.05L`, o algún giro nodal/interior supera `0.1 rad`, se advierte que
  la respuesta excede el filtro de pequeñas deformaciones. Es un umbral de
  diagnóstico, no un criterio normativo de servicio.
- No se redondea dentro del motor.

El validador detecta, entre otros:

- nodos o miembros inexistentes;
- longitud cero;
- `E`, `A` o `I` inválidos;
- identificadores repetidos;
- nodos aislados;
- cargas huérfanas;
- dominio de carga parcial inválido;
- cargas intermedias en armaduras;
- proyección de longitud nula;
- resortes negativos;
- mecanismos o matriz singular.

## 17. Alcance no implementado

No debe confundirse el motor actual con un programa general de diseño estructural. No incluye:

- P-Delta o no linealidad geométrica;
- plasticidad;
- grandes desplazamientos;
- análisis dinámico o sísmico;
- placas, cascarones o sólidos;
- cables, elementos solo a tensión y arcos no lineales;
- trenes móviles con carga distribuida o carga viva interior/exterior;
- envolventes móviles simultáneas para todos los cortes;
- factorización dispersa del sistema aumentado completo (la vía dispersa cubre el bloque
  reducido; los vínculos rígidos y los apoyos deslizantes inclinados siguen resolviéndose
  con la factorización densa, ver §11);
- diseño normativo de acero, concreto o madera;

## 18. Referencias conceptuales

- R. C. Hibbeler, *Análisis estructural*, 8.ª ed.: equilibrio, diagramas internos, armaduras, vigas, marcos y método de rigidez.
- Formulaciones clásicas de los elementos de marco plano Euler–Bernoulli y
  Timoshenko y del método directo de rigidez.
- Solución de sistemas lineales con pivoteo, equilibrado y refinamiento iterativo.

## 19. Corte educativo y DCL local

Para un corte en `x` y el cuerpo libre izquierdo, el motor utiliza exactamente el mismo conjunto de cargas locales que el solucionador. Con las acciones internas iniciales

\[
N_0=-q_{i,x},\qquad V_0=q_{i,y},\qquad M_0=-q_{i,m}
\]

se verifican:

\[
\Sigma F_x=-N_0+\Sigma P_x+N(x)=0
\]

\[
\Sigma F_y=V_0+\Sigma P_y-V(x)=0
\]

\[
\Sigma M_{corte}=-M_0-V_0x+\Sigma M_{ext,corte}+M(x)=0
\]

Las resultantes distribuidas se integran analíticamente en el intervalo cargado recortado por el corte. Los residuos se muestran en la interfaz; no se genera una explicación independiente de los resultados del motor.

## 20. Persistencia, migración e internacionalización

El formato serializado vigente es esquema `v5`. La importación no convierte un
objeto arbitrario mediante una aserción TypeScript: valida recursivamente tipos,
valores finitos, límites de colecciones, identificadores y referencias. Los
proyectos `v1/v2/v3/v4` se normalizan y completan con valores compatibles; una versión
futura desconocida se rechaza para no perder información silenciosamente.

El guardado local rota la última copia primaria válida a una clave de respaldo.
Si la primaria está dañada, se conserva el texto original en una clave de
recuperación y se intenta abrir el respaldo. Solo si ambas copias fallan se carga
el proyecto inicial, acompañado de un mensaje de recuperación.

El idioma es una preferencia de presentación y nunca altera valores, unidades,
identificadores ni resultados. Los textos visibles usan catálogos tipados `es/en`;
la ausencia de una clave en inglés falla en pruebas de paridad de catálogos. Los
mensajes matemáticos estructurados conservan magnitudes independientes del idioma.
