# Guía de contenido educativo de Aula - Fase 10

## Intención editorial

Aula ayuda a observar, anticipar e interpretar el comportamiento estructural dentro de la app técnica existente. No es una app educativa separada, un tutorial de botones ni una capa de gamificación. Cada explicación debe llevar de una decisión sobre el modelo a evidencia verificable del análisis real.

El canvas sigue siendo el documento principal. La guía violeta acompaña la selección, el inspector y Resultados; no los sustituye ni oculta permanentemente capacidades.

## Principios

1. **Un solo modelo y un solo solver.** Aula edita, analiza y selecciona mediante los contratos existentes.
2. **Predecir antes de revelar.** La persona registra una expectativa de signo, forma, tendencia, ubicación o magnitud antes de ver la respuesta.
3. **Evidencia antes que autoridad.** Una afirmación se vincula a miembro, nodo, carga, caso, diagrama, valor, issue o paso de explicación reales.
4. **Profundidad progresiva.** Resumen, paso a paso y completo explican la misma solución con diferente detalle.
5. **Lenguaje técnico y respetuoso.** Se explica con claridad sin infantilizar ni ocultar limitaciones.
6. **Supuestos visibles.** Defaults, propiedades bloqueadas y dependencia de rigideces se declaran donde afectan la interpretación.
7. **Trazabilidad reversible.** Toda evidencia permite volver al objeto del canvas; navegar no modifica el modelo ni crea historial.

## Recorrido canónico

| Etapa | Pregunta central | Contenido primario | Salida y siguiente acción |
| --- | --- | --- | --- |
| Construye | ¿Qué sistema se está representando? | Geometría, conectividad, ejes y entidades del modelo actual. | Modelo reconocible; continuar a condiciones y acciones. |
| Define | ¿Qué restricciones, cargas, casos y propiedades describen el problema? | Apoyos, cargas, propiedades visibles, unidades y supuestos activos. | Definición revisada; continuar a una predicción. |
| Predice | ¿Qué respuesta se espera y por qué? | Una pregunta focal con unidad y convención aplicables. | Predicción o incertidumbre razonada; habilitar Analiza. |
| Analiza | ¿El modelo se resuelve y qué debe corregirse? | Estado del análisis, progreso y avisos existentes. | Resultado vigente o ruta concreta a Avisos. |
| Compara | ¿Dónde coincide o difiere el resultado de la predicción? | Predicción y evidencia real con signo, ubicación, valor y unidad. | Observación registrada; continuar a una explicación. |
| Concluye | ¿Qué principio explica lo observado? | Relación causa–respuesta, límites y variación hipotética. | Conclusión propia y siguiente ejercicio o vuelta al workspace. |

Se muestra una tarea primaria por vez. En desktop puede verse el recorrido completo como orientación; en móvil, la etapa actual ocupa la superficie y siempre incluye `Volver`, el nombre de la etapa y una salida segura.

## Estructura de una tarea

Toda tarea responde estas cinco preguntas editoriales:

1. **Decisión:** ¿qué debe observar, elegir o explicar la persona?
2. **Contexto:** ¿a qué miembro, nodo, carga, caso o resultado se refiere?
3. **Evidencia:** ¿qué dato real permitirá comprobarla?
4. **Criterio:** ¿cómo se reconoce que la tarea terminó sin inventar una validación de dominio?
5. **Salida:** ¿cuál es el siguiente paso y cómo se abandona Aula sin perder el proyecto?

Plantilla de contenido:

```md
Título: [verbo + objeto técnico]
Pregunta: [una decisión comprobable]
Contexto: [entidad/caso/convención]
Ayuda: [una pista que no revela la respuesta]
Evidencia: [fuente real y ubicación]
Finalización: [interacción o estado existente]
Siguiente acción: [verbo concreto]
```

### Buenos títulos

- `Verifica los apoyos y sus restricciones.`
- `Predice el signo del momento en M2.`
- `Compara la ubicación del máximo con tu predicción.`
- `Explica por qué cambia el cortante en la carga puntual.`

### Evitar

- `¡Vamos a jugar con una viga!`
- `Respuesta correcta` sin evidencia ni contexto.
- `El momento es 42` sin entidad, signo, unidad, caso y origen del valor.
- `La estructura es estable` basado sólo en el conteo editorial de apoyos.
- `Haz clic aquí` sin nombrar la acción o el destino.

## Tono y terminología

El tono es directo, sobrio y colaborativo. Se presupone capacidad para aprender conceptos técnicos; se explica el término cuando aparece por primera vez y después se usa con consistencia.

