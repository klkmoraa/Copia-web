# Migración a la paleta cromática v2 (día/noche/estados/canvas/diagramas)

**Fecha:** 2026-08-03 14:58
**Agente:** Claude Code
**Rama:** main

## Qué cambió

Se actualizó `src/design-system/tokens.css` (única fuente de verdad de color del proyecto) para adoptar la "paleta v2" definida en un PDF que el usuario compartió (`structureco_paleta_v2_cambio_notorio.pdf`), y luego se hizo una segunda pasada de armonización pedida directamente por el usuario en el chat. En total:

1. **Tema día:** fondo de app, superficie 2, superficie inset, texto primario/secundario/muted, bordes, marca (verde/teal), foco/info/selección/estado-info/estado-cargando (se decidió moverlos juntos porque comparten el mismo primitivo `--sc-blue-500`), éxito, error y color de enlace (`#294DB7`) — todos con los valores "Nuevo" del PDF.
2. **Tema noche:** el mismo conjunto de roles con sus valores "Nuevo" correspondientes.
3. **Diagramas técnicos** (carga, axial, cortante, momento, deformada, reacción, dimensión, eje, compresión, envolvente) en ambos temas, según la tabla del PDF.
4. **Segunda pasada (pedida en el chat, sin PDF):** el usuario reportó que el color de "carga puntual" (`--sc-color-technical-load`) se veía naranja y pidió cambiarlo a un tono salmón-rojizo, dejando el color de "axial" intacto (azul, sin cambios). Se reemplazó el primitivo `--sc-orange-500` por `--sc-coral-500` (`#e25d32` → `#c85a45` día, `#ff825c`/`#ff936f` → `#ff7d66` noche), verificando que sigue distinguiéndose de `error`, `moment` y `axis` en matiz.
5. **Armonización de la rampa verde de marca:** los tonos derivados (`action-hover`, `action-pressed`, `action-subtle`, `brand-secondary` en día) se recalcularon con un script en Node (HSL: mismo matiz/relación de saturación que el nuevo `--sc-green-500`, con la luminosidad reanclada por offset) en vez de dejarlos pegados a la rampa vieja — antes casi no había diferencia perceptible entre `action-primary` y `action-hover`.
6. Se sincronizó `src/utils/svgExport.ts` (y su test), que tenía hardcodeado el fondo de exportación SVG del canvas Noche (`#0c1012`), para que coincida con el nuevo `--sc-color-bg-canvas` Noche (`#060b09`).
7. Se reescribió `docs/design-system/PALETTE.md`, que documentaba íntegramente la paleta v1 anterior (naranja de carga, azul `#2867e8`, etc.) y ya no reflejaba el código.

## Por qué

El usuario pidió implementar la paleta v2 de un PDF adjunto para dar un cambio cromático notorio, conservando estructura/nombres/alias de tokens. Antes de tocar nada se resolvieron dos ambigüedades vía preguntas directas al usuario (cascada del primitivo de foco compartido, y si aplicar el color de enlace nuevo que solo aparecía en la tabla de contraste del PDF, no en las tablas explícitas antes/nuevo). Luego, en una segunda ronda, el usuario detectó que "carga puntual" seguía leyendo naranja y pidió corregirlo a salmón, y pidió además una pasada general de armonía sobre cualquier color que hubiera quedado descolgado de la nueva dirección visual.

## Archivos tocados

- `src/design-system/tokens.css` — valores día/noche de fondo, superficies, texto, bordes, marca, foco/info/selección, estados, diagramas técnicos, envolvente y compresión; rampa verde recalculada; primitivo `--sc-orange-500` renombrado a `--sc-coral-500` con nuevo valor salmón.
- `src/utils/svgExport.ts` — constante de fondo de exportación SVG en Noche sincronizada con el nuevo `bg-canvas`.
- `src/utils/svgExport.test.ts` — expectativa del test actualizada al mismo valor.
- `docs/design-system/PALETTE.md` — reescrito de punta a punta para reflejar los valores y contrastes actuales; incluye dos notas de "deuda" detectadas durante la migración (ver Pendiente).

## Cómo verificar

```bash
npm test          # 631 tests, incluye tokens.test.ts (contraste WCAG recalculado dinámicamente contra los tokens)
npm run typecheck
```

En el navegador (dev server), inspeccionar `getComputedStyle(document.documentElement)` para las variables `--sc-color-*` en ambos temas (alternando `document.documentElement.setAttribute('data-theme', 'light'|'dark')`) y comparar contra las tablas de `docs/design-system/PALETTE.md`.

## Pendiente / siguiente paso

Dos inconsistencias menores quedaron documentadas (no arregladas) en `docs/design-system/PALETTE.md` sección "Lienzo y documento" y sección 6 "Estados", para que quien continúe decida si vale la pena cerrarlas:

1. `--sc-color-canvas-node-fill` en Noche (`#0c1012`) no se resincronizó con el nuevo `--sc-color-bg-canvas` Noche (`#060b09`) — quedó con el valor de la v1. No rompe nada (el relleno de nodo solo queda un pelín más claro que el fondo), pero no es 100% coherente.
2. `--sc-color-state-valid` / `--sc-color-state-invalid` quedaron con los valores de la v1 (`#1c9560` / rojo v1 en Noche) porque el PDF de paleta v2 no los mencionaba explícitamente y se optó por no asumir cambios no solicitados. Podría valer la pena unificarlos con `state-success`/`state-error` en una pasada futura si se confirma que es intencional que sean el mismo rol.

`src/design-system/lab/componentLab.css` (el "component lab" de desarrollo) se dejó intacto a propósito: el propio archivo indica en un comentario que sus paletas ("continuity", "mineral", "analytical") son direcciones experimentales locales que **nunca redefinen el tema del producto**, así que no forma parte del sistema de color en producción.
