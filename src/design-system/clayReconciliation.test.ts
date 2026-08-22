/// <reference types="node" />

/**
 * CRI-105 · Reconciliación Clay — los contratos de V-04 y V-05 que se pueden
 * demostrar de forma estática.
 *
 * Lo que aquí se afirma NO es "el CSS dice tal cosa en tal línea", sino el
 * contrato semántico: qué escalón de radio corresponde a cada rol, que ningún
 * desenfoque supera el radio de la pieza que lo consume, que el pulsado no
 * conserva ninguna capa exterior, que cavidad y pulsado son materias distintas y
 * que ninguna pieza declara su propia fuente de luz.
 *
 * La autoridad de los valores es `brand/brandbook-clay.html` (V-05: control
 * 10px · card 18px · panel/sheet 24px · modal 28px · pill 999px). Este archivo
 * no elige la escala: comprueba que el producto la implementa.
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const readCss = (url: URL) => readFileSync(url, 'utf8').replace(/\r\n/g, '\n');

const tokensCss = readCss(new URL('./tokens.css', import.meta.url));
const materialCss = readCss(new URL('./material.css', import.meta.url));
const uiCss = readCss(new URL('./components/ui.css', import.meta.url));
const stylesCss = readCss(new URL('../styles.css', import.meta.url));
const labCss = readCss(new URL('./lab/componentLab.css', import.meta.url));
const featureCss = [
  '../features/datasheet/datasheet.css',
  '../features/model-doctor/modelDoctor.css',
  '../features/project-hub/projectHub.css',
  '../features/canvas/phase2.css',
  '../features/workspace/phase1.css',
  '../features/bulk-edit/bulkEdit.css',
  '../features/space3d/space3d.css',
  '../features/structure-generator/structureGenerator.css',
].map((file) => ({ file, css: readCss(new URL(file, import.meta.url)) }));

/** Todo el CSS que consume materia, incluido el del Design System. */
const consumerCss = [
  { file: 'design-system/material.css', css: materialCss },
  { file: 'design-system/components/ui.css', css: uiCss },
  { file: 'design-system/lab/componentLab.css', css: labCss },
  { file: 'styles.css', css: stylesCss },
  ...featureCss,
];

const blockFor = (pattern: RegExp) => {
  const match = tokensCss.match(pattern);
  if (!match?.[1]) throw new Error(`Missing token block: ${pattern}`);
  return match[1];
};

const parseDeclarations = (block: string) => {
  const declarations = new Map<string, string>();
  for (const match of block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) declarations.set(match[1], match[2].trim());
  return declarations;
};

const rootTokens = parseDeclarations(blockFor(/:root\s*\{([\s\S]*?)\n\}/));
const darkTokens = parseDeclarations(blockFor(/:root\[data-theme='dark'\]\s*\{([\s\S]*?)\n\}/));
const reducedMotionTokens = parseDeclarations(
  blockFor(/@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?:root\s*\{([\s\S]*?)\n\s*\}\n\}/),
);

const themed = (theme: 'light' | 'dark') => (theme === 'light' ? rootTokens : new Map([...rootTokens, ...darkTokens]));

/** Resuelve un token de longitud (`--sc-radius-*`) a píxeles, siguiendo alias. */
const resolvePx = (name: string, tokens: Map<string, string>, seen = new Set<string>()): number => {
  if (seen.has(name)) throw new Error(`Alias circular: ${name}`);
  seen.add(name);
  const value = tokens.get(name);
  if (value === undefined) throw new Error(`Token desconocido: ${name}`);
  const alias = value.match(/^var\((--[\w-]+)\)$/);
  if (alias) return resolvePx(alias[1], tokens, seen);
  if (/^\d+(\.\d+)?px$/.test(value)) return Number.parseFloat(value);
  if (/^\d+$/.test(value)) return Number.parseFloat(value);
  throw new Error(`${name} no resuelve a una longitud en px: ${value}`);
};

/**
 * Separa un `box-shadow` en capas respetando los paréntesis de `color-mix()`,
 * cuyo interior lleva comas propias.
 */