- Preferir verbos observables: `selecciona`, `compara`, `localiza`, `estima`, `justifica`, `verifica`.
- Nombrar siempre la entidad: `miembro M2`, `nodo N3`, `caso Carga viva`.
- Incluir símbolo y nombre al introducir una magnitud: `momento flector M`, `cortante V`, `axial N`.
- Explicitar la convención de signo pertinente; no usar `positivo` o `negativo` sin contexto.
- Diferenciar `estimación`, `predicción`, `resultado` y `error de comparación`.
- No usar diminutivos, personajes, premios, puntos, rachas, confeti ni mensajes que equiparen rapidez con dominio.
- Reconocer incertidumbre como parte del razonamiento: `Todavía no puedo predecirlo` es una respuesta válida si conduce a observar los datos necesarios.

Mensajes de avance describen hechos: `Predicción registrada`, `Análisis vigente`, `Comparación revisada`. Evitar elogios genéricos como `¡Excelente!` o juicios sobre la persona.

## Predicciones

Una pregunta de predicción debe poder responderse sin haber visto el resultado de esta sesión. Debe identificar:

- entidad y caso o combinación;
- magnitud o rasgo a anticipar;
- unidad activa cuando sea numérica;
- convención de signo o referencia geométrica;
- alcance: extremo, estación, tramo o respuesta global;
- opción de incertidumbre y, cuando aporte valor, justificación breve.

Ejemplo ES:

> Antes de analizar, predice el signo de M en el centro de M2 para el caso Carga viva. Usa la convención mostrada en el diagrama y explica qué apoyo condiciona tu respuesta.

Ejemplo EN:

> Before analysis, predict the sign of M at midspan of M2 for the Live load case. Use the convention shown in the diagram and explain which support governs your answer.

Un campo numérico vacío permanece vacío. No se sugiere `0` como placeholder ni se penaliza una predicción por diferencia numérica: el error presentado es evidencia para interpretar escala, signo y ubicación.

## Analizar sin adelantar la respuesta

La etapa Analiza muestra estado, no resultados físicos, hasta que la persona ejecuta la acción y decide revelar. Copys recomendados:

- Listo: `El modelo contiene lo esencial. Analiza para comprobar estabilidad y equilibrio.`
- En progreso: `Analizando el modelo actual…`
- Resuelto y oculto: `El análisis terminó. Revela el resultado para compararlo con tu predicción.`
- Desactualizado: `El modelo cambió después del cálculo. Analiza de nuevo antes de comparar.`
- Fallido: `El modelo no produjo una solución confiable. Abre Avisos para localizar el problema y corregirlo.`

No mostrar ceros, placeholders, curvas parciales ni una respuesta de autor durante loading, error o bloqueo. No marcar `Analiza` como completo si el resultado pertenece a una revisión anterior del modelo.

## Comparación y evidencia

La comparación reúne, en este orden:

1. predicción original, sin reescribirla;
2. resultado real con entidad, caso, estación, signo, valor y unidad;
3. diferencia o coincidencia presentada, no una calificación;
4. acceso para localizar la evidencia en canvas o Resultados;
5. una pregunta interpretativa.

Ejemplo:

> Predijiste un máximo positivo cerca del centro de M2. El resultado vigente localiza `M = +18.4 kN·m` en `x = 2.38 m`. Localiza ese punto y explica por qué no coincide exactamente con el centro geométrico.

Si cambia el sistema de unidades, se vuelven a presentar la predicción y el resultado en la unidad activa sin cambiar sus valores conceptuales. Los valores almacenados, resultados internos y entradas originales conservan su precisión.

### Fuentes de evidencia permitidas

- selección y propiedades visibles del proyecto;
- estado de preparación existente;
- resultado terminado y vigente;
- extremos, cursor, discontinuidades y tablas ya calculados;
- `analysis.explanation`, incluidas entradas, ecuaciones, salidas e IDs relacionados;
- issues reales con severidad, objeto y acción;
- unidades y formatters de presentación existentes.

No transcribir un resultado esperado dentro de la lección. No recalcular extremos o errores físicos en el contenido. No inferir el objeto de una evidencia seleccionando el primer miembro o nodo disponible.

## Tres niveles de profundidad

| Nivel | Incluye | Excluye |
| --- | --- | --- |
| Resumen | Propósito, resultado gobernante, unidad, ubicación y siguiente acción. | Derivaciones largas, matrices y datos secundarios. |
| Paso a paso | Secuencia de decisiones, relaciones esenciales, ecuaciones clave y verificación. | Volcado completo de entradas o trazas internas sin explicación. |
| Completo | Datos de entrada, convenciones, ecuaciones, salidas, IDs relacionados, unidades y verificaciones disponibles. | Información inventada o no producida por el análisis. |

