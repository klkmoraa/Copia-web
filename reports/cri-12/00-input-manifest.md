# CRI-12A · Manifest de entradas

**Clasificación:** `AUDIT/TEMPORARY`

Este documento fija, de forma reproducible desde Git, qué se consultó para congelar el baseline de CRI-12 y con qué autoridad se leyó cada fuente. No decide UX ni visuales — ver `HANDOFF.md` para las preguntas abiertas que pasan a CRI-12B/12C.

## Referencias fijas (SHA, no ramas móviles)

| Referencia | SHA | Rol |
|---|---|---|
| `origin/main` al iniciar CRI-12A | `7fb927fb6d118925e63365d1a2bb2813f8795385` | Baseline de partida. Verificado con `git fetch origin main && git rev-parse origin/main`. |
| Rama de trabajo `research/cri-12-direction` | creada como `git checkout -b research/cri-12-direction origin/main` | Contiene únicamente `reports/cri-12/**` sobre el mismo árbol que `origin/main`. |
| CRI-11 final (evidencia fija dada por el encargo) | `d2a4dbfa20c08f1e22206619ee4291794555546a` | `feat(cri-11): Fase C — validación y estrés`, en `origin/claude/cri-11-fase-c-validation-1tyoq5`. No mergeado a `main`. |
| CRI-10 cierre (tip de su rama) | `aa63fa63db0ff6bc0122d4b34ce1602b534f24dc` | `docs: CRI-10 — cierre y congelación`, en `origin/research/cri-10-ux-system`. No mergeado a `main`. `origin/main` es ancestro directo (`git merge-base --is-ancestor` = sí). |

Todo lo de CRI-10 y CRI-11 vive en ramas no mergeadas: se leyó exclusivamente vía `git show <SHA>:<ruta>`, sin checkout, sin tocar el árbol de trabajo de `research/cri-12-direction`. CRI-7, CRI-8 y CRI-9 ya están mergeados a `main` (commits `e9a406a`, `07f80b9`, `d98006d`) y se leyeron directamente del árbol de trabajo.

## Jerarquía de autoridad aplicada

Tomada de `docs/README.md:7-19` (documento `CANONICAL`, índice único del repo):

```text
código + pruebas + gates ejecutables
→ documentación CANONICAL
→ documentación REFERENCE
→ documentación HISTORICAL / AUDIT-TEMPORARY
```

`reports/README.md:3` clasifica todo `reports/**` (salvo su propia política) como `AUDIT/TEMPORARY`: evidencia de una ejecución concreta, nunca fuente de verdad vigente. Esta jerarquía es la que rige la clasificación de cada tema en `01-evidence-matrix.md`.

## Fuentes consultadas

### Código, pruebas y gates (autoridad máxima)

| Fuente | Uso |
|---|---|
| `src/**` (engine, features, design-system, store, i18n, space3d, education) | Verificación de qué existe realmente en producción, por tema. |
| `src/**/*.test.{ts,tsx}` (sin ejecutar la suite completa) | Confirmación de invariantes por lectura de aserciones, no por corrida masiva. |
| `docs/architecture/README.md`, `docs/architecture/structureco-datasheet.md`, `docs/architecture/structureco-space-3d-s3d1.md`, `docs/architecture/structureco-elastic-index.md` | `CANONICAL`. Contratos vigentes de Datasheet, Space3D y η. |
| `docs/architecture/structureco-fase-4-gates.md` | `HISTORICAL` (sustituido por el mapa de arquitectura y los gates ejecutables actuales). Sólo para inventariar comandos de gate. |
| `package.json` (scripts `verify:*`) | Inventario de gates ejecutables (`verify:protected`, `verify:docs`, `verify:perf`, `verify:space3d`, `verify`) — no se ejecutaron. |

### Project Sources / identidad visual (autoridad de marca)

| Fuente | Clasificación declarada | Uso |
|---|---|---|
| `brand/README.md` | Regla de protección | Confirma `brandbook-clay.html`, `logo.svg`, `manifest.json` como protegidos, gobernados por CODEOWERS, no editables sin autorización explícita. |
| `brand/brandbook-clay.html` | `REFERENCE` (autodeclarado "documento de referencia, fuera del repositorio del proyecto", línea 1650) | Fuente de materialidad, forma, proporción, jerarquía visual y paleta. **No se leyó como especificación funcional.** |
| `brand/manifest.json` | — | Confirma qué archivos están bajo verificación de hash. |
| `src/design-system/tokens.css` | Implementación (no decide identidad, la implementa — comentario propio en `tokens.css:32-41`) | Confirma la regla de paleta única y el mapeo semántico de color. |
| `src/design-system/tokens.test.ts` | Prueba ejecutable | Confirma por aserción que no hay redeclaración de color semántico en el bloque oscuro. |

