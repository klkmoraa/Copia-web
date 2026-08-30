# Cierre final de StructureCo — verificación, reconciliación e integración

**Fecha:** 2026-08-21 05:00
**Agente:** Claude Code
**Rama:** `claude/structureco-final-closure-907sov` → `main`
**Clasificación:** `AUDIT/TEMPORARY`
**Alcance:** sólo cierre. Sin rediseño, sin features, sin refactors, sin tocar solver/model/schema ni contratos estructurales.

---

## 1. Punto de partida

`git fetch origin` → `origin/main` en `c339af6fdd22e626baf8aa8a7eb60a42cb1d8cb6`
("CRI-112 · Welcome — carril y bandas"). Working tree limpio.

---

## 2. Inconsistencias de cierre detectadas

### 2.1 Gate documental rojo sobre `main`

`npm run verify:docs` fallaba con dos problemas: los documentos de CRI-94
`docs/superpowers/plans/2026-08-16-cri-94-surface-presentation-broker.md` y
`docs/superpowers/specs/2026-08-16-cri-94-surface-presentation-broker-design.md`
estaban clasificados `HISTORICAL` sin el aviso visible que exige
`scripts/check-docs.mjs`. **Preexistente**, no regresión de esta pasada.

### 2.2 Trabajo terminado sin integrar

| Rama | Issue | Estado Linear | Contenido |
|---|---|---|---|
| `research/cri-12-direction` | CRI-12, 83, 84, 85, 86, 87 | **Done** | `reports/cri-12/**` — nunca llegó a `main` |
| `research/cri-10-ux-system` | CRI-10 | **Backlog** | 8 informes + 44 láminas, congelado desde `aa63fa6` |
| `claude/cri-93-performance-measurement-2a5ewq` | CRI-93 | In Progress (BLOCKED) | evidencia + harness de medición |
| `claude/cri-106-accessibility-gate-4q3891` | CRI-106 | In Progress (BLOCKED) | evidencia del gate de accesibilidad |

El caso de CRI-12 era el más grave: es el contrato que gobierna toda la serie
CRI-89…CRI-112 y el spec de CRI-94 dejó constancia escrita de su ausencia
—*"las decisiones de CRI-12 se leyeron desde el snapshot Git `3d5c807` porque
`reports/cri-12/**` no está presente en el árbol de `main`"*—.

### 2.3 Tarea integrada marcada pendiente

CRI-10 seguía en Backlog con su entregable completo y congelado, y con todos sus
consumidores aguas abajo (CRI-11, CRI-12, CRI-89…112) ya cerrados.

---

## 3. Correcciones aplicadas

1. Aviso `HISTORICAL` añadido a los dos documentos de CRI-94, siguiendo la
   convención del resto del repositorio. Sin relajar el chequeo ni reclasificar.
2. Cuatro merges de integración: CRI-93, CRI-106, CRI-12 (A–E) y CRI-10.
3. CRI-10 movido a **Done** en Linear, con comentario de justificación.
4. Comentarios de reconciliación en CRI-12, CRI-93 y CRI-106.

**Verificación de no-regresión de producto:** `git diff c339af6..HEAD -- src/
public/ package.json vite.config.ts tsconfig.json` sale **vacío**. Las cuatro
integraciones son exclusivamente `reports/**` y `scripts/` de medición.
`verify:protected` reporta la frontera intacta con 38 archivos.

---

## 4. Gates ejecutados

| Gate | Resultado |
|---|---|
| `npm run typecheck` | 0 errores |
| `npm run lint` | 4 warnings preexistentes (`react/only-export-components`), 0 errores |
| `npm run verify:protected` | Frontera protegida intacta, 38 archivos |
| `npm run verify:docs` | 0 — 30 documentos clasificados, enlaces válidos (**estaba en rojo, ahora verde**) |
| `npm test` | 224 archivos, 2245 pasadas, 8 saltadas, exit 0 |
| `npm run build` | OK (warnings de chunk-size preexistentes) |
| `npm run verify:perf` | 861749 bytes / 223168 gzip, sin techo bloqueante |
| `npm run validate:ci` | 2 workflows sin problemas |
| `npm run verify:space3d` | Capacidad aprobada: 150 nudos / 300 barras |

Ningún test relajado, ningún umbral tocado, ningún skip añadido.

---

## 5. Deliberadamente NO integrado

- `claude/cri-11-fase-{a,c}-*` — añaden `prototypes/cri-11-harness/**`, un
  subproyecto vendorizado con su propio `package-lock.json`. CRI-11 está Done y
  su resultado ya está capturado en la especificación de CRI-12. Integrarlo es
  trabajo real de integración con su propio gate, no higiene de cierre.
- `claude/structureco-motion-graphics-f14knb` (123 commits, subproyecto
  `video/` con Remotion) y `claude/motion-graphics-claymorphism-videos-1jseaf`.
- `claude/structureco-icon-system-6th5bd` — historia no relacionada, sin base de
  merge común con `main`.
- `gh-pages` — rama de publicación, no de desarrollo.

---

## 6. Bloqueos reales todavía abiertos

| Issue | Bloqueo | Naturaleza |
|---|---|---|
| CRI-106 | Sin lector de pantalla real y sin WebKit/Firefox | **Entorno**: contenedor headless sin sesión de escritorio; la política de red devuelve 403 en `cdn.playwright.dev` |
| CRI-93 | Sin dispositivo físico y sin segundo navegador real | **Entorno**: misma causa |
| CRI-116 | Gates QA (`npm run qa`) rotos por CRI-112 | **Trabajo real**, ya con issue propia |
| CRI-113, 114, 115, 117, 118 | Hallazgos de contraste, touch targets y clipboard | **Trabajo real**, ya con issue propia |

Ninguno es regresión de esta pasada y ninguno bloquea la sanidad de `main`:
los gates de `npm run verify` están todos en verde. Los gates QA de navegador
(`qa*`) son una suite aparte, no incluida en `verify`.

---

## 7. Estado de `main`

`main` queda sano y verificado: los nueve gates listados en §4 en verde, la
frontera protegida intacta, y el registro documental de CRI-10 y CRI-12
finalmente accesible desde `main` en lugar de depender de SHAs sueltos.

No se abrió trabajo nuevo. No se creó ninguna issue nueva: cada problema
encontrado en esta pasada o se corrigió como higiene de cierre, o ya tenía
issue abierta.