Los niveles no equivalen a `fácil`, `normal` y `difícil`. Una persona puede cambiar de nivel en cualquier etapa y conservar selección, cursor, predicción y progreso. El contenido común se redacta una vez; cada nivel agrega contexto sin contradecir el anterior.

## Defaults y propiedades bloqueadas

Cuando una actividad depende de un valor no introducido en esa sesión, identificarlo como supuesto activo.

Formato recomendado: **supuesto → impacto → acción**.

ES:

> Este miembro usa las propiedades mecánicas actuales del proyecto. En un sistema hiperestático, E, A, I y G·As pueden cambiar la distribución de esfuerzos. Cambia a modo Completo para revisarlas; sus valores almacenados se conservan.

EN:

> This member uses the project’s current mechanical properties. In a statically indeterminate system, E, A, I, and G·As can change force distribution. Switch to Complete mode to review them; stored values are preserved.

Reglas:

- No llamar `correcto`, `estándar` o `real` a un default.
- No insertar en el copy el valor numérico de un default; leerlo desde la propiedad visible cuando sea necesario.
- No convertir un campo bloqueado en explicación editable.
- Indicar qué se conserva y cómo acceder a la edición completa.
- No declarar isostático o hiperestático mediante una regla editorial. Usar el diagnóstico o aviso existente cuando esté disponible.
- En una actividad introductoria se puede omitir la derivación de rigidez, pero no ocultar una advertencia que cambie el significado del resultado.

## Estados y validación inline

Todo mensaje sigue **estado o problema → impacto → acción**.

| Estado | Contenido esperado |
| --- | --- |
| Vacío | Explica qué falta y abre la herramienta o selección adecuada. |
| En progreso | Mantiene visible la etapa y el contexto; no anuncia resultados parciales. |
| Completo | Describe la evidencia cumplida y ofrece avanzar o revisar. |
| Desactualizado | Identifica que el modelo cambió y exige reanalizar antes de comparar. |
| Bloqueado | Nombra el bloqueo, lo que se conserva y una acción segura. |
| Error | Conserva la predicción y ofrece Avisos, reintentar o volver. |
| Sin selección compatible | Pide la entidad correcta sin cambiar de objeto automáticamente. |

La validación de contenido puede comprobar campos, orden, traducción y referencias. La validación estructural sigue perteneciendo al dominio y se presenta sin duplicarla.

## ES/EN y glosario

Una lección publicada tiene paridad semántica completa entre español e inglés. No basta con traducir títulos: prompts, helpers, opciones, estados, nombres accesibles, alternativas visuales, atribución y mensajes de bloqueo deben existir en ambos idiomas.

| Concepto | ES | EN | Nota editorial |
| --- | --- | --- | --- |
| `build` | Construye | Build | Modelo y conectividad; no `Draw` como nombre de etapa. |
| `define` | Define | Define | Condiciones, acciones y propiedades. |
| `predict` | Predice | Predict | Antes del cálculo o revelado. |
| `analyze` | Analiza | Analyze | Ejecuta el solver real. |
| `compare` | Compara | Compare | Contrasta predicción y evidencia. |
| `conclude` | Concluye | Conclude | Explica y generaliza con límites. |
| axial | esfuerzo axial N | axial force N | Elegir `force` o `effort` según la convención ya establecida en el catálogo. |
| cortante | cortante V | shear V | Mantener símbolo. |
| momento flector | momento flector M | bending moment M | No abreviar antes de introducirlo. |
| apoyo | apoyo | support | Diferenciar de `reaction`. |
| hiperestática | hiperestática | statically indeterminate | No usar `unstable` como traducción. |

Las traducciones priorizan terminología técnica equivalente, no longitud idéntica. Revisar truncamiento en desktop, tablet y móvil con texto real de ambos idiomas.

## Atribución y revisión técnica

Toda lección publica:

- autoría y revisores;
- fuente y enlace cuando adapte un ejercicio externo;
- licencia o permiso aplicable;
- nota de adaptación;
- fecha de la última revisión técnica;
- nota inequívoca de que los valores visibles provienen del análisis activo.

No copiar problemas, diagramas o soluciones sin atribución verificable. Una referencia bibliográfica no autoriza reproducir material protegido. Si el permiso no está claro, conservar sólo el concepto general y crear geometría, texto y figuras originales.

La revisión técnica verifica objetivo, convención de signos, unidades, alcance, avisos, compatibilidad de la plantilla y correspondencia entre cada afirmación y su fuente de evidencia.

## Accesibilidad

