# Rediseño claymorphism · Ciclo 2 (la mesa de trabajo) — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Llevar la materia claymorphism del ciclo 1 —hoy confinada a la bienvenida— a toda la mesa de trabajo: `WorkspaceShell`, `TopBar`, toolbars, canvas, inspector, panel de resultados, modales y menús. Sustituir el vidrio (`backdrop-filter`) por arcilla en toda la app, declarar la materia una sola vez y construir el arnés que puede verlo.

**Architecture:** Tres sitios para la materia. `src/design-system/tokens.css` sigue siendo la fuente de los tokens (se añade el rol del chrome del lienzo, se retiran los de vidrio). `src/design-system/components/ui.css` se migra *in situ* de sombras planas a clay (es lazy, junto al workspace). `src/design-system/material.css` (nuevo) declara la materia **una sola vez** por lista de selectores agrupada por rol de elevación, y se importa desde `App.tsx` **después** de `styles.css` — queda en el chunk de entrada y gana la cascada a todo `styles.css` sin `!important`, replicando el patrón que ya usa la capa AG-015 al final del propio `styles.css`. Cada tarea de vestido añade sus selectores a los grupos existentes de `material.css` y retira las declaraciones de materia equivalentes de `styles.css`.

**Tech Stack:** React 19, TypeScript ~6.0, Vite 8, Vitest 4 + @testing-library/react, oxlint, Playwright (`qa.mjs`, Chromium). CSS moderno con custom properties. **Sin dependencias nuevas.**

**Spec:** `docs/superpowers/specs/2026-08-07-claymorphism-ciclo2-design.md`

## Global Constraints

Todas las tareas heredan estas restricciones. Violarlas rompe el gate, no es una cuestión de estilo.

- **Frontera matemática protegida.** No modificar `src/engine/**`, `src/workers/**`, `src/data/**`, `src/store/ProjectContext.tsx` ni `src/types.ts`. `npm run verify:protected` debe pasar sin actualizar el baseline.
- **Sin dependencias nuevas.** `package.json` no cambia sus bloques `dependencies` / `devDependencies`.
- **Colores técnicos congelados.** No tocar `--sc-color-bg-canvas` ni ningún `--sc-color-technical-*`. Es el contrato medido en `docs/ux-redesign/COLOR_ACCESSIBILITY.md`, verificado por `tokens.test.ts`.
- **Radios densos congelados.** `--sc-radius-xs` … `--sc-radius-md` (8/12/14px) gobiernan campos numéricos, filas del inspector y tablas. No suben.
- **Nada de literales de color en CSS de componente.** `styles.css`, `ui.css` y el nuevo `material.css` no admiten `#hex` ni `rgb()`. `rgba()` sólo dentro de `box-shadow`, `drop-shadow`, `filter` o `background`. Lo impone `tokens.test.ts`.
- **Sin primitivas de color en CSS de componente.** Prohibido `var(--sc-green-500)` y equivalentes fuera de `tokens.css`.
- **Toda referencia `var(--sc-…)` debe resolver.** `tokens.test.ts` lo verifica sobre `styles.css`, `ui.css` **y `material.css`** desde la Tarea 2.
- **`npm run qa` no entra en `verify`**, pero ninguna tarea que toque materia se marca completa sin haberlo corrido y visto el resultado (build previo: `npm run build && node qa.mjs`).
- **Verificación por mutación obligatoria** en cada red nueva de `qa.mjs`: romper la CSS a propósito una vez, confirmar que el check falla, antes de dar la tarea por cerrada.
- **Sin `git push`** sin confirmación explícita del usuario. Repo compartido con Codex.

**Comandos:**

```bash
npx vitest run <ruta>       # un test
npm run lint                # oxlint
npm run typecheck           # tsc -b --noEmit
npm run verify               # gate completo
npm run build && node qa.mjs  # recorrido Chromium (no lo ejecuta verify)
```

---

### Task 1: Tokens del chrome, retirada del vidrio y material componible

Sienta la base: el rol de borde medido para el chrome del lienzo, la retirada de los tokens de vidrio (con su relajación de contrato), el fichero `material.css` con los tres niveles genéricos, y `Surface` ampliado para poder vestir botones.

**Files:**
- Modify: `src/design-system/tokens.css` (§2 roles día y bloque `dark`)
- Modify: `src/design-system/tokens.test.ts` (dos listas existentes, relajadas; un test nuevo)
- Create: `src/design-system/material.css`
- Modify: `src/App.tsx` (import de `material.css`)
- Modify: `src/design-system/components/surface.tsx` (`as` amplía a `button` / `header` / `nav`)
- Modify: `src/design-system/components/surface.test.tsx` (casos nuevos de `as`)
- Modify: `src/styles.css` (`.sc-surface`, líneas 29-54: retira materia, conserva forma)

**Interfaces:**
- Consumes: `--sc-shadow-clay-*`, `--sc-gradient-clay`, `--sc-clay-edge`, `--sc-color-surface-pressed`, `--sc-radius-xl` (ciclo 1, ya en `tokens.css`).
- Produces: `--sc-color-border-canvas-chrome` (día/noche), fichero `material.css` con los grupos `[data-level='flat'|'raised'|'floating']` y `[data-pressed='true']` — lo consumen las tareas 4-9. `SurfaceProps['as']` incluye `'button' | 'header' | 'nav'`.

- [ ] **Step 1: Escribir el test de contraste que falla**

En `src/design-system/tokens.test.ts`, dentro de `describe('Phase 4 design-token contract')`, añade al final (antes del cierre del `describe`):

```ts
  it('measures a canvas-chrome border that clears the non-text contrast floor in both themes', () => {
    // Nothing else does: --sc-color-border-strong is 1.96:1 against the canvas
    // in Day. Floating chrome (mode badge, zoom controls, quick-entry) needs
    // its own measured border or it becomes unreadable once the glass that
    // used to separate it from the drawing is gone.
    expect(contrast('--sc-color-border-canvas-chrome', '--sc-color-bg-canvas', lightTheme))
      .toBeGreaterThanOrEqual(3);
    expect(contrast('--sc-color-border-canvas-chrome', '--sc-color-bg-canvas', darkTheme))
      .toBeGreaterThanOrEqual(3);
  });
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npx vitest run src/design-system/tokens.test.ts`
Expected: FAIL — `Unknown token: --sc-color-border-canvas-chrome`.

- [ ] **Step 3: Añadir el rol en `tokens.css`, tema día**

En `:root`, justo debajo de la declaración de `--sc-color-border-strong` (línea 119), añade:

```css
  --sc-color-border-strong: #b9b6af;
  /* El chrome que flota sobre el lienzo (badge de modo, chips, zoom, quick-entry,
     tooltip de corte) no puede apoyarse en ningún rol de superficie o borde
     existente: --sc-color-border-strong mide 1,96:1 contra #fafcfb, y ningún otro
     rol llega a 1,3:1. Medido aparte, sin depender del desenfoque que antes lo
     separaba del dibujo. */
  --sc-color-border-canvas-chrome: #84817a; /* 3,77:1 sobre --sc-color-bg-canvas */
```

- [ ] **Step 4: Añadir el rol en el bloque `dark`**

En `:root[data-theme='dark']`, junto a la redeclaración de `--sc-color-border-strong` (línea 151 según el mapa previo), añade:

```css
  --sc-color-border-canvas-chrome: #5f6d68; /* 3,66:1 sobre --sc-color-bg-canvas */
```

- [ ] **Step 5: Ejecutar y verificar que pasa**

Run: `npx vitest run src/design-system/tokens.test.ts`
Expected: PASS, incluido el test nuevo.

- [ ] **Step 6: Retirar los tokens de vidrio de `tokens.css`**

Elimina de `:root` (líneas 350-356):

```css
  /* Vidrio: una superficie translúcida necesita saturar lo que hay detrás,
     o el desenfoque la deja lechosa. */
  --sc-surface-glass: color-mix(in srgb, var(--sc-color-surface-1) 72%, transparent);
  --sc-surface-glass-strong: color-mix(in srgb, var(--sc-color-surface-1) 88%, transparent);
  --sc-surface-glass-border: color-mix(in srgb, var(--sc-white) 66%, transparent);
  --sc-blur-glass: blur(20px) saturate(1.6);
  --sc-blur-chrome: blur(14px) saturate(1.3);
```

Elimina de `:root[data-theme='dark']` sus tres redeclaraciones (`--sc-surface-glass`, `--sc-surface-glass-strong`, `--sc-surface-glass-border`).

- [ ] **Step 7: Retirar los primitivos huérfanos**

Elimina de `:root` (líneas 90-93):

```css
  --sc-sky-100: #e2f2fd;
  --sc-sky-500: #5caee9;
  --sc-lilac-100: #eee8fc;
  --sc-lilac-500: #9677db;
```

**No borres `--sc-sky-100` ni `--sc-lilac-100`**: `--sc-color-accent-blue-soft` y `--sc-color-accent-violet-soft` los consumen (líneas 129-130). Elimina **solo** `--sc-sky-500` y `--sc-lilac-500` — confirmado sin consumidores por grep. Deja los dos `-100` y su comentario, ajustando el texto si ya no menciona los `-500`.

- [ ] **Step 8: Relajar las dos listas de `tokens.test.ts` que protegían el vidrio**

En `it('declares materials — glass, rings, glows and gradients — as tokens, not per-component literals', ...)` (línea 275), retira del array `materials`: `'--sc-surface-glass'`, `'--sc-surface-glass-border'`, `'--sc-blur-glass'`.

En `it('recalibrates every material Dark cannot inherit from Day', ...)` (línea 291), retira del array `recalibrated`: `'--sc-surface-glass'`, `'--sc-surface-glass-border'`.

Ambos tests deben seguir teniendo entradas (`--sc-ring-inset`, `--sc-glow-accent`, `--sc-glow-aula`, `--sc-shadow-lifted`, `--sc-gradient-*`), así que no quedan vacíos.

- [ ] **Step 9: Ejecutar el test de tokens completo**

Run: `npx vitest run src/design-system/tokens.test.ts`
Expected: PASS. Si falla `resolves every design token %s references`, algo en `styles.css` todavía referencia un token de vidrio retirado — no lo pasa esta tarea (ver Tarea 9), así que si aparece aquí, confírmalo con grep antes de continuar (no debería: los 6 consumidores viven en `.welcome-*` y esta tarea no los toca).

- [ ] **Step 10: Crear `material.css` con los niveles genéricos**

Crea `src/design-system/material.css`:

