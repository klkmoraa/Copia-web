# Rediseño claymorphism · Ciclo 1 — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Llevar `structureCo` a una dirección visual claymorphism —fondo cálido, superficies con volumen difuso, esquinas amplias, verde vivo— empezando por la capa de tokens, la primitiva de elevación, la pantalla de inicio y un pórtico isométrico generado por código.

**Architecture:** Toda la materia clay (sombras de cuatro capas, gradientes, anillos) se declara como tokens en `src/design-system/tokens.css`; los componentes existentes la consumen sin duplicarse. Se añade una única primitiva nueva, `Surface`. El hero se parte en aritmética pura (`src/graphics/isometricPortal.ts`, testeable sin render) y pintura SVG (`src/features/welcome/StructuralPortalHero.tsx`).

**Tech Stack:** React 19, TypeScript ~6.0, Vite 8, Vitest 4 + @testing-library/react, oxlint, lucide-react. CSS moderno con custom properties. **Sin dependencias nuevas.**

**Spec:** `docs/superpowers/specs/2026-08-06-claymorphism-ciclo1-design.md`

## Global Constraints

Todas las tareas heredan estas restricciones. Violarlas rompe el gate, no es una cuestión de estilo.

- **Frontera matemática protegida.** No modificar `src/engine/**`, `src/workers/**`, `src/data/**`, `src/store/ProjectContext.tsx` ni `src/types.ts`. `npm run verify:protected` debe pasar sin actualizar el baseline.
- **Sin dependencias nuevas.** No añadir `three`, `@react-three/fiber`, `@react-three/drei` ni ninguna otra. `package.json` no cambia sus bloques `dependencies` / `devDependencies`.
- **Colores técnicos congelados.** No tocar `--sc-color-bg-canvas` (`#fafcfb` día / `#060b09` noche) ni ningún `--sc-color-technical-*`. Son el contrato medido en `docs/ux-redesign/COLOR_ACCESSIBILITY.md`.
- **Nada de literales de color en CSS de componente.** `styles.css` y `ui.css` no admiten `#hex` ni `rgb()`. `rgba()` sólo dentro de `box-shadow`, `drop-shadow`, `filter` o `background`. Lo impone `tokens.test.ts`.
- **Sin primitivas de color en CSS de componente.** Prohibido `var(--sc-green-500)` y equivalentes fuera de `tokens.css`. Se consumen roles semánticos.
- **Fuente de luz única a 145°.** Ninguna superficie declara su propia dirección de iluminación.
- **Suelos de contraste.** 4.5:1 texto de cuerpo sobre su fondo; 3:1 foco, indicadores y roles técnicos. Verificados por `tokens.test.ts` en ambos temas.
- **Radios densos congelados.** `--sc-radius-xs` … `--sc-radius-md` gobiernan campos numéricos, filas del inspector y tablas. No suben por encima de 14px.
- **Sin `git push`** sin confirmación explícita del usuario.

**Comandos:**

```bash
npx vitest run <ruta>     # un test
npm run lint              # oxlint
npm run typecheck         # tsc -b --noEmit
npm run verify            # gate completo
```

---

### Task 1: Rampa de color clay y neutros cálidos

Sustituye la paleta de grafito frío de AG-015 por la cálida de la referencia, conservando la estructura de capas. Es la tarea con más riesgo de contraste, por eso va primero y sola.

**Files:**
- Modify: `src/design-system/tokens.css` (§1 primitivas, §2 roles día, bloque `[data-theme='dark']`)
- Modify: `index.html:9-10` (`theme-color`)
- Test: `src/design-system/tokens.test.ts` (existente, no se modifica — es el arnés)

**Interfaces:**
- Consumes: nada.
- Produces: los roles semánticos que consumen las tareas 2, 4, 6 y 7. Nombres sin cambios respecto a hoy: `--sc-color-bg-app`, `--sc-color-surface-1`, `--sc-color-surface-2`, `--sc-color-surface-elevated`, `--sc-color-text-primary`, `--sc-color-text-secondary`, `--sc-color-text-muted`, `--sc-color-action-primary`, `--sc-color-action-hover`, `--sc-color-action-pressed`, `--sc-color-action-foreground`, `--sc-color-border`, `--sc-color-focus`. Añade tres roles nuevos: `--sc-color-surface-pressed`, `--sc-color-accent-blue-soft`, `--sc-color-accent-violet-soft`.

- [ ] **Step 1: Ejecutar el test de tokens para tener la línea base verde**

Run: `npx vitest run src/design-system/tokens.test.ts`
Expected: PASS (todo verde antes de tocar nada).

- [ ] **Step 2: Sustituir la rampa verde en §1 de `tokens.css`**

Reemplaza el bloque `--sc-green-50` … `--sc-green-900` por:

```css
  /* Identidad esmeralda clay. Los escalones 400-500 son DECORATIVOS: viven en
     el pórtico del hero, en halos y en superficies suaves. Nunca bajo texto
     blanco — #0b9270 con blanco mide 3,92:1 y el suelo del contrato es 4,5:1.
     La acción arranca en el 600. */
  --sc-green-50: #eff9f5;
  --sc-green-100: #ddf4ec;
  --sc-green-200: #b6e5d4;
  --sc-green-300: #57c7a4;
  --sc-green-400: #27ad83;
  --sc-green-500: #0b9270;
  --sc-green-600: #08795e;  /* blanco encima = 5,37:1 */
  --sc-green-700: #06614b;  /* blanco encima = 7,45:1 */
  --sc-green-800: #054c3b;
  --sc-green-900: #033a2d;
```

- [ ] **Step 3: Añadir los acentos decorativos en §1**

Debajo de `--sc-plum-500`, añade:

```css
  /* Acentos decorativos de la referencia clay. Sólo contenedores de icono y
     fondos suaves: ninguno alcanza el suelo de 3:1 como color de foco, así que
     no se usan para foco, selección ni estado. */
  --sc-sky-100: #e2f2fd;
  --sc-sky-500: #5caee9;
  --sc-lilac-100: #eee8fc;
  --sc-lilac-500: #9677db;
```

- [ ] **Step 4: Repintar los neutros y las acciones en §2 (tema día)**

En el bloque `:root`, sustituye estas declaraciones (deja el resto intactas, en especial `--sc-color-bg-canvas`):

```css
  --sc-color-bg-app: #f4f3f0;
  --sc-color-surface-1: #fbfaf8;
  --sc-color-surface-2: #f4f3f0;
  --sc-color-surface-elevated: var(--sc-white);
  --sc-color-surface-pressed: #ecedea;
  --sc-color-surface-inset: #eceae6;
  --sc-color-surface-toolbar: #f8f8f6;
  --sc-color-surface-input: var(--sc-white);

  --sc-color-text-primary: #24272b;    /* 14,4:1 sobre surface-1 */
  --sc-color-text-secondary: #666d70;  /*  5,05:1 */
  --sc-color-text-muted: #6b7274;      /*  4,70:1 */
  --sc-color-text-disabled: #9aa0a1;
  --sc-color-text-technical: #4a5153;
  --sc-color-text-unit: #7b8284;

  --sc-color-border: #e0ded9;
  --sc-color-border-soft: #eeece8;
  --sc-color-border-strong: #b9b6af;
  --sc-color-divider: #e8e6e1;

  --sc-color-action-primary: var(--sc-green-600);
  --sc-color-action-hover: var(--sc-green-700);
  --sc-color-action-pressed: var(--sc-green-800);
  --sc-color-action-subtle: var(--sc-green-50);

  --sc-color-accent-blue-soft: var(--sc-sky-100);
  --sc-color-accent-violet-soft: var(--sc-lilac-100);
```

`--sc-color-focus`, `--sc-color-selection-stroke` y todos los `--sc-color-technical-*` **no se tocan**: sus valores están medidos y los azules claros de la referencia no llegan al suelo de 3:1.

- [ ] **Step 5: Ejecutar el test de tokens y corregir lo que falle**

Run: `npx vitest run src/design-system/tokens.test.ts`
Expected: PASS. Si falla `meets interface and technical contrast floors`, el mensaje nombra la pareja exacta (`--foreground on --background`). Oscurece el primer plano hasta pasar; **no bajes el suelo del test**.

- [ ] **Step 6: Calibrar el bloque `[data-theme='dark']`**

