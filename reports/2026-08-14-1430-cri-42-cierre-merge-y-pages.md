# CRI-42 — cierre: merge a `main` y publicación en GitHub Pages

**Fecha:** 2026-08-14 14:30
**Agente:** Claude Code
**Rama:** `main` (merge de `crisdlm302/cri-42-p1-replantear-structural-health-como-demanda-elastica`)

## Qué cambió

CRI-42 queda cerrado y publicado. La lectura de demanda elástica de StructureCo
dejó de ser un medidor de «salud estructural» con semáforo y es ahora un
**Índice elástico estimado (η)** trazable, que sólo se publica cuando cada dato
que lo forma es verificable.

Merge `d6a9142` (no fast-forward) sobre `main`, con estos commits:

| Commit | Contenido |
|---|---|
| `4d82a55` | Contrato `available` / `unavailable`, procedencia, `reliability`, renombrado a `ElasticDemand`, tarjetas de Resumen e Inspector, mapa del lienzo, tokens, doc canónico. |
| `6fe77cc` | Cobertura `complete` / `partial` / `unavailable`, demanda axial sin W, escala continua con saturación declarada, miembros no evaluados visibles, causa de `limited`. |
| `54205fc` | `unreliable` deja de leerse como `limited` y de duplicar el botón del Doctor; la causa de confiabilidad respeta el idioma activo. |

Lo que desapareció y no debe volver: `Fy = 250 MPa` de reserva, `W` del
rectángulo equivalente `√(12·I/A)`, el estado `safe`, el umbral 0,85, el semáforo
verde/ámbar/rojo, las bandas por tercios y el `role="meter"` con
`aria-valuenow > aria-valuemax`.

## Por qué

Tarea CRI-42 (P1) en Linear, más dos rondas de revisión del usuario. El problema
de fondo era que la lectura tenía apariencia de verificación normativa sin serlo:
publicaba un ratio con datos inventados cuando el modelo no los tenía, lo
clasificaba como «seguro» y marcaba un umbral de aviso sin derivación técnica.

## Archivos tocados

Consolidado en los tres reportes de detalle:

- [Contrato y presentación](2026-08-14-1250-cri-42-indice-elastico-estimado.md)
- [Cobertura, axial sin W y escala continua](2026-08-14-1400-cri-42-cobertura-escala-continua.md)
- [`unreliable` ≠ `limited` e idioma de la causa](2026-08-14-1415-cri-42-unreliable-e-idioma-de-causa.md)

Contrato canónico: [Índice elástico estimado](../docs/architecture/structureco-elastic-index.md).

## Cómo verificar

### Gates ejecutados

```bash
npx vitest run src/features/results src/features/inspector src/features/canvas src/design-system src/i18n --maxWorkers=1
```

48 archivos / 349 tests en verde. `npx tsc -b --noEmit` y `npx oxlint src`
limpios. `node scripts/check-docs.mjs`: 27 documentos clasificados, 0 problemas.
`npm run build` correcto.

### Publicación

- `main` empujado: `8ef771d..d6a9142`.
- `gh-pages` empujado: `d9a1572..03a5db3`, con el `dist/` de `d6a9142` más
  `.nojekyll`.
- GitHub Pages: build `03a5db3` en estado **`built`** (15,4 s, sin error).
- `https://klkmoraa.github.io/structureco/` responde **200**; los assets del
  build (`index-CsUwpgL6.js`, `WorkspaceShell-QjEeHTJH.js`) responden **200**.

### CRI-42 en el sitio publicado

Comprobado sobre el bundle servido por Pages y sobre la página en ejecución:

- Presentes: `Índice elástico estimado` / `Estimated elastic index`,
  `Cobertura parcial`, `Demanda puramente axial`, `Rampa saturada`,
  `Control que lo impide`, `Numerical condition of the system`,
  `elastic-demand-card`, `elastic-index-scale`, `canvas-demand-legend`,
  `--sc-color-demand-reference-peak`, `is-unevaluated`.
- Ausentes: `Structural Health`, `structural-health`, `Régimen elástico holgado`,
  `Umbral de aviso (85%)`, `healthSafe`, `Magnitud baja`,
  `límite elástico supuesto`.

En `https://klkmoraa.github.io/structureco/` con el pórtico de ejemplo:

- Sin identidad de catálogo ⇒ `status="unavailable"`, «0 de 1 miembros
  evaluados», «Falta Fy…», «Falta W…» y la acción de localizar el miembro.
- Con A992 + IPE 300 ⇒ `status="available"`, `coverage="complete"`,
  `η 0.04 · 4 % de Fy de referencia`, «Mayor índice del modelo · miembro AB».
- Leyenda del mapa: «η 0 · η 1 · η 2+ · La rampa crece con la magnitud de η. La
  marca de η 1 es el Fy declarado del material, no un criterio normativo. 1 de 1
  miembros evaluados.»; el miembro lleva `data-elastic-index="evaluated"` y
  `data-demand-ratio="0.044"`.
- `document.querySelectorAll('[role="meter"]').length === 0`.

## Pendiente / siguiente paso

- **`NumericQualityCard` sigue publicando `reliability.governing.message` y la
  lista `reasons` en español fijo.** Superficie anterior a CRI-42, fuera de su
  alcance; `reasons` mezcla además mensajes de incidencias del solver sin forma
  estructurada que traducir. `src/features/results/reliabilityCopy.ts` ya existe
  para resolverlo por separado.
- La rama `crisdlm302/cri-42-p1-…` sigue publicada en `origin`; puede borrarse
  cuando se quiera.
- CRI-45 (módulo de diseño por norma) es lo que aportaría una comprobación real
  con criterio y código; CRI-42 deliberadamente no la hace.
