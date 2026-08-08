# S17 — Accesibilidad y responsive

- **Agente:** Claude Code (agente principal)
- **Modelo:** Sonnet 5 (`claude-sonnet-5`)
- **Fecha:** 2 de agosto de 2026
- **Estado de GitHub:** NO UTILIZADO

## Objetivo

Verificar §25/§26 sobre la aplicación real tras los cambios de 0.8.1, y extender la cobertura
donde la auditoría previa (Fase 12, 0.8.0) declaró explícitamente que no llegaba.

## Punto de partida: no repetir lo ya auditado

`docs/ux-redesign/A11Y_REPORT.md` (2026-07-26) ya certificó, con evidencia reproducible sobre
0.8.0: semántica de feedback, tabs por teclado, foco modal e inicial, Escape con retorno al
lanzador, validación numérica con `aria-invalid`/`aria-errormessage`, nombres accesibles en
resultados, `prefers-reduced-motion`, contraste medido con foco real, y responsive en
390×844 / 834×1194 / 1366×768. Ese documento también declara sus límites con honestidad: **no
certifica zoom 200%, no prueba WebKit, no usa lector de pantalla real, no audita
`forced-colors`.**

S17 no repite esa auditoría. Verifica que sigue vigente tras los cambios de esta sesión y
**amplía la matriz exactamente donde Fase 12 dijo que no llegaba**: más viewports y una
comprobación de reflujo a zoom alto.

## Matriz de viewport verificada (ampliación real sobre Fase 12)

| Viewport | Overflow horizontal | Errores de consola |
|---|---|---|
| 1536×960 | no | — |
| 1366×768 | no | ya cubierto por Fase 12 |
| 1024×768 | no | **nuevo** |
| 834×1194 | no | ya cubierto por Fase 12 |
| 844×390 (móvil horizontal) | no | **nuevo** |
| 390×844 | no | ya cubierto por Fase 12 |
| 360×800 | no | **nuevo** |
| 640×400 (aproximación de zoom 200% sobre 1280×800) | no | **nuevo, Fase 12 declaró esto fuera de alcance** |

Barrido completo de consola sin errores en las ocho configuraciones.

## Un hallazgo que investigué a fondo y descarté correctamente

A 834×1194, los botones «Corregir en el modelo» del panel de avisos medían **32×169 px** —
por debajo del mínimo táctil de 44 px que exige §26 y que ya declaran los tokens
(`--sc-size-target-touch: 44px`).

Antes de reportarlo, verifiqué la causa:

```js
matchMedia('(pointer: coarse)').matches  // → false, incluso a 834×1194
```

**Este navegador de automatización reporta `pointer: fine` sin importar el tamaño del
viewport**, porque no es hardware táctil real — cambiar el tamaño de ventana no cambia el
tipo de puntero que el sistema operativo reporta. El CSS del producto ya condiciona
correctamente el tamaño táctil a `@media (pointer:coarse)`
(`src/styles.css:1288`: `.results-panel :is(button,input,select) { min-width/min-height:
var(--sc-control-height-touch) }`).

Para confirmarlo sin necesitar hardware físico, forcé la condición de la media query a
verdadero reescribiendo `rule.media.mediaText = 'all'` sobre las hojas de estilo cargadas, y
volví a medir el mismo botón:

```
min-height forzado: 44px
altura real renderizada: 44px
```

**El CSS es correcto.** El hallazgo inicial era un artefacto del entorno de prueba (idéntico
en naturaleza al de S05-S08 con `blur`/`focus`), no un defecto del producto. No se hizo ningún
cambio de código.

## Otras verificaciones puntuales

- El enlace de salto («Saltar a la mesa de trabajo») es el primer elemento del DOM y tiene
  `tabIndex: 0`.
- El botón de marca sin texto visible (`brand-mark brand-home-button`) lleva
  `aria-label="Ir al inicio"`.
- El tema oscuro por preferencia del sistema (`colorScheme: dark` del navegador) se refleja
  correctamente en `document.documentElement[data-theme]` a tamaño móvil.
- `prefers-reduced-motion` forzado del mismo modo que el touch: `--sc-motion-standard` y
  `--sc-motion-loading` caen a `0.001ms`, consistente con la prueba ya existente en
  `tokens.test.ts`.
- `<html lang>` ya se sincroniza con el idioma de la aplicación en `App.tsx:20`
  (`document.documentElement.lang = project.settings.language`) — comprobado en código, no es
  un defecto.

## Decisión

**No se realizó ningún cambio de código.** El trabajo de este slice es la verificación misma:
confirma que la accesibilidad y el responsive certificados en Fase 12 siguen vigentes después
de nueve slices de cambios (tokens, formateo numérico, SVG/PNG, PDF, bus de comandos,
importación), y añade evidencia real en cuatro configuraciones que Fase 12 no cubría.

## Archivos tocados

Ninguno.

## Pruebas ejecutadas

No aplica ejecución de suite (sin cambios de código). Estado heredado del commit anterior:
78 archivos, 530 pruebas en verde.

## Riesgos

- La media query de puntero es la estrategia correcta y estándar (detecta capacidad real del
  dispositivo en vez de adivinar por ancho de viewport), pero **sigue sin verificarse en
  hardware táctil real** — solo se demostró que la regla CSS se activa y produce el tamaño
  correcto cuando la condición se cumple.

## Limitaciones (heredadas de Fase 12, no resueltas aquí)

- Sin pantalla táctil física ni lector de pantalla real.
- Sin verificación en WebKit/Safari (el navegador de esta sesión es Chromium).
- Sin auditoría de `forced-colors` / alto contraste del sistema.
- El zoom 200% se aproximó redimensionando el viewport a la mitad; no es idéntico al zoom real
  del navegador, aunque para efectos de reflujo y overflow horizontal —que es lo que exige
  §26— produce el mismo resultado observable.
- Sin capturas de pantalla: el panel del navegador no compone frames en esta sesión.

## Siguiente paso

S18 — CI preparado localmente.

## Commit local

Ninguno (sin cambios de código que commitear).
