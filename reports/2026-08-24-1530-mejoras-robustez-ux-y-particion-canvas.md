# Robustez, tres pendientes de UX y primera partición de StructuralCanvas.tsx

**Fecha:** 2026-08-24 15:30
**Agente:** Claude Code
**Rama:** claude/propuestas-mejora-2rnsdi

## Qué cambió

El usuario pidió una revisión general con permiso total para reorganizar código. Tras explorar el repo, se acordó un plan en tres fases y se ejecutaron las tres:

**Fase 1 — robustez:**
- Primer `ErrorBoundary` de React de todo el proyecto (`design-system/components/errorBoundary.tsx`), envolviendo `<App/>` en `main.tsx`. Antes, un error de render posterior al montaje dejaba la pantalla en blanco sin ningún mensaje — el caso de antes del montaje (deploy obsoleto) ya estaba cubierto en `index.html`, éste no.
- `.oxlintrc.json`: `ignorePatterns` tenía 8 entradas apuntando a carpetas de otros worktrees que no existen en este checkout; se redujo a `dist/**` y `output/**`.
- `docs/README.md` enlaza ahora `prototypes/ios-app/README.md` (que ya existía y ya explicaba bien el prototipo) como referencia, para que deje de ser invisible desde el índice canónico.

**Fase 2 — pendientes de UX que el propio equipo había dejado anotados:**
- Truncado de nombres en Project Hub: la fila es un grid de 4 columnas donde `Updated`/`Revision`/`Actions` no cedían espacio y se comían casi todo el ancho (medido: 44 de 436px). Se les puso `max-width` con elipsis a `Updated`/`Revision` y el botón "Abrir" pasó a solo-icono (como Renombrar/Duplicar), liberando espacio real para el nombre.
- `saveBytes` (File System Access API) y `buildShareLink` (modelo comprimido en el fragmento de la URL) existían con tests propios pero ningún componente los llamaba. Se conectó "Guardar en el disco" y "Enlace para compartir" al menú de exportación de la TopBar (desktop y móvil). Como el enlace no servía de nada si nadie leía el fragmento al abrir, también se añadió el consumo: `App.tsx` decodifica `location.hash` al montar, carga el proyecto compartido y limpia la URL.
- Diálogo de confirmación de propuestas de IA: todo el camino de aplicación de `CommandProposalV1` (`src/ai/**`) estaba construido y testeado pero sin ningún punto de entrada. Se añadió un ítem "Asistente (local)" en el menú de utilidades de la TopBar que abre `ProposalAssistant` — reutiliza `prepareProposal`/`confirmProposal` y las funciones de `projectDiffSummary.ts` (las mismas del visor de versiones) para mostrar el diff antes de confirmar. Sigue siendo 100% local/determinista: no se conectó ningún proveedor de red.

**Fase 3 — partición de `StructuralCanvas.tsx` (parcial, verificada):**
Se extrajeron los cuatro bloques más autocontenidos, de menor a mayor cohesión:
- `useCanvasCamera.ts` — cámara, tamaño medido, `toScreen`/`toModel`/`localScreenPoint`, `fitModel`, `navigateMinimapTo`, el resize-observer y el zoom con rueda.
- `useCanvasKeyboardShortcuts.ts` — el `useEffect` de atajos de teclado completo, ya casi autocontenido en la versión original.
- `CanvasCutInspector.tsx` — el panel del corte (DCL + ecuaciones de equilibrio), presentación pura.
- `CanvasGridLines.tsx` — la rejilla de fondo, mismo `useMemo` con las mismas dependencias.

`StructuralCanvas.tsx` bajó de 2497 a 2291 líneas. El resto del archivo —el despacho por herramienta, las acciones de edición y sobre todo la máquina de estados de puntero (pan/pinch/drag-de-nodo/edición-estructural/selección-por-caja, acoplada a ~15 refs "sombra")— se dejó tal cual: es la parte de mayor riesgo, y el plan autorizaba explícitamente detenerse ahí antes que extraer a medias sin presupuesto para verificarlo con la profundidad que exige.

## Por qué

Petición explícita del usuario ("propón mejoras, tienes total permiso de mover lo que quieras"). El plan se acordó con el usuario antes de ejecutar (categorías: robustez, UX pendiente, refactor de archivos grandes) y prioriza siempre lo verificable sobre lo ambicioso: cada paso se hizo, se tipó, se lintó, se probó y luego se avanzó al siguiente.

## Archivos tocados

