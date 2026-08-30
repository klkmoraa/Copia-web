# CRI-106 · Gate de accesibilidad real — informe de medición

## 1 · SHA exacto medido

`c339af6fdd22e626baf8aa8a7eb60a42cb1d8cb6` — `origin/main`, con CRI-112 ("Welcome — carril y bandas: composición nueva sobre el suelo de papel") integrado. Verificado antes de medir:

- `git fetch origin` + `git rev-parse origin/main` → `c339af6...`.
- `git merge-base --is-ancestor c339af6... origin/main` → ancestro (trivialmente, es la punta).
- CRI-112 en Linear: estado **Done**.
- La rama de trabajo de CRI-106 (`claude/cri-106-accessibility-gate-4q3891`) no tenía commits propios; se avanzó con `git merge --ff-only origin/main`.

**Este SHA es el que se midió en todo este informe.** Cualquier commit posterior invalida las cifras aquí registradas y exige remedición.

## 2 · Entorno

| Campo | Valor |
|---|---|
| OS | Linux 6.18.5-fc-v20, contenedor headless, sin `$DISPLAY` |
| CPU/arquitectura | x86_64 |
| Node | v22.22.2 |
| Navegador | Chromium 141.0.7390.37 (`/opt/pw-browsers/chromium`, pre-instalado) |
| Resolución/DPR | Ver matriz responsive (X2 1440×900, M1 834×1112, K0 390×844/844×390), DPR=1 |
| Tema | Día y Noche, ambos medidos |
| Idioma | ES (medición); EN mencionado donde aplica, no recorrido completo (ver limitaciones) |
| Clases | X2/M1/K0 — las tres cubiertas en captura; K0 además con `hasTouch:true`/`isMobile:true` |

### Baseline (antes de medir nada)

```
npm test              → 224 archivos, 2245 pasadas, 8 saltadas, exit 0
npm run typecheck     → 0 errores
npm run lint          → 4 warnings preexistentes (react/only-export-components, no relacionados con CRI-106)
npm run verify:protected → "Frontera protegida intacta: 38 archivos verificados"
npm run build          → OK (mismos warnings de chunk-size preexistentes)
```

Baseline verde. Se procedió a medir.

## 3 · Pre-flight de capacidades reales

### Navegadores

| Navegador | Estado |
|---|---|
| Chromium | DISPONIBLE, 141.0.7390.37 |
| WebKit | NO DISPONIBLE — `npx playwright install webkit` bloqueado por la política de red del entorno: 403 en `cdn.playwright.dev` y `playwright.download.prss.microsoft.com` (`curl "$HTTPS_PROXY/__agentproxy/status"` confirma `connect_rejected`/`policy denial`). |
| Firefox | NO DISPONIBLE — idéntico bloqueo 403 en los mismos dos hosts. |

Detalle completo: `reports/evidence/2026-08-21-cri-106-accessibility/browsers/MATRIX.md`.

### Lector de pantalla real

Verificado explícitamente: sin `orca`, sin `nvda`, sin `jaws`, sin `spd-say`/speech-dispatcher, sin `at-spi2-registryd`, sin `$DISPLAY`. Contenedor headless sin sesión de escritorio — **no existe ningún lector de pantalla real posible en este entorno**. Detalle: `reports/evidence/2026-08-21-cri-106-accessibility/screen-reader/PREFLIGHT.md`.

### Input

| Input | Estado |
|---|---|
| Mouse | REAL (clicks de Playwright vía CDP, indistinguibles de un click real) |
| Keyboard | REAL (`page.keyboard.press`, recorrido de Tab real) |
| Touch | EMULADO (Chromium `hasTouch:true`/`isMobile:true` — dispara eventos touch reales del motor, no sólo redimensiona el viewport; sigue sin ser hardware táctil físico) |
| Stylus/coarse pointer | NO PROBADO |

### Restricción del §4 aplicada

Falta WebKit y falta lector de pantalla real → **CRI-106 queda BLOCKED**, tal como exige la propia issue. Se continuó midiendo todo lo demás (harnesses preparados, lo repetible automatizado, el resto ejecutado), sin declarar cumplimiento que no se puede sostener.

## 4 · Tabla de contraste — medida sobre el producto real