En `:root[data-theme='dark']`, sustituye los neutros por una familia cálida oscura y añade el rol nuevo:

```css
  --sc-color-bg-app: #121916;
  --sc-color-surface-1: #1b2420;
  --sc-color-surface-2: #202b26;
  --sc-color-surface-elevated: #25312b;
  --sc-color-surface-pressed: #151d1a;
  --sc-color-surface-inset: #151d1a;
  --sc-color-surface-toolbar: #1b2420;
  --sc-color-surface-input: #1b2420;

  --sc-color-text-primary: #f2f5f3;
  --sc-color-text-secondary: #b6c0bb;
  --sc-color-text-muted: #93a09a;

  --sc-color-border: #2e3a35;
  --sc-color-border-soft: #232e29;
  --sc-color-border-strong: #4a5a53;

  --sc-color-action-primary: #45c69a;
  --sc-color-action-hover: #6ed7b2;
  --sc-color-action-pressed: #35b088;
  --sc-color-action-foreground: #06140f;
  --sc-color-action-subtle: #163027;

  --sc-color-accent-blue-soft: #1d2c38;
  --sc-color-accent-violet-soft: #272138;
```

`--sc-color-bg-canvas: #060b09` y los `--sc-color-technical-*` de noche **no se tocan**.

Nota sobre el formato: el resolvedor de `tokens.test.ts` exige hex de **seis** dígitos. Un valor de ocho (con canal alfa) falla con `does not resolve to a six-digit hex color`. Si necesitas transparencia en un rol de color, usa `color-mix(in srgb, … , transparent)`.

- [ ] **Step 7: Ejecutar el test de tokens en ambos temas**

Run: `npx vitest run src/design-system/tokens.test.ts`
Expected: PASS en `Light meets…` y `Dark meets…`.

- [ ] **Step 8: Actualizar `theme-color` en `index.html`**

```html
    <meta name="theme-color" content="#08795E" />
    <meta name="theme-color" content="#121916" media="(prefers-color-scheme: dark)" />
```

- [ ] **Step 9: Suite completa y lint**

Run: `npm run lint && npx vitest run && npm run typecheck`
Expected: PASS. Si `numericPolicy.test.ts` o los tests de componentes fallan, es una regresión real de esta tarea — corrígela, no la silencies.

- [ ] **Step 10: Commit**

```bash
git add src/design-system/tokens.css index.html
git commit -m "feat(tokens): paleta clay de neutros calidos y verde de accion medido

La accion primaria es #08795e y no el #0b9270 de la referencia: con texto
blanco encima el segundo mide 3,92:1 y el contrato de tokens exige 4,5:1.
Los escalones 400-500 quedan como decorativos. Los azules y lavandas claros
de la referencia entran como acento de contenedor, nunca como foco: #5caee9
sobre superficie mide 2,32:1 frente al suelo de 3:1.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Materia clay — sombras de cuatro capas y forma

Sustituye la elevación plana de AG-015 por la materia clay. Sin esto, la paleta de la tarea 1 se ve lavada.

**Files:**
- Modify: `src/design-system/tokens.css` (§4 forma, §5 materia, bloque dark)
- Modify: `src/design-system/tokens.test.ts` (añadir el contrato de la materia clay)

**Interfaces:**
- Consumes: roles de color de la tarea 1.
- Produces: `--sc-shadow-clay-xs`, `--sc-shadow-clay-sm`, `--sc-shadow-clay-md`, `--sc-shadow-clay-lg`, `--sc-shadow-clay-floating`, `--sc-shadow-clay-pressed`, `--sc-radius-hero`. Los consumen las tareas 3, 6 y 7.

- [ ] **Step 1: Escribir el test que falla**

En `src/design-system/tokens.test.ts`, dentro del `describe('AG-015 premium visual layer contract')`, añade al final:

```ts
  it('declares the clay elevation scale in both themes', () => {
    const clay = [
      '--sc-shadow-clay-xs',
      '--sc-shadow-clay-sm',
      '--sc-shadow-clay-md',
      '--sc-shadow-clay-lg',
      '--sc-shadow-clay-floating',
      '--sc-shadow-clay-pressed',
    ];
    for (const token of clay) {
      expect(rootTokens.declarations.has(token), `light ${token}`).toBe(true);
      // Night cannot inherit Day's clay: an inner highlight tuned for warm
      // porcelain reads as a scratch over graphite, and the outer shadow has to
      // shrink because there is no light left for it to remove.
      expect(darkTokens.declarations.has(token), `dark ${token}`).toBe(true);
    }
  });

  it('lights every clay surface from the same direction', () => {
    // Four layers per surface: outer shadow down-right, inner highlight
    // up-left, inner shadow down-right, and the 1px edge. Two of them are
    // `inset`; a level that forgot them would read as a flat card with a blur.
    for (const level of ['--sc-shadow-clay-sm', '--sc-shadow-clay-md', '--sc-shadow-clay-lg']) {
      const value = rootTokens.declarations.get(level) ?? '';
      expect((value.match(/inset/g) ?? []).length, level).toBeGreaterThanOrEqual(2);
    }
    // Pressed inverts: it is inset-only, or it would still look like it floats.
    expect(rootTokens.declarations.get('--sc-shadow-clay-pressed')).not.toMatch(/(^|,)\s*0\s+\d+px/);
  });

  it('reserves a hero radius above the card scale', () => {
    expect(rootTokens.declarations.has('--sc-radius-hero')).toBe(true);
  });
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npx vitest run src/design-system/tokens.test.ts`
Expected: FAIL — `light --sc-shadow-clay-xs` es `false`.

- [ ] **Step 3: Ensanchar la escala de radios en §4**

Sustituye el bloque de radios:

```css
  /* Los tres primeros escalones gobiernan campos numéricos, filas del inspector
     y tablas de resultados: no suben. Redondear una rejilla de datos la vuelve
     más difícil de escanear, no más amable. */
  --sc-radius-xs: 8px;
  --sc-radius-sm: 12px;
  --sc-radius-md: 14px;
  --sc-radius-lg: 22px;
  --sc-radius-xl: 28px;
  --sc-radius-2xl: 36px;
  --sc-radius-hero: 40px;
  --sc-radius-sheet: 28px;
  --sc-radius-pill: 999px;
```

- [ ] **Step 4: Declarar la materia clay en §5 (tema día)**

Debajo de `--sc-shadow-sheet`, añade:

```css
  /* ---- Materia clay -------------------------------------------------
     Una superficie clay son cuatro capas y una sola fuente de luz, a 145°
     (arriba-izquierda). En orden: sombra exterior difusa abajo-derecha, luz
     interior arriba-izquierda, sombra interior abajo-derecha, y el canto de
     1px que separa la superficie del fondo.

     La tinta es grafito verdoso diluido, nunca negro: sobre un fondo cálido el
     negro puro ensucia y delata el degradado. */
  --sc-shadow-clay-xs:
    0 1px 2px rgba(58, 70, 64, 0.05),
    0 2px 6px rgba(58, 70, 64, 0.04),
    inset 1px 1px 2px rgba(255, 255, 255, 0.70),
    inset -1px -1px 2px rgba(107, 128, 117, 0.05);
  --sc-shadow-clay-sm:
    0 2px 5px rgba(58, 70, 64, 0.06),
    0 6px 14px rgba(58, 70, 64, 0.05),
    inset 1px 1px 3px rgba(255, 255, 255, 0.82),
    inset -1px -2px 4px rgba(107, 128, 117, 0.06);
  --sc-shadow-clay-md:
    0 3px 8px rgba(58, 70, 64, 0.06),
    0 12px 28px rgba(58, 70, 64, 0.10),
    inset 2px 2px 4px rgba(255, 255, 255, 0.90),
    inset -2px -3px 6px rgba(107, 128, 117, 0.08);
  --sc-shadow-clay-lg:
    0 4px 12px rgba(58, 70, 64, 0.07),
    0 20px 44px rgba(58, 70, 64, 0.11),
    inset 2px 3px 6px rgba(255, 255, 255, 0.92),
    inset -3px -4px 9px rgba(107, 128, 117, 0.09);
  --sc-shadow-clay-floating:
    0 6px 16px rgba(58, 70, 64, 0.08),
    0 28px 64px rgba(58, 70, 64, 0.14),
    inset 2px 3px 6px rgba(255, 255, 255, 0.90),
    inset -3px -4px 10px rgba(107, 128, 117, 0.10);
  /* Pulsado: la luz se invierte. Sólo capas interiores — cualquier sombra
     exterior lo devolvería a parecer que flota. */
  --sc-shadow-clay-pressed:
    inset 3px 4px 8px rgba(58, 70, 64, 0.12),
    inset -2px -2px 5px rgba(255, 255, 255, 0.78);

  --sc-clay-edge: 1px solid rgba(255, 255, 255, 0.78);
  --sc-gradient-clay: linear-gradient(145deg,
    color-mix(in srgb, var(--sc-color-surface-elevated) 96%, transparent),
    color-mix(in srgb, var(--sc-color-surface-2) 96%, transparent));
