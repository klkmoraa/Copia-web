# Fase 12 — Contrato de estados de feedback

## Principio

Cada estado debe explicar tres cosas sin depender sólo del color:

1. qué sucede;
2. qué impacto tiene para la persona;
3. cuál es la siguiente acción disponible.

Los estados combinan texto, icono o spinner y semántica accesible. Los errores urgentes usan `role="alert"`; cambios no destructivos usan `role="status"` y anuncios `polite`. Los controles ocupados exponen `aria-busy` y quedan inertes mientras termina la acción.

## Inventario verificado

| Estado | Señal y semántica | Acción o continuidad | Cobertura |
| --- | --- | --- | --- |
| Listo | Icono, título y detalle; `StatusStrip` con estado `ready` | Analizar cuando el modelo esté preparado | Prueba unitaria |
| Calculando / loading | Spinner, texto de acción, `aria-busy`; botones loading deshabilitados | Esperar sin disparar la acción dos veces | Prueba unitaria y reduced-motion en Chromium |
| Resuelto / success | Check, título y detalle; anuncio `polite` | Consultar resultados | Prueba unitaria y recorrido runtime EN |
| Desactualizado / stale | Reloj, texto explícito y siguiente paso; anuncio `polite` | Volver a analizar | Prueba unitaria |
| Advertencia | Triángulo, texto y estado `polite` | Abrir detalles de análisis | Prueba unitaria de acción accesible |
| Error | Icono, texto y `role="alert"`/anuncio `assertive` en banners | Corregir o abrir detalles | Prueba unitaria |
| Validación de campo | Mensaje enlazado con `aria-describedby` y `aria-errormessage`; `aria-invalid`; `role="alert"` | Corregir el valor sin convertir vacío a cero | Pruebas unitarias y validación real EN en Inspector |
| Vacío | Título, descripción, icono opcional y acción opcional | Crear, seleccionar o analizar según el contexto | Prueba de Resultados e inventario de componente |
| Nuevo ejercicio | Descripción del diálogo enlazada; errores numéricos inline localizados y foco al primer campo inválido | Corregir parámetros o cerrar con Escape | Pruebas unitarias; apertura/foco/flechas/retorno runtime EN |
| Importación en revisión | Seis etapas visibles; cada cambio de etapa mueve foco al encabezado correspondiente | Revisar y confirmar antes de reemplazar | Pruebas unitarias y recorrido real EN |
| Importación no combinable | Radio deshabilitado descrito por ayuda enlazada con `aria-describedby` | Elegir proyecto nuevo o volver | Pruebas unitarias y recorrido real EN |
| Importación bloqueada o fallida | Error inline con `role="alert"`; el flujo vuelve a un estado recuperable | Elegir otro archivo o corregir el problema | Prueba unitaria de error |
| Importación completada | Encabezado enfocado `Project imported` y resumen de resultado | Abrir el proyecto importado | Prueba unitaria y recorrido real EN |
| Almacenamiento local | Check, etiqueta textual y `role="status"` con anuncio `polite` | Seguir trabajando localmente | Prueba unitaria |
| Backup recuperado | Etiqueta específica de recuperación | Revisar el proyecto recuperado | Prueba unitaria de prioridad de estado |
| Fallo de carga / guardado | Icono, etiqueta de error y diagnóstico textual | Conservar visible el problema prioritario | Prueba unitaria |
| Sin conexión | Icono, “Sin conexión · local” y explicación; no depende del color | Seguir editando en la sesión y navegador actuales | Chromium y captura visual |

La salida de navegador está en [phase12-metrics.json](evidence/phase-12/after/phase12-metrics.json). Las capturas [validación numérica EN](evidence/phase-12/after/phase12-i18n-en-numeric-validation-1366x768.png), [importación EN](evidence/phase-12/after/phase12-i18n-en-import-confirm-1366x768.png) y [offline local-first](evidence/phase-12/after/phase12-offline-local-first-1366x768.png) muestran estados representativos.

## Evidencia de preservación

El error `Use a value between 0 and 1.` se vinculó al campo `Position` por `aria-describedby` y `aria-errormessage`. El borrador `1.2` quedó visible, pero:

- `ML1.position` permaneció en `0.25`;
- el JSON persistido permaneció byte a byte sin cambios;
- el análisis permaneció en estado `resolved`;
- Escape eliminó el estado inválido y restauró la presentación del valor almacenado.

El flujo de importación comparó la huella técnica antes y después de `Project imported`; nodos, miembro, carga, apoyos, propiedades, unidades e IDs permanecieron iguales.

## Prioridad de estados

Cuando coinciden señales, se conserva la que exige una decisión más inmediata:

1. un fallo de carga local permanece visible aunque el navegador también esté offline;
2. offline prevalece sobre una notificación histórica de backup recuperado;
3. warning y error de análisis permiten abrir los detalles existentes;
4. loading bloquea el disparo duplicado y anuncia la acción en curso;
5. una validación inline conserva el borrador visible sin mutar el valor válido almacenado.

## Frontera de dominio

La capa de feedback no recalcula ni reinterpreta el modelo. Muestra estados derivados del análisis y de la validación existentes. No sustituye la validación física, no modifica magnitudes, unidades internas, signos, topología ni resultados, y no convierte borradores vacíos en cero.

## Límites

- No todos los estados tienen una captura individual; los estados sin screenshot se verifican por pruebas unitarias y por su contrato de componente.
- La prueba offline no incluye recargar la aplicación sin red y no implica soporte PWA.
- La importación runtime cubre un JSON structureCo válido y destino de proyecto nuevo; no certifica todos los formatos externos, errores de archivo o conflictos.
- La presencia de un anuncio live no reemplaza una sesión manual con lector de pantalla.
- La evidencia automatizada no constituye por sí sola una certificación WCAG completa.
