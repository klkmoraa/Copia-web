# Segunda pasada: 4 bugs propios corregidos + overlays genéricos animados con motion

**Fecha:** 2026-08-03 22:26
**Agente:** Claude Code
**Rama:** main

## Qué cambió

A pedido del usuario, se hizo una segunda revisión a fondo (dos investigaciones
en paralelo: autoauditoría de todo lo tocado esta noche + nueva comparación
Structure/Remix) antes de seguir portando ideas. La comparación confirmó que
el trabajo previo ya cubrió casi toda la divergencia real (import/export,
Aula, inspector, resultados y documentación resultaron idénticos entre
ambos repos). La autoauditoría sí encontró defectos reales, propios de los
cambios de esta sesión, aprobados uno por uno por el usuario:

### 1. Transición CSS competía con `motion` en las tarjetas de la pantalla de inicio
`.welcome-launcher-card`, `.welcome-import-card` y `.welcome-template-card` son
`motion.button` con `whileHover`/`whileTap`, pero heredaban
`--sc-transition-control` (incluye `transform`) del selector global de
botones — el navegador intentaba interpolar el mismo `transform` que
`motion` ya anima por resorte. Se creó un token nuevo
`--sc-transition-control-no-transform` (mismo conjunto de propiedades, sin
`transform`) para esas 3 clases.

Al revisar esto encontré un problema más directo, no señalado por la
auditoría: las reglas `:hover`/`:active` de esas mismas 3 clases (portadas
de Remix, que tiene el mismo problema en su propio código) fijaban un
`transform` **estático** vía CSS (`transform:translateY(-2px)`,
`transform:translateY(0) scale(0.985)`) en paralelo al `transform` dinámico
de `whileHover`/`whileTap` de Motion — un conflicto directo de valores, no
solo de temporización. Se quitó `transform` de esas reglas `:hover` (dejando
solo `border-color`/`background`/`box-shadow`) y se eliminaron por completo
las reglas `:active` que no tenían ninguna otra propiedad.

### 2. El toast podía quedar oculto detrás de un modal
`.sc-toast-container` usaba `z-index:1000` fijo; `--sc-z-modal` es `1200`.
Se agregó el token `--sc-z-toast: 1300` y se referenció desde el toast.

### 3. El arco de resorte de un apoyo elástico no cambiaba de color
`.support-spring-arc` (apoyo `custom` con rigidez rotacional) no estaba
incluido en las reglas `:hover` ni `.selected` de `.support-symbol` — el
resto del símbolo cambiaba de color al interactuar, el arco no. Se agregó a
ambas reglas junto con `.support-spring-coil` (que tampoco estaba en
`.selected`).

### 4. Selector `.menu-section:first-child` huérfano
El primer hijo real del menú móvil "Más" es `.mobile-history-actions`
(deshacer/rehacer), no la primera `.menu-section` — el selector nunca
coincidía y el padding-top reducido pretendido nunca se aplicaba. Se cambió
a `.mobile-history-actions + .menu-section` (hermano adyacente).

### 5. Animación con `motion` en `Dialog`/`Drawer`/`Popover`/overlays genéricos
Se portó (con una corrección importante) la idea de que Remix anima estos
componentes genéricos de `design-system/components/overlays.tsx` con
`motion`/`AnimatePresence`. **Nota de alcance**: la auditoría confirmó que
estos componentes no se usan hoy en ningún flujo real de la app (solo en el
`ComponentLab` interno) — el usuario lo aprobó igual, posiblemente pensando
en usos futuros.

**Corrección respecto al código de Remix**: en `ModalSurface` (la base de
`Dialog`/`Drawer`), Remix le agregó `initial`/`animate`/`exit` a
`motion.div`/`motion.section` pero **dejó intacto** el `if (!open ||
typeof document === 'undefined') return null;` de la línea siguiente — como
ese `return null` no está envuelto en `AnimatePresence`, React desmonta el
componente instantáneamente en cuanto `open` pasa a `false`, **antes** de
que `AnimatePresence` pueda interceptar el cambio. La animación `exit` de
Remix para `Dialog`/`Drawer` nunca se ejecuta en la práctica. Se corrigió
moviendo el `AnimatePresence` para que envuelva el `{open ? ... : null}`, y
dejando el `return null` solo para el caso `typeof document === 'undefined'`
(SSR/test). Ahora la animación de salida sí ocurre.

También se encontraron y quitaron **3 animaciones CSS huérfanas** en
`design-system/components/ui.css` que habrían competido con las nuevas
animaciones de `motion` sobre los mismos elementos (mismo patrón que ya se
corrigió dos veces antes esta noche en `.popover` y el menú P-Delta):
`sc-surface-in` (`.sc-popover__surface`), `sc-dialog-in`
(`.sc-modal-surface--dialog`) y `sc-drawer-in` (`.sc-modal-surface--drawer`)
— las tres `@keyframes` quedaron sin ningún otro consumidor, se eliminaron.

Se agregó manejo de `prefers-reduced-motion` (`useReducedMotion()`) en los
tres componentes, ausente en el código de Remix.

**Pruebas actualizadas**: dos aserciones en `overlays.test.tsx`
(`closes a popover with Escape...`, `traps modal focus, closes with
Escape...`) verificaban de forma síncrona que el diálogo desaparecía
inmediatamente tras Escape. Con la animación de salida real (antes no
ocurría, por el bug de Remix arriba descrito) el cierre ahora toma un
instante — se envolvieron esas dos aserciones en `waitFor`, igual que ya
hacían las otras pruebas de la misma suite que sí cerraban con animación
(la del Drawer).

## Archivos tocados

- `src/design-system/tokens.css` — `--sc-transition-control-no-transform`,
  `--sc-z-toast`.
- `src/styles.css` — fixes 1-4.
- `src/design-system/components/overlays.tsx` — `Popover`/`ModalSurface`
  migrados a `motion`/`AnimatePresence`, con el fix de envoltura descrito
  arriba y soporte de `prefers-reduced-motion`.
- `src/design-system/components/overlays.test.tsx` — 2 aserciones con
  `waitFor`.
- `src/design-system/components/ui.css` — 3 animaciones CSS huérfanas
  eliminadas.

## Cómo verificar

```bash
npx vitest run src/design-system
npm run lint
npm run typecheck
node scripts/check-protected-baseline.mjs   # 26 archivos intactos
npm test        # 88 archivos / 636 pruebas en verde, sin cambios de cantidad
npm run build    # sin costo de bundle adicional (motion ya estaba cargado)
```

No se pudo completar verificación visual en navegador en esta sesión (mismo
bloqueo de permisos del panel de vista previa que en todos los cambios
anteriores). Se recomienda, en `npm run dev`, abrir el `ComponentLab` interno
y confirmar visualmente el Popover/Dialog/Drawer animados (entrada y salida),
las tarjetas de la pantalla de inicio (hover/tap sin jitter), un toast con un
modal abierto encima, y un apoyo elástico con rigidez rotacional en hover/
selección.

## Pendiente / siguiente paso

Con esta segunda pasada, la investigación confirma que no queda divergencia
significativa sin explorar entre Structure y Remix más allá de lo ya
decidido explícitamente por el usuario (colores de carga: saltado; fix de
pantalla blanca: aplazado). Sin push (instrucción explícita del usuario:
trabajo solo local, sin GitHub).
