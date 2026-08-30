# Fundamentos de identidad Clay pronunciada — Fase 1

**Fecha:** 2026-08-21 16:24
**Agente:** Codex
**Rama:** `codex/clay-identity-redesign`
**Clasificación:** `AUDIT/TEMPORARY`

## Qué cambió

Se reemplazaron los fundamentos tipográficos y materiales del sistema visual por la identidad aprobada: DM Serif Display para titulares editoriales, Manrope para interfaz y JetBrains Mono para datos técnicos. Se separaron los colores de cargas puntuales, distribuidas y momentos aplicados, manteniéndolos invariantes entre Día y Noche y distintos de los colores de resultados.

El material Clay ahora distingue elevación, cavidad estática y presión transitoria con sombras mate, bordes físicos y movimiento táctil pronunciado. Se neutralizaron los brillos, sheens y gradientes decorativos. El Component Lab quedó como superficie verificable de aceptación para tipografía, color técnico, seis niveles materiales, movimiento normal y `prefers-reduced-motion`.

No se migraron todavía pantallas productivas ni el lienzo estructural; eso corresponde a fases posteriores. No se modificaron motor, solver, workers, modelo de datos, comandos, persistencia, import/export, Space 3D ni archivos protegidos de marca.

## Por qué

El usuario aprobó rehacer por completo la identidad de StructureCo siguiendo los adjuntos obligatorios: fondo marfil cálido en Día, Noche profunda funcional, Clay mate con hundimientos y superposiciones claramente perceptibles, sin glassmorphism ni brillo ornamental. También decidió reemplazar totalmente la tipografía, conservar los mismos colores técnicos en ambos temas y diferenciar visualmente cada tipo de carga.

## Punto de partida y resguardo

- Remoto: `https://github.com/klkmoraa/structureco.git`.
- Base `origin/main`: `aee61a95d01eacdfb44ba1cdc76bea907b5aefd1`.
- Clon aislado: `C:\Users\crisd\.codex\github-workspaces\structureco-clay-redesign`.
- Bundle de respaldo: `C:\Users\crisd\.codex\backups\structureco-aee61a95-before-clay.bundle` (133,740,727 bytes).
- Versión de producto: `0.8.2`.
- Baseline protegido previo: `FA67B40C7F1E92B549546A892C75CE195A007C8CC14533AC166BA84869A3AFE3`.
- La carpeta habitual del usuario no fue modificada.

## Archivos tocados

- `src/design-system/tokens.css` — familias tipográficas, roles de cargas, sombras Clay, presión física y neutralización de efectos brillantes.
- `src/design-system/material.css` — separación entre cavidad estática y estado presionado.
- `src/design-system/fonts.css` — declaraciones locales de DM Serif Display, Manrope y JetBrains Mono.
- `src/design-system/lab/ComponentLab.tsx` — especímenes de tipografía, cargas, resultados y materiales.
- `src/design-system/lab/componentLab.css` — composición responsive y muestras construidas con tokens reales.
- `src/design-system/tokens.test.ts`, `clayReconciliation.test.ts`, `material.test.ts` — contratos actualizados por TDD.
- `src/design-system/typography.test.ts` — contrato nuevo de tipografía local y retiro de IBM Plex.
- `src/design-system/lab/ComponentLab.foundations.test.tsx` — aceptación semántica del laboratorio.
- `public/fonts/*.woff2`, `public/fonts/OFL-*.txt` — fuentes aprobadas y licencias; se retiraron los seis WOFF2 de IBM Plex.
- `docs/superpowers/plans/2026-08-21-clay-identity-foundations-phase-1.md` — plan ejecutado de la fase.
- `reports/evidence/2026-08-21-clay-foundations/*.png` — seis capturas Día/Noche para desktop, tablet y móvil.

## Procedencia y hashes de fuentes

