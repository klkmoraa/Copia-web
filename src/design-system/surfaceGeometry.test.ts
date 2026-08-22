/// <reference types="node" />

/**
 * El contrato de geometría y elevación de las superficies.
 *
 * Lo que aquí se afirma NO es "el CSS dice tal cosa en tal línea", sino el
 * contrato semántico: qué escalón de radio corresponde a cada rol, que ninguna
 * proyección supera lo que puede sostener la esquina que la lleva, que la
 * elevación se reparte por altura real y no por importancia, y que ninguna
 * pieza vuelve a esculpirse su propio volumen.
 *
 * Este archivo sustituye al que vigilaba la reconciliación de la materia de
 * arcilla. Aquella escala (control 10 · card 18 · panel/sheet 24 · modal 28) y
 * aquella física (cuatro capas de sombra por pieza, luz a 145°, cavidades
 * excavadas) se retiraron enteras: una esquina de 24px sobre un panel de 300px
 * lee como una pastilla, y un panel no es una pastilla.
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

const themed = (theme: 'light' | 'dark') => (theme === 'light' ? rootTokens : new Map([...rootTokens, ...darkTokens]));

/** Resuelve un token de longitud (`--sc-radius-*`) a píxeles, siguiendo alias. */
const resolvePx = (name: string, tokens: Map<string, string>, seen = new Set<string>()): number => {
  if (seen.has(name)) throw new Error(`Alias circular: ${name}`);
  seen.add(name);
  const value = tokens.get(name);
  if (value === undefined) throw new Error(`Token desconocido: ${name}`);
  const reference = value.match(/^var\((--[\w-]+)\)$/);
  if (reference) return resolvePx(reference[1], tokens, seen);
  const px = value.match(/^(\d+(?:\.\d+)?)px$/);
  if (px) return Number.parseFloat(px[1]);
  if (value === '0') return 0;
  if (value === '999px') return 999;
  throw new Error(`${name} no resuelve a una longitud en px: ${value}`);
};

/** El desenfoque máximo declarado por una sombra, ignorando los colores. */
const maxBlurOf = (shadow: string) => {
  const lengths = shadow
    .replace(/rgba?\([^)]*\)/g, '')
    .replace(/color-mix\([^)]*\)/g, '')
    .split(',')
    .map((layer) => layer.trim().replace(/^inset\s+/, '').split(/\s+/))
    .map((parts) => Number.parseFloat(parts[2] ?? '0'))
    .filter((value) => Number.isFinite(value));
  return lengths.length ? Math.max(...lengths) : 0;
};

describe('escala de radios por rol', () => {
  it('declara la escala del sistema, con un token por rol', () => {
    // La escala de los controles de escritorio del sistema. El reparto es por
    // ROL, no por tamaño de la caja: un botón de 44px y otro de 28px son los
    // dos controles y comparten radio.
    const expected: Record<string, number> = {
      '--sc-radius-data': 0,
      '--sc-radius-control': 7,
      '--sc-radius-card': 12,
      '--sc-radius-panel': 14,
      '--sc-radius-modal': 18,
      '--sc-radius-pill': 999,
    };
    for (const [token, px] of Object.entries(expected)) {
      expect(resolvePx(token, rootTokens), token).toBe(px);
    }
  });

  it('crece de forma monótona del control al modal', () => {
    const ladder = ['--sc-radius-control', '--sc-radius-card', '--sc-radius-panel', '--sc-radius-modal']
      .map((token) => resolvePx(token, rootTokens));
    for (let index = 1; index < ladder.length; index += 1) {
      expect(ladder[index], `el escalón ${index} debe crecer`).toBeGreaterThan(ladder[index - 1]);
    }
  });

  it('no deja ningún alias de radio fuera de la escala', () => {
    // Los alias de migración existen para no repuntar ~180 consumidores de una
    // vez, pero ninguno puede volver a declarar un valor propio: cada uno
    // resuelve a un escalón de la escala, o inventa una geometría paralela.
    const scale = new Set([0, 5, 7, 12, 14, 18, 999]);
    const strays = [...rootTokens.keys()]
      .filter((name) => name.startsWith('--sc-radius-'))
      .map((name) => [name, resolvePx(name, rootTokens)] as const)
      .filter(([, px]) => !scale.has(px))
      .map(([name, px]) => `${name}: ${px}px`);
    expect(strays).toEqual([]);
  });

  it('mantiene la hoja en el escalón de panel y el modal por encima', () => {
    // Una hoja es un panel que nace de un borde, no una interrupción centrada.
    expect(resolvePx('--sc-radius-sheet', rootTokens)).toBe(resolvePx('--sc-radius-panel', rootTokens));
    expect(resolvePx('--sc-radius-modal', rootTokens)).toBeGreaterThan(resolvePx('--sc-radius-panel', rootTokens));
  });
});

