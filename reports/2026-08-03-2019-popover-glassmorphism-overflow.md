# Rediseño de popover (glassmorphism + contraste) y fix de overflow móvil

**Fecha:** 2026-08-03 20:19
**Agente:** Claude Code
**Rama:** main

## Qué cambió

Se portó (reimplementado sobre el sistema de tokens `--sc-*` actual, no copiado
literal) la idea de las carpetas `011-popover-redesign` y `012-popover-overflow`
de `remix-structureco/google-ai-diffs/`, fusionadas en un solo cambio porque
tocan la misma regla `.popover` en `styles.css`:

- **Fondo con efecto vidrio**: `backdrop-filter:blur(24px) saturate(1.2)` sobre
  `color-mix(in srgb, var(--sc-color-surface-elevated) 85%/92%, transparent)`
  (85% en tema oscuro, 92% en claro vía `:root[data-theme='light'] .popover`),
  bordes más redondeados (14px→18px). El bloque `@media
  (prefers-reduced-transparency:reduce)` ya existente en el proyecto **ya
  incluía `.popover` en su lista de selectores** (aplicaba `background:var(--surface)`
  cuando el usuario prefiere menos transparencia) — no hizo falta tocarlo, ya
  cubre el nuevo `backdrop-filter`.
- **Contraste de texto**: los botones del popover y los campos
  `.mobile-menu-field` (incluido el `<select>` de configuración avanzada
  P-Delta, que reutiliza esa misma clase) pasan de `color:var(--muted)` a
  `color:var(--text)`, con `font-weight:550` y estados de foco/hover/click
  explícitos (`focus-visible` con anillo de `--accent`, `:active` con
  `scale(0.98)`).
- **Overflow en pantallas bajas**: `max-height:calc(100dvh - 80px)`,
  `overflow-y:auto`, `overscroll-behavior:contain`, `scrollbar-width:thin` —
  antes el menú "Más" podía salirse de la pantalla en móviles o ventanas
  bajas sin forma de hacer scroll hasta las últimas opciones.

Es CSS puro sobre `styles.css`; no se agregaron dependencias, no se tocó
ningún componente ni el motor.

## Por qué

Tercera propuesta aprobada del backlog priorizado (la segunda, colores de
carga, se saltó por ahora a pedido del usuario). El propio reporte de origen
en Remix documentaba que el texto `--muted` sobre el fondo del popover tenía
contraste insuficiente, y que el menú "Más" se cortaba en viewports bajos —
ambos son defectos de usabilidad reales, no solo estéticos.

## Archivos tocados

- `src/styles.css` — bloque `.popover`, `.popover button` (+ estados
  hover/focus/active/svg), `.mobile-menu-field` y `.mobile-menu-field select`.

## Cómo verificar

```bash
npx vitest run src/design-system/tokens.test.ts src/features/topbar/TopBar.test.tsx src/design-system/components/overlays.test.tsx src/design-system/components/dependencyBoundary.test.ts
npm run typecheck
npm test        # 87 archivos / 631 pruebas en verde
```

No se pudo completar verificación visual en navegador en esta sesión (el panel
de vista previa no llegó a mostrar la página, mismo problema que en el cambio
anterior); se recomienda abrir el menú "Más" y el menú de exportación en
`npm run dev`, en ambos temas y en un viewport móvil bajo, antes de dar el
cambio por definitivamente cerrado desde el punto de vista estético.

## Pendiente / siguiente paso

Ninguno funcional. Queda pendiente la verificación visual manual mencionada
arriba. Sin push (instrucción explícita del usuario: trabajo solo local, sin
GitHub).
