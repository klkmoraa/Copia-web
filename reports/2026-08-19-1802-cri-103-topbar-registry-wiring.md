# CRI-103 (follow-up) — TopBar consume el commandRegistry por construcción

**Fecha:** 2026-08-19 18:03
**Agente:** Claude Code
**Rama:** claude/cri-103-command-registry-o51brr (reiniciada desde `main` tras el merge anterior)

## Qué cambió

El primer pase de CRI-103 (commit `d424b7c` / merge `c2e0136`) creó `commandRegistry.ts`
y migró `CommandPalette.tsx` para proyectarlo, pero `TopBar.tsx` seguía ejecutando
`undo`/`redo`/`emitWorkspaceCommand('open-datasheet')`/etc. directamente — la
coherencia botón↔Palette seguía siendo por convención (mismos valores, dos sitios
que los calculan), no por construcción. Este pase cierra ese gap sin reescribir
`TopBar.tsx`.

Se añadió a `commandRegistry.ts`:
- `TopBarCommandId` / `TopBarCommandContext` — el subconjunto de `CommandContext`
  que los comandos con botón real en TopBar necesitan (`t`, `project`,
  `isAnalyzing`, `canUndo`, `canRedo`, `theme`, `setTheme`, `analyze`, `undo`,
  `redo`), verificado campo por campo contra cada comando de la lista.
- `resolveTopBarCommand(id, ctx)` — resuelve un `CommandListItem` (mismo objeto
  que produce `buildCommands` para la Palette) rellenando el resto de
  `CommandContext` con stubs que lanzan si se invocan (`unusedByTopBar`), para
  que un futuro comando mal clasificado en `TOPBAR_COMMAND_IDS` falle ruidoso en
  vez de silenciosamente.
- `export:svg` / `export:png` ahora también muestran el toast de
  "Exportación completada" en su `run` — ya lo hacía TopBar pero no la Palette;
  se convergió hacia el comportamiento más completo (el usuario obtiene
  confirmación en ambos sitios) en vez de quitárselo a TopBar.

`TopBar.tsx` ahora resuelve una vez por render (`command('analysis:undo')`, etc.)
y sus botones leen `.label` / `.disabled` / `.run` / `.icon` directamente del
resultado — sin recomputar la regla en el propio archivo — para:
`analysis:run` (botón Analizar), `analysis:undo`/`analysis:redo` (control de
historial, escritorio y desbordamiento móvil), `analysis:model-doctor` (lanzador
de zona de estado y desbordamiento móvil), `tool:datasheet` (icono de escritorio
y desbordamiento móvil), `view:theme` (desbordamiento móvil), y
`export:json`/`export:svg`/`export:png`/`export:print` (menú de escritorio y
desbordamiento móvil).

## Por qué

El usuario señaló, correctamente, que el criterio 1–3 de CRI-103 no estaba
cumplido: "cuando un comando existe en el registry, el botón visible debe
consumir la misma definición". Cerrar ese hueco es exactamente lo que este pase
hace, sin ampliar alcance a comandos sin equivalente real (portable PDF/bundle,
copiar datos, selección de caso/modo/unidades, layout) ni tocar CRI-104.

## Decisiones de alcance explícitas

- **`openModelDoctor` (useCallback) se conserva**, sólo como prop de
  `AnalysisStatus` (memoizado, sensible a re-render por CRI-100): su cuerpo es
  literalmente el mismo `emitWorkspaceCommand('open-model-doctor')` que ejecuta
  `analysis:model-doctor`, pero se necesita una referencia **estable** entre
  renders, y `resolveTopBarCommand(...).run` crea una función nueva en cada
  render. Los dos botones visibles con la etiqueta "Model Doctor" sí leen
  `modelDoctorCommand.label`/`.run`. Documentado en el propio código y probado
  (`TopBar.commandParity.test.tsx`: exactamente una ocurrencia de código —no de
  comentario— de esa llamada).
- **La pastilla de estado accionable de `AnalysisStatus`** (el botón que se
  vuelve clicable en warning/error) tampoco se tocó: su nombre accesible combina
  el texto de estado con `modelDoctor.open` (una frase de acción distinta a
  "Model Doctor"), es un componente protegido y separado, y no es "el mismo
  botón" que los dos lanzadores literales — es una afordancia contextual que
  *además* abre el Doctor.
- **Botón "Datasheet" cambia de texto visible**: de "Abrir hoja de datos" /
  "Open datasheet" (`datasheet.open`) a "Hoja de datos estructural" /
  "Structural datasheet" (`datasheet.title`, la clave que ya usaba la Palette).
  Es el criterio 2 de CRI-103 aplicado literalmente — la etiqueta debe converger,
  y la Palette y el botón usaban claves distintas desde antes de este slice.
- **`export:svg`/`export:png` ganan un toast también en la Palette** (antes sólo
  lo mostraba TopBar) — mismo razonamiento: converger hacia el comportamiento
  más completo, no perder feedback existente en TopBar.
- Comandos sin botón real equivalente en TopBar (`view:grid`, `view:snap`,
  navegación a nodo/miembro, presets de capa, pestañas de resultados, capas de
  evidencia) **no** se tocaron.

## Archivos tocados

- `src/features/workspace/commandRegistry.ts` — `TopBarCommandId`,
  `TopBarCommandContext`, `resolveTopBarCommand`; toast añadido a
  `export:svg`/`export:png`.
- `src/features/topbar/TopBar.tsx` — botones migrados a `resolveTopBarCommand`;
  eliminado `openModelDoctorFromMobileMenu` (inlined); import de `Moon`/`Sun`
  retirado (ya no se usan directamente, `ThemeIcon = themeCommand.icon`).
- `src/features/topbar/TopBar.commandParity.test.tsx` — nuevo. Prueba **por
  construcción** (no por lectura de código) que:
  1. undo/redo comparten label/enabled/ejecución entre botón resuelto y Palette;
  2. cambiar `canUndo`/`canRedo` cambia ambos consumidores desde una sola
     definición;
  3. Datasheet/Model Doctor resuelven el mismo `commandId` y disparan el mismo
     evento del bus, para botón y Palette;
  4. el toggle de tema comparte label e icono;
  5. **render real**: el botón Datasheet de un `<TopBar>` montado y la entrada
     Datasheet de un `<CommandPalette>` montado en el mismo `ProjectProvider`
     emiten el mismo `open-datasheet`;
  6. **render real**: Undo arranca deshabilitado en el botón y en la Palette,
     leyendo el mismo store;
  7. **escaneo de fuente**: `TopBar.tsx` ya no contiene
     `emitWorkspaceCommand('open-datasheet'|'export-svg'|'export-png')` ni
     `window.print()` como código propio, y `open-model-doctor` aparece
     exactamente una vez en código (la excepción documentada).

## Cómo verificar

```
npx vitest run src/features/workspace src/features/topbar   # 16 files / 116 tests OK (9 nuevas)
npm run typecheck                                             # OK
npm run verify:protected                                      # 38 archivos, intacto
npm run lint                                                  # 0 errores (mismos 4 warnings preexistentes)
npm run build                                                 # OK
QA_LOCAL_CHROMIUM_PATH=/opt/pw-browsers/chromium npm run qa:topbar   # OK (mismo condicionante de entorno ya documentado: el channel "chrome" no existe en este contenedor)
```

## Pendiente / siguiente paso

Nada pendiente para CRI-103. No se tocó CRI-104 ni ninguna otra issue.
