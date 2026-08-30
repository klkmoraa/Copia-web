# CRI-91 · Brandbook canónico menta/esmeralda

**Clasificación:** `AUDIT/TEMPORARY`

**Fecha:** 2026-08-16 20:48

**Agente:** Codex

**Rama:** `crisdlm302/cri-91-brandbook-menta-esmeralda`

## Qué cambió

Se renovó en su sitio el único Brandbook canónico con la dirección CRI-12C menta/esmeralda. El gate cromático fijó primero una marca menta invariante, trasladó la lima a cortante V/carga distribuida, creó la anatomía fucsia discontinua para influencia y movió success para sostener separación perceptual.

Después del Brandbook se alinearon los roles en `tokens.css` y, al final, Component Lab quedó conectado exclusivamente a los tokens vivos, sin paletas históricas locales. La evidencia reproduce contraste WCAG, grayscale, deuteranopia, protanopia y QA responsive Día/Noche.

## Por qué

CRI-91 exige que la identidad deje la familia lima y adopte menta/esmeralda, sin crear una autoridad alternativa ni variantes semánticas nocturnas. La separación técnica queda explícita por HEX y anatomía: marca menta, cortante lima con área, influencia fucsia con canto medido y patrón siempre discontinuo.

## Decisiones cromáticas

- Brand fill/action `#1AA57A` (peor 3.06:1), hover `#159A72` (3.48:1), pressed `#148F69` (3.95:1), stroke/snap/hover técnico `#087E5C` (3.17:1), ink `#02140F` (peor par 4.65:1).
- Cortante V/carga distribuida: canto `#468C09` (3.84:1) + área `#DAEFC8`.
- Influencia: canto `#D85AC9` (3.30:1) + área `#F2C2E6` + dashed obligatorio.
- Success **MOVED** de `#2F9A2A` a `#2D7C36` (3.10:1; blanco encima 5.19:1).
- Aula **UNCHANGED** en `#C94A8F` (3.72:1). Momento, error, focus y selection también permanecen sin cambio.

## Archivos tocados

- `brand/brandbook-clay.html` — renovación integral V-01…V-14, tablas medidas, CVD/grayscale, materia Clay, Día/Noche y tres composiciones.
- `brand/README.md` — declara el Brandbook único y la relación de autoridad con tokens.
- `brand/manifest.json` — actualiza bytes, SHA-256 y revisión del Brandbook; el registro del logo permanece idéntico.
- `src/design-system/tokens.css` — alinea marca, cortante, influencia y success, sin nuevo rol semántico en dark.
- `src/design-system/lab/ComponentLab.tsx` — elimina alternativas históricas y demuestra la autoridad oficial.
- `src/design-system/lab/componentLab.css` — anatomías reales de brand, ingeniería, focus, selection y materia.
- `validation/cri-91/cri91-color-gate.mjs` — gate WCAG y evidencia perceptual reproducible.
- `validation/cri-91/cri91-visual-qa.mjs` — QA Playwright con la herramienta existente.
- `validation/cri-91/README.md` y `validation/cri-91/evidence/*.png` — método, tablas y capturas auditables.
- `reports/2026-08-16-2048-cri-91-brandbook-menta-esmeralda.md` — este relevo.

No se modificaron `src/features/**`, `src/design-system/tokens.test.ts`, `brand/logo.svg`, dependencias, solver, modelo, schema, persistencia ni protected baseline.

## Cómo verificar

```powershell
node validation/cri-91/cri91-color-gate.mjs
node validation/cri-91/cri91-visual-qa.mjs
npx.cmd vitest run src/design-system/tokens.test.ts
npm.cmd run typecheck
npm.cmd run build
```

Resultados del cierre local:

- Gate cromático: PASS.
- Grayscale/deuteranopia/protanopia: PASS en grupos A/B/C, con canales no cromáticos documentados.
- QA visual: PASS en Día/Noche × Expanded/Medium/Compact; cero overflow; focus/selection; cuatro grafitos; influence dashed; deformada continuous; reduced-motion.
- `tokens.test.ts`: PASS, 29/29, archivo sin modificar.
- `typecheck`: PASS.
- `build`: PASS.
- Lint literal: TIMEOUT sin salida al recorrer contenido local no versionado ajeno al slice. Suplemento `npx.cmd oxlint src scripts validation/cri-91/cri91-color-gate.mjs validation/cri-91/cri91-visual-qa.mjs`: 0 errores y sólo 2 warnings preexistentes en `src/features/canvas/ContextualActions.tsx`; los archivos ejecutables de CRI-91: 0 hallazgos.
- `verify:docs`: los 2 tests del verificador pasan, pero el gate final reporta 2 avisos HISTORICAL faltantes en documentos de CRI-94 ya idénticos a `origin/main`. No se tocaron por alcance.

El Brandbook y Component Lab también se revisaron contra `web-design-guidelines`, `vercel-react-best-practices`, `frontend-ui-engineering` y la accessibility checklist. No quedaron hallazgos contractuales de CRI-91; observaciones generales fuera del slice no se implementaron.

## Pendiente / siguiente paso

Nada pendiente dentro de CRI-91. La propagación de la nueva autoridad a superficies de producto pertenece a issues posteriores y no se inició. Tampoco se iniciaron CRI-90, CRI-95, CRI-98, CRI-99, CRI-100, CRI-101, CRI-104, CRI-105 ni CRI-106.