const shadowLayers = (value: string): string[] => {
  const layers: string[] = [];
  let depth = 0;
  let current = '';
  for (const character of value) {
    if (character === '(') depth += 1;
    if (character === ')') depth -= 1;
    if (character === ',' && depth === 0) {
      layers.push(current.trim());
      current = '';
      continue;
    }
    current += character;
  }
  if (current.trim()) layers.push(current.trim());
  return layers.filter((layer) => layer && layer !== 'none');
};

/**
 * Desenfoque de una capa: el tercer valor de longitud. `0 1px 0` no desenfoca;
 * `8px 9px 19px` desenfoca 19. Las longitudes dentro de `color-mix()` no
 * cuentan, así que se retiran antes de leer.
 */
const layerBlur = (layer: string): number => {
  const withoutFunctions = layer.replace(/[\w-]+\([^()]*(\([^()]*\)[^()]*)*\)/g, ' ');
  const lengths = [...withoutFunctions.matchAll(/(-?\d+(?:\.\d+)?)px/g)].map((match) => Number.parseFloat(match[1]));
  return lengths.length >= 3 ? Math.abs(lengths[2]) : 0;
};

const maxBlur = (value: string): number => Math.max(0, ...shadowLayers(value).map(layerBlur));
const outerLayers = (value: string): string[] => shadowLayers(value).filter((layer) => !/(^|\s)inset(\s|$)/.test(layer));

// ---------------------------------------------------------------------------
// V-05 · Radios por rol
// ---------------------------------------------------------------------------

/** La escala oficial del Brandbook, tal y como la enuncia V-05. */
const BRANDBOOK_RADIUS = {
  '--sc-radius-data': 0,
  '--sc-radius-control': 10,
  '--sc-radius-card': 18,
  '--sc-radius-panel': 24,
  '--sc-radius-modal': 28,
} as const;

describe('CRI-105 · radios por rol (V-05)', () => {
  it('declara la escala oficial del Brandbook, con un token por rol', () => {
    for (const [token, expected] of Object.entries(BRANDBOOK_RADIUS)) {
      expect(resolvePx(token, rootTokens), token).toBe(expected);
    }
    expect(rootTokens.get('--sc-radius-pill')).toBe('999px');
  });

  it('no deja ningún escalón de radio fuera de la escala oficial', () => {
    // La escala genérica (xs/sm/md/lg/…) sobrevive como alias de migración,
    // pero ya no puede inventar un valor propio: cada uno resuelve a un
    // escalón del Brandbook. Un componente que consuma `--sc-radius-md` recibe
    // el radio de control, no un decimoquinto valor intermedio.
    const permitted = new Set<number>([...Object.values(BRANDBOOK_RADIUS), 999]);
    const offenders: string[] = [];
    for (const [name] of rootTokens) {
      if (!name.startsWith('--sc-radius-')) continue;
      if (!permitted.has(resolvePx(name, rootTokens))) offenders.push(`${name}: ${rootTokens.get(name)}`);
    }
    expect(offenders).toEqual([]);
  });

  it('mantiene el radio del sheet en el escalón de panel y el modal por encima', () => {
    // V-05 reparte "panel/sheet" al mismo escalón: una hoja es un panel que
    // nace de un borde, no una interrupción.
    expect(resolvePx('--sc-radius-sheet', rootTokens)).toBe(BRANDBOOK_RADIUS['--sc-radius-panel']);
    expect(resolvePx('--sc-radius-modal', rootTokens)).toBeGreaterThan(resolvePx('--sc-radius-panel', rootTokens));
  });

  it('deja las celdas de una rejilla técnica sin redondeo clay', () => {
    // Redondear una rejilla de datos la vuelve más difícil de escanear. El
    // contrato se declara en `material.css` para que ninguna hoja de feature
    // tenga que repetirlo.
    const grid = materialCss.match(/\.datasheet-grid tbody th,\n\.datasheet-grid tbody td,\n\.datasheet-cell-editor \{[^}]*\}/)?.[0] ?? '';
    expect(grid, 'la rejilla del Datasheet declara su escalón cero').toContain('border-radius: var(--sc-radius-data)');

    const table = materialCss.match(/\[data-level='raised'\] \.results-table,[\s\S]*?\n\}/)?.[0] ?? '';
    expect(table).toContain('border-radius: var(--sc-radius-data)');
  });
});