Metodología: `tokens.css` cargado en Chromium real (no jsdom), `getComputedStyle` sobre los valores resueltos (incluye `color-mix()`), fórmula WCAG estándar de luminancia relativa. Script: `reports/evidence/2026-08-21-cri-106-accessibility/contrast/measure-contrast.mjs`.

| Rol | Elemento real (HEX computado) | Día lienzo | Día superficie | Noche lienzo | Noche superficie | Peor | Umbral | Veredicto |
|---|---|---|---|---|---|---|---|---|
| texto primario | #23312c D / #f4f8f6 N | 13.36 | 13.26 | 17.08 | 15.00 | 13.26:1 | 4.5:1 | PASS |
| texto secundario | #607068 D / #a6b6b0 N | 5.15 | 5.11 | 8.66 | 7.60 | 5.11:1 | 4.5:1 | PASS |
| caption técnico | #7b8284 D / #a6b6b0 N | 3.85 | 3.82 | 8.66 | 7.60 | 3.82:1 | 4.5:1 | **FAIL** |
| focus ring | #6a5df2 | 4.63 | 4.60 | 3.89 | 3.41 | 3.41:1 | 3:1 | PASS |
| selection (trazo) | #6a5df2 | 4.63 | 4.60 | 3.89 | 3.41 | 3.41:1 | 3:1 | PASS |
| brand action (relleno) | #1aa57a | 3.08 | 3.06 | 5.84 | 5.13 | 3.06:1 | 3:1 | PASS |
| brand edge | #087e5c | 4.98 | 4.95 | 3.62 | 3.17 | 3.17:1 | 3:1 | PASS |
| brand foreground (tinta/relleno) | tinta vs relleno | — | 6.04 | — | 6.04 | 6.04:1 | 4.5:1 | PASS |
| success | #2d7c36 | 5.11 | 5.07 | 3.53 | 3.10 | 3.10:1 | 3:1 | PASS |
| warning | #d9720a | 3.25 | 3.23 | 5.54 | 4.87 | 3.23:1 | 3:1 | PASS |
| error | #d92e28 | 4.73 | 4.69 | 3.81 | 3.34 | 3.34:1 | 3:1 | PASS |
| info | #6a5df2 | 4.63 | 4.60 | 3.89 | 3.41 | 3.41:1 | 3:1 | PASS |
| axial N | #0f95d1 | 3.31 | 3.29 | 5.44 | 4.77 | 3.29:1 | 3:1 | PASS |
| cortante V (trazo) | #468c09 | 4.12 | 4.09 | 4.37 | 3.84 | 3.84:1 | 3:1 | PASS |
| momento M | #ed4b46 | 3.63 | 3.60 | 4.96 | 4.36 | 3.60:1 | 3:1 | PASS |
| deformada | #8b5cf6 | 4.17 | 4.14 | 4.32 | 3.79 | 3.79:1 | 3:1 | PASS |
| reacción | #3a72e3 | 4.40 | 4.37 | 4.09 | 3.59 | 3.59:1 | 3:1 | PASS |
| cota | #b8860b | 3.20 | 3.18 | 5.62 | 4.94 | 3.18:1 | 3:1 | PASS |
| eje | #ad5e18 | 4.71 | 4.67 | 3.83 | 3.36 | 3.36:1 | 3:1 | PASS |
| texto disabled | #9aa0a1 D / #64746f N | 2.61 | 2.59 | 3.72 | 3.27 | 2.59:1 | 4.5:1 | **FAIL*** |
| stale/reliability (texto/ícono) | #6f5210 D / #f4d75e N | 7.15 | 7.10 | 12.83 | 11.27 | 7.10:1 | 4.5:1 | PASS |
| error (texto/ícono) | #96362d D / #f79b93 N | 7.22 | 7.17 | 8.77 | 7.70 | 7.17:1 | 4.5:1 | PASS |
| Aula (rosa) | #c94a8f | 4.25 | 4.22 | 4.23 | 3.72 | 3.72:1 | 3:1 | PASS |
| brand ink --accent (sobre accent-soft) | tinta vs fondo tinte | — | 4.45 | — | 2.76 | 2.76:1 | 3:1 | **FAIL** |

