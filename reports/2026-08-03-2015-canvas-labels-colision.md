# Colisión de etiquetas del canvas (smart labels) — gap y legibilidad

**Fecha:** 2026-08-03 20:15
**Agente:** Claude Code
**Rama:** main

## Qué cambió

Se ajustó el algoritmo de colocación de "smart labels" del canvas
(`labelLayout.ts`) y su presentación (`styles.css`), portando (reimplementado,
verificado línea a línea contra el código actual) la idea de la carpeta
`007-canvas-labels` de `remix-structureco/google-ai-diffs/`:

- Espacio mínimo obligatorio entre etiquetas: 4px → 8px (`LABEL_GAP`), para
  reducir el amontonamiento visual en modelos densos.
- Estimación de ancho de texto ligeramente más generosa (mínimo 30→34px,
  factor por carácter 6.15→6.5, margen 16→18), para que el rect estimado se
  ajuste mejor a fuentes reales antes de resolver colisiones.
- Fondo de la etiqueta más opaco y mezclado con `--canvas-bg` en vez de
  transparente puro, sombra sutil (`drop-shadow`) para que se lea sobre la
  grilla, tipografía ligeramente más grande y con mayor peso, y realce del
  contorno de selección (`tone-selection` ahora fija `stroke:var(--selection)`
  explícito en vez de depender solo de `currentColor`).

Es un cambio puramente de presentación: `labelLayout.ts` es un módulo puro sin
dependencias de motor, y el bloque de CSS tocado es exclusivo de
`.smart-label*`.

## Por qué

Primera propuesta aprobada del backlog priorizado construido a partir de los
12 diffs documentados en `remix-structureco/google-ai-diffs/` (ver análisis
completo en el chat de esta sesión). Bajo riesgo, alto valor: mejora directa
de legibilidad del canvas en modelos con muchas etiquetas superpuestas, sin
tocar `src/engine/**`, `src/workers/**`, `src/data/**`, `ProjectContext.tsx`
ni `types.ts`.

## Archivos tocados

- `src/features/canvas/labelLayout.ts` — `LABEL_GAP` y `estimatedWidth`.
- `src/styles.css` — bloque `.smart-label*` (fondo, tipografía, selección).

## Cómo verificar

```bash
npx vitest run src/features/canvas/labelLayout.test.ts src/design-system/tokens.test.ts
npm run typecheck
npm test        # 87 archivos / 631 pruebas en verde
```

No se pudo completar verificación visual en navegador en esta sesión (el panel
de vista previa no llegó a mostrar la página); se recomienda una revisión
visual manual en `npm run dev` con un modelo denso (varias barras/nodos/cargas
próximas entre sí) antes de dar el cambio por definitivamente cerrado desde el
punto de vista estético.

## Pendiente / siguiente paso

Ninguno funcional. Queda pendiente la verificación visual manual mencionada
arriba. Sin push (instrucción explícita del usuario: trabajo solo local, sin
GitHub).