```css
/* La materia clay componible.
 *
 * Se declara UNA VEZ por rol de elevación, aplicada por lista de selectores.
 * Cambiar la materia es editar un bloque aquí, no perseguir siete reglas
 * repartidas por `styles.css`. Cada tarea de vestido añade sus propios
 * selectores al grupo que le corresponde.
 *
 * Se importa desde `App.tsx` DESPUÉS de `styles.css`, así que queda en el
 * chunk de entrada (nunca sufre el retraso del chunk lazy de `ui.css`) y
 * gana la cascada a todo `styles.css` sin necesitar `!important` — el mismo
 * mecanismo que ya usa la capa "AG-015 · Capa de materia" al final de
 * `styles.css`, sólo que en un fichero propio en vez de al final de uno
 * ajeno.
 *
 * Un elemento sólo tiene un valor de `data-level` a la vez, así que los tres
 * grupos de nivel no compiten entre sí — no hace falta ordenarlos por
 * especificidad. `[data-pressed='true']` sí puede coexistir con un nivel, y
 * por eso va al final: gana la cascada por orden de aparición cuando ambos
 * atributos están presentes en el mismo elemento.
 *
 * `Surface` (`design-system/components/surface.tsx`) emite `data-level` y
 * `data-pressed`. Cualquier otro selector puede sumarse a un grupo sin pasar
 * por `Surface`: por eso `[data-level='…']` genérico también engancha
 * marcado que no usa el componente React. */

/* flat: sin volumen. Zonas técnicas densas — tablas, filas del inspector,
   el lienzo. Es el nivel por defecto en esas zonas, no una excepción. */
.sc-surface[data-level='flat'],
[data-level='flat'] {
  background: var(--sc-color-surface-1);
  border: 1px solid var(--sc-color-border-soft);
  box-shadow: none;
}

/* raised: la superficie normal — paneles, barras, tarjetas. */
.sc-surface[data-level='raised'],
[data-level='raised'] {
  background: var(--sc-gradient-clay);
  border: var(--sc-clay-edge);
  box-shadow: var(--sc-shadow-clay-md);
}

/* floating: lo que se despega del plano — popovers, hojas, menús. */
.sc-surface[data-level='floating'],
[data-level='floating'] {
  background: var(--sc-gradient-clay);
  border: var(--sc-clay-edge);
  box-shadow: var(--sc-shadow-clay-floating);
}

/* pressed: invierte la iluminación. Coexiste con cualquier nivel — por eso
   va al final y sólo toca lo que un estado pulsado necesita cambiar. */
.sc-surface[data-pressed='true'],
[data-pressed='true'] {
  background: var(--sc-color-surface-pressed);
  box-shadow: var(--sc-shadow-clay-pressed);
}
```

- [ ] **Step 11: Importar `material.css` en `App.tsx`, después de `styles.css`**

En `src/App.tsx`, línea 9, después de `import './styles.css';`:

```tsx
import './styles.css';
import './design-system/material.css';
```

- [ ] **Step 12: Migrar `.sc-surface` en `styles.css` para consumir el material en vez de declararlo**

Sustituye en `src/styles.css`, líneas 29-53:

```css
/* Superficie clay (`Surface`, tarea 3 del ciclo 1). Vivía en
   `design-system/components/ui.css`, pero ese fichero sólo lo carga
   `WorkspaceShell.tsx` (lazy) — así que la bienvenida, que no es lazy y es
   la única que usa `<Surface>` hoy, no tenía esta materia en el primer
   pintado: dependía de ganar la carrera contra el precalentamiento por
   `requestIdleCallback`. Movida aquí (hoja siempre presente en el chunk de
   entrada), no duplicada — nada en `ui.css` la necesitaba (`Surface`/
   `.sc-surface` no se usa en ningún componente del workspace todavía). El
   orden importa: tiene que declararse antes que cualquier selector que le
   gane la especificidad por venir después en el archivo, como
   `.welcome-frame` más abajo, que sube su radio a `--sc-radius-hero`. */
.sc-surface {
  background: var(--sc-gradient-clay);
  border: var(--sc-clay-edge);
  border-radius: var(--sc-radius-xl);
  transition: var(--sc-transition-control);
}

.sc-surface[data-level='flat'] {
  background: var(--sc-color-surface-1);
  border-color: var(--sc-color-border-soft);
  box-shadow: none;
}

.sc-surface[data-level='raised'] { box-shadow: var(--sc-shadow-clay-md); }
.sc-surface[data-level='floating'] { box-shadow: var(--sc-shadow-clay-floating); }
.sc-surface[data-pressed='true'] { box-shadow: var(--sc-shadow-clay-pressed); }
```

con:

```css
/* Superficie clay (`Surface`, ciclo 1). La materia (fondo, borde, sombra por
   nivel) vive en `design-system/material.css` desde el ciclo 2 — declarada
   una vez, compartida con el resto del workspace. Aquí sólo queda lo que es
   forma, no materia: el radio y la transición, que sí varían por
   componente. `.welcome-frame`, más abajo, sube el radio a
   `--sc-radius-hero` con igual especificidad e igual gana por venir después
   en el archivo — sigue siendo cierto, no ha cambiado. */
.sc-surface {
  border-radius: var(--sc-radius-xl);
  transition: var(--sc-transition-control);
}
```

- [ ] **Step 13: Ejecutar los tests de `Surface` y del inicio**

Run: `npx vitest run src/design-system/components/surface.test.tsx src/features/welcome/`
Expected: PASS — el comportamiento visual no cambia, sólo dónde vive la declaración.

- [ ] **Step 14: Escribir el test que falla para ampliar `as`**

En `src/design-system/components/surface.test.tsx`, añade al final del `describe('Surface', ...)`:

```tsx
  it('renders as an interactive element when asked', () => {
    render(<Surface as="button" data-testid="s" />);
    expect(screen.getByTestId('s').tagName).toBe('BUTTON');
  });

  it('renders as header or nav for landmark surfaces', () => {
    render(<><Surface as="header" data-testid="h" /><Surface as="nav" data-testid="n" /></>);
    expect(screen.getByTestId('h').tagName).toBe('HEADER');
    expect(screen.getByTestId('n').tagName).toBe('NAV');
  });
```

- [ ] **Step 15: Ejecutar y verificar que falla**

Run: `npx vitest run src/design-system/components/surface.test.tsx`
Expected: FAIL — TypeScript rechaza `as="button"` porque no está en la unión (o, si TS no bloquea el test en runtime, el `it` de todas formas documenta la ampliación pendiente). Si el proyecto compila el test sin que TypeScript lo bloquee en Vitest, confirma igualmente que el `tagName` assertion es lo que primero falla si `as` no se propagase — aquí lo que falla es la compilación de tipos, verifícalo con `npm run typecheck`.

Run: `npm run typecheck`
Expected: FAIL — `Type '"button"' is not assignable to type '"div" | "section" | "article" | "aside"'`.

- [ ] **Step 16: Ampliar `as` en `surface.tsx`**

En `src/design-system/components/surface.tsx`, sustituye:

```tsx
  as?: 'div' | 'section' | 'article' | 'aside';
```

por:

```tsx
  as?: 'div' | 'section' | 'article' | 'aside' | 'button' | 'header' | 'nav';
```

- [ ] **Step 17: Ejecutar el test y el typecheck**

Run: `npx vitest run src/design-system/components/surface.test.tsx && npm run typecheck`
Expected: PASS, 8 tests en `surface.test.tsx`.

- [ ] **Step 18: Verificar la frontera de dependencias y el contrato de tokens completo**

Run: `npx vitest run src/design-system/components/dependencyBoundary.test.ts src/design-system/tokens.test.ts`
Expected: PASS. `dependencyBoundary.test.ts` descubre ficheros por `readdirSync` de `components/` — `material.css` vive un nivel arriba, en `design-system/`, así que no lo escanea; confírmalo leyendo el test si el resultado te sorprende.

- [ ] **Step 19: Suite completa, lint y build**

Run: `npm run lint && npx vitest run && npm run typecheck && npm run build`
Expected: PASS. El build confirma que `material.css` se resuelve como import válido y que Vite no se queja de una hoja vacía en los grupos `raised`/`floating` (tienen `.sc-surface` como consumidor real).

- [ ] **Step 20: Commit**