\* `texto disabled`: WCAG exime a controles deshabilitados del suelo de contraste; se marca FAIL nominal porque cae bajo 4.5:1, pero su severidad real depende de si lleva "contenido obligatorio" (§6 de CRI-106) — ver CRI-117.

**24 roles medidos · 3 FAIL reales (más 1 condicional).**

## 5 · LEDGER-05 — pórtico en Noche

Remedido **sobre el producto real renderizado** (no tokens.css aislado): Chromium navega a Welcome, fuerza Noche, y se leen PÍXELES reales de un screenshot del pórtico (post-filtro SVG, post-composición), decodificados con un parser PNG propio (`zlib.inflateSync`, sin dependencias). Script: `reports/evidence/2026-08-21-cri-106-accessibility/contrast/ledger-05-portal-night.mjs`. Capturas: `portal-dark.png`, `portal-light.png` (verificadas visualmente).

| | Foreground/borde efectivo | Fondo efectivo | Contraste |
|---|---|---|---|
| Suelo cuadriculado (Día) | #bcb2a5 | #f7f4ee | 1.90:1 |
| Cara superior/dintel (Día) | #46b28f | #f7f4ee | 2.38:1 |
| Suelo cuadriculado (Noche) | #546c75 | #091015 | **3.45:1** |
| Cara superior/dintel (Noche) | #178869 | #091015 | **4.34:1** |

**Qué es informativo y qué es decorativo**: `StructuralPortalHero.tsx` marca el `<svg>` con `role="presentation" aria-hidden="true"` explícitamente, y su propio comentario de cabecera declara: *"Decorativo a efectos de accesibilidad. Todo lo que comunica está en el texto que la acompaña."* No hay ningún significado codificado sólo en el pórtico — es enteramente decorativo.

**Veredicto**: WCAG 1.4.11 excluye explícitamente gráficos puramente decorativos del suelo de contraste no-textual, así que el pórtico no está sujeto a ningún piso. Aun así, con los HEX de CRI-91 y la composición de CRI-112, el pórtico en Noche mide 3.45:1/4.34:1 — por encima de 3:1 igualmente. **No requiere ajuste.** No se cambió ningún HEX (fuera de alcance de CRI-106).

Nota de precisión: el hallazgo textual de la tarea ("silueta del índice activo contra `--accent-soft` ~2.75:1") no es del pórtico — es un consumidor DISTINTO de `--accent`/`--accent-soft` (ver CRI-113, contraste real 2.76:1 en Noche), no relacionado con LEDGER-05. `.welcome-step.active .welcome-step-index` (el índice que sí motivó CRI-109) ya usa `--accent-fill`/`--accent-foreground` y mide 6.04:1 PASS — corregido, verificado aquí.

## 6 · Lector de pantalla real

**No ejecutado — no existe ninguno en este entorno.** Ver §3 y `reports/evidence/2026-08-21-cri-106-accessibility/screen-reader/PREFLIGHT.md`. No se simuló ningún lector como sustituto.

## 7 · aria-live — inventario estático (NO sustituye la pasada real)

`grep` no-test sobre `src/**`: 24 usos literales de `aria-live` + 31 usos de `role="alert"` (asertivo implícito) = 55 regiones estáticas localizadas (el número de 66 citado en CRI-95/CRI-106 probablemente cuenta instancias dinámicas por fila/lista, no localizables por grep). Guardado en `reports/evidence/2026-08-21-cri-106-accessibility/aria-live-static-inventory.txt`.

Lectura de código (no ejecución con lector real) confirma **intención** de evitar duplicación en al menos dos sitios:

- `TopBar.tsx:541-544` — comentario explícito: el chip de persistencia del overflow móvil es "duplicado visible... y no vuelve a anunciarse solo" (sin `aria-live` propio).
- `AnalysisStatus.tsx:103-105` — la línea de fiabilidad vive deliberadamente FUERA de la región `aria-live` del estado, para que abrir el diálogo de causa gobernante (D-14/CRI-95) no re-dispare el anuncio del estado.

**Esto es lectura de código, no verificación auditiva.** No se puede confirmar sin un lector real si hay locución duplicada, omitida o repetitiva. Queda como limitación explícita, no como PASS.

## 8 · Multi-navegador

Ver `reports/evidence/2026-08-21-cri-106-accessibility/browsers/MATRIX.md` para la matriz completa flujo×navegador. Resumen:

- **Chromium**: ejecutado end-to-end (Welcome, Mesa, canvas, ToolRail, Results, Model Doctor, Command Palette, foco, reduced-motion, clipboard, responsive).
- **WebKit**: NO PROBADO — instalación bloqueada por política de red (403 en los dos hosts de descarga de Playwright). `npm run qa:webkit` falla en consecuencia (`Executable doesn't exist`).
- **Firefox**: NO PROBADO — idéntico bloqueo.

## 9 · Clipboard — U-11

Medido en Chromium (único navegador disponible), distinguiendo API disponible de lectura autorizada (`reports/evidence/2026-08-21-cri-106-accessibility/run-suite.mjs`, sección clipboard):

| | Sin permiso concedido | Con `clipboard-read` concedido |
|---|---|---|
| `navigator.clipboard` existe | true | true |
| `readText` es función | true | true |
| Secure context | true | true |
| `permissions.query` | `state: "prompt"` | `state: "granted"` |
| `readText()` | **nunca se asienta** (ni resuelve ni rechaza; sólo se libera al navegar) | resuelve `ok:true`, valor `""` |

**U-11 cerrado para Chromium**: API disponible ≠ lectura autorizada, confirmado con datos reales, no supuestos. Hallazgo adicional (promesa nunca asentada sin permiso, no sólo rechazo) registrado en CRI-118. WebKit/Firefox: NO PROBADO (sin vehículo).

## 10 · Escala de grises

Capturado sobre Results real (pórtico de ejemplo, momento activo, corte inspeccionado): `reports/evidence/2026-08-21-cri-106-accessibility/grayscale/results-color.png` vs `results-grayscale.png`. La curva de momento, sus etiquetas numéricas (`M = 36.35 kN·m`, etc.), el DCL del corte y el botón "Analizar" siguen siendo legibles y distinguibles por forma/posición/texto sin color. No se detectó pérdida de significado dependiente sólo de color en esta superficie.

## 11 · Deficiencia de color (CVD)

Deuteranopia y protanopia simuladas con matrices estándar (Brettel/Viénot) aplicadas como filtro SVG real sobre el DOM completo (Chromium rasteriza de verdad, no es superposición): `reports/evidence/2026-08-21-cri-106-accessibility/cvd/results-deuteranopia.png`, `results-protanopia.png`. La curva de momento (ahora oliva/amarillenta) conserva forma, posición y etiquetas — sigue siendo distinguible sin depender del matiz rojo/verde original. Tritanopia no se probó (no sustituye a las dos obligatorias, que sí se cubrieron).

## 12 · Reduced motion

Verificado con interacción real, no sólo lectura de CSS (`emulateMedia({reducedMotion:'reduce'})` + navegación real por la app): el filtro SVG del pórtico (`.portal-hero__body`) se retira (`filter:none`) confirmado por `getComputedStyle`; el stepper sigue presente y funcional; se llegó a la Mesa con éxito pese a `reduced-motion` activo (`reachedWorkspaceDespiteReducedMotion: true`). Función preservada, movimiento retirado — contrato sostenido en este recorrido.

## 13 · Reduced transparency

**NO VERIFICABLE end-to-end en este entorno.** Playwright 1.56 no expone `emulateMedia` para `prefers-reduced-transparency`; el contenedor headless tampoco expone el flag a nivel de SO para que Chromium lo detecte de forma nativa. Se intentó un shim de `matchMedia` para forzar la rama CSS, pero eso verifica que el CSS existe y se aplica (`styles.css:5344`, combinada con `reduced-motion`), no que el navegador real la dispare sola. Documentado como limitación, no como PASS.

## 14 · Focus

Recorrido real de Tab/Escape/Ctrl+K en Chromium (`reports/evidence/2026-08-21-cri-106-accessibility/focus/focus-walkthrough.json`):

