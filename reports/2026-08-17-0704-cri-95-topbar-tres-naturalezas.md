# CRI-95 — TopBar reducida a tres naturalezas, piso Compact y causa enfocable (D-14)

**Fecha:** 2026-08-17 07:04
**Agente:** Claude Code
**Rama:** claude/topbar-cri-95-simplify-zi23gm

## Qué cambió

- `TopBar.tsx` pasa de tres zonas `document` / `context` / `actions` a exactamente
  las tres naturalezas del issue: `document` (identidad), `actions` (acción
  global — incluye ahora el contexto de análisis como clúster interno, junto
  al comando que gobierna, D-09) y `status` (estado — Model Doctor, `Estado`
  del análisis, y un nuevo chip de persistencia visible en la Cinta).
- El chip de persistencia (`.autosave-state`, CSS que ya existía sin usarse)
  se renderiza por primera vez en la barra principal; su duplicado en «Más
  acciones» deja de llevar `aria-live` para no duplicar el anuncio.
- Se cerró una regresión real encontrada al escribir la prueba de Compact:
  `.topbar-command-button { display:none }` por debajo de 1023px ocultaba
  **Model Doctor entero** en Compact — exactamente lo que D-14/CRI-95 prohíbe.
  Se retiró esa regla; el botón ya colapsaba a icono con etiqueta accesible
  desde antes, así que no se retira ninguna capacidad.
- Orden de degradación implementado en ese orden exacto: persistencia (icono
  en K0, oculta bajo 460px) → Datasheet/Space3D/Export (ocultos bajo 700px,
  con ruta completa en «Más acciones», incluyendo una entrada de Datasheet
  que no existía) → nombre de proyecto (trunca visualmente, `value` completo
  intacto). `Estado` y `Doctor` nunca pierden visibilidad ni etiqueta.
- `ResultsPanel.tsx`: la causa gobernante de fiabilidad (línea 316, antes
  `title={reliability?.governing?.message}`) pasa a un `Popover` enfocable
  (mismo componente ya usado en el design system) con la estructura *qué /
  por qué / qué hacer*, usando la copia ya localizada de `reliabilityCopy.ts`
  para el «por qué» y dos claves nuevas para el «qué hacer». No se tocó el
  resto de Results.
- `src/i18n/catalogs.ts`: 6 claves nuevas en ES y EN
  (`reliability.governingCauseLabel`, `causeWhatHeading`, `causeWhyHeading`,
  `causeNextHeading`, `nextStepsLimited`, `nextStepsUnreliable`).
- `scripts/qa-topbar.mjs`: zonas renombradas a `document`/`actions`/`status`;
  se añadió un barrido de anchos Compact (360–1023px) y de landscape/portrait
  con el nombre de proyecto más largo en ES y EN, afirmando en cada uno que
  Model Doctor y Estado siguen visibles con nombre accesible. También admite
  `QA_LOCAL_CHROMIUM_PATH` como alternativa al canal `chrome` del sistema
  (útil en sandboxes sin Chrome instalado; el comportamiento por defecto no
  cambia).
- Tests actualizados/añadidos en `TopBar.test.tsx` (zonas, chip de
  persistencia sin `aria-live` duplicado, Doctor+Estado en la misma zona
  protegida) y `ResultsPanel.test.tsx` (causa gobernante enfocable por Tab,
  contenido qué/por qué/qué hacer, cero `title` como única fuente, cero
  duplicado de `aria-live`, mockeando `resolveReliability` para no depender
  de un mal condicionamiento real del solver).

## Por qué

CRI-95 (Linear), bloqueada por CRI-89 (ya integrada en `main`). El objetivo es
que la Cinta diga sólo tres cosas — identidad, acción global, estado — y que
`Estado`/`Doctor` sean intocables en Compact, con la causa de fiabilidad
alcanzable por teclado y touch, no sólo por `title`.

## Archivos tocados

- `src/features/topbar/TopBar.tsx`
- `src/features/topbar/TopBar.test.tsx`
- `src/features/results/ResultsPanel.tsx`
- `src/features/results/ResultsPanel.test.tsx`
- `src/i18n/catalogs.ts`
- `src/styles.css`
- `scripts/qa-topbar.mjs`

## Cómo verificar

```bash
npx vitest run src/features/topbar src/features/results
npm run typecheck
npm run build
QA_LOCAL_CHROMIUM_PATH=/opt/pw-browsers/chromium node scripts/qa-topbar.mjs   # o `npm run qa:topbar` con Chrome del sistema
npm run lint
```

Los cuatro primeros y el lint corrieron en verde en esta sesión. Capturas de
Compact portrait/landscape en ES/EN, Día/Noche, con el nombre de proyecto más
largo, adjuntas como evidencia en el issue de Linear.

## Pendiente / siguiente paso

- **Fuera de alcance, detectado al auditar `title=`**: `ResultSummary.tsx:80`
  usa `title={scenario.failureReason}` como única explicación de por qué un
  escenario de la comparación de envolvente no resolvió. Es el mismo patrón
  que D-14 cierra, pero es una causa distinta (comparación de escenarios, no
  la fiabilidad gobernante) y vive dentro de Results — no se tocó para
  respetar "no rediseñes Results". Candidato a una issue de accesibilidad
  separada.
- **Fuera de alcance**: el toast «Model Doctor encontró problemas» que
  dispara `WorkspaceShell.tsx` no se relocaliza si el idioma cambia después de
  emitido (se vio en las capturas EN). No es TopBar; no se tocó.
- No se inició CRI-100 ni se rediseñó Results más allá de la ruta de la causa
  gobernante exigida por el issue.
