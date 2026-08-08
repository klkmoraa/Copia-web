# Inventario de superficies e interacción

## Mapa de superficies

| Superficie | Propósito | Estados principales | Componentes/datos visibles | Frontera con el motor |
| --- | --- | --- | --- | --- |
| Bienvenida | Orientar y abrir el primer trabajo | nuevo, ejemplos, reciente | marca, propuesta, tarjetas, preferencias | No calcula; inicia o carga proyecto. |
| Centro de importación | Incorporar modelos con seguridad | fuente, archivo, mapeo, revisión, error | pasos, dropzone, formatos, validación | Debe preservar parsers y modelo serializado. |
| WorkspaceShell | Coordinar el espacio completo | desktop, tablet, mobile; inspector/resultados abiertos | TopBar, rail/dock, canvas, inspector, resultados | Sólo composición; no debe duplicar estado matemático. |
| TopBar | Contexto y acciones globales | guardado, historial, caso, modo, tema, unidades, idioma | proyecto, caso/combinación, undo/redo, Analizar, menús | Consume estado de proyecto/análisis; no lo recalcula. |
| Rail/dock de herramientas | Crear y manipular entidades | herramienta activa, grupos abiertos, desktop/mobile | selección, navegación, nodos, miembros, apoyos, cargas, edición | Despacha comandos existentes. |
| Canvas estructural | Modelar y leer la estructura | vacío, modelado, seleccionado, resultados, error | geometría, apoyos, cargas, cotas, diagramas, etiquetas | Representa exactamente entidades y resultados existentes. |
| Inspector | Ver y editar selección/contexto | vacío, nodo, miembro, carga, multiselección; modal móvil | propiedades, cargas, vista, resultados locales | Escribe por acciones existentes; no introduce fórmulas. |
| Panel de resultados | Interpretar la solución | cerrado/abierto, listo, analizando, resuelto, error | resumen, reacciones, N/V/M, influencia, deformada, aprender, problemas | Presenta el payload del solver sin cambiar signo/unidad. |
| Guía Aula | Estructurar aprendizaje | introducción, predicción, revelado | objetivo, pasos, inputs N/V/M, comparación | Puede ocultar/revelar, nunca cambiar la solución. |
| Diálogos y overlays | Acciones secundarias o críticas | importar, abrir, exportar, ayuda, preferencias, error | formularios, confirmaciones, foco modal | Invocan capacidades existentes. |
| Notificaciones | Confirmar o alertar | éxito, información, advertencia, error | mensajes temporales | Reflejan eventos existentes. |

## Inventario de herramientas

| Grupo | Acción | Atajo actual | Observación UX |
| --- | --- | --- | --- |
| Navegación | Seleccionar | `V` | Acción primaria correcta. |
| Navegación | Pan | `H` | Útil como herramienta y gesto; evitar duplicar jerarquía. |
| Modelo | Nodo | `N` | Primaria en escritorio y móvil. |
| Modelo | Miembro | `M` | Primaria en escritorio y móvil. |
| Modelo | Apoyo | `S` | Primaria en escritorio y móvil. |
| Cargas | Puntual | `P` | Agrupar bajo Cargas en espacios compactos. |
| Cargas | Distribuida | `D` | Agrupar bajo Cargas; conservar semántica visual. |
| Cargas | Momento | `O` | Agrupar bajo Cargas; distinguir de color de error. |
| Anotación | Cota | `C` | Secundaria/contextual. |
| Edición | Dividir | `B` | Contextual a un miembro elegible. |
| Edición | Cortar | `X` | Contextual y con ayuda clara. |
| Edición | Eliminar | `Backspace` | Retirar como modo persistente; conservar acción y atajo. |

## Inventario del inspector

### Nodo

- Coordenadas y edición geométrica.
- Tipo/orientación de apoyo y restricciones personalizadas.
- Desplazamientos prescritos, bisagra interna y resortes en modo Completo.
- Resultados asociados cuando existe solución válida.

### Miembro

- Tipo estructural: frame, truss o rígido.
- Geometría, material y sección.
- Teoría de viga y efectos iniciales.
- Liberaciones, conexiones semirrígidas y offsets rígidos.
- Extremos y resultados locales.

### Cargas

- Carga nodal o de miembro.
- Magnitud, dirección, posición/distribución, caso y acciones de edición/eliminación.

### Global

- Pestañas actuales Inspector, Cargas y Vista.
- Estados de selección única, múltiple y sin selección.
- En móvil funciona como hoja modal con fondo inerte y restauración de foco.

## Inventario de resultados

| Tab actual | Trabajo que resuelve | Familia propuesta |
| --- | --- | --- |
| Resumen | Estado y magnitudes clave | Resumen |
| Reacciones | Equilibrio/apoyos | Resumen o Esfuerzos |
| Axial | Diagrama N | Esfuerzos |
| Cortante | Diagrama V | Esfuerzos |
| Momento | Diagrama M | Esfuerzos |
| Influencia | Línea de influencia | Análisis avanzado |
| Deformada | Desplazamientos | Deformación |
| Aprender | Explicación pedagógica | Aprender |
| Problemas | Diagnóstico | Problemas |

La agrupación es sólo una propuesta de navegación: ninguna pestaña ni dato se elimina.

## Estados de producto que el rediseño debe cubrir

- Proyecto nuevo, ejemplo, importado y recuperado.
- Guardado local, cambio pendiente y error de persistencia.
- Sin selección, selección única, multiselección y selección inválida tras editar.
- Sin análisis, calculando, resuelto, desactualizado y error/mecanismo.
- Completo y Aula.
- Claro, oscuro, alto contraste del sistema, movimiento reducido y transparencia reducida.
- Desktop amplio, laptop, tableta horizontal/vertical y móvil.
- Teclado/mouse, touch y stylus como entrada apuntadora.
- ES/EN y sistemas de unidades existentes.

## Dependencias de composición actuales

- TopBar: 66 px.
- Rail: 164 px en escritorio; 76 px bajo el primer breakpoint.
- Inspector: 320 px.
- Resultados: alrededor de 285 px en escritorio y 330 px abierto en móvil.
- Breakpoints principales observados: 1180 px y 960 px.

Estas medidas explican el comportamiento actual; no son requisitos para la nueva arquitectura.

