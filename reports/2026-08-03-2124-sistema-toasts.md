# Sistema de notificaciones toast (con motion)

**Fecha:** 2026-08-03 21:24
**Agente:** Claude Code
**Rama:** main

## Qué cambió

Se portó (adaptado a i18n y tokens de Structure) el sistema de toasts de
`remix-structureco/google-ai-diffs/004-toast-notification`, ahora que
`motion` está disponible (commit `0279b1d`):

- **`src/features/workspace/ToastNotification.tsx`** *(nuevo)*: componente
  que escucha el comando tipado `show-toast` (bus de comandos existente,
  `workspaceCommands.ts`) y apila hasta 4 notificaciones simultáneas con
  animación de resorte (`motion/react`, `AnimatePresence`), `role="status"`,
  `aria-live="polite"`, cierre automático (3.2 s por defecto) o manual. A
  diferencia del código fuente de Remix, respeta `prefers-reduced-motion`
  (vía `useReducedMotion()` de `motion`, recortando la transición a fade
  simple) y usa claves de i18n (`toast.regionLabel`, `toast.dismiss`) en vez
  de las cadenas en español codificadas a mano que tenía el original —
  Structure sí mantiene inglés como idioma completo, a diferencia de Remix.
- **`workspaceCommands.ts`**: nuevo comando `show-toast` en la interfaz
  tipada (mensaje, descripción opcional, tono, duración opcional).
- **`WorkspaceShell.tsx`**: monta `<ToastNotification />` junto a
  `<ResultsPanel />`.
- **Conectado a las acciones de exportación/copia** en `TopBar.tsx` y
  `ResultSummary.tsx`: exportar JSON/SVG/PNG/PDF/paquete portable, exportar
  CSV de resultados, y "Copiar datos" (agregada en la propuesta 7 de esta
  sesión).

## Por qué me aparté del texto de Remix en un punto

El código de Remix reutilizaba el mismo mensaje (`export.copySuccessful`,
"¡Copiado!") tanto para la copia real al portapapeles como para toda
descarga de archivo (JSON/SVG/PNG/PDF/paquete/CSV) — un defecto de
copywriting que ya había señalado el primer análisis de esta sesión. Aquí se
usan dos mensajes distintos:

- `export.copySuccessful` ("¡Copiado!") — solo cuando el contenido realmente
  se copió al portapapeles.
- `export.completed` ("Exportación lista") — para toda acción que genera o
  descarga un archivo.
- `export.copyFallbackDownloaded` — cuando "Copiar datos" no pudo usar el
  portapapeles y descargó el archivo en su lugar (tono `info`, no
  `success`, porque no es exactamente lo que el usuario pidió).

Además, el feedback en el propio botón de "Copiar datos" que había
implementado en la propuesta 7 (mientras el sistema de toasts no estaba
disponible) se retiró y se reemplazó por el toast, tal como se había
anticipado en ese reporte.

## Costo medido: tamaño de bundle

`motion` agrega peso real al chunk del workspace:
`WorkspaceShell-*.js` pasó de **264.66 kB (gzip 69.55 kB)** a **392.42 kB
(gzip 111.92 kB)** — unos **+42 kB gzip**. Es el costo ya conocido y
aceptado explícitamente por el usuario al autorizar la dependencia (propuesta
8), documentado aquí para que quede medido y no solo mencionado.

## Archivos tocados

- `src/features/workspace/ToastNotification.tsx` *(nuevo)*
- `src/features/workspace/ToastNotification.test.tsx` *(nuevo)* — 3 pruebas:
  aparición + anuncio accesible, cierre manual, tope de 4 simultáneos.
- `src/features/workspace/workspaceCommands.ts` — comando `show-toast`.
- `src/features/workspace/WorkspaceShell.tsx` — monta el componente.
- `src/features/topbar/TopBar.tsx` — `handleCopyJson` reescrito para usar
  toast en vez de estado local; toasts agregados a JSON/SVG/PNG/PDF/paquete.
- `src/features/topbar/TopBar.test.tsx` — las 2 pruebas de "Copiar datos" de
  la propuesta 7 se actualizaron: ahora verifican el payload del comando
  `show-toast` (en vez del texto del botón, que ya no cambia) y que el menú
  se cierra tras la acción.
- `src/features/results/ResultSummary.tsx` — toast al exportar CSV.
- `src/styles.css` — bloque `.sc-toast-*` (sin la animación `@keyframes`
  CSS del original, que quedaría redundante/en conflicto con la animación
  que ya maneja `motion`; se agregó en su lugar
  `@media (prefers-reduced-transparency:reduce)` para el `backdrop-filter`,
  consistente con el resto del proyecto).
- `src/i18n/catalogs.ts` — claves nuevas `export.completed`,
  `toast.regionLabel`, `toast.dismiss` en español e inglés.

## Cómo verificar

```bash
npx vitest run src/features/workspace/ToastNotification.test.tsx src/features/topbar/TopBar.test.tsx
npm run lint
npm run typecheck
node scripts/check-protected-baseline.mjs   # 26 archivos intactos
npm test        # 88 archivos / 636 pruebas en verde (+3 nuevas)
npm run build    # WorkspaceShell +42 kB gzip por motion
```

No se pudo completar verificación visual en navegador en esta sesión (mismo
bloqueo de permisos del panel de vista previa). Se recomienda, en
`npm run dev`, exportar un JSON/SVG/PNG y confirmar que el toast aparece
abajo a la derecha, se puede cerrar manualmente, y respeta
`prefers-reduced-motion`/`prefers-reduced-transparency` en las herramientas
de desarrollador del navegador.

## Pendiente / siguiente paso

Quedan del backlog: animaciones de topbar/popover con `motion`
(categorías 006/010) y el rediseño de la pantalla de inicio (propuesta 9,
también depende de `motion`). Sin push (instrucción explícita del usuario:
trabajo solo local, sin GitHub).