describe('escala de elevación', () => {
  it.each(['light', 'dark'] as const)('reparte la altura de forma monótona en %s', (theme) => {
    const tokens = themed(theme);
    const ladder = ['--sc-elevation-1', '--sc-elevation-2', '--sc-elevation-3', '--sc-elevation-4']
      .map((token) => maxBlurOf(tokens.get(token) ?? ''));
    for (let index = 1; index < ladder.length; index += 1) {
      expect(ladder[index], `${theme}: el escalón ${index + 1} debe difuminar más`).toBeGreaterThan(ladder[index - 1]);
    }
  });

  it.each(['light', 'dark'] as const)('empieza cada escalón por un contorno de medio píxel en %s', (theme) => {
    const tokens = themed(theme);
    for (const token of ['--sc-elevation-1', '--sc-elevation-2', '--sc-elevation-3', '--sc-elevation-4']) {
      const value = tokens.get(token) ?? '';
      // `0 0 0 0.5px` es la manera de dibujar un canto nítido en pantallas
      // Retina: un borde de 1px se ve grueso, y sin canto la pieza flota sin
      // silueta.
      expect(value.startsWith('0 0 0 0.5px'), `${theme} · ${token}`).toBe(true);
    }
  });

  it('invierte el color del contorno en la apariencia oscura', () => {
    // Sobre carbón un canto negro no existe: el contorno tiene que ser luz.
    for (const token of ['--sc-elevation-1', '--sc-elevation-2', '--sc-elevation-3', '--sc-elevation-4']) {
      expect(rootTokens.get(token)).toMatch(/^0 0 0 0\.5px rgba\(0, 0, 0/);
      expect(darkTokens.get(token)).toMatch(/^0 0 0 0\.5px rgba\(255, 255, 255/);
    }
  });

  it.each(['light', 'dark'] as const)('mantiene la proyección por debajo del radio que la sostiene en %s', (theme) => {
    const tokens = themed(theme);
    // Una sombra más difusa que la esquina de la pieza deja de leerse como
    // contacto y empieza a leerse como halo. El modal es la única pieza cuyo
    // desenfoque puede superar su radio, porque cubre la pantalla entera y su
    // sombra es oclusión ambiental, no contacto.
    const pairs: ReadonlyArray<readonly [string, string]> = [
      ['--sc-elevation-1', '--sc-radius-control'],
      ['--sc-elevation-2', '--sc-radius-card'],
    ];
    for (const [shadow, radius] of pairs) {
      const blur = maxBlurOf(tokens.get(shadow) ?? '');
      expect(blur, `${theme} · ${shadow}`).toBeLessThanOrEqual(resolvePx(radius, tokens) + 2);
    }
  });
});

describe('el canto y la ausencia de volumen propio', () => {
  it.each(['light', 'dark'] as const)('mide el canto en medio píxel en %s', (theme) => {
    const edge = themed(theme).get('--sc-clay-edge') ?? '';
    expect(edge, theme).toMatch(/^0\.5px solid /);
  });

  it('retira toda la materia de arcilla de los tokens', () => {
    // Los nombres sobreviven como alias porque los consume CSS por todo el
    // repositorio, pero ninguno puede volver a declarar sombras propias: cada
    // uno resuelve a un escalón de elevación o a `none`.
    for (const token of ['--sc-shadow-clay-xs', '--sc-shadow-clay-sm', '--sc-shadow-clay-md', '--sc-shadow-clay-lg', '--sc-shadow-clay-floating']) {
      expect(rootTokens.get(token), token).toMatch(/^var\(--sc-elevation-\d\)$/);
    }
    // Cavidad y pulsado dejan de ser materia: son relleno.
    expect(rootTokens.get('--sc-shadow-clay-inset')).toBe('none');
    expect(rootTokens.get('--sc-shadow-clay-pressed')).toBe('none');
    expect(rootTokens.get('--sc-gradient-clay')).toBe('none');
  });

  it('no deja ninguna pieza declarando su propia fuente de luz', () => {
    // La firma de la arcilla era una sombra interior con desplazamiento en las
    // dos direcciones: eso es una pieza esculpiéndose el volumen a mano.
    const offenders: string[] = [];
    for (const { file, css } of consumerCss) {
      for (const match of css.matchAll(/box-shadow\s*:\s*([^;]+);/g)) {
        const value = match[1];
        if (value.includes('var(--')) continue;
        const stripped = value.replace(/rgba?\([^)]*\)/g, '').replace(/color-mix\([^)]*\)/g, '');
        if (/inset\s+-?\d+px\s+-?\d+px\s+\d+px/.test(stripped)) offenders.push(`${file}: ${value.trim()}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('no deja ningún control elevándose bajo el puntero', () => {
    // Un control del sistema no se despega de la ventana al pasar por encima:
    // se tiñe. El `translateY(-1px)` de hover era la firma del sistema
    // anterior y reaparece con facilidad al copiar una regla vieja.
    const offenders: string[] = [];
    for (const { file, css } of consumerCss) {
      for (const match of css.matchAll(/:hover[^{]*\{([^}]*)\}/g)) {
        if (/transform\s*:\s*translateY\(-\d/.test(match[1])) offenders.push(`${file}: ${match[1].trim().slice(0, 70)}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('no deja ningún degradado de volumen reescrito por componente', () => {
    // El acento rellena; no modela. Un `linear-gradient` construido sobre el
    // color de acción es una pieza volviendo a darse relieve.
    const offenders: string[] = [];
    for (const { file, css } of consumerCss) {
      for (const match of css.matchAll(/linear-gradient\(([^)]*(?:\([^)]*\)[^)]*)*)\)/g)) {
        if (/--sc-color-action|--accent-fill/.test(match[1])) offenders.push(`${file}: ${match[0].slice(0, 70)}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
