# S01 — Baseline y protección de la frontera matemática

- **Agente:** Claude Code (agente principal)
- **Modelo:** Opus 5 (`claude-opus-5`)
- **Fecha:** 2 de agosto de 2026
- **Estado de GitHub:** NO UTILIZADO

## Objetivo

Establecer un baseline verificable de structureCo 0.8.0 antes de cualquier cambio de 0.8.1,
y proteger la frontera matemática con hashes comprobables automáticamente.

## Contexto

El programa 0.8.1 se ejecuta **exclusivamente en local** por decisión expresa del usuario.
Ver `docs/releases/0.8.1/LOCAL_MODE.md`, que reemplaza para esta fase lo indicado en
`AGENTS.md` líneas 3–4.

## Hallazgos

### 1. La suite de pruebas no medía el producto (crítico)

`vite.config.ts` no tenía bloque `test`. Vitest usaba sus valores por defecto y recolectaba
archivos `*.test.*` de **todas** las copias del proyecto presentes en la carpeta:

- `structureCo/`
- `structureCo-backup-2026-08-01-135143/`, `-135215/`
- `structureCo-backup-color-foundations-20260801-181342/`
- `structureCo-backup-design-exploration-20260801-151246/`
- `structureCo-backup-redesign-20260802-002717/`
- `structureCo-backup-topbar-lab-20260801-185004/`
- `structureCo-worktrees/` (10 worktrees)

Consecuencias medidas: la ejecución superaba los **15 minutos** sin terminar y reportaba
fallos de copias obsoletas (por ejemplo `structureCo-backup-2026-08-01-135215/src/App.test.tsx`,
3 fallos) que no corresponden al código actual. Cualquier conteo de pruebas obtenido de
`npm test` antes de este cambio era incorrecto.

### 2. `npm run verify` estaba en rojo antes de este trabajo

`src/design-system/tokens.test.ts` fallaba en la fase de recolección y reportaba `(0 test)`.
Causa raíz: el archivo lee `tokens.css` y `styles.css` con `readFileSync` y los analiza con
expresiones regulares orientadas a línea (`\n\s*\}\n\}`). `src/design-system/tokens.css` está
guardado con **CRLF** (461 finales de línea CRLF, 0 LF), por lo que el bloque
`@media (prefers-reduced-motion: reduce)` nunca coincidía y el módulo lanzaba en la carga.

Efecto: **8 pruebas de tokens, contraste y temas estaban muertas** sin que nadie lo notara,
porque el ruido de las copias de respaldo ocultaba el fallo.

### 3. Lint sin alcance

`oxlint` también recorría las carpetas de respaldo y worktrees.

## Decisiones

- Acotar `vitest` a `src/**` y excluir explícitamente respaldos, worktrees y copias vendidas.
- Importar `defineConfig` desde `vitest/config` en lugar de `vite`, para que el bloque `test`
  tenga tipos (con `vite` la compilación fallaba con TS2769). No se añadió ninguna dependencia:
  `vitest` ya era `devDependency`.
- Normalizar finales de línea al leer CSS dentro de `tokens.test.ts`, en vez de reescribir
  `tokens.css` a LF. Se corrige la prueba, no el archivo de producción.
- Añadir `scripts/check-protected-baseline.mjs` y el script npm `verify:protected`, e integrarlo
  en `verify`. El baseline sólo se refresca con `--update`, de forma deliberada.

## Archivos tocados

| Archivo | Cambio |
|---|---|
| `vite.config.ts` | bloque `test` con `include`/`exclude`; import desde `vitest/config` |
| `.oxlintrc.json` | `ignorePatterns` para respaldos, worktrees y copias |
| `package.json` | scripts `typecheck`, `verify:protected`; `verify` incorpora la frontera protegida |
| `src/design-system/tokens.test.ts` | lectura de CSS insensible a CRLF |
| `scripts/check-protected-baseline.mjs` | nuevo verificador de la frontera matemática |
| `docs/releases/0.8.1/STATUS.md` | nuevo estado canónico |
| `docs/releases/0.8.1/LOCAL_MODE.md` | nueva gobernanza de trabajo local |
| `docs/releases/0.8.1/PROTECTED_BASELINE.sha256` | nuevo baseline de 45 archivos |

## Archivos protegidos comprobados

45 archivos de `src/engine/**`, `src/workers/**`, `src/data/**`, `src/store/ProjectContext.tsx`
y `src/types.ts`. **Ninguno fue modificado.** Verificado con
`node scripts/check-protected-baseline.mjs` → «Frontera protegida intacta: 45 archivos verificados.»

## Pruebas ejecutadas

| Comando | Resultado |
|---|---|
| `npx oxlint` | limpio, exit 0, sin diagnósticos |
| `npm run typecheck` (`tsc -b --noEmit`) | limpio, exit 0 |
| `npx vitest run` | **67 archivos, 388 pruebas, todas en verde**, 119,7 s |
| `npm run build` | correcto, 3,59 s |
| `npm run verify:protected` | 45 archivos verificados |

### Baseline numérico real de 0.8.0

- Archivos de prueba: **67**
- Pruebas: **388** (380 antes de reactivar `tokens.test.ts`, + 8 recuperadas)
- Duración de la suite acotada: **~120 s** (antes: >900 s sin terminar)
- Bundle: `index-*.css` 177,75 kB (gzip 31,50 kB); `es-*.js` 428,29 kB (gzip 178,35 kB);
  `pdf-*.js` 479,84 kB (gzip 145,23 kB); `pdf.worker-*.mjs` 2 366,08 kB

## Evidencia

- `docs/releases/0.8.1/PROTECTED_BASELINE.sha256`
- Salidas de lint/test/build conservadas en el scratchpad de la sesión.

## Riesgos

- El baseline de bundle incluye `pdf.worker` de 2,3 MB; es carga diferida, pero conviene
  confirmarlo en S16 antes de declarar presupuestos.
- Las copias de respaldo siguen en la carpeta. No se eliminaron (no está autorizado y
  contienen las referencias visuales oficiales), sólo se excluyeron de las herramientas.

## Limitaciones

- No se pudo confirmar la versión de Claude Code: `claude` no está en el `PATH` de este shell.
- Las referencias visuales oficiales sólo existen dentro de respaldos ignorados por git.
- `structureCo_mockups_canva_10_paginas.pdf` no se encontró.

## Pendientes

- S11: existen **cinco** formateadores numéricos distintos con umbrales incompatibles.
- S09: `inspectPortableFile` lee el archivo completo antes de validar tamaño;
  `readPortableBundle` descomprime ZIP sin ningún límite.
- S12/S13: la exportación SVG/PNG serializa el SVG vivo sin resolver variables CSS ni clases.

## Siguiente paso

S09 — Seguridad de importaciones (rechazo temprano, presupuestos de archivo y ZIP).

## Commit local

`chore(release): prepare local 0.8.1 program and fix the quality gate`
