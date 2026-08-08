# Especificación de visualizaciones de Resultados - Fase 9

## Propósito

Esta especificación define cómo representar reacciones, N/V/M, deformación, líneas de influencia, envolventes, escenarios, matrices e issues sin alterar los datos del análisis. La visualización sirve para leer y navegar resultados exactos; no es una capa de cálculo.

## Contrato de datos

| Visualización | Datos consumidos | Operación visual permitida |
| --- | --- | --- |
| Reacciones | `nodeResults` | Conversión de unidad, formato y orden de tabla. |
| N/V/M | `diagramSegments`, `diagramJumps`, `criticalPoints`, mínimos y máximos | Escala de pantalla, paths con helpers vigentes, etiquetas y cursor. |
| Deformación | `deformation`, `deformationSegments`, críticos y extremos | Escala visual, selector u/v/θ y cursor. |
| Influencia | Resultado y estado de línea de influencia existentes | Composición, leyenda y sincronización con canvas. |
| Escenarios/envolventes | Resultados de escenarios y envelopes existentes | Small multiples, ramas mínima/máxima y governing case. |
| Comprensión | `matrixTrace`, explicación y verificaciones existentes | Tablas parciales legibles y vínculos a objetos. |
| Avisos | `analysis.issues` | Jerarquía, severidad y acción contextual. |

Prohibido derivar en UI nuevos polinomios, raíces, extremos, fuerzas, reacciones, envolventes, tolerancias o signos. `evaluateDiagramAt`, `evaluateDeformationAt`, los helpers de segmentos y los resultados existentes son la única base de lectura.

## Roles visuales

| Magnitud/estado | Token semántico | Identificador no cromático | Uso |
| --- | --- | --- | --- |
| Axial | `technical-axial` / alias vigente `--axial` | Símbolo **N** y título “Axial” | Curva, marcador, badge y columna. |
| Cortante | `technical-shear` / `--shear` | Símbolo **V** y título “Cortante” | Curva, marcador, badge y columna. |
| Momento | `technical-moment` / `--moment` | Símbolo **M** y título “Momento” | Curva, marcador, badge y columna. |
| Deformación | `technical-deformed` | Símbolos **u**, **v**, **θ** | Curva, selector y columna. |
| Reacción | `technical-reaction` | **Rx**, **Ry**, **Mz** | Tabla, leyenda y localización. |
| Influencia | Rol técnico vigente de influencia/deformación | Nombre de respuesta y posición de carga | Curva y estado del canvas. |
| Selección/foco | `selection` / `focus` | Contorno, foco y etiqueta de entidad | Nunca sustituye el color técnico. |
| Éxito/aviso/error | Roles `state-*` | Icono, título y texto | Solo estado del sistema, no magnitud. |

Las curvas físicas base pueden permanecer sólidas porque siempre están acompañadas por símbolo, título y unidad. Cuando dos o más series comparten una gráfica, se añade patrón de trazo, marcador o etiqueta directa; nunca se distinguen solo por color.

## Anatomía de una gráfica

1. Encabezado con miembro, magnitud, caso/combinación y unidad.
2. Selector contextual que usa IDs existentes.
3. Área de trazado con eje cero, estaciones, límites de tramo y curva.
4. Marcadores de extremos, ceros y discontinuidades.
5. Cursor hover/fijado y readout exacto.
6. Leyenda únicamente cuando existen varias series, ramas o escenarios.
7. Resumen accesible o tabla equivalente para valores esenciales.

No se superponen instrucciones extensas sobre la curva. La explicación vive fuera del área trazada y se adapta a pantalla pequeña.

## Escalas y ejes

### Eje x

- Representa la coordenada local del miembro de `0` a `L`.
- Las etiquetas pasan por `toDisplay(..., 'length')` y muestran la unidad activa.
- Inicio, fin, límites de tramo, saltos y puntos críticos permanecen candidatos de navegación.
- La gráfica no cambia orientación ni convención de signos para “verse más natural”.

### Eje y

- Incluye siempre el eje cero cuando los datos lo permiten.
- La escala usa el máximo absoluto de los valores ya calculados para reservar amplitud visual simétrica y evitar clipping.
- Una magnitud constante o cercana a cero conserva una escala mínima puramente gráfica; esa escala no modifica ni sustituye el valor presentado.
- N y V muestran unidad de fuerza; M, unidad de momento; u/v, longitud; θ, `rad`.
- Si dos small multiples necesitan escalas distintas, cada uno declara su rango. Una comparación directa usa escala común cuando sea legible y se identifica explícitamente.

Las marcas de eje son ayudas de lectura, no nuevas estaciones de cálculo.

## Curvas por tramos

- Los paths se construyen con los helpers existentes de segmentos para conservar la forma polinómica disponible.
- Cada frontera de tramo puede mostrarse con una guía vertical tenue, especialmente al navegar o explicar el método.
- El relleno bajo la curva es secundario, de baja opacidad y nunca oculta ejes, marcas o texto.
- La línea principal mantiene contraste suficiente sobre el canvas de Resultados en Light y Dark.
- No se suavizan esquinas, saltos ni cambios de tramo con interpolaciones visuales ajenas al resultado.