// ---------------------------------------------------------------------------
// V-04 · Una sola fuente de luz, profundidad por tamaño y desenfoque acotado
// ---------------------------------------------------------------------------

/**
 * Cada escalón de profundidad está emparejado con el radio de las piezas que lo
 * consumen. El desenfoque no puede superar ese radio: una sombra más difusa que
 * la esquina deja de leerse como contacto y pasa a leerse como halo (V-04).
 */
const DEPTH_PAIRING = [
  { shadow: '--sc-shadow-clay-xs', radius: '--sc-radius-control' },
  { shadow: '--sc-shadow-clay-sm', radius: '--sc-radius-control' },
  { shadow: '--sc-shadow-clay-md', radius: '--sc-radius-card' },
  { shadow: '--sc-shadow-clay-lg', radius: '--sc-radius-panel' },
  { shadow: '--sc-shadow-clay-floating', radius: '--sc-radius-panel' },
  { shadow: '--sc-shadow-clay-inset', radius: '--sc-radius-control' },
  { shadow: '--sc-shadow-sheet', radius: '--sc-radius-panel' },
  { shadow: '--sc-shadow-modal', radius: '--sc-radius-modal' },
  { shadow: '--sc-shadow-clay-pressed', radius: '--sc-radius-control' },
  { shadow: '--sc-shadow-clay-action', radius: '--sc-radius-control' },
  { shadow: '--sc-shadow-clay-action-hover', radius: '--sc-radius-control' },
  { shadow: '--sc-shadow-clay-action-pressed', radius: '--sc-radius-control' },
] as const;

