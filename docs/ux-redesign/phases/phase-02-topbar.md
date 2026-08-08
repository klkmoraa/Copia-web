# Slice 2.4 - TopBar por zonas

Fecha: 2026-07-17  
Estado: gate aprobado.

## Arquitectura

- **Documento:** marca, nombre editable con tooltip completo, menú de proyecto y estado de guardado.
- **Contexto:** caso/combinación, modo y unidades según espacio disponible.
- **Acciones:** undo/redo, exportación, overflow secundario y Analizar siempre localizable.

El overflow conserva idioma, tema, unidades, exports, impresión y rutas compactas para historial/caso/modo. Comparte las mismas acciones y estado; no duplica lógica.

## Comportamiento por ancho

| Ancho | Documento | Contexto | Acciones |
| --- | --- | --- | --- |
| 1536/1440 | Completo + guardado | Caso + modo + unidades | Historial + export + overflow + Analizar |
| 1366/1280 | Nombre truncable + guardado | Caso + modo | Historial + overflow + Analizar |
| 1194/1024 | Nombre truncable + guardado | Modo | Overflow con historial/caso + Analizar |
| 834 | Proyecto + guardado | En overflow | Overflow + Analizar |
| 430/390 | Proyecto mínimo | En overflow | Overflow + Analizar |

## Matriz geométrica Browser

Los viewports 390, 430, 834, 1024, 1194, 1280, 1366, 1440 y 1536 resultaron con:

- Intersecciones entre controles visibles: 0.
- Controles fuera del header/viewport: 0.
- Overflow horizontal: 0 px.
- Botón Analizar visible: 9/9.
- Overflow visible y accesible: 9/9.

Pruebas adicionales:

- Proyecto largo: `Pórtico de ejemplo - combinación sísmica extraordinaria 2026` sin invadir otra zona; tooltip conserva el valor completo.
- ES y EN: cero colisiones en 1280, 1366, 1194 y 390.
- Menú secundario dentro del viewport y focus ring sólido de 3 px.
- Escape cierra y devuelve foco al trigger.
- Exportación directa en wide y todas las exportaciones disponibles en overflow.

## Gate

- [x] Tres zonas semánticas en el DOM.
- [x] Matriz de nueve viewports sin intersecciones.
- [x] Light/Dark compatibles mediante tokens.
- [x] Teclado, touch y acciones existentes accesibles.
- [x] Unit test nuevo de arquitectura/overflow/foco.
- [x] `npm.cmd run verify`: 40 archivos, 230 pruebas y build aprobados.
- [x] Sin cambios en motor, workers, datos o contratos.