- Welcome: 12 Tabs recorren stepper → tarjetas de lanzador → carriles de puertas → "Space 3D Experimental" → vuelta al stepper → tarjeta "Continuar proyecto", todos con `outline` visible.
- Model Doctor: `Enter` lo abre (foco pasa a "Cerrar Model Doctor"); `Escape` lo cierra **y restaura el foco exactamente al lanzador** ("Model Doctor") — sin caer a `BODY`.
- Command Palette: `Ctrl+K` enfoca el combobox de búsqueda; `Escape` cierra y restaura el foco al último control enfocado antes de abrir.
- Un punto de foco perdido momentáneo (`BODY`) apareció en la Mesa, Tab#4, entre "Resultados" y el skip-link "Saltar a la mesa de trabajo" (Tab#5) — se autorresuelve en el siguiente Tab y no impide continuar el recorrido; se registra como observación, no como fallo confirmado (no se investigó su causa exacta dentro de este gate).
- Limitación de medición: la detección de anillo de foco sólo comprobó `outline` nativo vía `getComputedStyle`; controles que usan `box-shadow`/borde para el anillo (p.ej. el campo "Nombre del proyecto", que midió `hasOutline:false`) pueden tener foco visible por otra propiedad CSS no capturada por este check — no se concluye ausencia de foco visible sin verificación adicional.

No se detectó un focus-trap accidental ni pérdida definitiva de foco.

## 15 · Touch targets (LEDGER-06, piso 44px)

Medido en K0 retrato con `hasTouch:true`/`isMobile:true` real (`reports/evidence/2026-08-21-cri-106-accessibility/suite-results.json` → `touchTargets`):

- ToolRail (20 controles): todos ≥47px. PASS.
- Cinta/TopBar: 4 de 5 controles ≥44px; **"Model Doctor" mide 36×36 — FAIL** (CRI-115).
- Stepper Welcome: nodos 1 y 4 ≥44px; **nodos 2 y 3 (icono-only) miden 40×44 — FAIL en ancho** (CRI-115).
- Lanzador de Welcome ("Nuevo proyecto"): 358×91, PASS.

## 16 · Responsive

Capturas ejecutadas y guardadas (`reports/evidence/2026-08-21-cri-106-accessibility/browsers/*.png`):

| Combinación | Ejecutado |
|---|---|
| X2 Día / Noche | Sí |
| M1 Día / Noche | Sí |
| K0 retrato Día / Noche | Sí |
| K0 apaisado Día / Noche | Sí |

8/8 combinaciones de la matriz mínima, todas sobre Welcome (paso 1). No se capturó la matriz completa X2 pasos 2/3 en esta pasada (ver limitaciones) — el foco de este gate fue accesibilidad, no el checkpoint visual de CRI-112 (ya cerrado y aprobado en su propio informe).

## 17 · Input real/emulado

Ver §3. Mouse y keyboard REAL vía CDP; touch EMULADO con `hasTouch`; stylus/coarse pointer NO PROBADO.

## 18 · Hallazgos e issues creadas

| # | Hallazgo | Severidad | Issue |
|---|---|---|---|
| 1 | `--accent` sobre `--accent-soft` cae a 2.76:1 en Noche (bajo 3:1) — ToolRail activo, capas, filter-chip, overlap-picker | Media | CRI-113 |
| 2 | Caption técnico (`--sc-color-text-unit`) cae a 3.82:1 en Día (bajo 4.5:1) — unidades de valores del solver | Media | CRI-114 |
| 3 | Touch targets <44px en K0: stepper nodos 2/3 (40×44) y lanzador Model Doctor (36×36) | Media | CRI-115 |
| 4 | `npm run qa` y `npm run qa:model-doctor` rotos: helpers de QA asumen el Welcome pre-CRI-112 (`.welcome-frame`, "Pórtico de ejemplo" visible en paso 1) | Alta (CI) | CRI-116 |
| 5 | Texto disabled (`--sc-color-text-disabled`) cae a 2.59:1 en Día — pendiente auditoría de "contenido obligatorio" | Baja | CRI-117 |
| 6 | `readClipboardText()` sin timeout: promesa nunca se asienta si el navegador no resuelve el permiso | Baja | CRI-118 |

Ningún hallazgo se corrigió dentro de CRI-106 (ni siquiera trivial): todos requieren o bien decisión de diseño (HEX), o bien tocar infraestructura de QA/producto fuera del alcance de medición.

## 19 · Gates

