# S20 — Certificación y versión

- **Agente:** Claude Code (agente principal)
- **Modelo:** Sonnet 5 (`claude-sonnet-5`)
- **Fecha:** 2 de agosto de 2026
- **Estado de GitHub:** NO UTILIZADO

## Objetivo

Certificar structureCo 0.8.1 desde una instalación limpia y hacer el cambio de versión, el
último paso técnico del programa.

## Procedimiento de certificación

1. `rm -rf node_modules && npm ci` — instalación limpia, 122 paquetes, **0 vulnerabilidades**.
2. `npm run verify` (lint + frontera protegida + 530 pruebas + build) sobre esa instalación
   limpia — correcto.
3. `npm run typecheck` — limpio.
4. `npm run qa` (Chromium) — **exit 0, 0 comprobaciones en falso**.
5. `npm run qa:webkit` (WebKit, iPhone 13 + iPad Pro 11) — **exit 0**.
6. Pruebas de round-trip, migración e i18n ejecutadas explícitamente
   (`portable.test.ts`, `migrate.test.ts`, `catalogs.test.ts`, `invariants.test.ts`) — 28
   pruebas, todas en verde.
7. `git diff --stat 3564505..HEAD` — 81 archivos, +6404/−321, sin archivos inesperados.
8. Barrido de secretos sobre el diff completo (`api[_-]?key`, `secret`, `password`,
   `token\s*[:=]`, cabeceras de clave privada) — **sin coincidencias reales** (los dos únicos
   resultados son el texto de catálogo i18n sobre PDF con contraseña).
9. Cambio de versión: `package.json` → `0.8.1`; `package-lock.json` sincronizado con
   `npm install --package-lock-only` (**diff de sólo 2 líneas, ambas el campo `version`; ninguna
   dependencia cambió**).
10. Re-certificación completa después del bump: lint, typecheck, 530 pruebas, build, frontera
    protegida y `validate-ci.mjs`, todos en verde con `structureco@0.8.1`.
11. Verificado en el bundle de producción real: la cadena `0.8.1` aparece en
    `portableFile-*.js` y `units-*.js` — la procedencia que S14 corrigió (`APP_VERSION` desde
    `package.json` vía `define` de Vite) refleja la versión real, no un literal.

## Documentación actualizada con el número de versión

| Archivo | Cambio |
|---|---|
| `package.json` | `0.8.0` → `0.8.1` |
| `package-lock.json` | sincronizado (sólo metadata, sin cambio de dependencias) |
| `README.md` | «Versión estable» actualizada; sin romper enlaces a documentos históricos de 0.8.0 |
| `docs/ROADMAP.md` | «Release actual» actualizada; el historial de 0.8.0 se conserva sin reescribir |
| `CHANGELOG.md` | la entrada «No publicado» del programa 0.8.1 se cierra con versión y fecha |
| `docs/releases/0.8.1/STATUS.md` | distingue versión al iniciar (0.8.0) de versión actual (0.8.1) |

No se tocaron `docs/ux-redesign/RELEASE_NOTES_0.8.0.md`, `DESIGN_TOKENS.md` ni
`COMPONENTS.md`: son documentos históricos de 0.8.0 correctamente fechados, no estado actual.

## Archivos protegidos comprobados

`node scripts/check-protected-baseline.mjs` → «Frontera protegida intacta: 22 archivos verificados.»
Verificado **después** del bump de versión, sobre la instalación limpia.

## Pruebas ejecutadas (resumen de todo el programa)

| Comando | Resultado |
|---|---|
| `npm ci` (limpio) | 122 paquetes, 0 vulnerabilidades |
| `npx oxlint` | limpio |
| `npm run typecheck` | limpio (`structureco@0.8.1`) |
| `npx vitest run` | **78 archivos, 530 pruebas, todas en verde** |
| `npm run build` | correcto |
| `npm run qa` | exit 0, Chromium |
| `npm run qa:webkit` | exit 0, WebKit (iPhone 13, iPad Pro 11) |
| `node scripts/check-protected-baseline.mjs` | 22 archivos |
| `node scripts/validate-ci.mjs` | 2 workflows sin problemas |

### Progresión de la suite a lo largo del programa

| Slice | Archivos | Pruebas |
|---|---:|---:|
| S01 (baseline) | 67 | 388 |
| S09 (seguridad de importación) | 69 | 439 |
| S11 (política numérica) | 71 | 467 |
| S12/S13 (SVG/PNG) | 73 | 487 |
| S14 (PDF) | 74 | 495 |
| S15 (invariantes) | 75 | 507 |
| S16 (rendimiento) | 76 | 513 |
| S02/S03 (tokens) | 76 | 515 |
| S04 (bus de comandos) | 77 | 521 |
| Motor autorizado (ruido numérico) | 78 | 528 |
| S10 (experiencia de importación) | 78 | 530 |
| **Final (0.8.1)** | **78** | **530** |

**+142 pruebas** sobre el baseline de 0.8.0 (388 → 530), sin reducir ninguna tolerancia y sin
eliminar ninguna prueba existente.

## Riesgos

Ninguno nuevo. El cambio de versión es metadata; no afecta comportamiento.

## Limitaciones

Heredadas y documentadas en cada slice — no se repiten aquí. Ver el informe final de cierre
para el resumen consolidado.

## Siguiente paso

Presentar el informe final de cierre del programa 0.8.1 y preguntar por la autorización para
comparar con GitHub, según exige la sección 41 del encargo.

## Commit local

`chore(release): bump local version to 0.8.1`
