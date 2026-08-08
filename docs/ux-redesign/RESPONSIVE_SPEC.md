# structureCo Responsive Specification

## Alcance y frontera

Esta especificación cierra la Fase 11 con una sola jerarquía React y un solo estado por superficie. Los cambios responsive organizan `AppShellLayout`, TopBar, ToolRail/ToolDock, canvas, Inspector y Resultados; no cambian el proyecto, el solver, las unidades físicas, los signos, la geometría, la topología, la persistencia de proyectos ni los handlers matemáticos.

Los breakpoints responden al espacio útil del contenido, no al nombre comercial de un dispositivo.

## Matriz de composición

| Ancho útil | Composición | Herramientas | Inspector | Resultados |
| --- | --- | --- | --- | --- |
| `>= 1440 px` | Desktop amplio | Rail expandido | Lateral persistente, 280-480 px, redimensionable | Inferior persistente: compacto, expandido o enfocado |
| `1024-1439 px` | Laptop/desktop compacto | Rail compacto | Lateral persistente y redimensionable | Inferior persistente y redimensionable |
| `701-1023 px` | Tablet portrait/landscape por contenido | Dock inferior de seis destinos y sheets modales | Drawer lateral modal | Drawer inferior modal |
| `<= 700 px` | Móvil canvas-first | Header mínimo y dock inferior alcanzable | Bottom sheet modal | Vista dedicada full-screen modal |
| `701-1023 px` y altura `<= 600 px` | Tablet/móvil ancho en orientación corta | Dock lateral compacto | Drawer derecho | Drawer modal sin comprimir tablas o gráficas |
| `<= 700 px` y altura `<= 600 px` | Móvil estrecho o zoom equivalente | Dock inferior | Bottom sheet limitado al visual viewport | Vista full-screen con scroll interno |

Los estados `fullCanvas`, rail compacto, ancho del Inspector y modo de Resultados son preferencias de presentación locales. No forman parte del proyecto estructural.

## Reflow, ocultamiento y superficies dedicadas

- Reflow: TopBar, guía Aula, formularios, resumen y controles cambian columnas sin duplicar contenido.
- Ocultamiento: sólo desaparece copy secundaria cuando existe nombre accesible o una ruta equivalente en Más.
- Drawer/sheet: Inspector, Resultados y paletas usan el mismo componente y estado que desktop; cambia su contenedor, no sus handlers.
- Vista dedicada: en móvil, Resultados ocupa el visual viewport completo. Conserva tabs, contexto, unidades, gráficas, tablas y una salida visible.
- Exclusión mutua: abrir Inspector colapsa Resultados; una solicitud de Resultados cede el Inspector. Nunca quedan dos diálogos modales operables simultáneamente.

## Safe areas y teclado visual

- TopBar, dock, launchers, bottom sheets y Resultados consumen `env(safe-area-inset-*)`.
- `WorkspaceShell` sincroniza altura, desplazamiento superior y espacio inferior desde `window.visualViewport`; es estado efímero de layout.
- El bottom sheet del Inspector limita su altura al visual viewport y mantiene scroll interno con `overscroll-behavior: contain`.
- Resultados full-screen usa la altura real del visual viewport; su cabecera y salida permanecen visibles cuando cambia la altura disponible.
- Ningún campo vacío se convierte en cero y ningún valor físico se reformatea por un cambio de viewport.

## Mouse, teclado, touch y stylus

- Desktop conserva shortcuts, tab order, resize por puntero y resize por `Arrow`, `Shift+Arrow`, `Home` y `End`.
- Touch conserva hit areas de canvas, pan de un dedo, pinch y long-press del pipeline existente.
- Controles frecuentes de Inspector, Resultados, TopBar y ToolDock alcanzan 44 px bajo `pointer: coarse`.
- Las gráficas permiten fijar una lectura por toque y mantienen scroll vertical mediante su contrato `touch-action` existente.
- Stylus usa Pointer Events del canvas. La automatización emula el contrato `pointerType`; no sustituye una prueba futura con hardware real.

## Contrato modal y foco

Inspector, Resultados y paletas táctiles:

1. exponen diálogo modal y nombre accesible;
2. mueven el foco a una acción útil al abrir;
3. contienen `Tab` y `Shift+Tab` en controles visibles;
4. cierran con `Escape` y backdrop;
5. restauran el foco al launcher, excepto cuando una superficie modal cede explícitamente a otra;
6. marcan el fondo como `inert` y lo retiran al cerrar.

## Persistencia y límites

- `structureco:workspace-layout:v1` conserva sólo preferencias visuales. `inspectorWidth` se sanea a 280-480 px.
- La orientación no crea un segundo árbol DOM ni reinicia selección, resultados, cámara o historial.
- Las capturas y métricas generadas por QA viven en `qa-artifacts/phase11/` y no se incorporan al bundle.
- Riesgos residuales no reclamados como cerrados por automatización: teclado iOS real, VoiceOver/TalkBack y stylus físico.

## Comandos reproducibles

```text
npm.cmd run verify
npm.cmd run qa:phase11
npm.cmd run qa
npm.cmd run qa:webkit
```

`qa:phase11` genera `phase11-results.json` y screenshots Chromium/WebKit para las composiciones objetivo.
