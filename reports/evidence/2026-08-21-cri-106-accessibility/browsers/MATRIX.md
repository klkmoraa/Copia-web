# CRI-106 · Matriz multi-navegador

## Navegadores disponibles en este entorno

| Navegador | Estado | Evidencia |
|---|---|---|
| Chromium | **DISPONIBLE** — `/opt/pw-browsers/chromium` (pre-instalado), versión 141.0.7390.37 | Usado en toda la suite |
| WebKit | **NO DISPONIBLE** — instalación bloqueada | `npx playwright install webkit` → `Error: Download failed: server returned code 403 body 'request blocked: no rule or allowlist entry allows host "cdn.playwright.dev"'` y el mismo 403 contra `playwright.download.prss.microsoft.com`. Confirmado también en `curl -sS "$HTTPS_PROXY/__agentproxy/status"` → `recentRelayFailures`: `connect_rejected`, `"gateway answered 403 to CONNECT (policy denial or upstream failure)"` para ambos hosts. `npm run qa:webkit` falla en consecuencia: `browserType.launch: Executable doesn't exist at /opt/pw-browsers/webkit-2311/pw_run.sh`. |
| Firefox | **NO DISPONIBLE** — instalación bloqueada | `npx playwright install firefox` → idéntico 403 contra los mismos dos hosts. |

**Causa raíz, no navegador-específica**: la política de red del entorno (proxy saliente) deniega ambos CDN de descarga de binarios de Playwright. No es un fallo de espacio en disco ni de configuración local — es una política de allowlist de host que este entorno no puede cambiar desde dentro de la sesión.

## Matriz de flujos — sólo Chromium tiene vehículo real en este entorno

| Flujo | Chromium | WebKit | Firefox |
|---|---|---|---|
| Welcome (4 pasos) | PASS | NO PROBADO | NO PROBADO |
| Entrada a la Mesa (Continuar / ejemplo) | PASS | NO PROBADO | NO PROBADO |
| Canvas | PASS (renderizado verificado en capturas) | NO PROBADO | NO PROBADO |
| ToolRail | PASS (targets medidos, ver `../touch-targets/`) | NO PROBADO | NO PROBADO |
| Inspector | PASS (visible en capturas de Results) | NO PROBADO | NO PROBADO |
| Results | PASS (grayscale/CVD, ver `../grayscale/`, `../cvd/`) | NO PROBADO | NO PROBADO |
| Datasheet | NO EJECUTADO EN ESTE GATE (ver limitaciones) | NO PROBADO | NO PROBADO |
| Model Doctor | PASS (foco + apertura/cierre, ver `../focus/`) | NO PROBADO | NO PROBADO |
| Command Palette | PASS (Ctrl+K, foco, Escape, ver `../focus/`) | NO PROBADO | NO PROBADO |
| Candidate Picker | NO EJECUTADO EN ESTE GATE | NO PROBADO | NO PROBADO |
| keyboard | PASS (recorrido de Tab, ver `../focus/`) | NO PROBADO | NO PROBADO |
| focus | PASS (ver `../focus/focus-walkthrough.json`) | NO PROBADO | NO PROBADO |
| reduced motion | PASS (ver `../motion/`) | NO PROBADO | NO PROBADO |
| clipboard | PASS (ver `../clipboard/`) | NO PROBADO | NO PROBADO |

**Ningún casillero de WebKit o Firefox se marca PASS.** Todos quedan explícitamente NO PROBADO, sin excepción, según exige CRI-106 §10-11.

## Veredicto

`CRI-106 BLOCKED — falta ejecución WebKit` (y Firefox), por causa de infraestructura documentada arriba, no por decisión del producto ni omisión de esta medición.
