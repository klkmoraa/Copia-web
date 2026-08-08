# Animaciones de resorte en popovers de TopBar + menú móvil agrupado en secciones

**Fecha:** 2026-08-03 21:31
**Agente:** Claude Code
**Rama:** main

## Qué cambió

Se portaron (reimplementadas) las ideas de
`remix-structureco/google-ai-diffs/010-topbar-redesign-animations`:

1. **Animación de resorte con `motion`** en los tres popovers de
   `TopBar.tsx` (menú de proyecto, menú de exportación, menú móvil "Más"):
   se reemplazó el render condicional simple (`{show ? <div>...</div> :
   null}`) por `<AnimatePresence>{show ? <motion.div ...>...</motion.div> :
   null}</AnimatePresence>`, con entrada/salida animada
   (`opacity`+`y`+`scale`, resorte `stiffness:400, damping:30`).
2. **Reagrupación del menú móvil "Más"** en secciones tituladas:
   *Análisis* (caso/combinación, modo, orden de análisis, configuración
   avanzada P-Delta), *Preferencias* (unidades, idioma, tema),
   *Vistas* (inspector, mesa de trabajo completa, barra de herramientas —
   solo si `layoutActions` está disponible) y *Exportar y guardar* (JSON,
   copiar datos, PDF, paquete portable, SVG, PNG, imprimir).
3. **Limpieza de la animación CSS ahora huérfana**: `.popover` compartía la
   keyframe `native-menu-in` con `.mobile-tool-palette` (del canvas, sin
   relación). Como `motion` ya anima la entrada/salida de los tres popovers
   de TopBar, se sacó `.popover` de esa regla (queda solo
   `.mobile-tool-palette`, que no se tocó) para no correr dos animaciones a
   la vez sobre el mismo elemento — la misma señal de "coexistencia" que el
   análisis inicial de esta sesión había marcado como deuda en el diff
   original de Remix.

## Por qué me aparté del código de Remix en dos puntos

- **`prefers-reduced-motion`**: el diff de Remix no maneja el caso reducido
  para los popovers de `TopBar.tsx` (solo lo hacía, según el análisis
  previo, en `overlays.tsx`). Como las animaciones de `motion` son
  impulsadas por JS, la regla CSS global `@media
  (prefers-reduced-motion:reduce) { *,*::before,*::after {
  transition-duration:.001ms!important; animation-duration:.001ms!important;
  } }` que ya tiene Structure **no las alcanza**. Se agregó
  `useReducedMotion()` de `motion` y una variante de las props de animación
  (`popoverMotionProps`) que reduce a un fundido casi instantáneo cuando el
  usuario lo prefiere, aplicada a los tres popovers.
- **i18n de los títulos de sección**: Remix escribe "Análisis",
  "Preferencias", "Vistas", "Exportar y Guardar" como cadenas en español
  fijas en el JSX. Se agregaron como claves de catálogo
  (`menu.sectionAnalysis`, `menu.sectionPreferences`, `menu.sectionViews`,
  `menu.sectionExport`) en español e inglés, ya que Structure sí mantiene
  soporte completo de inglés.

## Archivos tocados

- `src/features/topbar/TopBar.tsx` — import de `AnimatePresence`/`motion`/
  `useReducedMotion`; `popoverMotionProps` compartido; los tres popovers
  migrados; menú móvil reagrupado en `.menu-section`.
- `src/styles.css` — `.popover` separado de la keyframe `native-menu-in`
  (que ahora solo aplica a `.mobile-tool-palette`); regla huérfana
  `@media (prefers-reduced-motion:reduce) { .popover { animation:none; } }`
  eliminada (ya no tiene animación CSS que anular); nuevo bloque
  `.menu-section`/`.menu-section-title`.
- `src/i18n/catalogs.ts` — 4 claves nuevas de título de sección en español
  e inglés.

## Cómo verificar

```bash
npx vitest run src/features/topbar/TopBar.test.tsx
npm run lint
npm run typecheck
node scripts/check-protected-baseline.mjs   # 26 archivos intactos
npm test        # 88 archivos / 636 pruebas en verde, sin cambios de cantidad
```

Las 13 pruebas existentes de `TopBar.test.tsx` (apertura/cierre de menús,
retorno de foco, Escape, agrupación de zonas) siguen en verde sin
modificarlas — la migración a `motion` no cambió ningún contrato observable
por esas pruebas.

No se pudo completar verificación visual en navegador en esta sesión (mismo
bloqueo de permisos del panel de vista previa). Se recomienda, en
`npm run dev` con un viewport móvil, abrir el menú "Más" y confirmar que las
cuatro secciones se ven separadas con su título, y que la apertura/cierre de
los tres popovers anima con resorte en vez de aparecer abruptamente.

## Pendiente / siguiente paso

Queda del backlog el rediseño de la pantalla de inicio (propuesta 9, también
depende de `motion`; parcialmente ya cubierto por el patrón
`popoverMotionProps` reutilizable de este commit). Sin push (instrucción
explícita del usuario: trabajo solo local, sin GitHub).