```bash
git add src/design-system/tokens.css src/design-system/tokens.test.ts src/design-system/material.css src/App.tsx src/design-system/components/surface.tsx src/design-system/components/surface.test.tsx src/styles.css
git commit -m "feat(claymorphism): material.css eager, borde medido del chrome y retirada del vidrio

Tres piezas fundacionales del ciclo 2. --sc-color-border-canvas-chrome es el
primer rol que consigue 3:1 contra el lienzo (#84817a en dia, #5f6d68 en
noche); ningun rol de borde existente lo alcanzaba. Los tokens de vidrio
(--sc-surface-glass*, --sc-blur-glass, --sc-blur-chrome) se retiran junto
con los dos tests que los protegian, relajacion deliberada documentada en
el spec, no un test silenciado. material.css declara la materia clay una
sola vez por nivel de elevacion, importado despues de styles.css para
quedar en el chunk de entrada; .sc-surface pasa a consumirlo. Surface amplia
as a button/header/nav, saldando la deuda que le impedia vestir superficies
interactivas.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Arnés — extender el contrato de tokens y el helper de medición en `qa.mjs`

Construye la infraestructura de verificación antes de vestir ninguna zona: `tokens.test.ts` empieza a leer `material.css`, y `qa.mjs` gana una función reutilizable para medir materia clay real en Chromium.

**Files:**
- Modify: `src/design-system/tokens.test.ts` (lectura de `material.css`, tres checks ampliados)
- Modify: `qa.mjs` (helper `readClayMaterial`, primer check real sobre `.welcome-frame`)

**Interfaces:**
- Consumes: `material.css` (Tarea 1).
- Produces: función `readClayMaterial(page, selector)` en `qa.mjs` — devuelve `{ background, border, boxShadow, backdropFilter }` vía `getComputedStyle`. La consumen las tareas 4-9 para sus propios checks.

- [ ] **Step 1: Ampliar la lectura de ficheros en `tokens.test.ts`**

En `src/design-system/tokens.test.ts`, después de la línea 11 (`const uiCss = readCss(...)`), añade:

```ts
const materialCss = readCss(new URL('./material.css', import.meta.url));
/** El texto combinado de todo el CSS de componente que no es `tokens.css`. */
const componentCss = `${stylesCss}\n${materialCss}`;
```

- [ ] **Step 2: Sustituir `stylesCss` por `componentCss` en los tres checks de higiene de color**

En los tres tests que hoy escanean sólo `stylesCss`:

- `it('does not consume primitive color tokens from component CSS', ...)` (línea 205): cambia `expect(stylesCss)` por `expect(componentCss)`.
- `it('never hardcodes an opaque color in component CSS', ...)` (línea 209): cambia `stylesCss.match(...)` por `componentCss.match(...)`.
- `it('keeps translucency literals to shadows and scrims, ...', ...)` (línea 216): cambia `stylesCss.matchAll(...)` por `componentCss.matchAll(...)`.

Y en `it('keeps the welcome surface free of untokenized elevation', ...)` (línea 305): cambia `stylesCss.matchAll(...)` por `componentCss.matchAll(...)`.

- [ ] **Step 3: Añadir `material.css` al contrato de resolución de tokens**

En el `it.each` de `it('resolves every design token %s references', ...)` (línea 251), añade una tercera fila:

```ts
  it.each([
    ['styles.css', stylesCss],
    ['ui.css', uiCss],
    ['material.css', materialCss],
  ] as const)('resolves every design token %s references', (_label, css) => {
```

- [ ] **Step 4: Ejecutar el test de tokens completo**

Run: `npx vitest run src/design-system/tokens.test.ts`
Expected: PASS. `material.css` de la Tarea 1 sólo usa `var(--sc-…)` ya declarados, sin literales ni primitivos, así que los cuatro checks ampliados deben pasar sin tocar `material.css`.

- [ ] **Step 5: Escribir el helper y el primer check en `qa.mjs`, verlo fallar**

Abre `qa.mjs` y localiza el bloque de helpers cerca de `verifyWelcomeClayMaterial` (la función que ya mide materia clay real sobre `.welcome-*`, para seguir su mismo patrón de valores exactos). Añade, antes de esa función:

```js
/**
 * Lee la materia clay real de un selector vía getComputedStyle, en Chromium.
 * Es el helper que las tareas 4-9 reutilizan para verificar cada zona del
 * workspace: jsdom no renderiza CSS (vite.config.ts no declara test.css), así
 * que esta es la única red que ve cascada y especificidad de verdad.
 */
async function readClayMaterial(page, selector) {
  return page.$eval(selector, (el) => {
    const style = window.getComputedStyle(el);
    return {
      background: style.backgroundImage !== 'none' ? style.backgroundImage : style.backgroundColor,
      border: style.borderTopWidth + ' ' + style.borderTopStyle + ' ' + style.borderTopColor,
      boxShadow: style.boxShadow,
      backdropFilter: style.backdropFilter,
    };
  });
}
```

Dentro de `verifyWelcomeClayMaterial` (o en una función nueva `verifyWorkspaceClayMaterial` que se llame junto a ella en la orquestación — usa la que ya exista para `.welcome-frame`), añade:

```js
  const frameMaterial = await readClayMaterial(page, '.welcome-frame');
  out.checks.welcomeFrameHasNoBackdropFilter = frameMaterial.backdropFilter === 'none';
```

- [ ] **Step 6: Ejecutar `qa` y confirmar que el check nuevo pasa**

Run: `npm run build && node qa.mjs`
Expected: PASS, incluido `welcomeFrameHasNoBackdropFilter: true`. `.welcome-frame` (el contenedor `Surface` de la bienvenida) nunca tuvo `backdrop-filter` — es la prueba de que el helper mide lo que dice medir, sobre una superficie que ya es clay desde el ciclo 1.

- [ ] **Step 7: Verificación por mutación del helper**

Edita temporalmente `.sc-surface` en `material.css`, grupo `raised`, añadiendo `backdrop-filter: blur(4px);`. Ejecuta `npm run build && node qa.mjs` de nuevo.
Expected: FAIL — `welcomeFrameHasNoBackdropFilter: false`. Confirma que el check detecta la mutación, luego **revierte el cambio** (no lo commitees).

- [ ] **Step 8: Suite completa**

Run: `npm run lint && npx vitest run && npm run typecheck && npm run build`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/design-system/tokens.test.ts qa.mjs
git commit -m "test(claymorphism): arnes del ciclo 2 — material.css en el contrato de tokens y helper de qa

tokens.test.ts empieza a leer material.css en los cuatro checks de higiene
de color y en el contrato de resolucion, cerrando el punto ciego que
dejaba sin cubrir cualquier literal o token roto en el fichero nuevo.
qa.mjs gana readClayMaterial(), el helper que las tareas 4-9 reutilizan
para medir getComputedStyle real en Chromium — la unica red que ve cascada,
porque vite.config.ts no declara test.css y jsdom no renderiza CSS.
Verificado por mutacion: romper .sc-surface con un backdrop-filter falso lo
detecta.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: `ui.css` — migrar de sombras planas a clay

Los 602 líneas del design-system siguen íntegras en la materia AG-015. Cinco usos exactos de `raised` / `floating` / `modal` a migrar.

**Files:**
- Modify: `src/design-system/components/ui.css` (5 líneas: 221, 235, 283, 311, 559)

**Interfaces:**
- Consumes: `--sc-shadow-clay-*` (ciclo 1).
- Produces: nada que consuman tareas posteriores — es una migración de hoja aislada.

- [ ] **Step 1: Escribir el test de consumo que falla**

En `src/design-system/tokens.test.ts`, dentro de `describe('AG-015 premium visual layer contract')`, añade al final:

```ts
  it('keeps ui.css off the flat AG-015 shadow family', () => {
    // ui.css is the design-system library CSS — every sc-* component's shadow
    // should resolve to the clay scale, not the flat one clay was meant to
    // replace. Grep, not getComputedStyle: jsdom can't render this, so the
    // text-level check is what guards it inside `npm test`.
    const flatShadowTokens = ['--sc-shadow-raised', '--sc-shadow-lifted', '--sc-shadow-floating', '--sc-shadow-modal', '--sc-shadow-popover', '--sc-shadow-contact', '--sc-shadow-sheet'];
    const offenders = flatShadowTokens.filter((token) => uiCss.includes(`var(${token})`));
    expect(offenders).toEqual([]);
  });
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npx vitest run src/design-system/tokens.test.ts`
Expected: FAIL — el array `offenders` contiene `--sc-shadow-raised`, `--sc-shadow-floating` y `--sc-shadow-modal`.

- [ ] **Step 3: Migrar los cinco usos en `ui.css`**

Línea 221, `.sc-segmented button[aria-checked='true']`:

```css
.sc-segmented button[aria-checked='true'] { background: var(--sc-color-surface-1); color: var(--sc-color-action-primary); box-shadow: var(--sc-shadow-clay-sm); }
```

Línea 235, `.sc-tooltip__content`:

```css
  box-shadow: var(--sc-shadow-clay-md);
```

Línea 283, `.sc-popover__surface`:

```css
  box-shadow: var(--sc-shadow-clay-floating);
```

Línea 311, `.sc-modal-surface`:

```css
  box-shadow: var(--sc-shadow-clay-floating);
```

Línea 559, `.sc-layer-toggle__switch i`:

```css
.sc-layer-toggle__switch i { width: 16px; height: 16px; position: absolute; top: 2px; left: 2px; border-radius: 50%; background: var(--sc-color-surface-1); box-shadow: var(--sc-shadow-clay-xs); transition: transform var(--sc-motion-fast) var(--sc-ease-standard); }
```

**Criterio de elección de nivel**: el segmento activo y el thumb del switch son elevaciones pequeñas → `clay-sm`/`clay-xs`. El tooltip es contenido flotante intermedio → `clay-md`. El popover y el modal son lo que más se despega del plano → `clay-floating`.

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `npx vitest run src/design-system/tokens.test.ts`
Expected: PASS, incluido el test nuevo.

- [ ] **Step 5: Tests de componentes**

Run: `npx vitest run src/design-system/components/`
Expected: PASS — ningún test de `controls.test.tsx`, `overlays.test.tsx`, `disclosure.test.tsx`, `editor.test.tsx` afirma un valor de `box-shadow` (son tests de comportamiento/atributos, no de estilo computado), así que no deberían romperse.

- [ ] **Step 6: Verificación visual en navegador — ComponentLab**

Este es el único punto del ciclo donde `ComponentLab` (`/__components`, sólo dev) es la herramienta correcta: `qa.mjs` no lo recorre. Arranca `npm run dev`, navega a `/__components`, y confirma visualmente que segmentados, tooltips, popovers, modales y el switch de capas muestran la sombra de cuatro capas (difusa + luz interior) y no la plana de dos capas. Si algo se ve mal, es una regresión real de esta tarea.

- [ ] **Step 7: Suite completa y build**

Run: `npm run lint && npx vitest run && npm run typecheck && npm run build`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/design-system/components/ui.css src/design-system/tokens.test.ts
git commit -m "feat(design-system): migra ui.css de sombras planas AG-015 a la escala clay

Cinco usos: segmentado activo y switch de capas a clay-sm/xs (elevaciones
pequenas), tooltip a clay-md, popover y modal a clay-floating (lo que mas
se despega del plano). Nuevo test de consumo en tokens.test.ts impide que
vuelva a colarse --sc-shadow-raised/-floating/-modal en ui.css.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Marco — `TopBar` y `WorkspaceShell`

Primer consumidor real de `material.css` fuera de `.sc-surface`. El topbar pierde el vidrio (`--sc-surface-glass-strong` + `blur(18px)`, línea 495) y se une al grupo `raised`.

**Files:**
- Modify: `src/design-system/material.css` (`.topbar` se une al grupo `raised`)
- Modify: `src/styles.css` (línea 495: retira materia; línea 556-557: `.popover` — se trata en la Tarea 9)
- Modify: `qa.mjs` (`verifyTopbarClayMaterial`)

**Interfaces:**
- Consumes: grupo `raised` de `material.css` (Tarea 1), `readClayMaterial` (Tarea 2).
- Produces: nada que consuman tareas posteriores.

- [ ] **Step 1: Añadir `.topbar` al grupo `raised` de `material.css`**

En `src/design-system/material.css`, en el grupo `raised`:

```css
.sc-surface[data-level='raised'],
[data-level='raised'],
.topbar {
  background: var(--sc-gradient-clay);
  border: var(--sc-clay-edge);
  box-shadow: var(--sc-shadow-clay-md);
}
```

- [ ] **Step 2: Retirar la materia del `.topbar` en `styles.css`**

Sustituye la línea 495:

```css
.topbar { height: var(--topbar-h); flex: 0 0 var(--topbar-h); display: grid; grid-template-columns: minmax(270px,1fr) minmax(300px,max-content) minmax(350px,1fr); align-items: center; gap: var(--sc-space-4); padding: 0 var(--sc-layout-gutter); border-bottom: 1px solid var(--border); background: color-mix(in srgb, var(--sc-color-surface-toolbar) 92%, transparent); box-shadow:0 1px 0 color-mix(in srgb,var(--border) 62%,transparent); backdrop-filter: blur(18px); position: relative; z-index: var(--sc-z-topbar); }
```

por:

```css
.topbar { height: var(--topbar-h); flex: 0 0 var(--topbar-h); display: grid; grid-template-columns: minmax(270px,1fr) minmax(300px,max-content) minmax(350px,1fr); align-items: center; gap: var(--sc-space-4); padding: 0 var(--sc-layout-gutter); border-bottom-width: 0; position: relative; z-index: var(--sc-z-topbar); }
```

`background`, `box-shadow` y `backdrop-filter` se retiran (los da `material.css`); `border-bottom` desaparece porque el borde ahora lo aporta `--sc-clay-edge` en las cuatro aristas, y un borde inferior adicional duplicaría el canto. Elimina también la regla de la Capa AG-015 que apuntaba a `.topbar` (líneas 2983-2987):

```css
/* Cristal de la barra superior: sin saturar, el desenfoque deja el lienzo
   lechoso justo donde el ojo compara colores de diagrama. */
.topbar {
  background:var(--sc-surface-glass-strong);
  backdrop-filter:var(--sc-blur-glass);
  -webkit-backdrop-filter:var(--sc-blur-glass);
}
```

Bórrala entera — es la regla de vidrio original que este ciclo sustituye, y dejarla competiría con `material.css` sin ganar (ambas viven en `styles.css`, así que ganaría la última en el archivo; retirarla es más limpio que dejar dos declaraciones del mismo `background`).

- [ ] **Step 3: Retirar `.topbar` de los bloques `prefers-reduced-transparency`**

En la línea 1716-1717, retira `.topbar` de ambas listas de selectores (ya no declara `backdrop-filter` ni necesita el fallback de `background`):

```css
@media (prefers-reduced-transparency:reduce) {
  .toolbar,.welcome-header,.popover,.canvas-mode-badge,.canvas-result-legend,.mobile-inspector-toggle,.import-center-backdrop,.new-exercise-backdrop,.mobile-inspector-backdrop,.results-sheet-backdrop,.quick-entry-bar,.cut-tooltip,.welcome-workflow,.welcome-footer,.welcome-badge-pill,.welcome-highlight-item,.welcome-filter-tabs,.welcome-import-card { backdrop-filter:none!important; }
  .toolbar,.welcome-header,.popover,.canvas-mode-badge,.canvas-result-legend,.mobile-inspector-toggle,.quick-entry-bar,.cut-tooltip,.welcome-workflow,.welcome-footer { background:var(--surface)!important; }
}
```

(Esta lista se seguirá acortando en las tareas 5, 6 y 9 conforme cada zona pierda su vidrio. No la dejes vacía todavía — quedan `.toolbar` y el resto.)

- [ ] **Step 4: Escribir el check de `qa.mjs` que falla**

En `qa.mjs`, junto a `verifyWelcomeClayMaterial` (o en la función de la Tarea 2), añade:

```js
async function verifyTopbarClayMaterial(page) {
  const material = await readClayMaterial(page, '.topbar');
  return {
    topbarHasNoBackdropFilter: material.backdropFilter === 'none',
    topbarHasClayShadow: material.boxShadow.includes('inset'),
  };
}
```

Llama a `verifyTopbarClayMaterial(page)` desde `desktop()` (o desde donde se orquesten los checks de escritorio) y vuelca su resultado en `out.checks` con `Object.assign(out.checks, await verifyTopbarClayMaterial(page));`.

- [ ] **Step 5: Ejecutar y verificar que falla**

Run: `npm run build && node qa.mjs`
Expected: FAIL antes de este punto si los Steps 1-3 no se hubieran aplicado — como ya se aplicaron en este mismo Task, ejecuta esto **antes** del Step 1 en la práctica, o revierte temporalmente el Step 2 para confirmar el rojo. Deja constancia del resultado rojo→verde en el ledger de progreso.

- [ ] **Step 6: Confirmar que pasa con los cambios aplicados**

Run: `npm run build && node qa.mjs`
Expected: PASS — `topbarHasNoBackdropFilter: true`, `topbarHasClayShadow: true`.

- [ ] **Step 7: Verificación por mutación**

Añade temporalmente `backdrop-filter: blur(4px);` a `.topbar` en `material.css`. Ejecuta `npm run build && node qa.mjs`.
Expected: FAIL. Revierte.

- [ ] **Step 8: Revisión visual manual**

`npm run dev`, abre el workspace, confirma en ambos temas que el topbar tiene volumen (sombra difusa + canto de 1px) y ya no dibuja el lienzo borroso a través suyo. Confirma que el separador vertical entre topbar y el resto del workspace se sigue leyendo — si se pierde definición, considera que `--sc-shadow-clay-md` puede necesitar el border-bottom que se quitó; documenta la decisión si la cambias.

- [ ] **Step 9: Suite completa**

Run: `npm run lint && npx vitest run && npm run typecheck && npm run build`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add src/design-system/material.css src/styles.css qa.mjs
git commit -m "feat(workspace): topbar de vidrio a arcilla, primer consumidor real de material.css

.topbar pierde --sc-surface-glass-strong + blur(18px) y se une al grupo
raised de material.css junto a .sc-surface. Nuevo check en qa.mjs mide
getComputedStyle real: sin backdrop-filter, con la sombra de cuatro capas.
Verificado por mutacion.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Tool rail y dock móvil

`.toolbar` se une al grupo `raised`. El estado activo por herramienta (`--tool-color`) no cambia — ya está tokenizado y no es vidrio.

**Files:**
- Modify: `src/design-system/material.css` (`.toolbar` se une al grupo `raised`)
- Modify: `src/styles.css` (línea 572: retira materia de `.toolbar` en escritorio; línea 973 y 1409: retira `backdrop-filter` del dock móvil)
- Modify: `qa.mjs` (`verifyToolRailClayMaterial`)

**Interfaces:**
- Consumes: grupo `raised` de `material.css`, `readClayMaterial`.
- Produces: nada que consuman tareas posteriores.

- [ ] **Step 1: Añadir `.toolbar` al grupo `raised`**

```css
.sc-surface[data-level='raised'],
[data-level='raised'],
.topbar,
.toolbar {
  background: var(--sc-gradient-clay);
  border: var(--sc-clay-edge);
  box-shadow: var(--sc-shadow-clay-md);
}
```

- [ ] **Step 2: Retirar la materia de `.toolbar` en escritorio**

Sustituye la línea 572:

```css
.toolbar { border-right: 1px solid var(--border); background: var(--sc-color-surface-toolbar); padding: 12px 10px; display: flex; flex-direction: column; gap: 4px; min-height: 0; z-index: 10; overflow-y:auto; overscroll-behavior:contain; }
```

por:

```css
.toolbar { padding: 12px 10px; display: flex; flex-direction: column; gap: 4px; min-height: 0; z-index: 10; overflow-y:auto; overscroll-behavior:contain; }
```

`border-right` y `background` se retiran — el borde ahora es el canto de 4 lados de `--sc-clay-edge`. Si el rail necesita seguir separándose visualmente del lienzo con más fuerza en la arista derecha (comprueba en el Step 7), añade `border-right: 0` explícito no es necesario ya que ninguna regla posterior lo redeclara; verifícalo con grep antes de dar la tarea por cerrada.

- [ ] **Step 3: Retirar `backdrop-filter` del dock móvil**

Línea 973, dentro del bloque `@media (max-width: 1023px)`, sustituye:

```css
  .toolbar { position:absolute; z-index:25; left:10px; right:10px; bottom:calc(30px + env(safe-area-inset-bottom)); height:52px; border:1px solid var(--border); border-radius:13px; box-shadow:var(--shadow); flex-direction:row; gap:2px; padding:4px; overflow-x:auto; overflow-y:hidden; background:color-mix(in srgb,var(--surface) 92%,transparent); backdrop-filter:blur(16px); }
```

por:

```css
  .toolbar { position:absolute; z-index:25; left:10px; right:10px; bottom:calc(30px + env(safe-area-inset-bottom)); border-radius:13px; flex-direction:row; gap:2px; padding:4px; overflow-x:auto; overflow-y:hidden; }
```

(`height:52px` se retira sólo si `min-height`/contenido ya la fijan — confírmalo visualmente en el Step 7; si el rail pierde alto, restáuralo). `border`, `box-shadow` y `background` se retiran porque el grupo `raised` ya los aporta en cualquier breakpoint — al no repetirlos aquí, la regla de escritorio de `material.css` sigue rigiendo.

Línea 1409, dentro de otro bloque `@media (max-width:1023px)` (el de "Mobile v2"), localiza la declaración de `.toolbar` que incluye `backdrop-filter:blur(18px);` (contexto: bloque que empieza en la línea 1393) y retira esa línea junto con `background:color-mix(in srgb,var(--surface) 96%,transparent);` y `box-shadow:var(--sc-shadow-sheet);` — mismo motivo: el material ya lo aporta `material.css`.

- [ ] **Step 4: Retirar `.toolbar` del bloque `prefers-reduced-transparency`**

Línea 1716-1717: retira `.toolbar` de ambas listas.

- [ ] **Step 5: Escribir el check de `qa.mjs`**

```js
async function verifyToolRailClayMaterial(page) {
  const material = await readClayMaterial(page, '.toolbar');
  return {
    toolRailHasNoBackdropFilter: material.backdropFilter === 'none',
    toolRailHasClayShadow: material.boxShadow.includes('inset'),
  };
}
```

Llama a esta función desde `desktop()` y desde `mobile()` (el rail tiene tratamiento distinto en cada breakpoint — verifica ambos), volcando el resultado con prefijos distintos si hace falta distinguirlos (`toolRailDesktop…` / `toolRailMobile…`).

- [ ] **Step 6: Ejecutar y confirmar rojo→verde**

Run: `npm run build && node qa.mjs` antes y después de los Steps 1-4, como en la Tarea 4.
Expected: PASS tras aplicar los cambios.

- [ ] **Step 7: Verificación por mutación**

Añade `backdrop-filter: blur(4px)` temporalmente a `.toolbar` en `material.css`. Confirma que el check falla. Revierte.

- [ ] **Step 8: Revisión visual manual, escritorio y móvil (390×844)**

`npm run dev`. Confirma que el rail conserva alto y anchura correctos en escritorio, compacto (1024-1439px) y dock móvil; que el halo de la herramienta activa (línea 3005-3015, `.tool-button.active`, sin tocar en esta tarea) se sigue viendo con claridad sobre el nuevo fondo de arcilla.

- [ ] **Step 9: Suite completa**

Run: `npm run lint && npx vitest run && npm run typecheck && npm run build`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add src/design-system/material.css src/styles.css qa.mjs
git commit -m "feat(workspace): tool rail y dock movil de vidrio a arcilla

.toolbar se une al grupo raised de material.css en los tres breakpoints
(escritorio, compacto, dock movil). El halo por herramienta (--tool-color)
no cambia: ya estaba tokenizado y nunca fue vidrio. Checks nuevos en
qa.mjs para escritorio y movil, verificados por mutacion.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Chrome del lienzo — el borde medido en producción

La tarea de mayor riesgo del ciclo: el chrome flotante (badge de modo, chips, controles de zoom, status, leyenda, quick-entry, tooltip de corte, panel de capas) pasa de vidrio a arcilla opaca con el borde medido de la Tarea 1. Es la única zona con un riesgo que ningún test automático puede juzgar — ver Step 11.

**Files:**
- Create en `src/design-system/material.css`: grupo nuevo "chrome del lienzo"
- Modify: `src/styles.css` (líneas 733-769, 1901-2203: retira materia y `backdrop-filter` de cada selector del chrome)
- Modify: `qa.mjs` (`verifyCanvasChromeClayMaterial`)

**Interfaces:**
- Consumes: `--sc-color-border-canvas-chrome`, `--sc-color-surface-2`, `--sc-shadow-clay-floating` (Tarea 1), `readClayMaterial` (Tarea 2).
- Produces: nada que consuman tareas posteriores.

- [ ] **Step 1: Añadir el grupo "chrome del lienzo" a `material.css`**

Al final de `material.css`, después del grupo `pressed`:

```css
/* Chrome del lienzo — lo que flota sobre el dibujo técnico (badge de modo,
   chips, controles de zoom, status, leyenda, quick-entry, tooltip de corte,
   panel de capas). No es ninguno de los tres niveles genéricos: necesita un
   relleno opaco (--sc-color-surface-2, no la mezcla translúcida) y un borde
   medido aparte (--sc-color-border-canvas-chrome) porque ningún rol de
   borde existente alcanza 3:1 contra --sc-color-bg-canvas — antes de este
   ciclo se apoyaba en el desenfoque de lo que había detrás, no en el color.
   La sombra sube a `floating`, más presente que la plana anterior, porque
   ahora es lo único (junto al borde) que separa estas piezas del dibujo. */
.canvas-mode-badge,
.canvas-view-chips span,
.canvas-controls,
.canvas-status,
.canvas-result-legend,
.canvas-feedback,
.canvas-hint,
.quick-entry-bar,
.selection-cycle-indicator,
.cut-tooltip,
.canvas-layer-trigger,
.canvas-layer-panel {
  background: var(--sc-color-surface-2);
  border: 1px solid var(--sc-color-border-canvas-chrome);
  box-shadow: var(--sc-shadow-clay-floating);
}
```

- [ ] **Step 2: Retirar materia y `backdrop-filter` de las declaraciones base (líneas 733-769)**

Sustituye cada una de estas líneas, retirando `border`, `background`, `box-shadow` y `backdrop-filter` (los da el grupo nuevo) y conservando **todo lo demás** (posición, tamaño, tipografía, color de texto):

Línea 733:
```css
.canvas-mode-badge { position:absolute; z-index:4; left:14px; top:12px; max-width:min(430px,calc(100% - 28px)); display:flex; align-items:center; gap:8px; padding:7px 10px; border-radius:9px; font-size:var(--sc-font-size-technical); color:var(--muted); pointer-events:none; }
```

Línea 736 (`.canvas-mode-badge.placing-load` conserva su borde de énfasis, que no es materia sino estado — no lo toques):
```css
.canvas-mode-badge.placing-load { pointer-events:auto; border-color:color-mix(in srgb,var(--force) 42%,var(--border)); box-shadow:var(--sc-shadow-clay-floating); }
```
(sustituye sólo `var(--sc-shadow-floating)` → `var(--sc-shadow-clay-floating)` si la versión previa usaba el token plano; comprueba el valor exacto en el fichero antes de editar, dado que puede haber cambiado de nombre en una fase intermedia).

Línea 742, `.canvas-status` (nota: **no** está en la lista del Step 1 con su tratamiento completo porque su color de fondo original era `color-mix(canvas-bg, transparent)`, no `surface`; añádelo igualmente al grupo del Step 1 y retira aquí su declaración local):
```css
.canvas-status { position: absolute; right: 14px; bottom: 12px; color: var(--subtle); font-size: var(--sc-font-size-technical); display: flex; align-items: center; gap: 5px; padding: 5px 8px; border-radius: 6px; }
```

Línea 743, `.canvas-feedback` (conserva su borde de advertencia semántico, que es distinto del canto estructural — dos `border` competirían; dale prioridad al de advertencia dejándolo explícito):
```css
.canvas-feedback { position:absolute; z-index:6; left:50%; top:58px; transform:translateX(-50%); width:max-content; max-width:calc(100% - 28px); padding:9px 12px; border-color:color-mix(in srgb,var(--warning) 35%,var(--border)); color:var(--text); font-size:var(--sc-font-size-label); line-height:1.4; text-align:center; }
```

Línea 744, `.canvas-result-legend`:
```css
.canvas-result-legend { position:absolute; left:16px; top:54px; z-index:8; width:min(260px,calc(100% - 32px)); padding:9px 11px; border-radius:10px; display:grid; grid-template-columns:auto 1fr; align-items:center; gap:4px 9px; pointer-events:none; }
```

Línea 752, `.quick-entry-bar`:
```css
.quick-entry-bar { position:absolute; z-index:22; left:50%; bottom:14px; transform:translateX(-50%); width:min(560px,calc(100% - 190px)); padding:8px; border-radius:12px; display:grid; grid-template-columns:minmax(120px,1.2fr) repeat(2,minmax(90px,.8fr)) auto; align-items:end; gap:7px; }
```

Línea 755, `.selection-cycle-indicator`:
```css
.selection-cycle-indicator { position:absolute; z-index:30; padding:5px 8px; border-radius:7px; color:var(--muted); font-size:9px; pointer-events:none; }
```

Línea 757, `.cut-tooltip`:
```css
.cut-tooltip { position: absolute; z-index: 28; width:min(340px,calc(100% - 20px)); max-height:min(380px,calc(100% - 20px)); overflow:auto; border-radius: 12px; padding: 11px 12px; display: flex; flex-direction: column; gap: 6px; font-size: 11px; pointer-events: none; }
```

Línea 729, `.canvas-controls` (los botones internos no cambian):
```css
.canvas-controls { position: absolute; left: 14px; bottom: 18px; display: flex; flex-direction: column; border-radius: 9px; overflow: hidden; }
```

- [ ] **Step 3: Retirar materia y `backdrop-filter` de los overrides Fase 3 (líneas 1901-2203)**

`.canvas-mode-badge` (línea 1908): retira `background`, `box-shadow`, `border-color` (los da el grupo nuevo; conserva `top`, `left`, `min-height`, `max-width`, `border-radius`).

`.canvas-view-chips span` (línea 1928): retira `border`, `background`, `box-shadow`, `backdrop-filter` (línea 1941); conserva layout y tipografía.

`.canvas-controls` (línea 1944): retira `background`, `backdrop-filter` (línea 1952); conserva `right`, `bottom`, `flex-direction`, `border-radius`.

`.canvas-status` (línea 1955): retira `border`, `background`, `box-shadow`, `backdrop-filter` (línea 1970); conserva layout.

`.canvas-layer-trigger` (línea 2044): retira `border`, `background`, `box-shadow`, `backdrop-filter` (línea 2058); conserva posición y tamaño. El estado `.active` (línea 2061) conserva su tratamiento de acento, sin cambios.

`.canvas-layer-panel` (línea 2066): retira `border`, `background`, `box-shadow`, `backdrop-filter` (línea 2080); conserva layout.

- [ ] **Step 4: Retirar los selectores migrados de los bloques `prefers-reduced-transparency`**

Línea 2038-2040:
```css
@media (prefers-reduced-transparency:reduce) {
  .canvas-view-chips span,.canvas-controls,.canvas-status { backdrop-filter:none; background:var(--surface); }
}
```
Este bloque queda vacío de contenido útil — bórralo entero: ninguno de los tres selectores declara ya `backdrop-filter`.

Línea 2196-2197, mismo tratamiento — bórralo entero:
```css
@media (prefers-reduced-transparency:reduce) {
  .canvas-layer-trigger,.canvas-layer-panel { backdrop-filter:none; background:var(--surface); }
}
```

En la línea 1716-1717, retira `.canvas-mode-badge`, `.canvas-result-legend`, `.quick-entry-bar`, `.cut-tooltip` de ambas listas.

- [ ] **Step 5: Verificar el contraste técnico del lienzo tras el cambio de chrome**

Run: `npx vitest run src/design-system/tokens.test.ts`
Expected: PASS sin cambios — esta tarea no toca `--sc-color-technical-*` ni `--sc-color-bg-canvas`; el test de contraste técnico (líneas 158-191) sigue midiendo lo mismo. Confírmalo para descartar que el nuevo `--sc-color-border-canvas-chrome` interfiera con algo.

- [ ] **Step 6: Escribir el check de `qa.mjs`**

```js
async function verifyCanvasChromeClayMaterial(page) {
  const badge = await readClayMaterial(page, '.canvas-mode-badge');
  const controls = await readClayMaterial(page, '.canvas-controls');
  return {
    canvasChromeHasNoBackdropFilter: badge.backdropFilter === 'none' && controls.backdropFilter === 'none',
    canvasChromeHasMeasuredBorder: badge.border.includes('solid'),
    canvasChromeHasFloatingShadow: badge.boxShadow.includes('inset'),
  };
}
```

Llama desde `desktop()`.

- [ ] **Step 7: Ejecutar y confirmar rojo→verde**

Run: `npm run build && node qa.mjs` antes y después de aplicar los Steps 1-4.
Expected: PASS tras los cambios.

- [ ] **Step 8: Verificación por mutación**

Retira temporalmente `--sc-color-border-canvas-chrome` del grupo "chrome del lienzo" en `material.css` (deja el `border` sin color, cae al `currentColor` por defecto del navegador). Confirma que `canvasChromeHasMeasuredBorder` falla o que el valor computado ya no coincide. Revierte.

- [ ] **Step 9: Revisar las zonas seguras del lienzo**

Compara los valores de `--canvas-safe-top/-right/-bottom/-left` (líneas 1902-1906, 1980-1984, 2020-2024, 2794-2797) contra el resultado real en navegador — el chrome opaco puede necesitar más margen que el translúcido para no solaparse visualmente con el dibujo denso. Ajusta sólo si la comprobación visual del Step 11 lo exige; si no hace falta, dilo explícitamente en el commit.

- [ ] **Step 10: Suite completa**

Run: `npm run lint && npx vitest run && npm run typecheck && npm run build`
Expected: PASS.

- [ ] **Step 11: Verificación manual — el riesgo que ningún test puede juzgar**

`npm run dev`, carga o construye un modelo con varias barras, nodos, cargas y al menos un diagrama de momento activo. Confirma en ambos temas y en 390×844:

1. El badge de modo, los chips, los controles de zoom, el status, la leyenda de resultados, la barra de entrada rápida y el tooltip de corte son legibles sobre geometría densa.
2. Ninguno de ellos oculta información que el usuario necesite ver simultáneamente (nodos, apoyos, valores de diagrama bajo el chrome).
3. El borde nuevo se percibe como borde, no como ruido.

Si el chrome oculta demasiado, ajusta posición o tamaño en esta misma tarea — es el riesgo principal del ciclo (§10 del spec) y no se difiere.

- [ ] **Step 12: Commit**

```bash
git add src/design-system/material.css src/styles.css qa.mjs
git commit -m "feat(workspace): chrome del lienzo de vidrio a arcilla opaca con borde medido

El badge de modo, los chips, los controles de zoom, el status, la leyenda,
quick-entry, el tooltip de corte y el panel de capas pierden backdrop-filter
y pasan a --sc-color-surface-2 opaco + --sc-color-border-canvas-chrome (la
tarea 1 midio que ningun borde existente llega a 3:1 contra el lienzo) +
--sc-shadow-clay-floating. Verificado en navegador sobre un modelo denso:
el chrome sigue siendo legible y no tapa el dibujo. Es el riesgo principal
del ciclo, ningun test automatico puede juzgarlo.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Inspector

`.inspector-panel` se une al grupo `raised`; los campos y filas densas (`.selection-card`, `.number-control`, `.select-field select`, `.effect-card`, `.combination-card`, `.norm-source`, `.compact-toggle-grid label`, `.inspector-note`, `.load-tool-grid button`) se unen al grupo `flat` — coherente con §3.3: los radios densos no suben y el volumen no se filtra a zonas técnicas.

**Files:**
- Modify: `src/design-system/material.css` (`.inspector-panel` → `raised`; campos densos → `flat`)
- Modify: `src/styles.css` (líneas 774, 784, 789, 793, 801, 804, 814, 831, 833, 795 y overrides Fase 8 relevantes en 2308-2319)
- Modify: `qa.mjs` (`verifyInspectorClayMaterial`)

**Interfaces:**
- Consumes: grupos `raised`/`flat` de `material.css`, `readClayMaterial`.
- Produces: nada que consuman tareas posteriores.

- [ ] **Step 1: Añadir los selectores del inspector a `material.css`**

```css
.sc-surface[data-level='raised'],
[data-level='raised'],
.topbar,
.toolbar,
.inspector-panel,
.inspector-summary {
  background: var(--sc-gradient-clay);
  border: var(--sc-clay-edge);
  box-shadow: var(--sc-shadow-clay-md);
}
```

```css
.sc-surface[data-level='flat'],
[data-level='flat'],
.selection-card,
.number-control,
.select-field select,
.effect-card,
.combination-card,
.norm-source,
.compact-toggle-grid label,
.inspector-note,
.load-tool-grid button {
  background: var(--sc-color-surface-1);
  border: 1px solid var(--sc-color-border-soft);
  box-shadow: none;
}
```

**Nota sobre `.inspector-summary`**: es una tarjeta destacada dentro del inspector (resumen de la selección activa), no una fila densa — corresponde a `raised`, no a `flat`. Sus estados `is-empty` y el borde de acento por tipo de resultado (`.is-axial`, `.is-shear`, `.is-moment`) son ESTADO, no materia: no los toques.

- [ ] **Step 2: Retirar la materia local del inspector en `styles.css`**

Línea 774, `.inspector-panel`:
```css
.inspector-panel { min-width: 0; min-height: 0; display: flex; flex-direction: column; z-index: 10; }
```
(retira `border-left: 1px solid var(--border); background: var(--surface);` — los da `material.css`.)

Línea 784, `.selection-card`:
```css
.selection-card { border-radius: 8px; padding: 12px; display: flex; gap: 12px; align-items: center; }
```

Línea 789, `.number-control`:
```css
.number-control { display: grid; grid-template-columns: 1fr auto; border-radius: 7px; overflow: hidden; }
```

Línea 793, `.select-field select`:
```css
.select-field select { width: 100%; border-radius: 7px; padding: 8px 9px; }
```

Línea 801, `.inspector-note`:
```css
.inspector-note { margin: 12px 0; border-radius: 8px; padding: 10px; color: var(--muted); display: flex; gap: 8px; font-size: 10px; line-height: 1.45; }
```

Línea 804, `.compact-toggle-grid label`:
```css
.compact-toggle-grid label { min-height:34px; padding:7px 8px; border-radius:8px; display:flex; align-items:center; gap:7px; font-size:10px; }
```

Línea 814, `.effect-card`:
```css
.effect-card { display: grid; gap: 7px; padding: 10px; border-radius: 10px; }
```

Línea 831, `.combination-card`:
```css
.combination-card { margin-top: 8px; border-radius: 9px; padding: 0 9px 9px; }
```

Línea 833, `.norm-source`:
```css
.norm-source { border-radius: 7px; padding: 9px; display: flex; flex-direction: column; gap: 3px; font-size: 9px; color: var(--muted); }
```

Línea 795, dentro de `.load-tool-grid button` (busca el fragmento `.load-tool-grid button { --tool-color:var(--muted); min-height:76px; border:1px solid var(--border); border-radius:9px; background:var(--surface); ...}`), retira `border` y `background`, conserva el resto (incluido el estado `.active`, que es acento, no materia).

En la Fase 8 (línea 2308-2319, `.inspector-summary`), retira `border: 1px solid var(--border-soft);`, `background: color-mix(in srgb, var(--surface) 94%, var(--selection));` y `box-shadow: var(--sc-shadow-raised);` — los da el grupo `raised`. Conserva `position: relative; overflow: hidden; display: grid; gap: 11px; min-width: 0; padding: 13px; border-radius: 12px;` y el pseudo-elemento `::before` de acento (línea 2320-2326, es estado, no materia).

- [ ] **Step 3: Escribir el check de `qa.mjs`**

```js
async function verifyInspectorClayMaterial(page) {
  const panel = await readClayMaterial(page, '.inspector-panel');
  const field = await readClayMaterial(page, '.number-control');
  return {
    inspectorPanelHasClayShadow: panel.boxShadow.includes('inset'),
    inspectorNumericFieldStaysFlat: field.boxShadow === 'none',
  };
}
```

Llama desde `desktop()`, con una selección activa que muestre al menos un `.number-control` (usa el flujo ya existente que abre un modelo con barras).

- [ ] **Step 4: Ejecutar y confirmar rojo→verde**

Run: `npm run build && node qa.mjs` antes y después de los Steps 1-2.
Expected: PASS tras los cambios.

- [ ] **Step 5: Verificación por mutación**

Cambia temporalmente `.number-control` al grupo `raised` en lugar de `flat`. Confirma que `inspectorNumericFieldStaysFlat` falla. Revierte.

- [ ] **Step 6: Revisión visual — la tabla de datos no se convierte en fichas**

`npm run dev`, abre el inspector con una selección activa. Confirma que las filas de campos numéricos siguen leyéndose como una rejilla densa y no como tarjetas individuales con volumen — es el riesgo que §10 del spec nombra ("el volumen clay se filtra a las zonas técnicas densas").

- [ ] **Step 7: Suite completa**

Run: `npm run lint && npx vitest run && npm run typecheck && npm run build`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/design-system/material.css src/styles.css qa.mjs
git commit -m "feat(workspace): inspector de vidrio/plano a arcilla — panel raised, campos flat

.inspector-panel y .inspector-summary se unen al grupo raised. Las filas
densas (selection-card, number-control, select-field, effect-card,
combination-card, norm-source, compact-toggle-grid, inspector-note,
load-tool-grid) se unen a flat: sin volumen, para que una rejilla de
campos numericos siga leyendose como datos y no como un monton de fichas.
Verificado en navegador y por mutacion.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: Panel de resultados

`.results-panel` se une a `raised`; tablas, gráficas y bloques educativos densos se unen a `flat`.

**Files:**
- Modify: `src/design-system/material.css` (`.results-panel` → `raised`; `.results-table`, `.matrix-view`, `.education-explorer`, `.diagram-cursor-readout`, `.learning-steps details` → `flat`)
- Modify: `src/styles.css` (líneas 841, 864-866, 876-877, 882, 874)
- Modify: `qa.mjs` (`verifyResultsClayMaterial`)

**Interfaces:**
- Consumes: grupos `raised`/`flat` de `material.css`, `readClayMaterial`.
- Produces: nada que consuman tareas posteriores.

- [ ] **Step 1: Añadir los selectores de resultados a `material.css`**

```css
.sc-surface[data-level='raised'],
[data-level='raised'],
.topbar,
.toolbar,
.inspector-panel,
.inspector-summary,
.results-panel {
  background: var(--sc-gradient-clay);
  border: var(--sc-clay-edge);
  box-shadow: var(--sc-shadow-clay-md);
}
```

```css
.sc-surface[data-level='flat'],
[data-level='flat'],
.selection-card,
.number-control,
.select-field select,
.effect-card,
.combination-card,
.norm-source,
.compact-toggle-grid label,
.inspector-note,
.load-tool-grid button,
.matrix-view,
.education-explorer,
.diagram-cursor-readout,
.learning-steps details {
  background: var(--sc-color-surface-1);
  border: 1px solid var(--sc-color-border-soft);
  box-shadow: none;
}
```

**Nota**: `.results-table` no lleva borde ni sombra propios hoy (sólo `border-collapse: collapse` y bordes de celda) — no se une a ningún grupo, se queda como está. Sumarla obligaría a un tratamiento distinto de sus `<td>`/`<th>` que no es parte de este ciclo.

- [ ] **Step 2: Retirar la materia local en `styles.css`**

Línea 841, `.results-panel`:
```css
.results-panel { flex: 0 0 auto; min-height: 150px; max-height: 72dvh; position: relative; display: flex; flex-direction: column; container-type: inline-size; container-name: results-panel; }
```
(retira `background: var(--surface); border-top: 1px solid var(--border);`.)

Línea 882, `.education-numerical-substitution`:
```css
.education-numerical-substitution{margin-top:10px;border-radius:9px;overflow:hidden}
```

Dentro de la línea 877 (`.education-explorer`), retira `border:1px solid color-mix(in srgb,var(--accent) 24%,var(--border));background:var(--surface);` de la declaración de `.education-explorer` específicamente (el resto de ese bloque describe `.education-explorer-heading` y otros descendientes — no los toques, sólo el selector raíz).

Dentro de la línea 876 (`.learning-steps details`), retira `border:1px solid var(--border);background:var(--surface);` (conserva `border-radius:9px;overflow:hidden`).

Dentro de la línea 874 (`.diagram-cursor-readout`), retira `border:1px solid var(--border);background:var(--surface-2);` (conserva el resto de propiedades de layout y tipografía).

Dentro de la línea 877 (`.matrix-view`), retira `border:1px solid var(--border);` de su declaración (conserva `margin-top:10px;border-radius:9px;overflow:hidden`).

- [ ] **Step 3: Escribir el check de `qa.mjs`**

```js
async function verifyResultsClayMaterial(page) {
  const panel = await readClayMaterial(page, '.results-panel');
  return {
    resultsPanelHasClayShadow: panel.boxShadow.includes('inset'),
  };
}
```

Llama desde `desktop()`.

- [ ] **Step 4: Ejecutar y confirmar rojo→verde**

Run: `npm run build && node qa.mjs` antes y después de los Steps 1-2.
Expected: PASS tras los cambios.

- [ ] **Step 5: Verificación por mutación**

Retira temporalmente `.results-panel` del grupo `raised`. Confirma que el check falla. Revierte.

- [ ] **Step 6: Revisión visual — diagramas y matrices siguen siendo datos**

`npm run dev`, abre resultados con un análisis resuelto (diagramas N/V/M, matriz de rigidez si el modo educativo está activo). Confirma que las tablas y gráficas no ganan volumen que compita con las curvas técnicas que dibujan encima.

- [ ] **Step 7: Suite completa**

Run: `npm run lint && npx vitest run && npm run typecheck && npm run build`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/design-system/material.css src/styles.css qa.mjs
git commit -m "feat(workspace): panel de resultados de plano a arcilla — panel raised, datos flat

.results-panel se une a raised. Matrices, el explorador educativo, la
lectura de cursor del diagrama y los pasos de aprendizaje se unen a flat:
son datos, no tarjetas. .results-table no cambia, no tenia materia propia.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 9: Modales, menús, popovers, toasts y barrido del vidrio de la bienvenida

Cierra el barrido de vidrio en toda la app. `.popover`, `.sc-toast-card`, `.import-center-dialog`, `.mobile-tool-palette` se unen a `floating`; las 6 reglas `.welcome-*` con `backdrop-filter` se convierten a arcilla. Al final de esta tarea, el test de "sin backdrop-filter fuera de los velos" puede escribirse y pasar en el mismo paso.

**Files:**
- Modify: `src/design-system/material.css` (`.popover`, `.sc-toast-card`, `.import-center-dialog`, `.mobile-tool-palette`, `.welcome-header`, `.welcome-badge-pill`, `.welcome-highlight-item`, `.welcome-filter-tabs`, `.welcome-workflow`, `.welcome-footer` → `floating`)
- Modify: `src/styles.css` (líneas 87-88, 211, 220, 372, 481, 493, 556, 2937-2938, y los bloques `prefers-reduced-transparency` restantes)
- Modify: `src/design-system/tokens.test.ts` (test final de ausencia de `backdrop-filter` fuera de los velos)
- Modify: `qa.mjs` (`verifyOverlaysClayMaterial`)

**Interfaces:**
- Consumes: grupo `floating` de `material.css`, `readClayMaterial`.
- Produces: nada — es la última tarea de vestido.

- [ ] **Step 1: Añadir los selectores restantes al grupo `floating`**

```css
.sc-surface[data-level='floating'],
[data-level='floating'],
.popover,
.sc-toast-card,
.import-center-dialog,
.mobile-tool-palette,
.welcome-header,
.welcome-badge-pill,
.welcome-highlight-item,
.welcome-filter-tabs,
.welcome-workflow,
.welcome-footer {
  background: var(--sc-gradient-clay);
  border: var(--sc-clay-edge);
  box-shadow: var(--sc-shadow-clay-floating);
}
```

**Nota**: `.import-center-dialog` ya era opaca (`background: var(--surface); box-shadow: var(--sc-shadow-modal);`, sin `backdrop-filter`) — unirla al grupo es coherencia de materia, no una corrección de vidrio. `.welcome-footer` usaba `--sc-surface-glass-strong` (más opaco que `--sc-surface-glass`); el grupo `floating` es igualmente opaco por completo (sin transparencia), así que no pierde legibilidad.

- [ ] **Step 2: Retirar la materia local de las 6 reglas `.welcome-*`**

Línea 82-89, `.welcome-header`:
```css
.welcome-header {
  position:sticky; top:0; z-index:var(--sc-z-sticky);
  min-height:74px;
  padding-inline:max(24px, calc((100% - var(--sc-layout-reading)) / 2));
  display:flex; justify-content:space-between; align-items:center; gap:var(--sc-space-4);
  border-bottom:1px solid color-mix(in srgb, var(--border) 58%, transparent);
```
(retira `background:var(--sc-surface-glass);` y la línea `backdrop-filter:var(--sc-blur-glass); -webkit-backdrop-filter:var(--sc-blur-glass);` completa.)

Línea 211, `.welcome-badge-pill`:
```css
.welcome-badge-pill { display:inline-flex; align-items:center; gap:8px; width:fit-content; margin:0 0 22px; padding:7px 14px 7px 12px; border-radius:var(--sc-radius-pill); font-size:12px; font-weight:650; color:var(--muted); box-shadow:var(--sc-ring-inset); }
```
(retira `background:var(--sc-surface-glass); border:1px solid var(--border-soft);` — el borde y el fondo los da `floating`; conserva `box-shadow:var(--sc-ring-inset)` **sólo si** decides mantener el anillo interior como acento adicional sobre la sombra clay — si `--sc-shadow-clay-floating` ya incluye una capa `inset`, valora retirar `var(--sc-ring-inset)` también para no duplicar el efecto. Decide en el Step 6 según el resultado visual y documenta la decisión en el commit; por defecto, **retíralo** — la clay floating ya trae su propia luz interior.)

Retira también `backdrop-filter:var(--sc-blur-chrome); -webkit-backdrop-filter:var(--sc-blur-chrome);`.

Línea 220, `.welcome-highlight-item`:
```css
.welcome-highlight-item { display:inline-flex; align-items:center; gap:7px; font-size:12px; font-weight:650; color:var(--muted); padding:7px 13px; border-radius:var(--sc-radius-pill); }
```
(retira `background:var(--sc-surface-glass); border:1px solid var(--border-soft); box-shadow:var(--sc-ring-inset);` por el mismo motivo.)

Línea 372, `.welcome-filter-tabs`:
```css
.welcome-filter-tabs { display:inline-flex; gap:3px; padding:4px; border-radius:var(--sc-radius-lg); width:fit-content; }
```
(retira `background`, `border`, `box-shadow:var(--sc-ring-inset)`, `backdrop-filter` y su prefijo `-webkit-`.)

Línea 481, `.welcome-workflow`:
```css
.welcome-workflow { padding:28px; border-radius:var(--sc-radius-2xl); }
```
(retira `background`, `backdrop-filter` + `-webkit-backdrop-filter`, `border`, `box-shadow:var(--sc-shadow-raised), var(--sc-ring-inset);` — el `floating` group ya aporta fondo, borde y sombra clay.)

Línea 493, `.welcome-footer`:
```css
.welcome-footer { margin-top:auto; min-height:40px; padding:9px 18px; display:flex; justify-content:center; align-items:center; gap:7px; color:var(--subtle); text-align:center; font-size:11px; }
```
(retira `background:var(--sc-surface-glass-strong); backdrop-filter:var(--sc-blur-chrome); -webkit-backdrop-filter:var(--sc-blur-chrome); border-top:1px solid var(--border-soft);`.)

- [ ] **Step 3: Retirar `backdrop-filter` de popover, toast e import center**

Línea 556, `.popover`:
```css
.popover { position:absolute; z-index:var(--sc-z-popover); top:calc(100% + var(--sc-space-2)); min-width:220px; padding:var(--sc-space-2); border-radius:18px; transform-origin:top right; max-height:calc(100dvh - 80px); overflow-y:auto; overscroll-behavior:contain; scrollbar-width:thin; }
```
(retira `border:1px solid var(--border-soft); background:color-mix(in srgb, var(--sc-color-surface-elevated) 85%, transparent); backdrop-filter:blur(24px) saturate(1.2); -webkit-backdrop-filter:blur(24px) saturate(1.2); box-shadow:var(--sc-shadow-popover);`.)

Retira también la regla `:root[data-theme='light'] .popover { background:color-mix(in srgb, var(--sc-color-surface-elevated) 92%, transparent); }` justo debajo — era una corrección de opacidad específica de tema para el vidrio; deja de tener sentido con fondo opaco.

Línea 2937, `.sc-toast-card`:
```css
.sc-toast-card { pointer-events:auto; display:flex; align-items:center; gap:12px; padding:12px 14px; border-radius:12px; color:var(--sc-color-text-primary); font-size:13px; line-height:1.4; }
```
(retira `border:1px solid var(--sc-color-border-soft); background:var(--sc-color-surface-elevated); box-shadow:var(--sc-shadow-floating); backdrop-filter:blur(16px); -webkit-backdrop-filter:blur(16px);`.)

Retira la línea 2938 entera: `@media (prefers-reduced-transparency:reduce) { .sc-toast-card { backdrop-filter:none; } }` — ya no declara `backdrop-filter`.

Línea 1180, `.import-center-dialog`: retira sólo si comprobaste en el Step 1 que ya no necesita su `box-shadow:var(--sc-shadow-modal);` local (lo aporta `floating`); conserva `border-radius`, `width`, `max-width`, `max-height`, `display`, `grid-template-rows`, `overflow`.

`.mobile-tool-palette` (definición que empieza en la línea 1453, continúa fuera del rango leído en este plan — localízala con `grep -n "backdrop-filter" src/styles.css` centrado en esa zona): retira su `backdrop-filter` y su `background`/`border`/`box-shadow` si los declara localmente antes de unirse a `floating`.

- [ ] **Step 4: Vaciar y retirar los bloques `prefers-reduced-transparency` que ya no tengan objeto**

Revisa la línea 1715-1717 tal como quedó tras las tareas 4-6: a estas alturas debería contener sólo los tres velos legítimos (`.import-center-backdrop`, `.new-exercise-backdrop`, `.mobile-inspector-backdrop`, `.results-sheet-backdrop`) más cualquier selector que **esta** tarea no haya migrado todavía. Tras los Steps 1-3, retira de esa lista: `.welcome-header`, `.popover`, `.quick-entry-bar` (si no se retiró ya en la Tarea 6), `.cut-tooltip` (ídem), `.welcome-workflow`, `.welcome-footer`, `.welcome-badge-pill`, `.welcome-highlight-item`, `.welcome-filter-tabs`, `.welcome-import-card` (revisa si `.welcome-import-card` tenía `backdrop-filter` propio — si no, ya estaba de más en esta lista y puedes retirarlo igualmente).

El bloque final debe contener **únicamente** los tres velos de modal (`import-center-backdrop`, `new-exercise-backdrop`, `mobile-inspector-backdrop`) y `results-sheet-backdrop`:

```css
@media (prefers-reduced-transparency:reduce) {
  .import-center-backdrop,.new-exercise-backdrop,.mobile-inspector-backdrop,.results-sheet-backdrop { backdrop-filter:none!important; }
}
```

(La segunda regla del bloque original, la que restauraba `background:var(--surface)!important` sobre superficies, se retira entera — los velos no necesitan ese fallback, su color de fondo no dependía del desenfoque.)

- [ ] **Step 5: Escribir el test final de ausencia de `backdrop-filter` fuera de los velos**

En `src/design-system/tokens.test.ts`, dentro de `describe('AG-015 premium visual layer contract')`, añade al final:

```ts
  it('limits backdrop-filter to modal scrims — surfaces are opaque clay, not glass', () => {
    // A scrim separates a modal from the content behind it; a surface should
    // never need to. If backdrop-filter shows up anywhere else, glass crept
    // back in through a component this cycle was supposed to convert.
    const allowedScrims = ['import-center-backdrop', 'new-exercise-backdrop', 'mobile-inspector-backdrop', 'results-sheet-backdrop'];
    const offenders: string[] = [];
    for (const match of componentCss.matchAll(/([^\n{]+)\{[^}]*backdrop-filter\s*:\s*(?!none)[^;]+;[^}]*\}/g)) {
      const selector = match[1].trim();
      if (!allowedScrims.some((scrim) => selector.includes(scrim))) offenders.push(selector.slice(0, 80));
    }
    expect(offenders).toEqual([]);
  });
```

- [ ] **Step 6: Ejecutar y verificar que pasa (ya en verde, porque los Steps 1-4 ya migraron todo)**

Run: `npx vitest run src/design-system/tokens.test.ts`
Expected: PASS. Si falla, el mensaje nombra el selector que todavía declara `backdrop-filter` fuera de los 4 velos — vuelve a los Steps 2-4 y complétalo.

Para confirmar que el test detecta de verdad una regresión (mutación), añade temporalmente `backdrop-filter: blur(2px);` a cualquier selector fuera de la lista de velos (por ejemplo, a `.popover` en `material.css`), ejecuta el test, confirma que falla, y revierte.

- [ ] **Step 7: Escribir el check de `qa.mjs` para overlays**

```js
async function verifyOverlaysClayMaterial(page) {
  // El popover se abre a través de un botón real del topbar (exportar,
  // menú de proyecto) — usa el flujo ya existente en desktop() que lo abre
  // antes de leer estilos, o abre uno aquí si no existe todavía ese paso.
  const popover = await readClayMaterial(page, '.popover');
  return {
    popoverHasNoBackdropFilter: popover.backdropFilter === 'none',
    popoverHasFloatingShadow: popover.boxShadow.includes('inset'),
  };
}
```

Llama desde `desktop()`, en el punto donde ya se abre un menú/popover para otras comprobaciones existentes (reutiliza esa apertura en vez de abrir uno nuevo).

- [ ] **Step 8: Ejecutar `qa` completo**

Run: `npm run build && node qa.mjs`
Expected: PASS en todos los checks — de la bienvenida y del workspace, incluidos los seis grupos añadidos en las tareas 4-9.

- [ ] **Step 9: Revisión visual manual — inicio y workspace en el mismo recorrido**

`npm run dev`. Confirma que la cabecera, el badge de versión, los highlights, los filtros de plantilla, el bloque "modelar/cargar/analizar" y el pie del inicio tienen ahora el mismo lenguaje de materia que el workspace — sin vidrio en ningún sitio de la app. Confirma también que ningún popover del topbar (menú de proyecto, exportar, overflow móvil) quedó ilegible al perder la saturación que el vidrio aportaba sobre fondos con color detrás.

- [ ] **Step 10: Suite completa**

Run: `npm run lint && npx vitest run && npm run typecheck && npm run build`
Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add src/design-system/material.css src/styles.css src/design-system/tokens.test.ts qa.mjs
git commit -m "feat(claymorphism): cierra el barrido de vidrio — overlays y bienvenida a arcilla

Popover, toast, dialogo de importacion y paleta movil de herramientas se
unen al grupo floating. Las 6 reglas .welcome-* con backdrop-filter
(header, badge-pill, highlight-item, filter-tabs, workflow, footer) pasan
a la misma arcilla que el resto de la app — el vidrio desaparece de
structureCo por completo, salvo los tres velos de modal, que siguen
siendo scrim y no superficie. Nuevo test en tokens.test.ts prohibe
backdrop-filter fuera de esa lista de velos, verificado por mutacion.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 10: Verificación del ciclo, presupuesto y reporte

Cierra el ciclo. No se marca completo sin haber visto el resultado de cada comando.

**Files:**
- Modify: `scripts/check-performance-budget.mjs` (re-basar `BUDGET` sólo si la medición lo justifica)
- Create: `reports/YYYY-MM-DD-HHmm-claymorphism-ciclo2.md`
- Modify: `docs/design-system/PALETTE.md` (documentar el rol del chrome del lienzo y la retirada del vidrio)

- [ ] **Step 1: Gate completo**

Run: `npm run verify`
Expected: PASS en lint, verify:protected, test, build. `verify:perf` puede fallar — el Step 3 lo resuelve.

- [ ] **Step 2: Recorrido de navegador completo**

Run: `npm run build && node qa.mjs`
Expected: PASS — todos los checks de la bienvenida (heredados del ciclo 1) y los nuevos del workspace (tareas 4-9).

Run: `npm run qa:webkit`
Expected: PASS. Presta atención especial a targets táctiles ≥44px en el chrome del lienzo tras el Step 9 de la Tarea 6, y a la lectura nativa de PDF si el ciclo tocó algo del centro de importación (Tarea 9).

- [ ] **Step 3: Medir el presupuesto y decidir si se re-basa**

Run: `npm run perf`, toma `eagerBytes` / `eagerGzip`.

Compáralo contra la línea base de cierre del ciclo 1 (663 916 B / 178 161 gzip, techo actual 670 000 / 179 500). `material.css` añade bytes al chunk de entrada; retirar declaraciones duplicadas en `styles.css` los quita; retirar `backdrop-filter` no cambia bytes. El neto es incierto de antemano — **sólo re-basa el techo si la medición real lo exige**, y documenta la provenance con el mismo formato que usó el ciclo 1 en `scripts/check-performance-budget.mjs`:

```
 * Medido YYYY-MM-DD tras el ciclo 2 del rediseño claymorphism: <bytes> bytes, <gzip> gzip.
 *
 * material.css se suma al chunk de entrada (import eager desde App.tsx) para que la
 * materia del chrome del lienzo no dependa de ganar la carrera del chunk lazy de
 * ui.css — la misma clase de fallo que produjo el Critical C1 del ciclo 1. El gate NO
 * se elimina: la medicion antes/despues va en el reporte del ciclo.
```

Si la medición queda por debajo del techo actual, **no toques el script** — dilo explícitamente en el reporte.

- [ ] **Step 4: Re-ejecutar el gate si se tocó el presupuesto**

Run: `npm run verify`
Expected: PASS completo, incluido `verify:perf`.

- [ ] **Step 5: Revisión manual, anotada punto por punto**

1. Consola del navegador sin errores ni warnings (`npm run dev`, recorre inicio y workspace).
2. Navegación completa por teclado del workspace: topbar → rail de herramientas → lienzo → inspector → resultados → menús y popovers.
3. Foco visible en todos los controles anteriores.
4. Tema claro y tema oscuro, alternando desde el topbar.
5. 390×844: sin scroll horizontal, targets ≥44px, dock de herramientas y hoja de resultados funcionales.
6. 1366×768 y 1536×960.
7. Zoom al 200%: sin solapes ni recortes en el chrome del lienzo.
8. `prefers-reduced-motion: reduce`: transiciones desactivadas donde corresponde.
9. `prefers-reduced-transparency: reduce`: sólo los 4 velos reaccionan; todo lo demás no tiene nada que desactivar porque ya es opaco.
10. El riesgo de la Tarea 6, repetido con un modelo distinto al usado durante el desarrollo: el chrome del lienzo sigue siendo legible y no tapa el dibujo.

- [ ] **Step 6: Actualizar `docs/design-system/PALETTE.md`**

Documenta: el rol `--sc-color-border-canvas-chrome` con su medición exacta en ambos temas y **por qué** hizo falta (ningún rol existente alcanzaba 3:1 contra el lienzo); la retirada de los tokens de vidrio y la razón (sustituidos deliberadamente, no deuda); la arquitectura de `material.css` como tercer sitio de materia. Es el mismo tipo de nota que el ciclo 1 dejó sobre el 3,92:1 del verde — evita que alguien "corrija" el borde de vuelta a `--sc-color-border-strong` dentro de tres meses sin saber que ya se midió y falló.

- [ ] **Step 7: Escribir el reporte**

Usa la skill `change-report` para el template exacto. Debe incluir: ficheros creados y modificados por tarea, la tabla de contraste medida del chrome del lienzo, el inventario de selectores movidos a cada grupo de `material.css`, el antes/después del bundle, y los resultados literales de `npm run verify`, `npm run qa` y `npm run qa:webkit`.

- [ ] **Step 8: Commit final**

```bash
git add scripts/check-performance-budget.mjs docs/design-system/PALETTE.md reports/
git commit -m "chore(ciclo2): verificacion final, presupuesto y reporte del ciclo

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Step 9: NO hacer push**

`autoPush` está desactivado a propósito y el repo lo comparten dos agentes. Informa al usuario de que el ciclo está listo y espera confirmación explícita antes de cualquier `git push`.

---

## Cobertura del spec

| Sección del spec | Tarea |
| --- | --- |
| §2.1-2.7 decisiones (arcilla en todo, velos se quedan, bienvenida entra, Surface amplía `as`, arnés doble, tokens de vidrio retirados) | 1, 2, 9 |
| §3.5 relajación deliberada del contrato de vidrio | 1 |
| §4.1 tres sitios de materia, `material.css` eager | 1 |
| §4.2 material componible, `Surface` amplía `as`, huérfanos resueltos | 1 |
| §4.3 chrome del lienzo, borde medido, zonas seguras | 1 (token), 6 |
| §4.4 zonas y su tratamiento (marco, tool rail, chrome, inspector, resultados, overlays, bienvenida) | 4, 5, 6, 7, 8, 9 |
| §4.5 lo que no se refactoriza (anotado, no ejecutado) | fuera de alcance, documentado en el spec |
| §7 testing — arnés de consumo, checks de workspace en `qa.mjs`, verificación por mutación | 2, y cada tarea de vestido (4-9) |
| §8 verificación, presupuesto, reporte | 10 |
| §9 fuera de alcance | no aplica — ninguna tarea lo toca |
| §10 riesgos (chrome oculta el modelo, regresión de cascada, red sin detección, token huérfano, volumen en zonas densas, bundle, ciclo largo) | 1, 2, 6, 7, 10 |
