# Backlog priorizado del rediseño

Estado de todos los elementos: **diagnosticados, no implementados**. La prioridad responde a impacto UX y criterios del brief; no autoriza cambios de fase.

## P0 — resolver antes de aprobar una interfaz candidata

| ID | Entregable | Criterio de aceptación | Dependencias / límite |
| --- | --- | --- | --- |
| B-001 | Rearquitectura responsive de TopBar | Cero solapamientos en 390, 834, 1024, 1194, 1280, 1366, 1440 y 1536 px; acciones primarias visibles y secundarias accesibles. | Sólo composición; reutilizar acciones/estado actuales. |
| B-002 | Escala tipográfica técnica | Ningún texto crítico <12 px; cuerpo ≥14 px cuando el espacio lo permita; ejes, unidades y valores legibles a 200 %. | No redondear ni cambiar valores para “hacerlos caber”. |
| B-003 | Sistema de targets táctiles | Controles frecuentes ≥44×44 px, separación verificable y sin targets superpuestos en móvil/tableta. | Preservar shortcuts de teclado. |

## P1 — arquitectura y tareas principales

| ID | Entregable | Criterio de aceptación | Dependencias / límite |
| --- | --- | --- | --- |
| B-004 | Layout adaptativo por contenido | La composición compacta se activa antes de colisionar; iPad 1194 horizontal funciona sin comprimir el canvas de forma inutilizable. | Basado en tokens/layout, no en detección de dispositivo. |
| B-005 | Estados del panel de resultados | Cerrado, compacto, expandido y pantalla completa; pestaña activa visible y canvas recuperable. | Mismo payload y tabs actuales. |
| B-006 | Arquitectura de resultados | Agrupar Resumen, Esfuerzos, Deformación, Aprender y Problemas sin perder Axial/Cortante/Momento/Influencia. | Convenciones, precisión y unidades invariantes. |
| B-007 | Viaje Aula persistente | Stepper Modelo→Predicción→Cálculo→Comparación→Reflexión visible con y sin selección; revelado no destructivo. | Aula oculta/revela; nunca altera solver. |
| B-008 | Inspector progresivo | Resumen y grupos Básico/Frecuente/Avanzado; estado vacío útil; hoja móvil con alturas adaptables. | Todos los campos actuales siguen disponibles. |
| B-009 | Roles cromáticos semánticos | Marca, selección, estado, carga y N/V/M usan tokens distintos; contraste AA en claro/oscuro; Aula usa violeta secundario. | Validar con diagramas, no sólo componentes UI. |
| B-010 | Capas y decluttering de canvas | Controles para geometría, apoyos, cargas, cotas, etiquetas y resultados; prioridad por zoom reduce colisiones. | No ocultar silenciosamente información crítica. |
| B-011 | Continuidad de cámara responsive | Cambiar tamaño/orientación conserva una vista útil o ofrece Fit; nunca cambia coordenadas. | Integración visual con cámara existente. |
| B-012 | Herramientas por intención | Grupos Navegar/Modelo/Cargas/Anotar; acciones de edición dependen de selección; Eliminar deja de ser modo persistente. | Mantener comandos y atajos existentes. |
| B-013 | Consolidación de CSS/layout | Una capa coherente de tokens, breakpoints y estados; pruebas de regresión por viewport. | Refactor visual; no mezclar con engine/context changes. |

## P2 — coherencia y acabado funcional

| ID | Entregable | Criterio de aceptación | Dependencias / límite |
| --- | --- | --- | --- |
| B-014 | Indicador global de análisis | Estados listo/calculando/resuelto/desactualizado/error accesibles y persistentes. | Derivar del estado existente. |
| B-015 | Cierre contextual de menús móviles | Seleccionar modo/tema/unidad cierra o confirma la acción sin toque extra innecesario. | Preservar foco y navegación por teclado. |
| B-016 | Descubrimiento de ejemplos móviles | La continuidad de la galería es visible y cada tarjeta tiene target ≥44 px. | No alterar plantillas. |
| B-017 | Cobertura lingüística ES/EN | Todas las superficies inventariadas y términos técnicos tienen equivalencia revisada. | No traducir símbolos, unidades o variables de forma incorrecta. |
| B-018 | Documentación derivada | Cifras de pruebas/versión no quedan obsoletas o se actualizan en el release checklist. | Fuera del motor. |

## Orden propuesto para la fase siguiente

1. Tokens de tipografía, spacing, targets, color y layout.
2. Arquitectura responsive de shell/TopBar y pruebas de no colisión.
3. Navegación de herramientas, inspector y resultados.
4. Capas/decluttering y continuidad de cámara.
5. Viaje Aula y refinamiento de accesibilidad.

Cada bloque debe pasar comparación visual y `verify` antes de avanzar. Si una propuesta exige cambiar tipos o contratos matemáticos, se rechaza o se separa para autorización expresa.

