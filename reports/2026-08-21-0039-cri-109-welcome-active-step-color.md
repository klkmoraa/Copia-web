# CRI-109 — Welcome: el índice del paso activo usa tinta oscura sobre relleno oscuro

**Fecha:** 2026-08-21 00:39
**Issue:** [CRI-109](https://linear.app/klkmoraa/issue/CRI-109/welcome-el-indice-del-paso-activo-pone-tinta-oscura-sobre-relleno)
**Clasificación:** AUDIT/TEMPORARY (evidencia de cierre de slice)

---

## Baseline

`origin/main` = `84830d6d24f443afcfcf31c4d2d6c3106870c2c9` — confirmado con `git fetch origin && git rev-parse origin/main`.
Coincide con el baseline esperado por el encargo. La rama parte exclusivamente de ahí
(`git checkout -B claude/cri-109-welcome-active-step-nygxo4 origin/main`).

## Reproducción roja (antes)

```
$ npx vitest run src/design-system/tokens.test.ts --maxWorkers=1
 Test Files  1 failed (1)
      Tests  1 failed | 28 passed (29)

 FAIL  src/design-system/tokens.test.ts > Phase 4 design-token contract
       > never puts white ink on the light brand fill
 ❯ src/design-system/tokens.test.ts:238:30
    238|     expect(componentCss).not.toMatch(/background:\s*var\(--accent\)/);
```

Existe **exactamente** el fallo conocido de `--accent`, y ninguno más.
`grep` sobre `componentCss` (`styles.css` + `material.css`) devuelve **una sola**
ocurrencia de `background:var(--accent)`, y es justo el consumidor de CRI-109:

```
src/styles.css:4991:.welcome-step.active .welcome-step-index { background:var(--accent); … }
```

## Alias: el incorrecto y el correcto

Reparto verificado en `src/design-system/tokens.css` §9 (líneas 678-688) y contra el
Brandbook canónico `brand/brandbook-clay.html` — no se asumió el arreglo propuesto en la issue,
se confirmó primero.

| Alias | Rol semántico | HEX | Papel |
| --- | --- | --- | --- |
| `--accent` | `--sc-color-action-ink` → `--sc-mint-700` | `#087E5C` | **Alias histórico de trazo/tinta.** Brandbook: «Brand stroke · canto, trazo, snap y hover técnico». No es relleno. |
| `--accent-fill` | `--sc-color-action-primary` → `--sc-mint-500` | `#1AA57A` | **Relleno de acción.** Brandbook: «Brand fill · action». |
| `--accent-foreground` | `--sc-color-action-foreground` → `--sc-mint-ink` | `#02140F` | **Tinta medida contra el relleno.** Brandbook: «tinta sobre rellenos de marca». |

El comentario de `tokens.css` es explícito: «`--accent` es el alias histórico de trazo/tinta…
El relleno vive en `--accent-fill` y sólo puede llevar `--accent-foreground`, medido en todos sus estados.»

- **Alias incorrecto usado:** `--accent` (`#087E5C`, trazo) como `background`.
- **Alias correcto:** `--accent-fill` (`#1AA57A`), que es contra el que `--accent-foreground` está medido.

Ninguno de los tres roles se redefine en `:root[data-theme='dark']` — un HEX por significado,
idéntico en Día y Noche. Por eso el defecto y su corrección son idénticos en ambos temas.

## Diff exacto

Un token, una línea, un archivo.

```diff
diff --git a/src/styles.css b/src/styles.css
@@ -4988,7 +4988,7 @@
   background:var(--accent-soft);
   border-color:color-mix(in srgb, var(--accent) 42%, var(--border));
 }
-.welcome-step.active .welcome-step-index { background:var(--accent); color:var(--accent-foreground); border-color:transparent; }
+.welcome-step.active .welcome-step-index { background:var(--accent-fill); color:var(--accent-foreground); border-color:transparent; }
 .welcome-step--table { color:var(--text); border-color:var(--border); background:var(--surface); }
```

`git diff --stat` → `src/styles.css | 2 +-` · 1 archivo, 1 inserción, 1 borrado.

## Contraste medido REAL (no copiado del Brandbook)

Medido dos veces por vías independientes: (a) cálculo WCAG 2.x sobre los HEX resueltos a mano,
(b) `getComputedStyle` en Chromium sobre la app construida, leyendo el color **resuelto** del
elemento real. Ambas coinciden.

### El índice del paso activo — tinta sobre relleno

| Tema | Foreground resuelto | Background resuelto | Ratio | Umbral texto | Veredicto |
| --- | --- | --- | --- | --- | --- |
| **Día** | `rgb(2, 20, 15)` = `#02140F` | `rgb(26, 165, 122)` = `#1AA57A` | **6.04:1** | ≥ 4.5:1 | **PASS** |
| **Noche** | `rgb(2, 20, 15)` = `#02140F` | `rgb(26, 165, 122)` = `#1AA57A` | **6.04:1** | ≥ 4.5:1 | **PASS** |

**Antes del cambio** (el defecto, medido): `#02140F` sobre `#087E5C` = **3.74:1** en Día y en Noche
— por debajo del suelo de 4.5:1 para texto. Ése es el fallo real, cuantificado.

Mejora: **3.74:1 → 6.04:1** en ambos temas.

### Estados no tocados (verificados intactos)

| Estado | Tema | fg / bg resueltos | Ratio |
| --- | --- | --- | --- |
| Inactivo (pasos 2 y 3) | Día | `rgb(96,112,104)` / `rgb(247,244,238)` | 4.76:1 |
| Inactivo (pasos 2 y 3) | Noche | `rgb(166,182,176)` / `rgb(21,35,43)` | 7.60:1 |
| Paso 4 · Mesa (`--table`) | Día | `rgb(96,112,104)` / `rgb(247,244,238)` | 4.76:1 |
| Paso 4 · Mesa (`--table`) | Noche | `rgb(166,182,176)` / `rgb(21,35,43)` | 7.60:1 |

## Verificación visual

Capturas y mediciones en `reports/evidence/2026-08-21-cri-109/`
(`capture.mjs`, `measurements.json`, `rail-*.png`, `welcome-*.png`).

Matriz: **Día × Noche × X2 (1440×900) × K0 retrato (390×844)**, `deviceScaleFactor: 2`,
sobre el build de producción servido por `vite preview`, usuario nuevo (IndexedDB vaciada).

| Comprobación | Resultado |
| --- | --- |
| Fondo correcto | El índice activo pinta `rgb(26,165,122)` = `--accent-fill` en las 4 combinaciones |
| Texto legible | 6.04:1 en las 4 combinaciones; el dígito se lee sin esfuerzo en ambas capturas |
| Foco visible y separado del canto | `outline: 3px solid rgb(106,93,242)`, `outline-offset: 2px` — anillo, no elevación, separado del borde |
| Inactive intacto | Pasos 2 y 3 sin cambio: `--surface-2` / `--muted`, canto `--border-soft` |
| Complete / paso 4 intacto | No existe estado `complete` en el carril (verificado por `grep`): los estados son inactive / active / `--table`. `.welcome-step--table` sin cambio |
| Sin overflow | `rail.scrollWidth > clientWidth` → false; `document.scrollWidth > clientWidth` → false, en las 4 |
| Gramática Clay de CRI-105 | Sin regresión: no se tocó radio, canto, sombra ni ritmo; el diff no contiene ninguna de esas propiedades |

Tamaño del índice: 20×20 px en X2, 18×18 px en K0 retrato — el mismo de antes; el objetivo táctil
lo aporta el `.welcome-step` contenedor (`min-height:40px`), no el índice.

## Conflicto abierto para CRI-106 (no resuelto aquí, no se inventó ningún HEX)

La **silueta** del índice —su relleno contra el fondo de la píldora activa (`--accent-soft`)— es
un límite no textual y **no cumple 3:1 en uno de los dos temas, ni antes ni después**:

| | Día | Noche | Peor caso |
| --- | --- | --- | --- |
| Antes (`--accent` `#087E5C`) | 4.44:1 | 2.76:1 | **2.76:1** |
| Después (`--accent-fill` `#1AA57A`) | 2.76:1 | 4.46:1 | **2.75:1** |

El peor caso entre temas queda **igual dentro del redondeo** (2.76 → 2.75): el cambio no introduce
regresión, sólo desplaza de tema el borde flojo. La causa es que `.welcome-step.active
.welcome-step-index` lleva `border-color:transparent`, así que la silueta depende sólo del relleno.

**No se toca aquí**: corregirlo exige o devolver un canto medido al índice o mover un valor, y ambas
cosas caen en el gate de accesibilidad real. **Queda registrado como entrada para
[CRI-106](https://linear.app/klkmoraa/issue/CRI-106).** El umbral aplicable a CRI-109 —tinta legible
sobre el relleno, ≥4.5:1— sí se cumple (6.04:1), por lo que CRI-109 cierra en verde.

## Gates

| Gate | Antes | Después |
| --- | --- | --- |
| `npx vitest run src/design-system/tokens.test.ts --maxWorkers=1` | **1 failed \| 28 passed (29)** | **29 passed (29)** — 0 failed |
| `npx vitest run src/design-system --maxWorkers=1` | — | **13 files passed · 104 passed (104)** |
| `npm run typecheck` | — | verde (`tsc -b --noEmit`, exit 0) |
| `npm run lint` | — | verde (`oxlint`, exit 0; sólo los 4 warnings preexistentes de `react(only-export-components)`) |
| `npm run verify:protected` | — | verde — «Frontera protegida intacta: 38 archivos verificados» |
| `npm test` | — | **224 files passed · 2244 passed \| 8 skipped (2252) — 0 failed** |

`npm test` en **0 failed**, como se esperaba: CRI-111 retiró los 17 fallos de `App.test.tsx`,
CRI-110 el del Candidate Picker, y este slice retira el último, el de `tokens.test.ts`.
**No apareció ningún fallo nuevo**, así que no hubo nada que atribuir ni a regresión ni a baseline.

## Confirmaciones de alcance

- **Cero HEX modificados.** `git diff -U0 | grep -E '#[0-9a-fA-F]{3,8}'` sobre las líneas
  añadidas/borradas → sin coincidencias. El diff sustituye un nombre de variable por otro.
- **Cero tokens de color modificados.** `tokens.css`, `tokens.test.ts` y `material.css` no aparecen
  en `git diff --name-only`. `tokens.test.ts` **no se relajó**: pasa tal cual está en `main`.
- **Welcome no fue rediseñada.** El único selector tocado es
  `.welcome-step.active .welcome-step-index`. Intactos: los cuatro pasos y su rótulo, el layout,
  recents, recovery, autoskip del usuario recurrente, el portal clay, la navegación, las puertas
  (importar, DXF, ejemplos, Aula, Space3D) y `WelcomeScreen.tsx` — que no se abrió para editar.
  La captura `welcome-dark-X2.png` lo muestra completo y sin cambios estructurales.
- **CRI-105 sin regresión**: no se tocó radio, canto, sombra, fuente de luz ni ritmo de espaciado.
- **CRI-106 no se empezó**: no se ejecutó su gate; sólo se midió el contraste necesario para
  demostrar que CRI-109 quedó corregida, y se le dejó registrado el conflicto de la silueta.
- **CRI-93 permanece In Progress / BLOCKED** — no se tocó.

## Cómo verificar

```bash
git checkout main && git pull
npx vitest run src/design-system/tokens.test.ts --maxWorkers=1   # 29 passed
npx vitest run src/design-system --maxWorkers=1                  # 104 passed
npm run typecheck && npm run lint && npm run verify:protected
npm test                                                         # 0 failed
npm run build && node reports/evidence/2026-08-21-cri-109/capture.mjs
```

## Pendientes

- **CRI-106** — silueta del índice activo contra `--accent-soft`: 2.76:1 (Día) tras el cambio,
  2.76:1 (Noche) antes. Límite no textual por debajo de 3:1 en un tema, con o sin este slice.
- **CRI-93** — sigue In Progress / BLOCKED, sin cambios.
- El remate visual general de Welcome sigue sin abrir: esta issue no lo era y no se convirtió en él.