## Extremos, ceros, extremos de miembro y puntos críticos

| Punto | Marca | Etiqueta |
| --- | --- | --- |
| Máximo | Marcador sólido y símbolo/familia | Valor y estación cuando gobierna o está seleccionado. |
| Mínimo | Marcador sólido con posición diferenciada | Valor y estación. |
| Máximo absoluto | Énfasis en Resumen y acción “localizar” | Magnitud, signo, unidad, miembro y x. |
| Cero | Círculo abierto sobre el eje | `0`; no repite unidad si la leyenda ya la fija. |
| Inicio/fin | Marca de borde | Estación y valor si es crítico. |
| Salto | Segmento vertical/patrón y dos lados | `izq.` y `der.` con sus valores. |

Las etiquetas se deduplican con la tolerancia ya usada por la presentación y limitan densidad para evitar colisiones. Ocultar una etiqueta por espacio no elimina el punto del cursor, tabla o navegación.

## Discontinuidades

Una discontinuidad se dibuja como salto explícito entre los valores izquierdo y derecho en la misma estación.

- No unir ambos lados mediante una curva suave.
- Usar un segmento vertical con patrón, marcador o etiqueta que no dependa del color.
- Al fijar el cursor en el salto, mostrar `izq. valor → der. valor`, magnitud y unidad.
- El readout principal debe identificar qué lado usa para la marca visible; si ambos son relevantes, presenta los dos.
- La estación del salto proviene de `diagramJumps`; la UI no detecta saltos comparando píxeles.

## Cursor compartido y navegación

| Estado | Apariencia | Entrada |
| --- | --- | --- |
| Hover | Guía vertical tenue y punto | Movimiento de puntero. |
| Fijado | Guía más firme, punto y readout persistente | Click/tap o flechas con la gráfica enfocada. |
| En discontinuidad | Contorno de aviso y lectura izquierda/derecha | Snap a estación de salto. |
| En envolvente | Ramas mín./máx., escenarios gobernantes y x | Cursor fijado con modo envolvente activo. |

- El cursor conserva `memberId` y `x` al cambiar entre N, V, M y deformación.
- Flechas recorren la estación; `Shift` aumenta el paso; `Inicio`/`Fin` van a `0/L`.
- El snap privilegia límites, saltos y críticos existentes dentro del umbral visual vigente.
- El readout usa cifras tabulares y presenta x, N, V y M juntos, o x, u, v y θ.
- El cursor no actualiza proyecto, análisis, historial ni persistencia.

La gráfica incluye `<title>`, descripción de teclado y un nombre con magnitud y miembro. Los valores gobernantes también existen como texto o tabla; el SVG no es el único canal accesible.

## Envolventes y escenarios

- “Env.” es un modo de comparación controlado, no una nueva familia física.
- Las ramas **Mín.** y **Máx.** usan etiqueta directa y patrones distintos; la leyenda nombra ambas.
- El cursor muestra valor, unidad y escenario gobernante de cada rama.
- La curva del caso actual puede atenuarse, pero permanece identificable.
- La carga o generación asíncrona anuncia estado busy y conserva el resultado actual.
- Para varios casos, se prefieren small multiples o resumen tabular antes que una superposición saturada.
- Un small multiple incluye nombre del caso/combinación, escala y magnitud. No se comparan valores sin unidad o contexto.

## Deformación

- El selector u/v/θ es un grupo con estado presionado y etiqueta accesible.
- u y v usan unidad de longitud; θ usa radianes.
- Los máximos interiores y valores del cursor provienen de `deformationSegments` y críticos existentes.
- La forma trazada es una lectura de respuesta del miembro, no una geometría editable ni una escala física del canvas.
- La amplitud visual puede normalizarse para legibilidad si se comunica como diagrama; el valor numérico nunca se multiplica ni redondea para coincidir con ella.

## Líneas de influencia

- Título y leyenda identifican respuesta objetivo, entidad, dirección/signo y posición de la carga móvil.
- La posición activa se sincroniza con el estado de canvas existente.
- Ceros, extremos y discontinuidades siguen las mismas reglas N/V/M.
- No se mezclan coordenadas de la línea de influencia con una estación N/V/M sin una etiqueta explícita.
- Interacción por teclado y touch ofrece el mismo destino que puntero.

## Tablas y matrices

- Tablas usan `caption`, `th scope="col"` y `th scope="row"`; no simulan grillas con `div`.
- Números se alinean a la derecha, usan cifras tabulares y mantienen el signo.
- La unidad se ubica en el encabezado; no se repite en cada celda salvo readouts aislados.
- Encabezados son sticky dentro del contenedor de scroll.
- Filas accionables mantienen una acción o control con nombre; una fila completa no depende solo de hover.
- Matrices grandes usan scroll bidimensional y una vista parcial declarada. El cálculo conserva la matriz completa.
- Cero exacto puede usar un glifo tenue como `·` en matrices. No se aplica tolerancia visual para convertir residuos pequeños en cero.
- Copy/export incluye encabezados, unidades, caso/combinación y precisión técnica suficiente.

