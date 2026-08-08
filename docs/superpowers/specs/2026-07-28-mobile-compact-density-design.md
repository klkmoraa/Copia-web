# Densidad móvil compacta para el editor y los resultados

## Objetivo

Hacer que structureCo se perciba más limpia, menos amontonada y ligeramente más pequeña en teléfonos, conservando el lienzo como espacio principal y sin perder capacidades, legibilidad ni seguridad táctil.

El cambio se limita a presentación y comportamiento local de interfaz. Tablet y escritorio mantienen su composición actual.

## Problema observado

En teléfonos, varias superficies presentan información repetida o demasiado extensa al mismo tiempo:

- La insignia del modo muestra permanentemente la instrucción táctil completa.
- La leyenda del diagrama ocupa casi todo el ancho.
- El panel repite el contexto global en el botón de apertura y en una fila interior.
- Las pestañas, el dock y los controles usan espacios visuales mayores de lo necesario.
- El conjunto reduce el área útil del modelo y desplaza el diagrama hacia abajo.

La instrucción “Arrastra para mover · pellizca para ampliar” es ayuda contextual, no un error. En móvil no necesita permanecer visible después de que el usuario ya está trabajando.

## Enfoque aprobado

Se aplicará una densidad compacta equilibrada únicamente hasta 700 px de ancho.

### Lienzo

- La insignia persistente mostrará el modo activo, por ejemplo “Seleccionar”.
- La instrucción gestual larga dejará de ocupar espacio permanente en teléfonos.
- Las instrucciones necesarias durante una operación activa, como colocar o cancelar una carga, seguirán visibles.
- La leyenda N/V/M conservará la familia del resultado, la muestra de color o trazo y la convención técnica, pero usará una composición más estrecha y compacta.
- Capas, zoom, alejamiento y ajuste del modelo seguirán disponibles.

### Panel de resultados

- El botón superior conservará la pestaña y el contexto actuales.
- La fila interior que repite “Vista global” se ocultará en teléfonos porque el contexto ya está presente en el botón.
- Las pestañas usarán tipografía secundaria y espaciado compactos, con desplazamiento horizontal cuando sea necesario.
- La altura abierta bajará moderadamente para devolver espacio al modelo, compensada por la eliminación de la fila redundante.
- El gráfico y sus controles conservarán el mismo comportamiento y datos.

### Encabezado y dock

- Se reducirán espacios, radios y tamaños ópticos de iconos.
- Las áreas táctiles interactivas conservarán un mínimo de 44 por 44 px.
- El dock inferior ocupará menos altura sin ocultar Selección, Nodo, Miembro, Apoyo, Cargas ni Más.
- Se conservarán safe areas y navegación de teclado.

## Contratos que no cambian

- No se modifican `src/engine/**`, `src/workers/**`, `src/data/**`, `src/store/ProjectContext.tsx`, `src/types.ts` ni `src/components/StructuralCanvas.tsx`.
- No cambian solver, resultados, unidades, signos, precisión, geometría, topología, snapping, hit testing, persistencia, IDs, undo/redo ni validaciones.
- No se recalculan ni reformatean valores físicos para conseguir el nuevo aspecto.
- Tablet y escritorio conservan sus superficies, modales y focus traps actuales.

## Implementación prevista

- Ajustar la presentación móvil en `src/styles.css`.
- Añadir una variante de contenido compacto en `CanvasChrome.tsx` solamente si CSS no puede conservar correctamente la ayuda de operaciones activas.
- Actualizar las pruebas del chrome del lienzo y las pruebas o scripts responsive existentes.
- Evitar nuevos estados persistentes y nuevas preferencias de usuario.

## Accesibilidad

- Ningún objetivo táctil será menor de 44 px.
- Se conservarán nombres accesibles, roles, foco visible, Escape y retorno de foco.
- El texto técnico no dependerá únicamente de color o iconos.
- La instrucción de una operación activa seguirá anunciándose mediante el estado existente.
- Se comprobarán Light Mode, Dark Mode y reducción de movimiento.

## Criterios de aceptación

1. En un teléfono de 390 × 844, la instrucción gestual larga no ocupa una franja permanente.
2. La insignia del modo y la leyenda del diagrama no se superponen ni cubren innecesariamente el modelo.
3. “Vista global” no aparece en dos filas consecutivas dentro del panel abierto.
4. El modelo completo permanece visible después de analizar y puede moverse y ampliarse con resultados abiertos.
5. Las pestañas Resumen, Reacciones, Axial, Cortante y Momento siguen alcanzables.
6. El dock inferior conserva todas sus rutas y objetivos táctiles de al menos 44 px.
7. No hay overflow horizontal en 390 × 844, 430 × 932 ni en orientación horizontal.
8. Chromium y WebKit pasan la verificación móvil en Light y Dark.
9. Lint, todas las pruebas y build pasan.
10. El diff de rutas matemáticas y persistentes protegidas queda vacío.

## Verificación

- Añadir primero una prueba que falle al detectar la ayuda gestual persistente o la fila móvil redundante.
- Ejecutar las pruebas dirigidas del chrome, resultados y toolbar.
- Ejecutar `npm.cmd run verify`.
- Ejecutar las matrices responsive de Fase 11 y Fase 14 en Chromium y WebKit.
- Revisar visualmente al menos 390 × 844 y 430 × 932, con resultados abiertos y cerrados.
- Confirmar selección, pan, pinch/zoom, ajuste, cambio N/V/M, Escape, retorno de foco y ausencia de overflow.
- Publicar primero un deploy de vista previa y después producción, verificando HTTP 200 y los assets actuales.