```

- [ ] **Step 5: Recalibrar la materia clay en el bloque dark**

Dentro de `:root[data-theme='dark']`, debajo de `--sc-shadow-sheet`, añade:

```css
  /* En Noche la sombra pierde trabajo —no queda luz que quitar— y el borde lo
     gana: sin un canto visible los paneles se funden con el fondo. La luz
     interior pasa de blanca a un velo de marca muy tenue; el blanco puro sobre
     grafito se lee como un arañazo. */
  --sc-shadow-clay-xs:
    0 1px 2px rgba(0, 0, 0, 0.30),
    inset 1px 1px 2px rgba(120, 160, 145, 0.05),
    inset -1px -1px 2px rgba(0, 0, 0, 0.22);
  --sc-shadow-clay-sm:
    0 2px 6px rgba(0, 0, 0, 0.34),
    inset 1px 1px 3px rgba(120, 160, 145, 0.06),
    inset -1px -2px 4px rgba(0, 0, 0, 0.26);
  --sc-shadow-clay-md:
    0 4px 14px rgba(0, 0, 0, 0.38),
    inset 2px 2px 4px rgba(120, 160, 145, 0.07),
    inset -2px -3px 6px rgba(0, 0, 0, 0.30);
  --sc-shadow-clay-lg:
    0 8px 24px rgba(0, 0, 0, 0.42),
    inset 2px 3px 6px rgba(120, 160, 145, 0.08),
    inset -3px -4px 9px rgba(0, 0, 0, 0.32);
  --sc-shadow-clay-floating:
    0 12px 36px rgba(0, 0, 0, 0.48),
    inset 2px 3px 6px rgba(120, 160, 145, 0.08),
    inset -3px -4px 10px rgba(0, 0, 0, 0.34);
  --sc-shadow-clay-pressed:
    inset 3px 4px 8px rgba(0, 0, 0, 0.44),
    inset -2px -2px 5px rgba(120, 160, 145, 0.06);

  --sc-clay-edge: 1px solid rgba(120, 160, 145, 0.14);
  --sc-gradient-clay: linear-gradient(145deg,
    color-mix(in srgb, var(--sc-color-surface-elevated) 96%, transparent),
    color-mix(in srgb, var(--sc-color-surface-1) 96%, transparent));
```

- [ ] **Step 6: Ejecutar el test y verificar que pasa**

Run: `npx vitest run src/design-system/tokens.test.ts`
Expected: PASS, incluidos los tres tests nuevos.

- [ ] **Step 7: Commit**

```bash
git add src/design-system/tokens.css src/design-system/tokens.test.ts
git commit -m "feat(tokens): materia clay de cuatro capas con luz unica a 145 grados

La elevacion de AG-015 era plana: solo capas exteriores. La clay compone
sombra exterior, luz interior, sombra interior y canto, y el test exige que
cada nivel declare sus dos capas inset y que el pulsado no tenga exterior.
Noche se recalibra entera: la sombra pierde trabajo y el borde lo gana.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Primitiva `Surface`

La única primitiva nueva del ciclo. Es el envoltorio de elevación clay tras una API tipada.

**Files:**
- Create: `src/design-system/components/surface.tsx`
- Create: `src/design-system/components/surface.test.tsx`
- Modify: `src/design-system/components/ui.css` (añadir al final)

**Interfaces:**
- Consumes: `--sc-shadow-clay-*`, `--sc-radius-*`, `--sc-clay-edge`, `--sc-gradient-clay` de la tarea 2.
- Produces:
  ```ts
  export type SurfaceLevel = 'flat' | 'raised' | 'floating';
  export interface SurfaceProps extends HTMLAttributes<HTMLElement> {
    level?: SurfaceLevel;      // default 'raised'
    pressed?: boolean;         // default false
    as?: 'div' | 'section' | 'article' | 'aside';  // default 'div'
  }
  export const Surface: (props: SurfaceProps) => ReactElement;
  ```
  Lo consume la tarea 6.

- [ ] **Step 1: Escribir el test que falla**

Crea `src/design-system/components/surface.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Surface } from './surface';

describe('Surface', () => {
  it('defaults to the raised level as a div', () => {
    render(<Surface data-testid="s">contenido</Surface>);
    const el = screen.getByTestId('s');
    expect(el.tagName).toBe('DIV');
    expect(el).toHaveAttribute('data-level', 'raised');
    expect(el).not.toHaveAttribute('data-pressed');
  });

  it('exposes each level as a data attribute', () => {
    render(<><Surface level="flat" data-testid="a" /><Surface level="floating" data-testid="b" /></>);
    expect(screen.getByTestId('a')).toHaveAttribute('data-level', 'flat');
    expect(screen.getByTestId('b')).toHaveAttribute('data-level', 'floating');
  });

  it('marks the pressed state only when asked', () => {
    render(<Surface pressed data-testid="s" />);
    expect(screen.getByTestId('s')).toHaveAttribute('data-pressed', 'true');
  });

  it('renders as the requested semantic element', () => {
    render(<Surface as="section" data-testid="s" />);
    expect(screen.getByTestId('s').tagName).toBe('SECTION');
  });

  it('keeps caller classes alongside its own', () => {
    render(<Surface className="welcome-frame" data-testid="s" />);
    const el = screen.getByTestId('s');
    expect(el).toHaveClass('sc-surface');
    expect(el).toHaveClass('welcome-frame');
  });

  it('forwards arbitrary props such as aria-labelledby', () => {
    render(<Surface aria-labelledby="t" data-testid="s" />);
    expect(screen.getByTestId('s')).toHaveAttribute('aria-labelledby', 't');
  });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npx vitest run src/design-system/components/surface.test.tsx`
Expected: FAIL — no existe `./surface`.

- [ ] **Step 3: Implementar `surface.tsx`**

```tsx
import type { HTMLAttributes, ReactElement } from 'react';

/**
 * Niveles de elevación clay.
 *
 * `flat` no aplica volumen y es el nivel de las zonas técnicas densas —tablas
 * de resultados, filas del inspector, el lienzo—: darles relieve a cada una
 * convierte una rejilla de datos en un montón de fichas y se lee peor.
 * `raised` es la tarjeta normal. `floating` es la elevación de lo que se
 * despega del plano: popovers, hojas, menús.
 */
export type SurfaceLevel = 'flat' | 'raised' | 'floating';

export interface SurfaceProps extends HTMLAttributes<HTMLElement> {
  level?: SurfaceLevel;
  /** Invierte la iluminación. El estilo vive en CSS; aquí sólo se expone el estado. */
  pressed?: boolean;
  as?: 'div' | 'section' | 'article' | 'aside';
}

/**
 * Envoltorio de elevación clay. Es CSS tras una API tipada: no gestiona estado
 * ni conoce el dominio, y por eso puede vivir en la librería sin cruzar la
 * frontera que `dependencyBoundary.test.ts` protege.
 */
export const Surface = ({
  level = 'raised',
  pressed = false,
  as: Tag = 'div',
  className = '',
  children,
  ...rest
}: SurfaceProps): ReactElement => (
  <Tag
    className={`sc-surface${className ? ` ${className}` : ''}`}
    data-level={level}
    data-pressed={pressed ? 'true' : undefined}
    {...rest}
  >
    {children}
  </Tag>
);
```

- [ ] **Step 4: Añadir el CSS al final de `ui.css`**