### CANONICAL / REFERENCE del índice documental

| Fuente | Clasificación |
|---|---|
| `docs/architecture/structureco-datasheet.md` | `CANONICAL` |
| `docs/architecture/structureco-space-3d-s3d1.md` | `CANONICAL` |
| `docs/architecture/structureco-elastic-index.md` | `CANONICAL` |
| `brand/README.md` | `REFERENCE` (identidad visual oficial) |
| `validation/space3d/README.md` | `REFERENCE` |

### AUDIT/TEMPORARY — reportes de CRI-7 a CRI-9 (mergeados a `main`)

| Reporte | Commit de merge |
|---|---|
| `reports/2026-08-14-2330-cri-7-auditoria-ux-integral.md` + `reports/evidence/2026-08-14-cri-7-ux-audit/**` | `e9a406a` |
| `reports/2026-08-15-0130-cri-8-mapa-maestro-ux.md` + `reports/evidence/2026-08-15-cri-8-ux-map/**` (corrección D-07 en `cc586d5`) | `07f80b9` |
| `reports/2026-08-15-0400-cri-9-arquitectura-interaccion-adaptativa.md` + `reports/evidence/2026-08-15-cri-9-adaptive-architecture/**` (corrección U-14 en `7e9fb05`) | `d98006d` |

### AUDIT/TEMPORARY — reportes de CRI-10 (no mergeados, leídos vía `git show origin/research/cri-10-ux-system:<ruta>`)

- `reports/2026-08-15-0730-cri-10-sistema-ux-ui.md`
- `reports/2026-08-15-1015-cri-10-correccion-discoverability.md`
- `reports/2026-08-15-1230-cri-10-evolucion-tarjetas-velocidades.md`
- `reports/2026-08-15-1600-cri-10-reconciliacion-clay.md`
- `reports/2026-08-15-1900-cri-10-welcome-reconstruccion.md`
- `reports/2026-08-15-2100-cri-10-welcome-reestructura.md`
- `reports/2026-08-15-2330-cri-10-entrada-rediseno-total.md`
- `reports/2026-08-16-0100-cri-10-cierre.md`
- `reports/evidence/2026-08-15-cri-10-ux-system/competitive-research.md` — **ver nota de gobierno en `HANDOFF.md`: excede el marco REFERENCE-only.**

### PROTOTYPE_EVIDENCE — CRI-11 (no mergeado, leído vía `git show d2a4dbfa20c08f1e22206619ee4291794555546a:<ruta>`, aislado en `prototypes/cri-11-harness/**`)

- `reports/2026-08-15-2230-cri-11-fase-a-harness.md` + `reports/evidence/2026-08-15-cri-11-fase-a/**`
- `reports/2026-08-15-2300-cri-11-preview-publico.md`
- `reports/2026-08-16-0300-cri-11-fase-b-harness.md` + `reports/evidence/2026-08-15-cri-11-fase-b/**`
- `reports/2026-08-16-cri-11-fase-c-validacion.md` + `reports/evidence/2026-08-16-cri-11-fase-c/**` (incluye `metrics.json`, `validate-report.md`)
- `prototypes/cri-11-harness/src/**` (inventario de arquitectura vía `git ls-tree -r -l`, sin ejecutar el harness)

Confirmado por `git diff --stat origin/main d2a4dbfa20c08f1e22206619ee4291794555546a`: 97 archivos cambiados, ninguno bajo `src/**` — todo confinado a `prototypes/cri-11-harness/**`, `reports/**` y `reports/evidence/**`.

### HISTORICAL — cierre cromático (mergeado a `main`, ya ejecutado, no reabrir)

- `reports/2026-08-15-0500-cierre-cromatico-paleta-lima.md`, `reports/2026-08-15-0548-cierre-cromatico-correccion-vivida.md`
- `reports/evidence/2026-08-15-palette-closure/**`, `reports/evidence/2026-08-15-palette-closure-v2/**`
- Commits `74dfc76` (paleta lima única Día/Noche), `f60eae5` (sube croma), `7fb927f` (Component Lab por defecto en paleta oficial)

## Qué no se hizo

- No se ejecutó `npm run verify`, `npm test` ni ningún subconjunto masivo de pruebas; se citan pruebas existentes por lectura, no por corrida.
- No se modificó `src/**`, `brand/**` ni `src/design-system/tokens.css`.
- No se hizo checkout de `research/cri-10-ux-system` ni de las ramas `claude/cri-11-*`; se leyeron por `git show`.
- No se publicó en GitHub Pages ni se hizo merge.
