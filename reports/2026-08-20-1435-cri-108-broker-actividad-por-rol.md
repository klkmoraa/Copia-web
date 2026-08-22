# CRI-108 — El broker resuelve actividad por rol de superficie, no por «la última activación gana»

**Fecha:** 2026-08-20 14:35
**Agente:** Claude Code
**Rama:** claude/datasheet-contextual-actions-k0-71sdgd
**Issue:** [CRI-108](https://linear.app/klkmoraa/issue/CRI-108) · padre CRI-88 · reconcilia CRI-94, CRI-97, CRI-102, CRI-107
**Baseline:** `origin/main` = `02430db3a5c8589ce9428acd0a3a6638bffd51f1` (verificado con `git rev-parse origin/main`, no de memoria)

---

## 1 · Reproducción sobre `main` limpio, antes de tocar nada

### 1.1 Estado del broker

`resolveSurfaceActivity('K0', state)` sobre el baseline:

| paso | `datasheet` | `contextualActions` | `validateSurfaceCombination` |
| -- | -- | -- | -- |
| Datasheet abierto | `active` · `default` · `fullscreen` | `closed` | `[]` |
| se selecciona una fila | **`suspended`** · `default` | `active` · `inset` | `[]` |
| `setSurfaceExtent('datasheet','peek')` | **`suspended`** · `peek` | `active` | `[]` |
| X2 / M1, mismo estado | `active` · `drawer` | `active` | `[]` |

Dos cosas a la vez: el fallo, y un validador que lo daba por bueno.

### 1.2 Navegador real (Chromium, app construida, 60 nudos / 54 barras)

Mismo guion en las dos orientaciones de K0. Evidencia en
`reports/evidence/2026-08-20-datasheet-contextual-actions-k0/before/`.

| paso | montado | visible | `extent` | scroll | fila | borrador | `inert` | foco |
| -- | -- | -- | -- | -- | -- | -- | -- | -- |
| abrir Datasheet | sí | sí | `default` | 0 | 0 | — | `true` | `BUTTON` en el Datasheet |
| clic real en una celda | **no** | no | — | — | 0 | — | `false` | **`BODY`** |
| `Localizar` | — | — | — | — | — | — | — | *no hay botón alcanzable* |
| restaurar | — | — | — | — | — | — | — | *no hay asa de `peek`* |

Idéntico en 390×844 y en 844×390. Seleccionar una fila **hacía desaparecer el
Datasheet**: `ModalSurface` renderiza `{open ? … : null}` y `WorkspaceShell`
pasa `open={datasheet.status === 'active'}`, así que suspender **desmonta el
DOM**. Con la superficie se iban el carril contextual, `Localizar`, el asa de
`peek` y el foco. El ciclo D-11 completo era inalcanzable en K0.

Corroboración independiente y anterior: `scripts/qa-datasheet-k0.mjs` (CRI-107)
ya documentaba este defecto en dos comentarios y **evitaba K0** para poder
ejercer el ciclo de `peek` en X2.

---

## 2 · Causa raíz

`src/features/workspace/surfacePresentation.ts`, en `resolveSurfaceActivity`:

```ts
const compactWinner = shellClass === 'K0' ? latest(open, state) : undefined;
```

En K0 **todas** las superficies abiertas competían como iguales y ganaba la
última activación. `contextual-actions` es la única superficie del registro cuya
apertura **no es un acto del usuario**: se deriva enteramente de la selección
(CRI-97, `StructuralCanvas.tsx`), de modo que un efecto de selección desbancaba
a la herramienta modal que el usuario estaba usando.

La tabla clase→presentación ya distinguía los roles —`fullscreen`/`drawer` para
las herramientas, `sheet` para las capas, `inset` para el zócalo— pero la
resolución de actividad no la leía.

---

## 3 · Política aplicada

**Clases de actividad explícitas por rol de superficie.** Una tabla, en el
broker, junto a la de presentación:

| clase | superficies | cómo compite |
| -- | -- | -- |
| `tool` | `datasheet`, `doctor`, `dense` | ocupa la ranura contextual de Compact; se resuelve por última activación |
| `layer` | `detail`, `analysisSetup`, `view`, `results`, `palette`, `candidatePicker` | idem |
| `derived` | `contextualActions` | **no compite**: nunca reclama la ranura ni suspende a nadie; activa mientras el lienzo sea alcanzable |

En K0 el ganador se calcula sólo entre las que ocupan la ranura, y la derivada
se resuelve aparte: activa si no hay ocupante, o si el ocupante está en `peek`
—que sigue ocupando la ranura pero ya no tapa el lienzo—. Es el mismo criterio
con el que el proveedor levanta el `inert` del fondo en `peek`, no un concepto
nuevo.

`tool` y `layer` **no** tienen rango entre sí: abrir el Picker o una hoja encima
de una herramienta es un acto del usuario y debe seguir ganando. Lo único que
cambia es que una apertura *derivada* ya no puede.

`validateSurfaceCombination` se reconcilió con R-1: la regla cuenta **capas
contextuales**, no superficies activas —el zócalo derivado es una excepción
declarada, como `status` y `transient` en CRI-94— y se le añadió la recíproca:
una superficie derivada activa detrás de algo que tapa el lienzo es un error,
porque quedaría enfocable bajo un fondo `inert`.

X2 y M1 no tienen ranura única: allí nada cambia.

**La tabla clase→presentación no se tocó.** No hay CSS, ni `z-index`, ni
temporizadores, ni reapertura del Datasheet, ni efectos cruzados, ni doble
estado, ni segundo broker, ni umbrales por ancho.

### Efecto derivado en el lienzo

Se retiró de `StructuralCanvas.tsx` el efecto que re-activaba el Candidate
Picker en K0 para ganarle la carrera de activación al zócalo. La precedencia es
ahora del broker y por rol, en **cualquier** orden de apertura, con prueba en
los dos órdenes. Era exactamente el patrón de «componentes peleándose» que esta
issue tenía que eliminar.

---

## 4 · Estado después

### 4.1 Broker

| paso | `datasheet` | `contextualActions` |
| -- | -- | -- |
| Datasheet abierto | `active` · `default` · `fullscreen` | `closed` |
| se selecciona una fila | **`active`** · `default` | `suspended` (retenido) |
| `Localizar` → `peek` | **`active`** · `peek` | `active` |
| restaurar | `active` · `default` | `suspended` |
| cerrar Datasheet | `closed` | `active` (se reanuda) |

`validateSurfaceCombination` en verde en todos los pasos.

### 4.2 Navegador real — K0 portrait 390×844 y landscape 844×390

Evidencia en `reports/evidence/2026-08-20-datasheet-contextual-actions-k0/after/`
(mismo guion que el «antes») y, ya como regresión permanente, en la sección 3 de
`scripts/qa-datasheet-k0.mjs`.

| paso | montado | `extent` | scroll | fila | borrador | `inert` | foco | hit-test del lienzo |
| -- | -- | -- | -- | -- | -- | -- | -- | -- |
| abrir | sí | `default` | 0 | 0 | — | `true` | en el Datasheet | Datasheet |
| seleccionar fila | **sí** | `default` | — | 1 | — | `true` | `TD` del Datasheet | Datasheet |
| editar celda sin aplicar + desplazar | sí | `default` | 240 | 1 | `7.5` | `true` | `INPUT` del Datasheet | Datasheet |
| `Localizar` | sí | **`peek`** | (rejilla plegada) | 1 | `7.5` | **`false`** | `svg` del lienzo | **`circle`** del lienzo |
| restaurar | sí | `default` | **240** | 1 | **`7.5`** | **`true`** | en el Datasheet | Datasheet |

* **No desaparece al seleccionar.**
* **Borrador**: `7.5` ni se aplica ni se descarta en ningún paso (T-INV-8).
* **Scroll**: 240 antes de `Localizar`, 240 al restaurar.
* **Fila/selección**: intacta en todo el ciclo.
* **`inert`**: `true` → `false` en `peek` → `true` al restaurar. Nunca pegado.
* **Foco**: nunca en `BODY`, nunca dentro de `[inert]`, nunca en un elemento de
  altura 0.
* **Lienzo en `peek`**: el hit-test devuelve geometría del lienzo, no la hoja.

### 4.3 Candidate Picker

Verificado en el navegador, en las dos orientaciones de K0, con la hoja en
`peek`: tocar el lienzo abre el Picker, que **sí** tiene derecho a la ranura
contextual (R-1).

* el Picker toma la ranura; el zócalo derivado **no** aparece encima;
* nunca hay dos capas contextuales activas;
* `Escape` cierra **sólo** el Picker;
* al cancelarlo, la hoja vuelve a su `peek` **con su fila y su borrador
  intactos** — la sustitución no la destruyó (CRI-94).

A nivel de broker, además, la precedencia del Picker sobre el zócalo se prueba
en los **dos** órdenes de apertura, que es lo que antes dependía de un efecto en
el componente.

### 4.4 Model Doctor

`npm run qa:model-doctor-peek` — 21/21 en verde en X2, K0 portrait y K0
landscape: `Doctor → Localizar → peek → lienzo → restaurar`, conservando la lista
de hallazgos (4), sin `inert` pegado y sin foco huérfano. No se tocaron reglas de
diagnóstico, stale, reconocimiento, solver ni modelo.

### 4.5 X2 / M1

Sin cambio de comportamiento, verificado por prueba unitaria y por el smoke de
`qa:datasheet-k0`: los carriles residentes y el zócalo siguen conviviendo con la
herramienta modal, y `peek` en X2 sigue igual.

---

## 5 · Gates

| gate | resultado |
| -- | -- |
| `npx vitest run src/features/workspace src/features/datasheet src/features/canvas src/features/model-doctor` | **54 ficheros / 479 pruebas en verde** |
| `npm run typecheck` | **verde** |
| `npm run verify:protected` | **verde** — «Frontera protegida intacta: 38 archivos verificados», sin `--update` |
| `npm run qa:datasheet-k0` | **76/76 en verde** (38 antes de esta issue; +38 del ciclo K0 nuevo) |
| `npm run build` | **verde** |
| `npm run lint` | **verde**, 4 avisos preexistentes idénticos al baseline, en ficheros no tocados |
| `npm run qa:model-doctor-peek` | **21/21 en verde** |

No se corrió la suite completa.

### `qa:model-doctor` — fallo preexistente, no tocado

Falla en `enterWorkspace` (`scripts/qa-model-doctor.mjs:44`) esperando un botón
`/P.rtico de ejemplo/i` que la Bienvenida de CRI-104 ya no ofrece:

```
locator.waitFor: Timeout 30000ms exceeded.
  - waiting for getByRole('button', { name: /P.rtico de ejemplo/i }).first() to be visible
    at enterWorkspace (/home/user/structureco/scripts/qa-model-doctor.mjs:44:23)
```

**Reproducido idéntico sobre baseline limpio** (`git stash` de todo `src/` y
`scripts/`, HEAD en `02430db3`, sin ninguna modificación local). Es el fallo de
navegación posterior a CRI-104 que la issue anticipaba: previo y ajeno a este
cambio. **Ese QA no se ha modificado**, ni para conseguir verde ni por ningún
otro motivo. El ciclo de `peek` del Doctor queda cubierto entre tanto por
`qa:model-doctor-peek` y por la prueba de broker del rol `tool`.

> Nota de entorno: el contenedor no tiene el canal `chrome` del sistema, así que
> ambos QA se lanzan con `PLAYWRIGHT_EXECUTABLE_PATH=/opt/pw-browsers/chromium`,
> ruta que el propio script ya contemplaba. Eso no es el fallo descrito arriba:
> con el ejecutable resuelto, el guion arranca y falla después, en la navegación.

---

## 6 · Ficheros tocados

* `src/features/workspace/surfacePresentation.ts` — tabla de clases de actividad
  por rol, resolución por ranura contextual, validador reconciliado con R-1.
* `src/features/workspace/surfacePresentation.test.ts` — pruebas de broker
  nuevas (ver abajo) y la del Picker reescrita para los dos órdenes.
* `src/features/canvas/StructuralCanvas.tsx` — retirado el efecto de
  re-activación del Picker, que la política del broker subsume.
* `scripts/qa-datasheet-k0.mjs` — sección 3 nueva: el ciclo D-11 completo en K0
  portrait y landscape, más el caso del Candidate Picker; corregidos tres
  comentarios que describían el defecto como vigente.
* `scripts/qa-model-doctor-peek.mjs` + entrada `qa:model-doctor-peek` — smoke del
  ciclo del Doctor mientras `qa:model-doctor` no alcance la Mesa.

### Pruebas de broker añadidas

1. una clase de actividad explícita por superficie, y `contextualActions` como
   la única derivada;
2. K0 · `contextual-actions` no roba la actividad al Datasheet en `default`;
3. K0 · `Localizar` deja `active` + `peek`, nunca `suspended`, con las dos
   superficies retenidas;
4. K0 · restaurar devuelve a `default`; cerrar reanuda la siguiente superficie;
5. K0 · una capa contextual **sí** desbanca al Datasheet — la precedencia es por
   rol, no una excepción para el Datasheet;
6. K0 · el Model Doctor tiene el mismo ciclo, por tener el mismo rol;
7. X2/M1 sin cambio, `peek` incluido;
8. el validador denuncia una derivada activa detrás de algo que tapa el lienzo;
9. el Picker gana al zócalo en los **dos** órdenes de apertura.

---

## 7 · Fuera de alcance, respetado

Sin tocar: solver, `ProjectModel`/schema, análisis estructural, IndexedDB,
virtualización, diseño visual, Clay, la tabla clase→presentación, las reglas de
diagnóstico, stale y reconocimiento del Doctor.

**CRI-93 sigue In Progress / BLOCKED** por falta de dispositivo físico; no se ha
tocado. **CRI-105 no se ha empezado.** No se corrigieron hallazgos ajenos.

## 8 · Rollback

Revertir el commit. Es política de resolución de actividad del broker: sin
migración, sin estado persistido nuevo, sin impacto en proyectos guardados ni en
`ProjectModel`.
