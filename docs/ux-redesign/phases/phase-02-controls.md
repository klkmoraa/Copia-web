# Slice 2.2 - Tipografía crítica y targets

Fecha: 2026-07-17  
Estado: gate aprobado.

## Cambios

- Controles y menús usan 14 px; metadatos/valores críticos usan un piso de 12 px.
- Números heredan variantes tabulares sin modificar sus valores almacenados.
- TopBar, cámara, overflow e inspector tienen targets de 44 x 44 px en tablet/móvil.
- Desktop conserva controles compactos de 40 px y la acción Analizar mide 44 px.
- Focus ring azul de 3 px visible en temas claro y oscuro.
- El ancho de Analizar queda estable durante loading para evitar layout shift.

## Evidencia Browser

Viewport medido: 834 x 1194.

| Control frecuente | Bounding box |
| --- | --- |
| Inicio | 44 x 44 px |
| Menú de proyecto | 44 x 44 px |
| Más acciones | 44 x 44 px |
| Analizar | 44 x 44 px |
| Acercar / Alejar / Fit | 44 x 44 px cada uno |
| Abrir inspector | 44 x 44 px |

- Intersecciones entre controles visibles: 0.
- Overflow horizontal: 0 px.
- `canvas-status`: 12 px.
- `canvas-mode-badge`: 12 px.
- Menú secundario: dentro del viewport.
- Escape: cierra el menú y devuelve foco a `Más acciones`.
- Foco abierto: outline sólido azul de 3 px.
- Consola: sin warnings ni errores relevantes.

## Gate

- [x] Targets frecuentes 44 x 44 en composición touch.
- [x] Sin targets solapados.
- [x] Foco visible y retorno correcto.
- [x] Copy crítico 12 px mínimo en superficies cubiertas.
- [x] `npm.cmd run verify`: 40 archivos, 229 pruebas y build aprobados.
- [x] Sin cambios en motor, workers, datos o contratos.