describe('CRI-105 · profundidad y desenfoque (V-04)', () => {
  it.each(['light', 'dark'] as const)('no deja ningún desenfoque mayor que el radio de su pieza en %s', (theme) => {
    const tokens = themed(theme);
    const offenders: string[] = [];
    for (const { shadow, radius } of DEPTH_PAIRING) {
      const value = tokens.get(shadow);
      if (value === undefined) {
        offenders.push(`${shadow}: sin declarar`);
        continue;
      }
      const blur = maxBlur(value);
      const limit = resolvePx(radius, tokens);
      if (blur > limit) offenders.push(`${shadow}: blur ${blur}px > ${radius} ${limit}px`);
    }
    expect(offenders).toEqual([]);
  });

  it('no deja ninguna pieza real con más desenfoque que radio', () => {
    // El tope de arriba se mide sobre el emparejamiento previsto. Éste se mide
    // sobre las piezas de verdad: toda regla que declara a la vez su radio y su
    // sombra dice por sí sola qué esquina tiene y cuánto desenfoca. Un
    // componente que consuma el escalón de profundidad equivocado aparece aquí
    // aunque los tokens estén bien.
    const offenders: string[] = [];
    for (const { file, css } of consumerCss) {
      for (const [, selector, body] of css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        const radius = body.match(/border-radius\s*:\s*([^;}]+)/)?.[1]?.trim();
        const shadow = body.match(/box-shadow\s*:\s*([^;}]+)/)?.[1]?.trim();
        if (!radius || !shadow || shadow === 'none') continue;
        // Sólo se puede medir lo que nombra la escala: un radio en `%`, en
        // `calc()` o con cuatro esquinas distintas no tiene un único valor.
        const radiusToken = radius.match(/^var\((--sc-radius-[\w-]+)\)$/)?.[1];
        if (!radiusToken) continue;
        const limit = resolvePx(radiusToken, rootTokens);
        for (const layer of shadowLayers(shadow)) {
          const token = layer.match(/^var\((--sc-shadow-[\w-]+)\)$/)?.[1];
          if (!token) continue;
          for (const theme of ['light', 'dark'] as const) {
            const blur = maxBlur(themed(theme).get(token) ?? '');
            if (blur > limit) offenders.push(`${file} · ${selector.trim().split('\n').pop()} · ${theme}: ${token} blur ${blur}px > ${radiusToken} ${limit}px`);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it.each(['light', 'dark'] as const)('escala la profundidad por tamaño, nunca por importancia, en %s', (theme) => {
    const tokens = themed(theme);
    const ladder = ['--sc-shadow-clay-xs', '--sc-shadow-clay-sm', '--sc-shadow-clay-md', '--sc-shadow-clay-lg'];
    const blurs = ladder.map((token) => maxBlur(tokens.get(token) ?? ''));
    for (let index = 1; index < blurs.length; index += 1) {
      expect(blurs[index], `${ladder[index]} debe ser al menos tan profundo como ${ladder[index - 1]}`)
        .toBeGreaterThanOrEqual(blurs[index - 1]);
    }
  });

  it.each(['light', 'dark'] as const)('ilumina toda la escala clay desde arriba-izquierda en %s', (theme) => {
    const tokens = themed(theme);
    // La sombra oscura cae abajo-derecha (desplazamientos positivos) y la luz
    // sube arriba-izquierda (negativos). Un nivel que invirtiera el signo
    // estaría declarando una segunda fuente de luz.
    for (const token of ['--sc-shadow-clay-xs', '--sc-shadow-clay-sm', '--sc-shadow-clay-md', '--sc-shadow-clay-lg', '--sc-shadow-clay-floating']) {
      const layers = outerLayers(tokens.get(token) ?? '');
      expect(layers.length, `${token} necesita sombra y contraluz exteriores`).toBe(2);
      const [dark, light] = layers.map((layer) => [...layer.matchAll(/(-?\d+(?:\.\d+)?)px/g)].map((match) => Number.parseFloat(match[1])));
      expect(dark[0], `${token} · sombra a la derecha`).toBeGreaterThan(0);
      expect(dark[1], `${token} · sombra hacia abajo`).toBeGreaterThan(0);
      expect(light[0], `${token} · contraluz a la izquierda`).toBeLessThan(0);
      expect(light[1], `${token} · contraluz hacia arriba`).toBeLessThan(0);
    }
  });

  it.each(['light', 'dark'] as const)('invierte la luz al pulsar y no deja ninguna capa exterior en %s', (theme) => {
    const tokens = themed(theme);
    for (const token of ['--sc-shadow-clay-pressed', '--sc-shadow-clay-action-pressed']) {
      const value = tokens.get(token) ?? '';
      expect(outerLayers(value), `${token} no puede conservar sombra exterior`).toEqual([]);
      // Invertida: la parte oscura pasa al interior arriba-izquierda.
      const dark = shadowLayers(value)[0];
      const offsets = [...dark.replace(/[\w-]+\([^()]*(\([^()]*\)[^()]*)*\)/g, ' ').matchAll(/(-?\d+(?:\.\d+)?)px/g)]
        .map((match) => Number.parseFloat(match[1]));
      expect(offsets[1], `${token} · cavidad iluminada desde arriba-izquierda`).toBeGreaterThan(0);
    }
  });

  it.each(['light', 'dark'] as const)('no usa ninguna sombra de color como halo exterior en %s', (theme) => {
    const tokens = themed(theme);
    // La acción menta conserva su relleno y su tinta (CRI-91). Lo que no puede
    // conservar es una fuente de luz verde propia: su elevación exterior es la
    // misma física neutra que el resto del sistema.
    for (const [name, value] of tokens) {
      if (!name.startsWith('--sc-shadow-')) continue;
      const coloured = outerLayers(value).filter((layer) => /var\(--sc-color-|color-mix/.test(layer));
      expect(coloured, `${name} proyecta color hacia fuera`).toEqual([]);
    }
  });

  it('retira el token de halo de marca que nadie puede volver a consumir', () => {
    // `--sc-shadow-contact` era una sombra de marca proyectada bajo cada control
    // "activo": elevaba lo que debía hundirse y lo hacía con luz verde. Sus
    // consumidores pasan a la cavidad neutra.
    expect(rootTokens.has('--sc-shadow-contact')).toBe(false);
    for (const { file, css } of consumerCss) {
      expect(css.includes('--sc-shadow-contact'), file).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// V-04 · Canto obligatorio de 1px
// ---------------------------------------------------------------------------

describe('CRI-105 · canto de 1px', () => {
  it('da canto a RAISED, FLOATING, SHEET y MODAL', () => {
    for (const level of ['raised', 'floating', 'sheet', 'modal']) {
      const index = materialCss.indexOf(`.sc-surface[data-level='${level}']`);
      expect(index, level).toBeGreaterThan(-1);
      const rule = materialCss.slice(materialCss.indexOf('{', index) + 1, materialCss.indexOf('}', index));
      expect(rule, `${level} necesita el canto del sistema`).toContain('border: var(--sc-clay-edge)');
    }
  });

  it('mantiene el canto en 1px en los dos temas: sube de importancia, no de grosor', () => {
    for (const tokens of [rootTokens, darkTokens]) {
      const edge = tokens.get('--sc-clay-edge');
      expect(edge).toBeDefined();
      expect(edge, 'el canto se mide en 1px').toMatch(/^1px solid /);
    }
    // Noche gana contraste cambiando el color del canto, no su grosor.
    expect(darkTokens.get('--sc-clay-edge')).not.toBe(rootTokens.get('--sc-clay-edge'));
  });

  it('reserva los 2px al énfasis estructural declarado', () => {
    expect(rootTokens.get('--sc-border-width')).toBe('1px');
    expect(rootTokens.get('--sc-border-width-strong')).toBe('2px');
  });
});

// ---------------------------------------------------------------------------
// V-04 / V-13 · Cavidad estable y pulsado físico
// ---------------------------------------------------------------------------

describe('CRI-105 · hundimiento y reduced-motion', () => {
  it.each(['light', 'dark'] as const)('separa la cavidad estable del pulsado transitorio en %s', (theme) => {
    const tokens = themed(theme);
    const inset = tokens.get('--sc-shadow-clay-inset') ?? '';
    const pressed = tokens.get('--sc-shadow-clay-pressed') ?? '';
    expect(inset).not.toBe(pressed);
    expect(outerLayers(inset)).toEqual([]);
    expect(outerLayers(pressed)).toEqual([]);
  });

  it('declara un hundimiento táctil pronunciado', () => {
    expect(rootTokens.get('--sc-clay-press-transform')).toBe('translateY(2px) scale(0.98)');
  });

  it('retira el hundimiento —y sólo el hundimiento— con reduced-motion', () => {
    expect(reducedMotionTokens.get('--sc-clay-press-transform')).toBe('none');
    // El relieve no se apaga: ningún token de materia se neutraliza aquí.
    for (const [name] of reducedMotionTokens) {
      expect(name.startsWith('--sc-shadow-'), `${name} no puede desaparecer con reduced-motion`).toBe(false);
      expect(name.startsWith('--sc-clay-edge'), `${name} no puede desaparecer con reduced-motion`).toBe(false);
    }
  });

  it('no deja ningún literal de hundimiento compitiendo con el token', () => {
    // Un `transform` literal en un estado pulsado sobrevive a
    // `prefers-reduced-motion`, porque el token ya no lo alcanza. Los
    // desplazamientos funcionales (arrastre, zoom, hover, animaciones) no
    // entran: sólo el hundimiento físico de un control.
    const pressedState = /([^{}]*(?::active|\[aria-pressed='true'\]|\[data-pressed='true'\]|\[aria-checked='true'\]|\.is-active|\.active)[^{}]*)\{([^{}]*)\}/g;
    const offenders: string[] = [];
    for (const { file, css } of consumerCss) {
      // Los comentarios citan selectores y declaraciones a modo de ejemplo; no
      // son reglas y no pueden desplazar nada.
      for (const [rule, selector, body] of css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(pressedState)) {
        if (!/transform\s*:/.test(body)) continue;
        // Un `:hover` que además filtra por estado elegido no es un pulsado.
        if (selector.includes(':hover')) continue;
        const declaration = body.match(/transform\s*:\s*([^;}]+)/)?.[1]?.trim() ?? '';
        if (/var\(--sc-clay-press-transform\)/.test(declaration)) continue;
        if (declaration === 'none') continue;
        // Geometría, no hundimiento: `translateX` mueve el pulgar de un
        // interruptor y `scaleX` estira el subrayado de una pestaña hasta su
        // ancho. Ninguno de los dos representa que la pieza baje.
        if (/^(translateX|scaleX)\([^)]*\)$/.test(declaration)) continue;
        void rule;
        offenders.push(`${file}: ${selector.trim().split('\n').pop()} → ${declaration}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// V-02 · Clay para el cascarón, plano y exacto para la ingeniería
// ---------------------------------------------------------------------------

describe('CRI-105 · planitud técnica', () => {
  it('conserva los seis niveles materiales', () => {
    for (const level of ['flat', 'inset', 'raised', 'floating', 'sheet', 'modal']) {
      expect(materialCss).toContain(`[data-level='${level}']`);
    }
  });

  it('deja BASE sin volumen', () => {
    const flatIndex = materialCss.indexOf(".sc-surface[data-level='flat']");
    const flat = materialCss.slice(materialCss.indexOf('{', flatIndex) + 1, materialCss.indexOf('}', flatIndex));
    expect(flat).toContain('box-shadow: none');
    expect(flat).not.toContain('gradient');
  });

  it('deja las zonas técnicas densas sin sombra clay ni gradiente', () => {
    const baseIndex = materialCss.indexOf('.datasheet-grid-scroll');
    const base = materialCss.slice(baseIndex, materialCss.indexOf('}', baseIndex));
    for (const selector of ['.datasheet-grid-scroll', '.datasheet-grid tbody th', '.datasheet-grid tbody td', '.inspector-numeric-field__control']) {
      expect(base).toContain(selector);
    }
    expect(base).toContain('box-shadow: none');
    expect(base).toContain('background-image: none');
  });

  it('no eleva ningún nivel dentro de sí mismo', () => {
    const nested = materialCss.match(/\[data-level='raised'\] \[data-level='raised'\],[\s\S]*?\n\}/)?.[0] ?? '';
    expect(nested).toContain("[data-level='floating'] [data-level='floating']");
    expect(nested).toContain("[data-level='modal'] [data-level='modal']");
    expect(nested).toContain('box-shadow: none');
    // `.inspector-summary` vivía en el grupo RAISED dentro de `.inspector-panel`,
    // que ya es RAISED: dos elevaciones sin cambio de nivel entre ellas.
    const raisedIndex = materialCss.indexOf(".sc-surface[data-level='raised']");
    const raised = materialCss.slice(raisedIndex, materialCss.indexOf('{', raisedIndex));
    expect(raised).not.toContain('.inspector-summary');
    // Y `styles.css` tampoco puede devolvérsela por especificidad: la regla
    // `.inspector-panel .inspector-summary` (0,2,0) gana a la de materia (0,1,0).
    const insidePanel = stylesCss.match(/\.inspector-panel \.inspector-summary \{[^}]*\}/)?.[0] ?? '';
    expect(insidePanel, 'la regla existe y es la que decide').not.toBe('');
    expect(insidePanel).toContain('box-shadow:none');
    expect(insidePanel).not.toContain('--sc-clay-edge');
  });

  it('mantiene la impresión de resultados plana', () => {
    const print = materialCss.match(/@media print \{[\s\S]*?\n\}/)?.[0] ?? '';
    expect(print).toContain('.results-panel');
    expect(print).toContain('box-shadow:none');
    expect(print).toContain('border:0');
  });
});

// ---------------------------------------------------------------------------
// Deuda conocida en alcance · `.canvas-layer-switch`
// ---------------------------------------------------------------------------

describe('CRI-105 · una sola definición del interruptor de capas', () => {
  it('no deja dos definiciones base peleando por la cascada', () => {
    // `styles.css` declaraba `.canvas-layer-switch` dos veces con geometrías
    // incompatibles (32×18 con pulgar de 14px y 38×22 con pulgar de 16px), y
    // ninguna de las dos tenía marcado: `LayerToggle` emite
    // `.sc-layer-toggle__switch`. La definición viva es la del Design System.
    const withoutComments = stylesCss.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(withoutComments, 'ninguna regla vuelve a declarar `.canvas-layer-switch`')
      .not.toContain('canvas-layer-switch');
    const base = [...uiCss.matchAll(/^\.sc-layer-toggle__switch\s*\{/gm)];
    expect(base.length, 'una sola definición base del interruptor').toBe(1);
    const rule = uiCss.slice(uiCss.indexOf('.sc-layer-toggle__switch {'));
    expect(rule.slice(0, rule.indexOf('}'))).toContain('border-radius: var(--sc-radius-pill)');
    // El pulgar y el estado marcado siguen existiendo.
    expect(uiCss).toContain('.sc-layer-toggle__switch i');
    expect(uiCss).toContain('.sc-layer-toggle.is-checked .sc-layer-toggle__switch');
  });
});

// ---------------------------------------------------------------------------
// V-04 · Ningún componente declara su propia fuente de luz
// ---------------------------------------------------------------------------

describe('CRI-105 · una sola fuente de luz', () => {
  it('no deja ninguna sombra de materia escrita a mano fuera de los tokens', () => {
    // Una sombra de varias capas es materia, y la materia vive en `tokens.css`.
    // Se permiten los trazos de una sola capa sin desenfoque (subrayados,
    // separadores, anillos), que no describen volumen.
    const offenders: string[] = [];
    for (const { file, css } of consumerCss) {
      for (const [, value] of css.matchAll(/box-shadow\s*:\s*([^;}]+)/g)) {
        const declaration = value.trim();
        if (declaration === 'none' || declaration === 'inherit') continue;
        const layers = shadowLayers(declaration);
        const handmade = layers.filter((layer) => !/var\(--sc-/.test(layer));
        if (handmade.length === 0) continue;
        if (handmade.every((layer) => layerBlur(layer) === 0)) continue;
        offenders.push(`${file}: ${declaration}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('no deja ningún gradiente de volumen clay reescrito por componente', () => {
    // El relleno de arcilla teñida es `--sc-gradient-clay-action`, y su mitad
    // en sombra es la única que mezcla con negro. Repetir ese literal por
    // componente es declarar una segunda fuente de luz con el mismo ángulo y
    // la libertad de desviarse en el siguiente cambio. Los tintes de identidad
    // y los degradados técnicos (rampa de demanda, rejilla del papel, máscaras
    // de desvanecido) no modelan volumen y no entran aquí.
    const shading: string[] = [];
    const surfaceVolume: string[] = [];
    for (const { file, css } of consumerCss) {
      for (const [match] of css.matchAll(/color-mix\([^()]*(?:\([^()]*\)[^()]*)*\bblack\b[^()]*\)/g)) {
        shading.push(`${file}: ${match.slice(0, 90)}`);
      }
      for (const [match] of css.matchAll(/linear-gradient\([^;]*?\)(?=\s*[;,}])/g)) {
        const stops = [...match.matchAll(/var\((--sc-color-surface-[\w-]+)\)/g)];
        if (stops.length >= 2) surfaceVolume.push(`${file}: ${match.slice(0, 90)}`);
      }
    }
    expect(shading, 'la mitad en sombra del volumen clay vive sólo en tokens.css').toEqual([]);
    expect(surfaceVolume, 'modelar volumen con dos superficies es materia, y la materia es token').toEqual([]);
  });
});