- `src/design-system/components/errorBoundary.tsx` (nuevo) — ErrorBoundary de React.
- `src/design-system/components/ui.css` — estilos del fallback del ErrorBoundary.
- `src/main.tsx` — envuelve `<App/>` en el ErrorBoundary.
- `.oxlintrc.json` — `ignorePatterns` reducido a lo que existe de verdad.
- `docs/README.md` — enlaza `prototypes/ios-app/README.md`.
- `src/features/project-hub/ProjectHub.tsx`, `projectHub.css` — fila de la biblioteca reparte mejor el ancho.
- `src/utils/export.ts` — extrae `safeProjectFilename` (compartido entre la descarga forzada y el guardado nativo nuevo).
- `src/platform/fileSystem.ts`, `src/utils/shareLink.ts` — sin cambios de código, ahora con consumidores reales.
- `src/features/topbar/TopBar.tsx` — "Guardar en el disco", "Enlace para compartir" y "Asistente (local)" en el menú de exportación/utilidades (desktop y móvil).
- `src/App.tsx`, `src/App.test.tsx` — consumo del enlace compartido al montar (`decodeProjectFragment` sobre `location.hash`), con su prueba de integración.
- `src/i18n/en/transfer.ts`, `src/i18n/es/transfer.ts`, `src/i18n/phase2Catalogs.ts` — claves nuevas: `export.saveToDisk`/`export.share`/variantes, `proposal.*`.
- `src/features/ai/ProposalAssistant.tsx` (nuevo), `proposalAssistant.css` (nuevo), `ProposalAssistant.test.tsx` (nuevo) — diálogo de confirmación de propuestas de IA.
- `src/features/canvas/StructuralCanvas.tsx` — reducido de 2497 a 2291 líneas.
- `src/features/canvas/useCanvasCamera.ts`, `useCanvasKeyboardShortcuts.ts`, `CanvasCutInspector.tsx`, `CanvasGridLines.tsx` (nuevos) — los cuatro bloques extraídos.

## Cómo verificar

```bash
npm run typecheck && npm run lint && npm test
npm run verify:protected   # frontera matemática protegida intacta: 49 archivos
npm run verify:docs
npm run build && npm run verify:perf && npm run verify:entry
```

Los cuatro pasaron limpio (255 archivos de test, 2629 pruebas, 0 advertencias nuevas de lint). QA con navegador real (`node qa.mjs`, Chromium vía `PLAYWRIGHT_EXECUTABLE_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome PLAYWRIGHT_CHANNEL=chromium` — el script pide por defecto un canal `chrome` que este contenedor no tiene instalado, `npm run qa` solo no basta aquí).

La primera corrida de QA dio un único rojo: `topbarMenusFocusAVisibleItem`, concretamente `proyecto@320` (el foco del menú «Abrir proyectos y ejemplos» a 320px de ancho). Antes de asumir que era mío lo investigué: `.project-menu` no lo toca ningún archivo de esta sesión. Corrí la misma comprobación tres veces — código limpio (sin mis cambios): verde; mi código, primera vez: rojo; mi código, segunda vez: verde — así que no es determinista con el diff, es la carrera ya conocida entre el `requestAnimationFrame` que pone el foco y la lectura inmediata de Playwright justo tras `waitFor({state:'visible'})`, sensible a la carga del contenedor en el instante exacto. El propio `reports/2026-08-23-1819-cinta-ultimo-piso.md` ya documenta 320px como un umbral al filo («colisión a 320 y desborde ya a 340»). No se tocó nada para «arreglarlo»: no es un defecto de este cambio.

Prueba manual sugerida: redimensionar la biblioteca de proyectos a 1440px y comprobar que el nombre ya no se recorta tanto; abrir el menú de exportación y usar "Guardar en el disco" y "Enlace para compartir" (verificar que abrir el enlace en una pestaña nueva carga el proyecto compartido); abrir "Asistente (local)", escribir p. ej. «aplica w6x9 a M1», confirmar y comprobar que queda en el historial de deshacer; forzar un error en un componente hijo en dev y confirmar que el ErrorBoundary muestra el mensaje en vez de pantalla en blanco.

## Pendiente / siguiente paso

- `StructuralCanvas.tsx` sigue teniendo pendiente su parte de mayor riesgo: el despacho por herramienta (`performNodeAction`/`performMemberAction`/`performTargetAction`), las acciones de edición (crear nodo/miembro, copiar/pegar/duplicar) y sobre todo la máquina de estados de puntero. El plan detallado de extracción para esa parte queda en `/root/.claude/plans/prop-n-mejorar-s-tienes-total-luminous-pond.md` si se retoma.
- El "Asistente (local)" solo reconoce `member.update`, `member.section.apply` y `member.material.apply` (la allowlist actual de `src/ai/commandProposal.ts`); no hay proveedor de red conectado, por diseño.
- Los mensajes de error/rechazo de `src/ai/proposalCompiler.ts` y `proposalValidation.ts` están hardcodeados en español (herencia del pre-RFC); un usuario en inglés los vería tal cual dentro del diálogo. No se tocó ese módulo para no ampliar el alcance de esta sesión.