## Formato numérico

| Contexto | Presentación recomendada |
| --- | --- |
| Reacciones y N/V/M principales | Decimal compacto, normalmente 3 decimales, con unidad visible. |
| Estación x | Decimal compacto, normalmente 2-3 decimales, en longitud activa. |
| Labels dentro de gráfica | 2-3 decimales; detalle completo disponible en readout/tabla. |
| Desplazamientos y rotaciones | Notación científica cuando la escala lo exige. |
| Residuos, error y matrices | Notación científica y cifras suficientes para diagnóstico. |
| Predicción vs resultado | Precisión comparable y unidad común visible. |

Estas reglas afectan solo el texto. La conversión usa helpers existentes, `-0` puede normalizarse visualmente a `0`, y ningún redondeo se persiste o se utiliza para evaluar equilibrio, governing cases o discontinuidades.

## Light y Dark

- Todos los colores provienen de tokens semánticos/técnicos; no se agregan hexadecimales locales.
- Dark tiene superficies, ejes, texto, curvas, overlays y sombras definidos; no es una inversión de Light.
- Curva, eje, marker, focus ring y texto alcanzan contraste en ambos temas.
- El relleno técnico reduce opacidad antes de comprometer legibilidad de la línea.
- El azul de selección y foco se distingue de N/V/M; verde queda para marca/acción y no significa un esfuerzo positivo.
- Success, warning y error siempre incluyen icono o texto.

## Responsive y touch

### Desktop

La gráfica vive en panel expandido o modo enfocado, con leyenda/readout lateral o inferior. Resize conserva una altura mínima útil y la tabla puede compartir contexto con el canvas.

### Tablet

Drawer/sheet con gráfica a ancho completo. Leyenda y readout se reordenan debajo; tablas y matrices hacen scroll interno. Targets táctiles miden al menos 44 px.

### Móvil

El bottom sheet compacto muestra estado o valor gobernante. La visualización completa abre una vista dedicada con:

- header mínimo con volver, magnitud, miembro y unidad;
- gráfica con altura estable y `touch-action` que no secuestra el scroll vertical;
- readout en dos columnas o apilado;
- tabs/familias con targets de 44 px;
- padding de safe area y acciones fuera del teclado virtual.

No se ocultan extrema, discontinuidades, unidad, selector de miembro ni ruta de regreso para hacer caber la gráfica.

## Movimiento y rendimiento

- Transiciones de panel usan tokens de motion y quedan neutralizadas con `prefers-reduced-motion`.
- No se anima la forma física al punto de sugerir una evolución temporal inexistente.
- Pointer move puede actualizar lectura transitoria mediante refs/batching; no dispara análisis ni mutaciones globales por frame.
- Se reutilizan segmentos y resultados memoizados existentes. Una mejora de rendimiento debe medirse antes de añadir memoización o dependencias.
- El cambio de tema, resize y cursor no vuelven a resolver la estructura.

## Evidencia y pruebas mínimas

| Área | Casos |
| --- | --- |
| Exactitud | Fixtures N/V/M, reacciones, deformación, influencia, escenarios y extremos coinciden con baseline. |
| Discontinuidad | Salto muestra ambos lados y no interpola; cursor fija la estación correcta. |
| Trazabilidad | Modelo→resultado y resultado→modelo para nodo, miembro, issue y extremo. |
| Cursor | Cambio N→V→M→deformación conserva miembro/x; puntero, touch y teclado. |
| Formato/unidades | Cuatro sistemas de presentación, signos, magnitudes extremas y cero real sin mutar datos. |
| A11y | Tablist, separator, SVG con título/descripción, tablas semánticas, foco y canal no cromático. |
| Responsive | Desktop expandido/enfocado, drawer tablet y vista dedicada móvil en portrait/landscape. |
| Temas | Light/Dark con curvas, ejes, markers, focus y estados legibles. |
| Performance | Cursor/resize fluidos, sin análisis por frame, consola limpia y bundle sin regresión injustificada. |

## Exclusiones explícitas

- No modificar engine, workers, unidades, tipos, persistencia o `ProjectContext` para obtener una apariencia.
- No reconstruir polinomios, extremos, saltos, envolventes o deformación dentro de componentes visuales nuevos.
- No invertir signos, ejes o ramas para ajustarse a una convención gráfica distinta.
- No usar escalas, interpolaciones o animaciones que alteren el significado.
- No depender solo de color, hover, screenshot ideal o puntero.
- No crear gráficas decorativas, KPIs ficticios ni una copia educativa del resultado real.
- No ocultar precisión, contexto, unidades o estados gobernantes en exportes.
