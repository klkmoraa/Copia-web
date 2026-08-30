# Rediseño Clay de Space 3D (desktop/tablet/teléfono, claro/oscuro)

**Fecha:** 2026-08-10 12:39
**Agente:** Claude Code
**Rama:** main

## Qué cambió

Rediseño completo de la superficie Space 3D (`src/features/space3d/`, `src/space3d/view/`) siguiendo las capturas de referencia aportadas por el usuario como fuente de verdad visual: claymorphism del brandbook, carril de herramientas vertical, panel «Modelo / Vistas», Inspector/Resultados con tablas y dropdown, cabecera con selector de proyecto/caso y toggle de tema, barra de estado con unidades, y una bandeja inferior desplegable en móvil. Misma estructura de DOM en todos los tamaños de pantalla — sólo CSS repositiona (grid + `display: contents`), sin duplicar controles ni tablas entre breakpoints.

No se tocó el solver, el worker ni el modelo de dominio de Space 3D.

## Por qué

El usuario pidió ejecutar directamente el rediseño visual de Space 3D usando cuatro imágenes de referencia (desktop/tablet/móvil, claro/oscuro) como especificación aprobada, sin fase de investigación ni de planificación previa. Antes de tocar código se verificó una discrepancia real: las imágenes describen una superficie que **sí existe** en este repo raíz (`src/features/space3d`, con three.js, worker y store propios), distinta del proyecto anidado `structureCo/` (que es 2D y no tiene ninguna pantalla llamada «Space 3D»). Se trabajó sobre la superficie real.

## Archivos tocados

- `src/features/space3d/Space3DWorkspace.tsx` — reestructuración completa: cabecera con selector de proyecto/caso (reutiliza el `<select>` existente, sólo reubicado), toggle de tema local (persiste en la misma clave `structureCo.theme` que el editor 2D), carril vertical de herramientas, panel Modelo/Vistas, bandeja `.space3d-sheet` (contiene el mismo Inspector/Resultados de siempre), marca de tiempo del último análisis, chip de unidades reales (`kN · m · rad`, no grados — el motor usa radianes).
- `src/features/space3d/Space3DToolRail.tsx` (nuevo) — carril de herramientas: Seleccionar/Nodo/Barra/Carga/Apoyo + Deshacer/Rehacer/Eliminar. «Apoyo» edita las restricciones de un nudo ya seleccionado (no crea una entidad nueva: en S3D-1 el apoyo es un atributo del nudo, no una entidad aparte).
- `src/features/space3d/Space3DModelNav.tsx` (nuevo) — panel Modelo/Vistas: conteos reales (nudos, barras, apoyos, cargas, casos, combinaciones), lista de Vistas (misma cámara que gobierna el selector del lienzo), «Propiedades del modelo» con datos reales (id, objetivo, grados de libertad).
- `src/features/space3d/Space3DResultsPanel.tsx` — pestañas de resultados convertidas a un `<select>` «Tablas de resultados»; se agregó el aviso de éxito «Análisis completado correctamente» que faltaba para el estado `ready`.
- `src/features/space3d/space3d.css` — ~480 líneas nuevas/editadas: carril vertical, panel Modelo/Vistas, bandeja inferior móvil, cabecera del lienzo (selector de vista + zoom + pantalla completa), selector de proyecto, tres niveles de breakpoint (escritorio ≥960px, tablet 600–959px con el mismo esqueleto de escritorio en 3 columnas, teléfono ≤599px con bandeja fija).
- `src/space3d/view/Space3DCanvas.tsx` — el preset de cámara pasa a ser controlado desde fuera (`activeView`/`onViewChange`), para compartir estado con la lista Vistas del panel lateral; se agregó selector `<select>` «Vista» y botón de pantalla completa real (Fullscreen API) sobre el lienzo.
- `src/i18n/catalogs.ts` — 27 claves nuevas (es/en) para el carril, el panel Modelo/Vistas, el selector de resultados, la bandeja móvil y el aviso de éxito.
- `src/features/space3d/Space3DWorkspace.test.tsx`, `src/space3d/view/Space3DCanvas.test.tsx` — adaptados a los controles nuevos (selector de vista en vez de botones por preset, dropdown de resultados en vez de pestañas); ninguna aserción de comportamiento se debilitó.

## Cómo verificar

```bash
npm test          # 134 archivos, 1015 tests, 8 skipped — todo en verde
npx tsc -b         # typecheck limpio
npx oxlint         # lint limpio
npm run build      # build de producción sin errores
```

Visual (dev server `npm run dev`, abrir Inicio → tarjeta «Space 3D»):
- **Escritorio** ≥960px: carril + panel Modelo/Vistas + viewport + Inspector/Resultados en 4 columnas, sin overflow horizontal, tema claro y oscuro.
- **Tablet** 600–959px (probado en 768×1024): mismo esqueleto que escritorio en 3 columnas (el panel Modelo/Vistas y el Inspector comparten una columna apilada) — no es un móvil comprimido.
- **Teléfono** ≤599px (probado en 390×844): viewport arriba, carril de herramientas fijo abajo, bandeja Inspector/Resultados desplegable con toque (contraída por defecto, se expande sola al crear/editar una entidad o al navegar el panel Modelo). Objetivos táctiles ≥44px verificados.

Nota de entorno: en esta sesión el panel de navegador no compositaba capturas de pantalla (`screenshot` fallaba con «Browser pane is not displayed»), así que la verificación visual se hizo con estilos computados y simulación de interacción vía `javascript_tool` en vez de capturas — confirmé grid columns, posición, overflow, colores de tema y flujo de expansión de la bandeja, pero no hay una captura de imagen para revisar a ojo. Recomendado: abrir la app y confirmar visualmente antes de dar el diseño por cerrado.

## Pendiente / siguiente paso

- Simplificación deliberada frente al mockup: la bandeja móvil tiene 2 pestañas (Inspector/Resultados) en vez de 4 («Modelo/Herramientas/Resultados/Inspector»). «Herramientas» se omitió porque duplicaría los botones del carril inferior (dos controles con el mismo nombre accesible rompen lectores de pantalla y tests); «Modelo» se implementó como panel siempre visible arriba de la bandeja en vez de una pestaña aparte, para no duplicar sus datos en dos sitios del DOM a la vez.
- No se agregó «Ver informe» ni «Perspectiva» como vista adicional: no existe generación de informes en Space 3D (a diferencia del editor 2D) ni un quinto preset de cámara en el motor — añadirlos habría sido inventar funcionalidad, no rediseñar la existente.
- Cabecera móvil: con las etiquetas de Inicio/Editor 2D ocultas (sólo iconos, con `aria-label`) y el subtítulo oculto, la cabecera baja de 183px a 132px de alto en 390px de ancho, pero sigue siendo 2–3 filas apiladas, no una sola fila compacta como en la referencia — margen de mejora si se quiere apretar más.
- No se tocó `structureCo/` (proyecto 2D anidado, repo git separado): es un producto distinto sin pantalla Space 3D, no era el objetivo de este pedido.
