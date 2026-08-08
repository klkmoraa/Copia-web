# Baseline previa al rediseño visual integral

- **Fecha:** 2026-08-02
- **Versión ejecutable:** 0.8.0 (`package.json`)
- **Rama git:** `fix/mobile-results-canvas-visibility` @ `8000160`
- **Respaldo previo:** `../../../../structureCo-backup-redesign-20260802-002717/`
  (883 archivos · 126 031 851 bytes · inventario SHA-256 `361e81282d251b341e410dbb545a69768501b56a741965c1a6cedfbaa911aaa1`)

## Resultados de la línea base

| Gate | Resultado | Detalle |
|---|---|---|
| `npm run lint` (oxlint) | ✅ PASS | exit 0 — ver `lint.txt` |
| `npm test` (vitest) | ✅ PASS | **67 archivos / 388 pruebas**, 52.73 s — ver `test.txt` |
| `npm run build` (tsc + vite) | ✅ PASS | 2.28 s — ver `build.txt` (tamaños de bundle registrados) |
| `node qa-phase14.mjs` (Playwright, Chromium+WebKit, 8 matrices) | ✅ PASS | `failures: []`, 10 capturas |
| `node qa.mjs` (suite general Playwright) | ❌ FAIL (**preexistente**) | Timeout en `qa.mjs:340`, flujo móvil esperando `dialog "Resultados del análisis"`. Coincide exactamente con el fallo documentado en `structureCo-documentacion-integral-0.8.0.md` (generado 2026-08-01, antes del rediseño). No fue introducido por este trabajo. |

## Referencia matemática

La paridad matemática del rediseño se verifica contra:

- Las **388 pruebas vitest** (motor de rigidez, diagramas, líneas de influencia,
  auditoría de cargas, migraciones, formatos portables) con sus tolerancias
  existentes (`rtol` ≈ 3e-7 a 1e-6). Ninguna prueba ni fixture matemático será
  modificado por el rediseño.
- La huella técnica (`technicalFingerprint`) de `qa-phase14.mjs`, que serializa
  nodos, miembros, casos, combinaciones y cargas del proyecto antes/después del
  roundtrip de importación.

## Capturas del estado inicial

Las capturas `phase14-*.png` de esta carpeta son el estado real 0.8.0
inmediatamente antes del rediseño (generadas por `qa-phase14.mjs` contra el
build de producción):

| Archivo | Superficie | Tema | Viewport |
|---|---|---|---|
| `phase14-chromium-desktop-1536x960-light.png` | Workspace desktop | Día | 1536×960 |
| `phase14-chromium-tablet-834x1194-dark.png` | Workspace tablet | Noche | 834×1194 |
| `phase14-chromium-mobile-390x844-light.png` | Workspace móvil | Día | 390×844 |
| `phase14-chromium-mobile-landscape-683x384-light.png` | Workspace móvil horizontal | Día | 683×384 |
| `phase14-chromium-import-roundtrip-1536x960.png` | Centro de importación | Día | 1536×960 |
| `phase14-webkit-desktop-1366x768-dark.png` | Workspace desktop (WebKit) | Noche | 1366×768 |
| `phase14-webkit-tablet-834x1194-light.png` | Workspace tablet (WebKit) | Día | 834×1194 |
| `phase14-webkit-mobile-390x844-dark.png` | Workspace móvil (WebKit) | Noche | 390×844 |
| `phase14-webkit-mobile-landscape-683x384-dark.png` | Workspace móvil horizontal (WebKit) | Noche | 683×384 |
| `phase14-webkit-classroom-1366x768-dark.png` | Modo Aula (WebKit) | Noche | 1366×768 |

## Advertencias y errores preexistentes

1. `qa.mjs:340` — timeout del diálogo de resultados móvil (descrito arriba).
2. Working tree git con cambios sin commitear previos al rediseño:
   `src/ui/ComponentLab.tsx`, `src/ui/componentLab.css` (modificados) y varios
   directorios sin trackear (`.agents/`, `skill-audit/`, `AGENTS.md`, etc.).
3. Discrepancias documentales heredadas (0.7.0 en `MATHEMATICAL_SPEC.md` /
   `VERIFICATION_REPORT.md` vs 0.8.0 ejecutable) — documentadas, fuera del
   alcance del rediseño visual.
