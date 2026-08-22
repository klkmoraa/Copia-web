# Fase 4: diseño del visor 3D experimental

> **HISTORICAL** — Diseño del visor planar conservado. Fue sustituido por [Space 3D · S3D-1](../../architecture/structureco-space-3d-s3d1.md).

**Clasificación:** `HISTORICAL`

**Fecha:** 2026-08-09
**Estado:** aprobado para implementación
**Producto:** structureCo 0.8.2

## Objetivo

Incorporar una vista 3D real, deliberadamente experimental y no autoritativa, del proyecto 2D actual. El usuario podrá abrirla desde Inicio o desde el editor, inspeccionar la geometría sobre el plano global XY y regresar sin modificar el proyecto ni ejecutar análisis.

La inteligencia artificial permanece fuera del producto. Esta fase sólo define su contrato futuro, sus controles de seguridad y sus gates en un pre-RFC independiente.

## Arquitectura

`App` añade una tercera pantalla interna, `experimental3d`, cargada mediante `React.lazy`. La pantalla recibe el `ProjectModel` actual como dato de sólo lectura y lo entrega a un adaptador puro. El adaptador descarta entradas no finitas o referencias rotas, conserva `x/y` exactamente y genera posiciones visuales `(x, y, 0)` sin escribir sobre el modelo.

Un componente React local administra Three.js directamente. Construye una escena con líneas para miembros, puntos para nodos, ejes y retícula XY. La cámara se ajusta a los límites del modelo, `OrbitControls` emite renders bajo demanda y todos los recursos se liberan al desmontar. Three.js vive exclusivamente en el chunk diferido del visor.

## Experiencia

- Inicio incorpora una tarjeta “Experimental 3D”.
- El editor incorpora un acceso visible y una alternativa equivalente en el menú móvil.
- La pantalla muestra nombre del proyecto, estado experimental y la advertencia “Vista del modelo 2D sobre z = 0. No realiza análisis estructural 3D”.
- La escena admite órbita, zoom y presets frontal/isométrico, además de acercar, alejar y restablecer.
- El resumen semántico informa unidades, conteos, límites XY y diagnósticos.
- “Editor 2D” e “Inicio” son retornos explícitos.
- Un proyecto vacío orienta al usuario para modelar en 2D.
- WebGL ausente o perdido produce una explicación accionable, resumen textual y reintento; nunca un canvas vacío.

## Dirección visual

Se conserva el sistema visual vigente de structureCo: superficies, tipografía, focos, radios, elevación y colores provienen de sus tokens. La firma propia del visor es una “mesa de coordenadas” técnica: retícula XY vertical, ejes sobrios y modelo en azul estructural, con una banda de estado experimental color ámbar. No se añaden tipografías ni una segunda estética.

La pantalla prioriza la escena en escritorio y reorganiza controles/resumen en una columna compacta en móvil. No hay animación ambiental ni autorrotación; `prefers-reduced-motion` se respeta por construcción.

## Límites protegidos

No se modifican `src/engine/**`, `src/workers/**`, `src/data/**`, `src/store/ProjectContext.tsx`, `src/types.ts`, `StructuralCanvas`, persistencia, formatos, IDs, topología, unidades, signos, resultados, undo/redo ni validación física. No se añade `z` al modelo persistido ni se presenta el visor como análisis 3D.

## Criterios de aceptación

- El adaptador es puro, inmutable y está cubierto por pruebas de proyección, diagnóstico y degeneración.
- Navegación Inicio/editor/visor funciona en español e inglés.
- Controles de cámara son semánticos y operables por teclado.
- El fallback de WebGL conserva contexto y retorno.
- El bundle inicial se mide y se reporta; Fase 4 no impone un techo bloqueante de bytes/gzip. Three.js sólo aparece en un chunk diferido.
- La baseline protegida continúa con 29 archivos idénticos.
- La UI se verifica en navegador real en escritorio/móvil y claro/oscuro.
