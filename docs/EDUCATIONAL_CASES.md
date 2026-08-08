# Casos educativos de structureCo

## Política de atribución

Los casos atribuidos utilizan únicamente material visible en muestras oficiales o fuentes públicas autorizadas. Los enunciados cerrados del libro y los manuales de soluciones no se copian. Las prácticas marcadas como originales fueron creadas para structureCo y solo siguen la organización temática y la metodología general de análisis de Hibbeler.

## Caso atribuido — Carga tributaria, Fig. 2–11

Fuente: R. C. Hibbeler, *Structural Analysis*, muestra oficial de Pearson, Fig. 2–11.

https://www.pearsonhighered.com/assets/samplechapter/0/1/3/6/0136020607.pdf

Modelo:

- Viga simplemente apoyada.
- Longitud: 10 ft.
- Carga distribuida: 500 lb/ft = 0.500 kip/ft.
- Propiedades E, A e I educativas, porque el ejemplo atribuido comprueba transmisión de carga y reacciones.

Solución comprobada:

\[
W=wL=(0.500)(10)=5.000\ \text{kip}
\]

Por simetría:

\[
R_A=R_B=2.500\ \text{kip}
\]

Momento máximo en el centro:

\[
M_{max}=\frac{wL^2}{8}=6.250\ \text{kip·ft}
\]

## Práctica original — Diagramas N-V-M

Tema: cargas internas desarrolladas en miembros.

- Viga simple de 8 m.
- Carga uniforme de 5 kN/m.
- Carga puntual de 20 kN en x = 3 m.

Resultados:

\[
R_A=32.500\ \text{kN},\qquad R_B=27.500\ \text{kN}
\]

El cortante cambia de signo al pasar por la carga puntual, por lo que:

\[
M_{max}=M(3)=75.000\ \text{kN·m}
\]

## Práctica original — Armadura 3–4–5

Tema: armaduras estáticamente determinadas.

- Luz: 6 m.
- Altura: 4 m.
- Carga vertical central: 60 kN.

Resultados:

\[
R_{Ay}=R_{By}=30.000\ \text{kN}
\]

\[
F_{AB}=+22.500\ \text{kN}\quad\text{(tensión)}
\]

\[
F_{AC}=F_{BC}=-37.500\ \text{kN}\quad\text{(compresión)}
\]

Los tres casos se ejecutan desde el menú de proyectos y tienen pruebas automatizadas en `src/data/educationalExamples.test.ts`.
