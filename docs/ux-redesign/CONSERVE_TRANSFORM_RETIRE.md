# Conservar, transformar y retirar

Esta decisión se aplica a patrones de interfaz. “Retirar” no significa eliminar una capacidad matemática o un dato.

## Conservar

- Motor, workers, contratos de análisis, convenciones, precisión, unidades y fixtures.
- Modelo local-first, serialización, importación/exportación y continuidad del proyecto.
- Canvas como superficie principal y sincronía selección–inspector–resultados.
- Herramientas y atajos existentes como vocabulario funcional.
- Bienvenida y Centro de importación, especialmente su progresión y targets.
- Diagnóstico de mecanismo/error y capacidad de volver al modelo.
- Hoja modal móvil del inspector con fondo inerte y restauración de foco.
- Temas claro/oscuro, ES/EN, preferencias de movimiento/transparencia y pruebas automatizadas.
- Verde como identidad reconocible de structureCo.

## Transformar

- TopBar en zonas estables: proyecto/contexto, análisis y utilidades secundarias.
- Rail/dock en grupos por intención y acciones contextuales.
- Canvas con capas, niveles de detalle, decluttering y respuesta a orientación.
- Inspector en resumen + Básico/Frecuente/Avanzado, con estados móviles adaptables.
- Resultados en familias y estados cerrado/compacto/expandido/pantalla completa.
- Aula en un recorrido persistente con predicción, comparación y reflexión.
- Color en roles independientes para marca, interacción, estado y física.
- Breakpoints fijos en reglas basadas en contenido y contenedor.
- Tipografía y targets para cumplir 12 px crítico, 14 px de cuerpo y 44–48 px táctiles.
- Estado de análisis en una señal global clara y accesible.

## Retirar como patrón

- Geometría de TopBar que permite intersecciones entre controles.
- Texto técnico de 8–11 px y labels que sólo funcionan por proximidad visual.
- Eliminar como herramienta persistente de primer nivel; conservar acción y atajo.
- Nueve pestañas de resultados presentadas como opciones equivalentes en una sola tira.
- Inspector largo y plano sin disclosure progresivo.
- Uso del mismo verde para marca, éxito, selección y magnitudes físicas.
- Suposición de que rail 164 + inspector 320 + resultados 285 caben en cualquier “desktop”.
- Overrides responsive acumulativos y contradictorios.
- Cámara que conserva ciegamente escala/centro tras un cambio grande de viewport.
- Cifras manuales de pruebas que se vuelven obsoletas.

## Regla de seguridad

Si retirar o transformar un patrón hace inaccesible un dato, una opción de modelado, un resultado o un atajo existente, el cambio no cumple esta decisión y debe corregirse antes de integrarse.