```css
/* Superficie clay. La materia entera viene de tokens: una sombra escrita aquí
   a mano no seguiría al tema y `tokens.test.ts` la rechazaría. */
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

- [ ] **Step 5: Ejecutar el test y verificar que pasa**

Run: `npx vitest run src/design-system/components/surface.test.tsx`
Expected: PASS, 6 tests.

- [ ] **Step 6: Verificar que no se cruzó la frontera de dependencias**

Run: `npx vitest run src/design-system/components/dependencyBoundary.test.ts src/design-system/tokens.test.ts`
Expected: PASS. El segundo confirma que todo `var(--sc-…)` de `ui.css` resuelve.

- [ ] **Step 7: Commit**

```bash
git add src/design-system/components/surface.tsx src/design-system/components/surface.test.tsx src/design-system/components/ui.css
git commit -m "feat(design-system): primitiva Surface con los tres niveles de elevacion clay

Unica primitiva nueva del ciclo. Los 18 componentes Clay* del encargo ya
existen con otro nombre en esta misma carpeta, asi que el claymorphism entra
como materia en los tokens y no como una libreria paralela.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Geometría isométrica del pórtico

Aritmética pura, sin React. Es lo que hace el hero testeable sin render y sin WebGL.

**Files:**
- Create: `src/graphics/isometricPortal.ts`
- Create: `src/graphics/isometricPortal.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  ```ts
  export interface Vec3 { x: number; y: number; z: number }
  export interface Point2 { x: number; y: number }
  export type MaterialId = 'column' | 'beam' | 'base' | 'capital';
  export interface Face {
    id: string;
    material: MaterialId;
    points: Point2[];
    /** 0 = cara en sombra, 1 = cara de cara a la luz. */
    shade: number;
    /** Mayor = más cerca del observador. Las caras vienen ya ordenadas. */
    depth: number;
  }
  export interface PortalDimensions {
    columnWidth: number; columnHeight: number; columnDepth: number;
    beamHeight: number; beamModules: number;
    baseWidth: number; baseHeight: number;
    span: number;
  }
  export const DEFAULT_PORTAL: PortalDimensions;
  export const buildPortal: (dims?: PortalDimensions) => Face[];
  export const projectIso: (v: Vec3) => Point2;
  ```
  Lo consume la tarea 5.

- [ ] **Step 1: Escribir el test que falla**

Crea `src/graphics/isometricPortal.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildPortal, projectIso, DEFAULT_PORTAL, type Face } from './isometricPortal';

describe('projectIso', () => {
  it('sends the world origin to the projection origin', () => {
    expect(projectIso({ x: 0, y: 0, z: 0 })).toEqual({ x: 0, y: 0 });
  });

  it('mirrors x and z horizontally, so the two are distinguishable', () => {
    const a = projectIso({ x: 1, y: 0, z: 0 });
    const b = projectIso({ x: 0, y: 0, z: 1 });
    expect(a.x).toBeCloseTo(-b.x, 6);
    expect(a.y).toBeCloseTo(b.y, 6);
  });

  it('sends height straight up the screen', () => {
    const ground = projectIso({ x: 0, y: 0, z: 0 });
    const up = projectIso({ x: 0, y: 10, z: 0 });
    expect(up.x).toBeCloseTo(ground.x, 6);
    expect(up.y).toBeLessThan(ground.y);
  });
});

