# Especificación de paridad con FTOOL 4.01

## Fuente y criterio

La referencia de producto es **FTOOL 4.01 (junio de 2024)**:

- manual oficial: <https://www.tecgraf.puc-rio.br/ftool/downloads/ftoolman_en.pdf>;
- sitio oficial: <https://www.tecgraf.puc-rio.br/ftool/>;
- tutorial de pórtico: <https://www.tecgraf.puc-rio.br/ftool/downloads/tutorialframe.zip>;
- tutorial de armadura: <https://www.tecgraf.puc-rio.br/ftool/downloads/tutorialtruss.zip>;
- tutorial de puente y tren móvil: <https://www.tecgraf.puc-rio.br/ftool/downloads/tutorialloadtrain.zip>.

"Paridad" no significa que dos capturas se parezcan. Exige coincidencia, dentro
de una tolerancia declarada, de desplazamientos, reacciones, fuerzas de extremo,
valores interiores, signos, unidades, líneas de influencia y envolventes. Una
capacidad solo se marca como validada cuando existe un modelo reproducible, una
referencia independiente y el registro numérico de comparación.

Las fuentes oficiales no publican la matriz elemental, el vector consistente de
cargas, el pivotado, las tolerancias de singularidad ni la representación interna
de miembros rígidos. Por ello no se promete identidad bit a bit. structureCo
persigue equivalencia física y numérica verificable para el mismo modelo lineal.

## Alcance matemático común

Ambas herramientas resuelven estructuras planas lineales-elásticas mediante el
método de rigidez. Cada nodo dispone de los grados globales
`[Ux, Uy, Rz]`. El alcance común incluye:

- marcos Euler–Bernoulli y con deformación por cortante Timoshenko;
- armaduras axiales y miembros rígidos;
- apoyos globales o inclinados, resortes y movimientos impuestos;
- rótulas nodales y liberaciones de extremo;
- cargas nodales, uniformes, lineales y térmicas;
- casos, combinaciones, reacciones, deformada y diagramas `N–V–M`;
- unidades configurables sin modificar el modelo físico.

FTOOL no documenta P–Delta, grandes desplazamientos, plasticidad, análisis modal,
espectral ni historia de tiempo. Su factor de impacto para trenes móviles es un
multiplicador estático; no es un análisis dinámico.

## Matriz de aceptación

| Bloque | Estado de structureCo | Evidencia requerida para cierre |
|---|---|---|
| Rigidez 2D, apoyos, resortes y liberaciones | Implementado | Banco analítico y tutorial oficial de pórtico |
| Euler–Bernoulli / Timoshenko | Implementado | Límite EB y referencia con `G·As` finito |
| Cargas estáticas y térmicas | Implementado | Resultantes, trabajo equivalente y tutorial oficial |
| Casos, combinaciones y envolventes estáticas | Implementado | Superposición y cruces internos gobernantes |
| Diagramas y deformadas | Implementado | Cierre por miembro y extremos interiores |
| Líneas de influencia `N–V–M` | Implementado y verificado analíticamente | Falta contraste archivado con el tutorial oficial de puente |
| Tren de ejes concentrados | Implementado y verificado analíticamente | Falta contraste archivado con el tutorial oficial |
| Trenes con cargas distribuidas y carga viva interior/exterior | Pendiente | Tutorial oficial y comparación de envolventes |
| Catálogo de materiales y secciones | Pendiente | Propiedades y orientación de sección |
| Importación/exportación `.ftl` / `.pos` | Pendiente | Ida y vuelta sin pérdida documentada |
| Nueve comparaciones externas `SC-FT-03…11` | Pendiente | Archivo FTOOL, versión y salida archivada |

## Política de exactitud

"Exacto" se usa únicamente para una operación analítica dentro de la formulación
lineal adoptada: integración polinómica, raíces de tramos, transformación a
Bézier o combinación de escenarios. La solución global usa `number` IEEE-754 y
siempre debe acompañarse de residuo, estimación de condición y cota de error.

Cada nueva formulación debe incluir antes de su entrega:

1. un caso cerrado con solución analítica o referencia independiente;
2. equilibrio global y cierre por elemento;
3. prueba de invariancia al sistema de unidades;
4. un caso mal condicionado o mecanismo;
5. una descripción explícita de sus límites físicos.

## Orden de trabajo

1. Corregir cualquier regresión del solver lineal antes de ampliar alcance.
2. Contrastar las líneas de influencia y los trenes de ejes ya implementados con
   el tutorial oficial y archivar la salida de referencia.
3. Validar los tres tutoriales oficiales y completar `SC-FT-03…11`.
4. Incorporar trenes distribuidos, carga viva interior/exterior y superposición
   móvil-estática.
5. Añadir bibliotecas de material/sección e interoperabilidad `.ftl`.
6. Tratar P–Delta, plasticidad o dinámica como módulos separados, sin mezclar sus
   resultados con el solver lineal de primer orden.