- Usar encabezados y lista ordenada para el recorrido; `aria-current="step"` identifica la etapa actual.
- Cada control tiene nombre que expresa acción y destino. Evitar controles cuyo nombre sea sólo `Siguiente` cuando el resultado sea ambiguo.
- Los targets táctiles tienen al menos 44 × 44 px en composiciones táctiles.
- El foco visible usa azul y contraste suficiente en Light/Dark; violeta identifica Aula, no sustituye el foco.
- Drawer, sheet o vista enfocada contienen foco, cierran con Escape y lo devuelven al invocador.
- `Tab` y `Shift+Tab` recorren la tarea en orden visual; no se usan `tabIndex` positivos.
- Cambio de etapa, error, análisis terminado y evidencia desactualizada se anuncian con live regions breves.
- No usar color, posición o animación como única explicación de signo, estado o selección.
- Diagramas y ecuaciones tienen alternativa textual. La alternativa nombra entidad, caso, magnitud, tendencia, punto relevante, valor y unidad disponibles.
- Tablas conservan `caption`, encabezados semánticos y unidades en las columnas.
- Respetar `prefers-reduced-motion`; el progreso no anima geometría ni resultados físicos.
- A 200 % de zoom se conserva lectura, foco, salida y acceso a la acción primaria sin overflow horizontal del documento.

## Responsive

### Desktop

El recorrido puede permanecer visible como guía lateral o contextual mientras canvas y Resultados conservan espacio útil. La tarea actual tiene prioridad; detalle y evidencia se expanden sin convertir Aula en un dashboard.

### Tablet

Aula usa drawer contextual con backdrop, foco contenido y retorno. La selección o apertura de Resultados no borra el progreso. Una sola superficie modal domina a la vez.

### Móvil

Cada etapa usa una pregunta primaria, controles grandes y detalle progresivo. Comparación o explicación extensa puede abrir una vista dedicada. Bottom sheet, teclado virtual y dock respetan safe areas y no se solapan.

La capacidad es equivalente entre formatos: cambia la composición, no el modelo, la evidencia ni el conjunto de etapas.

## Proceso de autoría

1. Definir una decisión de aprendizaje estrecha y observable.
2. Elegir un ejemplo o plantilla existente y verificar sus IDs actuales.
3. Nombrar la evidencia real que sostendrá cada afirmación.
4. Escribir Construye y Define para orientar sin resolver por adelantado.
5. Formular la predicción antes de cualquier acción de analizar o revelar.
6. Especificar los estados sin análisis, calculando, resuelto oculto, desactualizado y fallido.
7. Diseñar Compara con predicción original, resultado vigente y localización en el modelo.
8. Cerrar con una conclusión que relacione causa y respuesta, incluyendo límites.
9. Escribir resumen, paso a paso y completo sobre la misma evidencia.
10. Completar ES/EN, alternativa accesible, atribución y revisión técnica.
11. Validar schema y referencias; probar la lección renderizada con teclado y touch.

## Lista de control de contenido

- [ ] Usa exactamente Construye → Define → Predice → Analiza → Compara → Concluye.
- [ ] La predicción aparece antes del cálculo o revelado y admite incertidumbre.
- [ ] Los inputs vacíos no se convierten en cero.
- [ ] Toda magnitud visible incluye entidad, caso cuando aplica, signo, unidad y origen.
- [ ] Comparación y explicación consumen resultados y traces reales.
- [ ] La edición posterior marca la evidencia como desactualizada.
- [ ] Resumen, paso a paso y completo son coherentes entre sí.
- [ ] Defaults, bloqueos e hiperestaticidad tienen supuesto, impacto y acción.
- [ ] El lenguaje es técnico, claro y no infantil; no hay gamificación.
- [ ] ES/EN tienen paridad semántica y caben en todos los viewports objetivo.
- [ ] La atribución y licencia están verificadas.
- [ ] La alternativa accesible permite comprender evidencia sin depender del color o la gráfica.
- [ ] La tarea es operable por teclado, touch y a 200 % de zoom.
- [ ] El contenido no introduce un segundo modelo, solver, resultado, unidad, validación o historial.

## Evidencia de aceptación

Una lección candidata se acepta con:

- validación del documento y sus referencias en ES/EN;
- recorrido funcional de las seis etapas sobre un ejemplo real;
- comprobación de que los resultados permanecen ocultos hasta la acción de revelar;
- comparación numérica contra el resultado vigente en cada sistema de unidades soportado;
- prueba de desactualización al editar y reanálisis posterior;
- revisión de foco, Escape, retorno, `Tab`, `Shift+Tab`, touch, reduced motion y zoom 200 %;
- revisión visual desktop, tablet y móvil, Light/Dark y ES/EN;
- diff-check que confirme ausencia de cambios en motor, workers, contratos, persistencia y validación del dominio.