describe('buildPortal', () => {
  const faces = buildPortal();

  it('emits faces for every material of the portal', () => {
    const materials = new Set(faces.map((f) => f.material));
    expect(materials).toEqual(new Set(['column', 'beam', 'base', 'capital']));
  });

  it('splits the lintel into the requested number of modules', () => {
    const beams = faces.filter((f) => f.material === 'beam');
    const modules = new Set(beams.map((f) => f.id.split(':')[1]));
    expect(modules.size).toBe(DEFAULT_PORTAL.beamModules);
  });

  it('returns faces sorted back to front so painting them in order is correct', () => {
    const depths = faces.map((f) => f.depth);
    expect(depths).toEqual([...depths].sort((a, b) => a - b));
  });

  it('gives every face a closed polygon of at least three points', () => {
    for (const face of faces) expect(face.points.length).toBeGreaterThanOrEqual(3);
  });

  it('shades top faces brighter than side faces, from a single light', () => {
    const brightest = (material: Face['material'], kind: string) => {
      const face = faces.find((f) => f.material === material && f.id.endsWith(kind));
      if (!face) throw new Error(`missing ${material} ${kind}`);
      return face.shade;
    };
    expect(brightest('beam', 'top')).toBeGreaterThan(brightest('beam', 'right'));
    expect(brightest('column', 'left')).toBeGreaterThan(brightest('column', 'right'));
  });

  it('keeps shade inside the unit interval so materials can interpolate on it', () => {
    for (const face of faces) {
      expect(face.shade).toBeGreaterThanOrEqual(0);
      expect(face.shade).toBeLessThanOrEqual(1);
    }
  });

  it('is parametric: a wider span moves the right column right', () => {
    const rightOf = (fs: Face[]) => Math.max(...fs.flatMap((f) => f.points.map((p) => p.x)));
    expect(rightOf(buildPortal({ ...DEFAULT_PORTAL, span: DEFAULT_PORTAL.span * 1.5 })))
      .toBeGreaterThan(rightOf(faces));
  });

  it('is deterministic', () => {
    expect(buildPortal()).toEqual(buildPortal());
  });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npx vitest run src/graphics/isometricPortal.test.ts`
Expected: FAIL — no existe `./isometricPortal`.

- [ ] **Step 3: Implementar `isometricPortal.ts`**

> **Corrección post-revisión (2026-08-06).** El bloque de código de abajo tenía dos defectos
> demostrados numéricamente durante la revisión de esta tarea. Si lo transcribes literalmente,
> obtienes un pórtico roto. Los dos:
>
> 1. `boxFaces` emite la cara `−x` (`corner(0, …)` como `${id}:left`), pero `depth = x+y+z`
>    sitúa al observador en el octante `+x/+y/+z`, donde las caras visibles son `+x`, `+y`,
>    `+z`. Medido por muestreo: las tres caras cubren el 54,3 % de la silueta de la columna
>    con un 45,7 % pintado dos veces. Debe emitirse la cara `+x`.
> 2. `LIGHT` apunta al octante `−x/+y/−z`, opuesto a esa cámara. Corregido el punto 1, las dos
>    caras laterales caen ambas al suelo ambiental exacto (0,3400 las dos) y el pórtico sale
>    sin volumen. `LIGHT` debe apuntar a `+x/+y`, conservando su proyección de 145° en el plano
>    de pantalla.
>
> Además, `projectIso` debe llevar el signo como `x: (v.x - v.z) * ISO_X` para que su
> orientación coincida con la de `buildPortal`; y el dintel debe repartir la junta de 1,5 sólo
> entre módulos, no dejar el último 1,5 corto por la derecha. La versión en `main` es la buena;
> este bloque queda como registro de dónde estuvo el fallo.

```ts
/**
 * Geometría del pórtico clay de la bienvenida.
 *
 * Es aritmética, no dibujo: define el pórtico en coordenadas de mundo y lo
 * proyecta a 2D con una matriz isométrica, devolviendo caras ya ordenadas por
 * profundidad y ya sombreadas contra una única fuente de luz. El componente
 * que lo consume sólo pinta.
 *
 * Esa frontera es lo que permite testear la figura con asserts numéricos en
 * jsdom, sin render y sin WebGL — y lo que permitiría sustituir el motor de
 * pintura sin volver a derivar la geometría.
 *
 * La luz es la misma que la de la materia clay: arriba-izquierda, a 145°.
 * Si cambia en `tokens.css`, cambia aquí.
 */

export interface Vec3 { x: number; y: number; z: number }
export interface Point2 { x: number; y: number }

export type MaterialId = 'column' | 'beam' | 'base' | 'capital';

export interface Face {
  id: string;
  material: MaterialId;
  points: Point2[];
  /** 0 = cara en sombra, 1 = cara de cara a la luz. */
  shade: number;
  /** Mayor = más cerca del observador. */
  depth: number;
}

export interface PortalDimensions {
  columnWidth: number;
  columnHeight: number;
  columnDepth: number;
  beamHeight: number;
  beamModules: number;
  baseWidth: number;
  baseHeight: number;
  span: number;
}

/** Proporciones del pórtico de la referencia: ancho, achaparrado y estable. */
export const DEFAULT_PORTAL: PortalDimensions = {
  columnWidth: 22,
  columnHeight: 116,
  columnDepth: 22,
  beamHeight: 26,
  beamModules: 4,
  baseWidth: 40,
  baseHeight: 14,
  span: 150,
};

/** Isométrica clásica 2:1. `y` del mundo sube; en pantalla, baja. */
const ISO_X = Math.cos(Math.PI / 6);
const ISO_Y = Math.sin(Math.PI / 6);

export const projectIso = (v: Vec3): Point2 => ({
  x: (v.z - v.x) * ISO_X,
  y: (v.x + v.z) * ISO_Y - v.y,
});

/** Luz normalizada arriba-izquierda-frente. Coincide con los 145° de la materia clay. */
const LIGHT: Vec3 = (() => {
  const raw = { x: -0.55, y: 0.75, z: -0.37 };
  const length = Math.hypot(raw.x, raw.y, raw.z);
  return { x: raw.x / length, y: raw.y / length, z: raw.z / length };
})();

/** Normales de las tres caras visibles en isométrica. Las ocultas no se emiten. */
const NORMALS: Record<'top' | 'left' | 'right', Vec3> = {
  top: { x: 0, y: 1, z: 0 },
  left: { x: -1, y: 0, z: 0 },
  right: { x: 0, y: 0, z: 1 },
};

/**
 * Lambert con un suelo ambiental. Sin el suelo, la cara derecha cae a negro y
 * el objeto deja de leerse como una pieza de un solo material.
 */
const AMBIENT = 0.34;
const shadeOf = (normal: Vec3) => {
  const lambert = normal.x * LIGHT.x + normal.y * LIGHT.y + normal.z * LIGHT.z;
  return Math.min(1, Math.max(0, AMBIENT + (1 - AMBIENT) * Math.max(0, lambert)));
};

interface Box { x: number; y: number; z: number; w: number; h: number; d: number }

/**
 * Emite las tres caras visibles de una caja. Las otras tres quedan fuera:
 * en isométrica sin transparencia nunca se ven, y emitirlas duplicaría el
 * número de `<path>` del SVG sin cambiar un píxel.
 */
const boxFaces = (id: string, material: MaterialId, box: Box): Face[] => {
  const { x, y, z, w, h, d } = box;
  const corner = (dx: number, dy: number, dz: number) => projectIso({ x: x + dx, y: y + dy, z: z + dz });
  const depth = x + y + z + (w + h + d) / 2;

  return [
    {
      id: `${id}:top`,
      material,
      shade: shadeOf(NORMALS.top),
      depth,
      points: [corner(0, h, 0), corner(w, h, 0), corner(w, h, d), corner(0, h, d)],
    },
    {
      id: `${id}:left`,
      material,
      shade: shadeOf(NORMALS.left),
      depth,
      points: [corner(0, h, 0), corner(0, h, d), corner(0, 0, d), corner(0, 0, 0)],
    },
    {
      id: `${id}:right`,
      material,
      shade: shadeOf(NORMALS.right),
      depth,
      points: [corner(0, h, d), corner(w, h, d), corner(w, 0, d), corner(0, 0, d)],
    },
  ];
};

export const buildPortal = (dims: PortalDimensions = DEFAULT_PORTAL): Face[] => {
  const { columnWidth: cw, columnHeight: ch, columnDepth: cd, beamHeight: bh, beamModules, baseWidth: bw, baseHeight: bhh, span } = dims;
  const faces: Face[] = [];

  /* Dos columnas. `span` es la distancia entre sus caras exteriores. */
  const columnX = [0, span - cw];
  const centreOffset = (bw - cw) / 2;

  for (const [index, x] of columnX.entries()) {
    const side = index === 0 ? 'l' : 'r';

    /* Base: dos cajas apiladas, la de abajo más ancha. */
    faces.push(...boxFaces(`base-${side}-lower`, 'base', {
      x: x - centreOffset, y: 0, z: -centreOffset, w: bw, h: bhh, d: bw,
    }));
    faces.push(...boxFaces(`base-${side}-upper`, 'base', {
      x: x - centreOffset / 2, y: bhh, z: -centreOffset / 2,
      w: cw + centreOffset, h: bhh * 0.7, d: cd + centreOffset,
    }));

    const columnBase = bhh + bhh * 0.7;
    faces.push(...boxFaces(`column-${side}`, 'column', {
      x, y: columnBase, z: 0, w: cw, h: ch, d: cd,
    }));

    /* Capitel: un escalón muy leve entre columna y dintel. */
    faces.push(...boxFaces(`capital-${side}`, 'capital', {
      x: x - 2, y: columnBase + ch, z: -2, w: cw + 4, h: 5, d: cd + 4,
    }));
  }

  /* Dintel dividido en módulos. Se emiten como cajas independientes para que
     la junta entre módulos exista de verdad y no sea una línea pintada. */
  const beamY = bhh + bhh * 0.7 + ch + 5;
  const moduleWidth = span / beamModules;
  for (let i = 0; i < beamModules; i += 1) {
    faces.push(...boxFaces(`beam:${i}`, 'beam', {
      x: i * moduleWidth, y: beamY, z: 0, w: moduleWidth - 1.5, h: bh, d: cd,
    }));
  }

  /* Pintor: de atrás hacia delante. Es el orden en el que hay que dibujarlas. */
  return faces.sort((a, b) => a.depth - b.depth);
};
```

- [ ] **Step 4: Ejecutar el test y verificar que pasa**

Run: `npx vitest run src/graphics/isometricPortal.test.ts`
Expected: PASS, 11 tests.

Si `shades top faces brighter than side faces` falla, el vector `LIGHT` o las normales están mal orientados. Corrige `LIGHT`, no el test: el test codifica la dirección de luz que la materia clay ya fijó.

- [ ] **Step 5: Lint y typecheck**

Run: `npm run lint && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/graphics/isometricPortal.ts src/graphics/isometricPortal.test.ts
git commit -m "feat(graphics): geometria isometrica parametrica del portico clay

Aritmetica pura, sin React y sin WebGL: define el portico en coordenadas de
mundo, lo proyecta con una matriz isometrica y devuelve caras ordenadas por
profundidad y sombreadas contra una unica luz, la misma de la materia clay.
Separarlo del render es lo que lo hace testeable con asserts numericos.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: `StructuralPortalHero`

La pintura. Consume la geometría de la tarea 4 y los tokens de las tareas 1–2.

**Files:**
- Create: `src/features/welcome/StructuralPortalHero.tsx`
- Create: `src/features/welcome/StructuralPortalHero.test.tsx`
- Delete: `src/features/welcome/WelcomeStructureArt.tsx`
- Modify: `src/styles.css` (reglas `.portal-hero*`; retirar las de `.welcome-art*`)

**Interfaces:**
- Consumes: `buildPortal`, `DEFAULT_PORTAL`, `type Face` de `src/graphics/isometricPortal`.
- Produces: `export const StructuralPortalHero: () => ReactElement`. Lo consume la tarea 6.

- [ ] **Step 1: Escribir el test que falla**

Crea `src/features/welcome/StructuralPortalHero.test.tsx`:

```tsx
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StructuralPortalHero } from './StructuralPortalHero';

describe('StructuralPortalHero', () => {
  it('renders without WebGL, canvas or any external asset', () => {
    const { container } = render(<StructuralPortalHero />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(container.querySelector('canvas')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('iframe')).toBeNull();
  });

  it('stays out of the accessible tree: it is decoration, not content', () => {
    const { container } = render(<StructuralPortalHero />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('focusable', 'false');
    expect(svg).toHaveAttribute('role', 'presentation');
  });

  it('paints one path per face of the geometry', () => {
    const { container } = render(<StructuralPortalHero />);
    expect(container.querySelectorAll('path.portal-hero__face').length).toBeGreaterThan(20);
  });

  it('reserves its box so nothing shifts while the page settles', () => {
    const { container } = render(<StructuralPortalHero />);
    expect(container.querySelector('svg')).toHaveAttribute('viewBox');
    expect(container.querySelector('svg')).toHaveAttribute('preserveAspectRatio');
  });

  it('drives materials from tokens, never from literal colors', () => {
    const { container } = render(<StructuralPortalHero />);
    for (const path of container.querySelectorAll('path.portal-hero__face')) {
      expect(path.getAttribute('fill')).toMatch(/^var\(--sc-/);
    }
  });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npx vitest run src/features/welcome/StructuralPortalHero.test.tsx`
Expected: FAIL — no existe `./StructuralPortalHero`.

- [ ] **Step 3: Implementar `StructuralPortalHero.tsx`**

```tsx
import { useMemo, type CSSProperties } from 'react';
import { buildPortal, type Face, type MaterialId } from '../../graphics/isometricPortal';

/**
 * Pórtico clay de la bienvenida.
 *
 * Pinta la geometría que `isometricPortal.ts` deriva. No hay WebGL: la escena
 * de la referencia es estática —cámara ortográfica fija, sin órbita, materiales
 * mate sin reflejos— así que un motor 3D costaría ~200 KB gzip y una segunda
 * implementación del mismo dibujo para producir el mismo fotograma. Aquí no
 * hay nada que pueda fallar, y por eso tampoco hay fallback que mantener.
 *
 * El color sale de tokens, nunca de literales: los mismos `<path>` dan marfil
 * y verde menta en Día, y gris cálido y verde luminoso en Noche, sin una sola
 * rama condicional.
 *
 * Decorativo a efectos de accesibilidad. Todo lo que comunica está en el texto
 * del hero y en los tres chips de confianza.
 */

/** Token base de cada material. El sombreado modula su luminosidad en CSS. */
const MATERIAL_TOKEN: Record<MaterialId, string> = {
  column: 'var(--sc-color-clay-ivory)',
  beam: 'var(--sc-color-clay-mint)',
  base: 'var(--sc-color-clay-mint-deep)',
  capital: 'var(--sc-color-clay-ivory-deep)',
};

const toPath = (face: Face) =>
  `${face.points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ')} Z`;

export const StructuralPortalHero = () => {
  const faces = useMemo(() => buildPortal(), []);

  return (
    <svg
      className="portal-hero"
      viewBox="-140 -210 320 300"
      preserveAspectRatio="xMidYMid meet"
      role="presentation"
      aria-hidden="true"
      focusable="false"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Suelo cuadriculado. Una rejilla, no una textura: sitúa el objeto en un
          plano sin competir con él. */}
      <g className="portal-hero__ground">
        {Array.from({ length: 9 }, (_, i) => i - 4).map((i) => (
          <g key={i}>
            <line x1={i * 26 - 104} y1={-i * 15 + 60} x2={i * 26 + 104} y2={-i * 15 + 164} />
            <line x1={-i * 26 - 104} y1={-i * 15 + 60} x2={-i * 26 + 104} y2={-i * 15 - 44} />
          </g>
        ))}
      </g>

      {/* Sombra de contacto: una elipse difuminada. Un filtro de sombra real
          sobre 30 paths costaría más de lo que aporta. */}
      <ellipse className="portal-hero__contact" cx="0" cy="66" rx="112" ry="30" />

      {faces.map((face) => (
        <path
          key={face.id}
          className="portal-hero__face"
          d={toPath(face)}
          fill={MATERIAL_TOKEN[face.material]}
          style={{ '--face-shade': face.shade.toFixed(3) } as CSSProperties}
        />
      ))}
    </svg>
  );
};
```

- [ ] **Step 4: Declarar los tokens de material en `tokens.css`**

En `:root`, dentro de §2, añade:

```css
  /* Materiales del pórtico del hero. Son roles de ilustración, no de interfaz:
     nada de texto se apoya en ellos, así que se eligen por lectura de volumen
     y no por contraste. */
  --sc-color-clay-ivory: #f0ece2;
  --sc-color-clay-ivory-deep: #e3ddcf;
  --sc-color-clay-mint: #6fb99a;
  --sc-color-clay-mint-deep: #4f9e80;
```

Y en `:root[data-theme='dark']`:

```css
  --sc-color-clay-ivory: #b9b5ab;
  --sc-color-clay-ivory-deep: #a29e94;
  --sc-color-clay-mint: #57c7a4;
  --sc-color-clay-mint-deep: #3d9c7d;
```

- [ ] **Step 5: Añadir el CSS del hero a `styles.css`**

Sustituye el bloque de reglas `.welcome-art*` por:

```css
/* Pórtico clay. El sombreado por cara llega como `--face-shade` (0 sombra,
   1 luz) y se aplica con `brightness`, de modo que un solo token de material
   produce sus tres caras y el tema no necesita duplicar valores. */
.portal-hero {
  width: 100%;
  height: auto;
  max-width: 440px;
  overflow: visible;
}

.portal-hero__face {
  filter: brightness(calc(0.72 + 0.38 * var(--face-shade, 1)));
  stroke: none;
}

.portal-hero__ground line {
  stroke: var(--sc-color-border-soft);
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
}

.portal-hero__contact {
  fill: var(--sc-color-border-strong);
  opacity: 0.16;
  filter: blur(14px);
}

/* Inclinación con el puntero: 2° como máximo, conducida por el contenedor.
   No rota sola, no hay parallax, y en táctil no existe. */
.welcome-hero-figure {
  perspective: 1100px;
}

@media (hover: hover) and (pointer: fine) {
  .welcome-hero-figure .portal-hero {
    transform: rotateX(calc(var(--tilt-y, 0) * 2deg)) rotateY(calc(var(--tilt-x, 0) * 2deg));
    transition: transform var(--sc-motion-standard) var(--sc-ease-standard);
  }
}

@media (prefers-reduced-motion: reduce) {
  .welcome-hero-figure .portal-hero { transform: none; }
}
```

- [ ] **Step 6: Borrar el arte anterior**

```bash
git rm src/features/welcome/WelcomeStructureArt.tsx
```

Elimina también su import en `WelcomeScreen.tsx:24` y sustituye `<WelcomeStructureArt />` (línea 139) por `<StructuralPortalHero />`, añadiendo `import { StructuralPortalHero } from './StructuralPortalHero';`.

- [ ] **Step 7: Ejecutar los tests**

Run: `npx vitest run src/features/welcome/ src/design-system/tokens.test.ts`
Expected: PASS. `tokens.test.ts` confirma que no quedaron `var(--sc-…)` colgando de las reglas `.welcome-art*` que borraste.

- [ ] **Step 8: Suite completa**

Run: `npm run lint && npx vitest run && npm run typecheck`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add -A src/features/welcome src/graphics src/styles.css src/design-system/tokens.css
git commit -m "feat(welcome): portico clay isometrico generado por codigo

Sustituye WelcomeStructureArt. El sombreado por cara viaja como custom
property y se resuelve con brightness, asi que un token de material produce
sus tres caras y Noche no duplica valores. Decorativo en el arbol accesible:
lo que comunica ya esta en el titular y en los tres chips.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Cabecera del inicio — tema, idioma y drawer móvil

Añade los dos controles que la referencia muestra y que hoy sólo existen dentro del workspace.

**Files:**
- Modify: `src/features/welcome/WelcomeScreen.tsx:104-116` (cabecera)
- Modify: `src/App.test.tsx` (o crear `src/features/welcome/WelcomeHeader.test.tsx`)
- Modify: `src/styles.css` (reglas `.welcome-header*`)

**Interfaces:**
- Consumes: `useWorkspaceUI` y `useProject` re-exportados desde `../../store/ProjectContext`; `Drawer` desde `../../design-system/components/overlays`; `Surface` de la tarea 3.
- Produces: nada que consuman tareas posteriores.

- [ ] **Step 1: Escribir el test que falla**

Crea `src/features/welcome/WelcomeHeader.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ProjectProvider } from '../../store/ProjectContext';
import { WelcomeScreen } from './WelcomeScreen';

const renderWelcome = () =>
  render(<ProjectProvider><WelcomeScreen onOpenWorkspace={() => {}} /></ProjectProvider>);

describe('WelcomeScreen header', () => {
  it('toggles the theme from the welcome screen', async () => {
    const user = userEvent.setup();
    renderWelcome();
    const before = document.documentElement.getAttribute('data-theme');
    await user.click(screen.getByRole('button', { name: /tema|theme/i }));
    expect(document.documentElement.getAttribute('data-theme')).not.toBe(before);
  });

  it('changes the language from the welcome screen', async () => {
    const user = userEvent.setup();
    renderWelcome();
    await user.selectOptions(screen.getByLabelText(/idioma|language/i), 'en');
    expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  it('keeps every header action reachable, and returns focus when the drawer closes', async () => {
    const user = userEvent.setup();
    renderWelcome();
    const trigger = screen.getByRole('button', { name: /menú|menu/i });
    await user.click(trigger);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(trigger).toHaveFocus();
  });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npx vitest run src/features/welcome/WelcomeHeader.test.tsx`
Expected: FAIL — no hay botón de tema.

- [ ] **Step 3: Añadir las claves de i18n que falten**

En `src/i18n/catalogs.ts`, comprueba que existen `theme.light`, `theme.dark`, `language.label`, `language.es`, `language.en` (ya las usa `TopBar.tsx:446-447`). Añade sólo si faltan:

```ts
  'welcome.menu': { es: 'Menú', en: 'Menu' },
```

- [ ] **Step 4: Implementar la cabecera**

En `WelcomeScreen.tsx`, añade a los imports:

```tsx
import { Menu, Moon, Sun } from 'lucide-react';
import { useWorkspaceUI } from '../../store/ProjectContext';
import { Drawer } from '../../design-system/components/overlays';
```

Dentro del componente, junto a los demás hooks:

```tsx
  const { theme, setTheme } = useWorkspaceUI();
  const { updateProjectView } = useProject();
  const [menuOpen, setMenuOpen] = useState(false);

  const themeControl = (
    <button
      className="welcome-header-icon"
      onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
      aria-label={theme === 'light' ? t('theme.dark') : t('theme.light')}
    >
      {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
    </button>
  );

  const languageControl = (
    <label className="welcome-header-language">
      <span className="sr-only">{t('language.label')}</span>
      <select
        value={language}
        onChange={(event) => updateProjectView((draft) => ({
          ...draft,
          settings: { ...draft.settings, language: event.target.value as 'es' | 'en' },
        }))}
      >
        <option value="es">{t('language.es')}</option>
        <option value="en">{t('language.en')}</option>
      </select>
    </label>
  );
```

Sustituye el `<header>` (líneas 107-116) por:

```tsx
        <header className="welcome-header">
          <div className="welcome-brand" aria-label="structureCo">
            <BrandMark size={34} />
            <strong><span>structure</span>Co</strong>
            <span className="welcome-version-tag">v{APP_VERSION}</span>
          </div>
          <div className="welcome-header-actions">
            <button className="welcome-continue-link" onClick={onOpenWorkspace}>
              <span>{t('welcome.continue')}</span> <ArrowRight size={16} />
            </button>
            <div className="welcome-header-desktop-only">
              {languageControl}
              {themeControl}
            </div>
            <button
              className="welcome-header-icon welcome-header-menu"
              onClick={() => setMenuOpen(true)}
              aria-label={t('welcome.menu')}
            >
              <Menu size={20} />
            </button>
          </div>
        </header>
```

Y antes del `</main>`, junto a los otros overlays:

```tsx
      <Drawer
        open={menuOpen}
        onOpenChange={setMenuOpen}
        title={t('welcome.menu')}
        side="right"
      >
        <div className="welcome-menu-body">
          {languageControl}
          {themeControl}
        </div>
      </Drawer>
```

**La API es `onOpenChange: (open: boolean) => void`, no `onClose`.** Y **no escribas código de retorno de foco**: `useModalFocus` ya devuelve el foco al elemento previo al cerrarse (`overlays.tsx:193-196`). Añadir un `ref.focus()` propio compite con el suyo y produce un salto doble. Por eso el disparador no necesita `ref`.

- [ ] **Step 5: Añadir el CSS de la cabecera a `styles.css`**

```css
.welcome-header-actions {
  display: flex;
  align-items: center;
  gap: var(--sc-space-2);
}

.welcome-header-desktop-only { display: flex; align-items: center; gap: var(--sc-space-2); }
.welcome-header-menu { display: none; }

.welcome-header-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: var(--sc-size-target-touch);
  min-height: var(--sc-size-target-touch);
  border: var(--sc-clay-edge);
  border-radius: var(--sc-radius-pill);
  background: var(--sc-gradient-clay);
  box-shadow: var(--sc-shadow-clay-sm);
  color: var(--sc-color-text-secondary);
  transition: var(--sc-transition-control);
}

.welcome-header-icon:hover { color: var(--sc-color-text-primary); box-shadow: var(--sc-shadow-clay-md); }
.welcome-header-icon:active { box-shadow: var(--sc-shadow-clay-pressed); transform: translateY(1px); }

@media (max-width: 767px) {
  .welcome-header-desktop-only { display: none; }
  .welcome-header-menu { display: inline-flex; }
}
```

- [ ] **Step 6: Ejecutar el test y verificar que pasa**

Run: `npx vitest run src/features/welcome/WelcomeHeader.test.tsx`
Expected: PASS, 3 tests.

El tercero verifica el retorno de foco que `useModalFocus` ya implementa. Si falla, el fallo está en el cableado del `Drawer` —o en que algo añadió foco manual que compite con el suyo—, no en que falte gestión de foco. Revisa `modalFocus.test.tsx` antes de escribir nada.

- [ ] **Step 7: Verificar que no se tocó la frontera protegida**

Run: `npm run verify:protected`
Expected: PASS. Esta tarea lee `useWorkspaceUI` y `updateProjectView`, que ya están re-exportados; no debe haber modificado `ProjectContext.tsx`.

- [ ] **Step 8: Commit**

```bash
git add src/features/welcome src/styles.css src/i18n/catalogs.ts
git commit -m "feat(welcome): tema e idioma alcanzables desde el inicio, con drawer en movil

Hasta ahora los dos ajustes solo existian dentro del workspace, asi que
cambiar de tema obligaba a entrar a la mesa de trabajo. Reutiliza el Drawer
y el gestor de foco existentes en vez de anadir un segundo mecanismo.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Vestido clay del inicio y hovers en CSS

Aplica la materia a la pantalla y saca los hovers de `motion`, que es lo que devuelve margen de bundle.

**Files:**
- Modify: `src/styles.css` (reglas `.welcome-*`)
- Modify: `src/features/welcome/WelcomeScreen.tsx:146-243` (sustituir `m.button` por `button` en hovers)

**Interfaces:**
- Consumes: `Surface` (tarea 3), materia clay (tarea 2), `StructuralPortalHero` (tarea 5).
- Produces: nada.

- [ ] **Step 1: Envolver el contenido en el marco clay**

En `WelcomeScreen.tsx`, envuelve `.welcome-content` con `Surface`:

```tsx
import { Surface } from '../../design-system/components/surface';
```

```tsx
        <Surface as="div" level="raised" className="welcome-frame">
          <div className="welcome-content">
            {/* … contenido existente, sin cambios … */}
          </div>
        </Surface>
```

- [ ] **Step 2: Sustituir los hovers de `motion` por CSS**

Cambia las tres `m.button` de `.welcome-hero-launcher` (líneas 147, 159, 171), la de `.welcome-import-card` (línea 197) y la de `.welcome-template-card` (línea 218) por `button` normal, eliminando `whileHover` y `whileTap`.

**Conserva** `AnimatePresence`, `layout` y `{...templateMotion}` en `.welcome-template-card`: son el reflow de lista, el caso que `docs/design-system/MOTION.md` reserva para la librería. Elimina `hoverLift` y `pressDown` si quedan sin uso; `reducedMotion` sigue haciendo falta para `templateMotion`.

- [ ] **Step 3: Escribir las reglas clay en `styles.css`**

```css
.welcome-screen { background: var(--sc-color-bg-app); }

.welcome-frame {
  border-radius: var(--sc-radius-hero);
  padding: clamp(var(--sc-space-6), 4vw, var(--sc-space-8));
}

/* Tarjetas de lanzamiento. La elevación sube en hover y se hunde en press;
   el color de borde acompaña, para que el estado no dependa sólo de la sombra. */
.welcome-launcher-card,
.welcome-import-card,
.welcome-template-card {
  background: var(--sc-gradient-clay);
  border: var(--sc-clay-edge);
  border-radius: var(--sc-radius-xl);
  box-shadow: var(--sc-shadow-clay-sm);
  transition: var(--sc-transition-control);
}

.welcome-launcher-card:hover,
.welcome-import-card:hover,
.welcome-template-card:hover {
  box-shadow: var(--sc-shadow-clay-lg);
  border-color: var(--sc-color-border-strong);
  transform: translateY(-2px);
}

.welcome-launcher-card:active,
.welcome-import-card:active,
.welcome-template-card:active {
  box-shadow: var(--sc-shadow-clay-pressed);
  transform: translateY(1px);
}

.welcome-launcher-card:focus-visible,
.welcome-import-card:focus-visible,
.welcome-template-card:focus-visible {
  outline: var(--sc-focus-ring-width) solid var(--sc-color-focus);
  outline-offset: var(--sc-focus-ring-offset);
}

/* Contenedores de icono: aquí es donde viven el azul y el lavanda de la
   referencia. Decorativos, con el icono en un tono que sí está medido. */
.welcome-launcher-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  border-radius: var(--sc-radius-lg);
  border: var(--sc-clay-edge);
  box-shadow: var(--sc-shadow-clay-sm);
  background: var(--sc-color-action-subtle);
  color: var(--sc-color-action-primary);
}

.welcome-launcher-card--classroom .welcome-launcher-icon {
  background: var(--sc-color-accent-violet-soft);
  color: var(--sc-color-aula);
}

.welcome-launcher-card--recent .welcome-launcher-icon {
  background: var(--sc-color-accent-blue-soft);
  color: var(--sc-color-text-link);
}

/* Pasos numerados: círculos clay, coherentes con los del Modo Aula. */
.welcome-step-num {
  border-radius: var(--sc-radius-pill);
  background: var(--sc-gradient-clay);
  border: var(--sc-clay-edge);
  box-shadow: var(--sc-shadow-clay-xs);
  color: var(--sc-color-action-primary);
}

@media (prefers-reduced-motion: reduce) {
  .welcome-launcher-card,
  .welcome-import-card,
  .welcome-template-card { transition: none; }
  .welcome-launcher-card:hover,
  .welcome-import-card:hover,
  .welcome-template-card:hover,
  .welcome-launcher-card:active,
  .welcome-import-card:active,
  .welcome-template-card:active { transform: none; }
}
```

- [ ] **Step 4: Ejecutar los tests del inicio y del contrato de tokens**

Run: `npx vitest run src/features/welcome/ src/design-system/tokens.test.ts src/App.test.tsx`
Expected: PASS.

Si `keeps the welcome surface free of untokenized elevation` falla, quedó un `box-shadow` con `rgba()` literal dentro de una regla `.welcome*`: muévelo a un token de `tokens.css`.

- [ ] **Step 5: Medir el efecto en el bundle**

Run: `npm run perf`
Expected: la carga inicial **baja** respecto a los 651 107 B / 174 355 gzip de partida, porque los hovers ya no arrastran `motion`. Anota los dos números; la tarea 8 los necesita.

- [ ] **Step 6: Commit**

```bash
git add src/features/welcome src/styles.css
git commit -m "feat(welcome): vestido clay del inicio y hovers conducidos por CSS

Los hovers de tarjeta dejan de pasar por motion, que es justo la deuda que
el comentario de check-performance-budget.mjs senala: eran lo que arrastraba
el nucleo de animacion al chunk de entrada. AnimatePresence se queda solo
donde hace falta de verdad, en el reflow del filtro de plantillas.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: Verificación del ciclo, presupuesto y reporte

Cierra el ciclo. No se marca completo sin haber visto el resultado de cada comando.

**Files:**
- Modify: `scripts/check-performance-budget.mjs` (re-basar `BUDGET` y su provenance)
- Create: `reports/2026-08-06-HHmm-claymorphism-ciclo1.md`
- Modify: `docs/design-system/PALETTE.md` (rampa nueva y la corrección de contraste)

- [ ] **Step 1: Gate completo**

Run: `npm run verify`
Expected: PASS en lint, verify:protected, test, build. `verify:perf` puede fallar — el paso 3 lo resuelve.

- [ ] **Step 2: Recorrido de navegador**

Run: `npm run qa`
Expected: PASS en desktop y móvil. Si falla un selector porque una clase cambió, actualiza `qa.mjs`; si falla una aserción de comportamiento, es una regresión real.

- [ ] **Step 3: Re-basar el presupuesto sobre la medición real**

Run: `npm run perf` y toma `eagerBytes` / `eagerGzip`.

En `scripts/check-performance-budget.mjs`, actualiza `BUDGET` a la medición más un 3 % de margen, y añade a la provenance del comentario:

```
 * Medido 2026-08-06 tras el ciclo 1 del rediseño claymorphism: <bytes> bytes, <gzip> gzip.
 *
 * El usuario autorizó que el presupuesto no limitara este rediseño, así que el techo se
 * re-basa sobre la medición en vez de recortar el diseño para encajar. El gate NO se
 * elimina: existe porque la carga inicial creció de 148 531 a 195 360 gzip sin que nada se
 * pusiera en rojo, y esa señal hace falta para los ciclos 2 y 3. Portar los hovers del
 * inicio a CSS retiró `motion` del chunk de entrada, así que este ciclo debería haber
 * devuelto margen en lugar de consumirlo — si no lo hizo, hay algo que investigar antes de
 * subir el número.
```

- [ ] **Step 4: Re-ejecutar el gate**

Run: `npm run verify`
Expected: PASS completo, incluido `verify:perf`.

- [ ] **Step 5: Revisión manual**

Comprueba y anota el resultado de cada punto:

1. Consola del navegador sin errores ni warnings (`npm run dev`).
2. Navegación completa por teclado del inicio: cabecera → hero → tres tarjetas → filtros → importar → plantillas.
3. Foco visible en todos los controles anteriores.
4. Tema claro y tema oscuro, alternando desde la propia cabecera.
5. 390 × 844: sin scroll horizontal, targets ≥ 44 px, drawer funcional.
6. 1366 × 768 y 1536 × 960.
7. Zoom al 200 %: sin solapes ni recortes.
8. `prefers-reduced-motion: reduce`: la inclinación del pórtico no se aplica y las tarjetas no se desplazan.

- [ ] **Step 6: Actualizar la documentación de paleta**

En `docs/design-system/PALETTE.md`, documenta la rampa clay y **la razón por la que la acción primaria no es el verde de la referencia** — la medición de 3,92:1. Es el dato que evita que alguien lo "corrija" de vuelta dentro de tres meses.

- [ ] **Step 7: Escribir el reporte**

Usa la skill `change-report` para el template exacto. Debe incluir: ficheros creados y modificados, la decisión de no añadir `three` con su justificación numérica, las dos correcciones de contraste, el antes/después del bundle, y los resultados literales de `npm run verify` y `npm run qa`.

- [ ] **Step 8: Commit final**

```bash
git add scripts/check-performance-budget.mjs docs/design-system/PALETTE.md reports/
git commit -m "chore(ciclo1): rebase del presupuesto medido, paleta documentada y reporte

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Step 9: NO hacer push**

`autoPush` está desactivado a propósito y el repo lo comparten dos agentes. Informa al usuario de que el ciclo está listo y espera confirmación explícita antes de cualquier `git push`.

---

## Cobertura del spec

| Sección del spec | Tarea |
| --- | --- |
| §4.1 capa de tokens — paleta | 1 |
| §4.1 capa de tokens — forma y materia | 2 |
| §4.2 componentes — `Surface` | 3 |
| §4.2 componentes — no duplicar `Clay*` | verificado en 3; ninguna tarea crea componentes paralelos |
| §4.3 inicio — marco contenedor | 7 |
| §4.3 inicio — cabecera, tema, idioma, drawer | 6 |
| §4.3 inicio — sección de pasos conservada | 7 |
| §4.4 hero — geometría | 4 |
| §4.4 hero — pintura, materiales, a11y, motion | 5 |
| §4.5 motion — hovers a CSS | 7 |
| §3.1 frontera protegida | 6 (step 7), 8 (step 1) |
| §3.2 colores técnicos congelados | 1 (steps 4, 6) |
| §3.4 contrato de tokens ejecutable | 1, 2, 5, 7 |
| §3.5 sin dependencias nuevas | ninguna tarea toca `package.json` |
| §7 testing | 2, 3, 4, 5, 6 |
| §8 verificación y presupuesto | 8 |
