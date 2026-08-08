# Slice 2.6 - Consolidación visual

Fecha: 2026-07-17  
Estado: gate aprobado.

## Alcance consolidado

- Reunificadas en la declaración principal las reglas finales de TopBar, marca, nombre de proyecto, botones de icono, selectores compactos, Analizar y popovers.
- Eliminadas reglas huérfanas de `theme-switch` y `switch-track`; el tema continúa operando desde el overflow actual.
- Popovers migrados a tokens de z-index, radio, spacing, borde y sombra.
- Estados y controles conservan roles semánticos de color Light/Dark.
- No se hizo una reescritura global del CSS heredado; la limpieza se limitó a las superficies modificadas en Fase 2.

## Validación

- `npm.cmd run lint`: aprobado sin warnings.
- `npm.cmd run build`: aprobado.
- Tokens comprobados en Browser:
  - Light: app `#f3f5f4`, surface `#ffffff`, text `#17201c`.
  - Dark: app `#0d1110`, surface `#151a18`, text `#f2f6f4`.
- Indicador global hereda correctamente color y superficie en ambos temas.
- Matriz 390, 430, 834, 1024, 1194, 1280, 1366, 1440 y 1536 px repetida tras la limpieza:
  - intersecciones: 0;
  - controles fuera del header: 0;
  - overflow horizontal: 0 px.

## Frontera matemática

Único archivo productivo modificado en este slice: `src/styles.css`. No se tocaron motor, workers, datos, contratos, persistencia ni resultados.
