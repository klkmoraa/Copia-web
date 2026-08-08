# Nueva identidad visual Clay oficial

**Fecha:** 2026-08-07 17:46
**Agente:** Codex
**Rama:** main

## Qué cambió

- Se migró el sistema de tokens a la paleta Clay oficial: bases marfil cálidas, tinta verde profunda, acento verde, colores técnicos y sus equivalentes dark.
- Se incorporaron IBM Plex Sans e IBM Plex Mono como fuentes locales (`public/fonts`), sin CDN ni solicitudes externas.
- Se ajustaron radios, sombras direccionales, highlights, superficies elevadas y hundidas, gradientes de controles y estados pressed para reproducir la receta del brandbook.
- Se aplicó la identidad a las superficies reales de Bienvenida, TopBar, Toolbar, Inspector, Results, controles, popovers y modales. Results conserva su disposición debajo del canvas.
- Se preservó la geometría, cámara, composición e interacción de la viga 3D de Bienvenida; solo hereda los colores nuevos mediante tokens.
- Se actualizaron las comprobaciones visuales de QA para validar la receta Clay real, incluidos material elevado, estado pressed y salida de impresión de Results.

## Por qué

El intento visual anterior no reproducía de forma consistente el sistema definido por `brandbook-clay.html` ni el objetivo de `structureco-real-clay.html`. La migración reemplaza los valores base en lugar de añadir una capa genérica de claymorphism sobre la identidad anterior.

## Archivos tocados

- `src/design-system/tokens.css`
- `src/design-system/fonts.css`
- `src/design-system/material.css`
- `src/styles.css`
- `public/fonts/ibm-plex-*.woff2`
- `qa.mjs`

## Cómo verificar

1. Ejecutar `npm.cmd run verify`.
2. Ejecutar `npm.cmd run qa`.
3. Revisar Bienvenida y Workspace en light/dark, escritorio/tablet/móvil. Confirmar que Results permanece apilado bajo el canvas y que la viga 3D no cambió de composición ni comportamiento.

## Pendiente / siguiente paso

No hay pendientes funcionales. El cambio queda en un commit local; no se hizo push ni publicación.