| Gate | Resultado |
|---|---|
| `npm test` | PASS (224/224, 2245 pasadas, 8 saltadas) |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS (4 warnings preexistentes) |
| `npm run verify:protected` | PASS (38 archivos) |
| `npm run build` | PASS |
| `npm run qa:topbar` | **PASS** — "TopBar browser geometry passed" en las 3 clases + continuo + long-name ES/EN |
| `npm run qa` | **FAIL** — roto por CRI-112 (`.welcome-frame` ya no existe), ver CRI-116 |
| `npm run qa:model-doctor` | **FAIL** — roto por CRI-112 (ejemplo ya no visible en paso 1), ver CRI-116 |
| `npm run qa:webkit` | **FAIL** — WebKit no instalable en este entorno (bloqueo de red), ver §8 |

Los tres FAIL están reproducidos sobre baseline limpio, con causa identificada y documentada (dos por CRI-112, uno por infraestructura de red). Ninguno se forzó en verde ni se relajó.

## 20 · Evidencia

```
reports/evidence/2026-08-21-cri-106-accessibility/
├── contrast/            (measure-contrast.mjs, ledger-05-portal-night.mjs, tablas, screenshots del pórtico)
├── screen-reader/        (PREFLIGHT.md — justificación BLOCKED)
├── browsers/             (MATRIX.md, capturas responsive X2/M1/K0 × Día/Noche)
├── grayscale/            (results-color.png, results-grayscale.png)
├── cvd/                  (results-deuteranopia.png, results-protanopia.png)
├── motion/               (welcome-reduced-motion-x2-day.png)
├── transparency/         (welcome-x2-night.png + nota de no-verificabilidad)
├── focus/                (focus-walkthrough.mjs, focus-walkthrough.json)
├── touch-targets/        (datos en suite-results.json → touchTargets)
├── clipboard/            (datos en suite-results.json → clipboard)
├── run-suite.mjs         (harness principal reutilizable)
├── suite-results.json
└── aria-live-static-inventory.txt
```

## 21 · Limitaciones

1. **BLOQUEO PRINCIPAL**: sin lector de pantalla real y sin WebKit, CRI-106 no puede declarar accesibilidad cerrada. Ambos son limitaciones del ENTORNO (contenedor headless sin sesión de escritorio; política de red que bloquea la descarga de binarios de Playwright), no del producto.
2. Firefox: mismo bloqueo, sin vehículo.
3. `prefers-reduced-transparency` no verificable end-to-end en headless (sin control del flag de SO).
4. La duplicación real de locución `aria-live` no se pudo confirmar ni descartar sin lector real; el inventario aquí es estático.
5. No se recorrió Datasheet ni Candidate Picker en este gate (tiempo/alcance); quedan pendientes de una pasada posterior, junto con la pasada de lector real.
6. El recorrido de foco no verificó anillos de foco basados en `box-shadow`/borde, sólo `outline` nativo — puede subestimar cobertura real de `:focus-visible`.
7. No se recorrió el catálogo EN completo para locución (sólo se citan strings ES/EN de forma puntual); pendiente de la pasada real.
8. La matriz responsive cubrió sólo Welcome paso 1 (no pasos 2/3), priorizando cobertura de accesibilidad sobre repetir el checkpoint visual ya cerrado por CRI-112.

## 22 · Veredicto de cierre

Según CRI-106 §29:

- CRI-112 estaba integrada antes de medir → cumplido.
- Contraste medido sobre producto real → cumplido (§4).
- LEDGER-05 ejecutado → cumplido (§5), sin ajuste necesario.
- Pasada con lector de pantalla REAL → **NO cumplido** (§3, §6).
- Chromium ejecutado → cumplido.
- WebKit ejecutado → **NO cumplido** (§3, §8).
- Firefox probado o justificado → justificado como no disponible (§8).
- U-11 cerrado → cumplido para Chromium (§9); WebKit/Firefox no probados.
- Grayscale/CVD ejecutados → cumplido (§10, §11).
- reduced-motion/transparency verificados → reduced-motion cumplido (§12); reduced-transparency no verificable en este entorno (§13).
- Hallazgos con issue → cumplido (§18, 6 issues).
- Gates aplicables verdes → parcial: 6/9 verdes, 3 rojos con causa identificada (§19).

**`CRI-106 BLOCKED — falta lector de pantalla real` y `CRI-106 BLOCKED — falta ejecución WebKit`.**

No se marca Done. Se deja In Progress/Blocked en Linear con esta evidencia adjunta.