- DM Serif Display WOFF2 — Google Fonts oficial, `https://fonts.gstatic.com/s/dmserifdisplay/v17/-nFnOHM81r4j6k0gjAW3mujVU2B2G_Bx0g.woff2`; SHA-256 `FDF61EFD0610D7A7FF99F99F16AE3BABD4D4F226E42413266EEDC6AD1E160A`.
- Manrope variable WOFF2 — Google Fonts oficial, `https://fonts.gstatic.com/s/manrope/v20/xn7gYHE41ni1AdIRggexSg.woff2`; SHA-256 `A30DDCF498986BCFAD26B11BCDD57645BA5A9DAB2699B6E89E7FD931675B0972`.
- JetBrains Mono latin variable WOFF2 — Google Fonts oficial, `https://fonts.gstatic.com/s/jetbrainsmono/v24/tDbV2o-flEEny0FZhsfKu5WU4xD7OwE.woff2`; SHA-256 `18BE45B40E1889D5347132A23DAC7115318FF7B8B6AE2A397825017329436A7E`.
- JetBrains Mono greek variable WOFF2 — Google Fonts oficial, `https://fonts.gstatic.com/s/jetbrainsmono/v24/tDbV2o-flEEny0FZhsfKu5WU4xD4OwG_TA.woff2`; SHA-256 `EE86315835631139762AE3EFFD8DFBFD07398DBEB0AB3B99C17947826C374109`.
- Licencia DM Serif Display — Google Fonts `ofl/dmserifdisplay/OFL.txt`; SHA-256 `A3E5CDFB55855671C021AE13E9B58507CCB18C1D76C65C2D57E8DB85A0C07231`.
- Licencia Manrope — Google Fonts `ofl/manrope/OFL.txt`; SHA-256 del archivo normalizado sin espacio final `F612090FB72B6DCA3E807E66FA0D2B5DEF163CEF86F1A3209B5C897CBA5EE4B7`.
- Licencia JetBrains Mono — Google Fonts `ofl/jetbrainsmono/OFL.txt`; SHA-256 `B2FE5E5A4F0449E9A9881144F953325307CC353552234F11016C044939FA591D`.

## Cómo verificar

- `npm.cmd test` — 226 archivos aprobados; 2,255 pruebas aprobadas, 8 omitidas, 0 fallos.
- `npm.cmd test -- src/design-system` — 15 archivos y 112 pruebas aprobadas.
- Pruebas focales de fundamentos — 4 archivos y 69 pruebas aprobadas.
- Pruebas de Component Lab — 2 archivos y 2 pruebas aprobadas.
- `npm.cmd run lint` — código de salida 0; conserva advertencias heredadas fuera del alcance de esta fase.
- `npm.cmd run typecheck` — aprobado.
- `npm.cmd run verify:docs` — aprobado; 31 documentos clasificados.
- `npm.cmd run verify:protected` — aprobado; 38 archivos protegidos intactos.
- `npm.cmd run build` — aprobado; Vite conserva la advertencia heredada de chunks mayores a 500 kB.
- `npm.cmd run verify:perf` — aprobado; 862,117 bytes / 223,409 gzip, sin techo bloqueante configurado.
- `git diff --check` — aprobado; sólo avisos de conversión LF/CRLF de la configuración Windows.

La instrumentación responsive a 390 px confirmó `scrollWidth = innerWidth = 390`. En movimiento normal, el estado presionado aplica `translateY(2px) scale(0.98)` durante 160 ms y conserva sombras distintas para presión y cavidad. Con `prefers-reduced-motion: reduce`, elimina la transformación y usa 0.001 ms, pero mantiene la profundidad material estática.

## Evidencia visual

- `reports/evidence/2026-08-21-clay-foundations/desktop-day.png`
- `reports/evidence/2026-08-21-clay-foundations/desktop-night.png`
- `reports/evidence/2026-08-21-clay-foundations/tablet-day.png`
- `reports/evidence/2026-08-21-clay-foundations/tablet-night.png`
- `reports/evidence/2026-08-21-clay-foundations/mobile-day.png`
- `reports/evidence/2026-08-21-clay-foundations/mobile-night.png`

La inspección comparó marfil, Noche profunda, serif editorial, verde de marca, capas elevadas/hundidas, ausencia de glow y composición móvil de una columna con los adjuntos obligatorios, incluidas las cuatro referencias adicionales recibidas durante el cierre.

## Pendiente / siguiente paso

- Solicitar aprobación visual de la Fase 1 antes de migrar superficies productivas.
- Fase 2 propuesta: Workspace 2D, Tool Rail e Inspector, incluyendo jerarquía de cargas superpuestas para que la carga puntual quede por encima de la distribuida sin ocultamiento.
- Home, Project Hub, Results, Aula, Datasheet, Model Doctor, Import Center, Generator y Space 3D permanecen sin migrar en esta fase.
- El commit `8cd31d25cd99ec06354cc6dd1efb058c87cbfbc6` fue publicado en `origin/codex/clay-identity-redesign` con autorización del usuario.
- Pull Request en borrador: `https://github.com/klkmoraa/structureco/pull/5` contra `main`; no se ha fusionado.
- Las seis capturas esenciales se enviaron por correo para revisión: Día/Noche en desktop, tablet y móvil. No se enviaron imágenes redundantes.
