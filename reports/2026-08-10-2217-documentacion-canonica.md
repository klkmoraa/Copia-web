# Documentación canónica y guard objetivo

**Fecha:** 2026-08-10 22:17
**Agente:** Codex
**Rama:** `codex/documentacion-canonica`

## Qué cambió

Se restableció una entrada breve y actual del producto, un índice documental canónico y un mapa de arquitectura vigente. Toda la documentación bajo `docs/**` quedó clasificada como `CANONICAL`, `REFERENCE` o `HISTORICAL`; los planes y estados superados conservan su contenido y ahora muestran un aviso con su sustitución vigente.

También se añadió una política para `reports/**` y un guard sin dependencias que comprueba documentos obligatorios, clasificaciones, avisos históricos y enlaces relativos. `verify:docs` quedó integrado en `npm run verify`, el Gate rápido y el gate manual de release sin cambiar el nombre del job requerido.

## Por qué

El README anterior se presentaba como única documentación vigente, incluía conteos volátiles y no reflejaba Project Hub, `ProjectCommand` ni el Space 3D funcional experimental actual. Además, planes, pre-RFCs y reportes convivían sin una jerarquía que impidiera usarlos como prueba de implementación presente.

## Archivos tocados

- `README.md` — entrada breve, capacidades comprobadas, límites y navegación documental.
- `docs/README.md` — índice canónico, jerarquía, inventario y mapa de autoridad.
- `docs/architecture/README.md` — mapa vigente de subsistemas y fronteras.
- `docs/architecture/*.md` — clasificación de S3D-1, pre-RFC de IA y documentos históricos de Fase 4.
- `docs/superpowers/plans/*.md` — avisos `HISTORICAL` sin reescribir planes.
- `docs/superpowers/specs/*.md` — avisos `HISTORICAL` sin reescribir diseños.
- `reports/README.md` — política `AUDIT/TEMPORARY` para evidencia y handoffs.
- `scripts/check-docs.mjs` — verificador documental objetivo.
- `scripts/check-docs.test.mjs` — pruebas Node del guard, desarrolladas con ciclo RED/GREEN.
- `package.json` — script `verify:docs` e integración en `verify`.
- `.github/workflows/ci.yml` — `verify:docs` dentro del job `Lint, frontera protegida, pruebas y build` y comentarios vigentes.
- `.github/workflows/release-qa.yml` — comprobación documental en el bloque de Gate rápido y comentarios vigentes.
- `scripts/validate-ci.mjs` — comentarios y mensajes independientes de una versión obsoleta.
- `AGENTS.md` — regla mínima para consultar el índice y mantener la clasificación.

No se modificaron `src/**`, `validation/**`, `brand/**`, `package-lock.json`, dependencias ni `scripts/protected-baseline.sha256`.

## Cómo verificar

- `npm.cmd run verify:docs` — PASS: 2 pruebas del guard; 14 documentos clasificados; obligatorios y enlaces válidos.
- `npm.cmd run verify:protected` — PASS: 29 archivos protegidos intactos.
- `npm.cmd run verify:space3d` — PASS: 20 archivos; 212 pruebas aprobadas, 5 omitidas; capacidad 150 nudos / 300 barras.
- `npx.cmd vitest run --maxWorkers=1` — PASS: 143 archivos; 1071 pruebas aprobadas, 8 omitidas.
- `npm.cmd run build` — PASS.
- `npm.cmd run verify:perf` — PASS informativo: 768762 bytes / 201133 gzip, sin techo bloqueante.
- `npm.cmd run validate:ci` — PASS: 2 workflows.
- `git diff --check` — PASS; sólo advertencias informativas LF/CRLF de Git en Windows.
- `npm.cmd run verify` — **NO PASA** en dos ejecuciones finales: `src/features/space3d/Space3DWorkspace.test.tsx > informa un mecanismo sin perder el modelo` excede su timeout de 5000 ms bajo la suite paralela (5160 ms y 5318 ms). La línea base previa a los cambios pasó; el caso aislado pasó en 2475 ms y `verify:space3d`/la suite serial completa pasaron. No se modificó el test ni el producto por estar fuera del alcance documental.

## Pendiente / siguiente paso

- Investigar y estabilizar por separado el timeout paralelo existente de `Space3DWorkspace.test.tsx`; el gate exacto `npm run verify` no puede declararse verde en esta entrega.
- Push y PR pendientes por instrucción explícita del usuario.
