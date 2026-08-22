/// <reference types="node" />

/**
 * El contrato tipográfico.
 *
 * La identidad es la de una app de escritorio del sistema: una sola familia
 * hace la interfaz entera y la jerarquía la llevan el peso, el tamaño y el
 * tracking óptico. La monoespaciada existe para los NÚMEROS y nada más.
 *
 * La primera familia de cada pila no es un archivo: es la cara del sistema
 * (SF Pro, SF Mono), que no se puede empaquetar ni hace falta empaquetar.
 * Inter es el sustituto donde no la hay, elegida por métricas y no por gusto.
 */

import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const fontsCss = readFileSync(new URL('./fonts.css', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const tokensCss = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

/**
 * Los CONSUMIDORES de la escala tipográfica.
 *
 * El sistema declara un suelo —«no baja de 10 px: por debajo no hay
 * tipografía, hay textura»— y una escala de nueve cuerpos. `styles.css` la
 * contradecía con un `font-size:7px!important`, dos de 8,5 px y uno de 9,5 px,
 * y ningún gate abría ese archivo. Un suelo que sólo vive en un README no es
 * un suelo.
 */
const consumerCss = ['../styles.css', '../features/workspace/phase1.css', '../features/canvas/phase2.css', './components/ui.css', './material.css']
  .map((file) => ({ file, css: readFileSync(new URL(file, import.meta.url), 'utf8').replace(/\r\n/g, '\n') }));

describe('tipografía del sistema', () => {
  it('empaqueta sólo los sustitutos, nunca las caras del sistema', () => {
    expect(fontsCss).toContain("font-family: 'Inter'");
    expect(fontsCss).toContain("url('/fonts/inter-latin-variable.woff2')");
    expect(fontsCss).toContain("font-family: 'JetBrains Mono'");
    expect(fontsCss).toContain("url('/fonts/jetbrains-mono-latin-variable.woff2')");
    expect(fontsCss).toContain("url('/fonts/jetbrains-mono-greek-variable.woff2')");
    // SF Pro y SF Mono se nombran en la pila, jamás se sirven: su licencia lo
    // prohíbe y además ya están instaladas donde importan.
    expect(fontsCss).not.toMatch(/src:[^;]*sf-(pro|mono)/i);
    expect(fontsCss.match(/font-display:\s*swap/g)).toHaveLength(3);
  });

  it('pide la cara del sistema primero y el sustituto después', () => {
    const ui = tokensCss.match(/--sc-font-ui:\s*([^;]+);/)?.[1] ?? '';
    const display = tokensCss.match(/--sc-font-display:\s*([^;]+);/)?.[1] ?? '';
    const mono = tokensCss.match(/--sc-font-mono:\s*([^;]+);/)?.[1] ?? '';

    expect(ui.startsWith('-apple-system')).toBe(true);
    expect(ui).toContain('"Inter"');
    expect(display).toContain('"SF Pro Display"');
    expect(display).toContain('"Inter"');
    // La monoespaciada arranca por `ui-monospace` para que el sistema resuelva
    // SF Mono sin que haya que nombrarla como primera opción.
    expect(mono.startsWith('ui-monospace')).toBe(true);
    expect(mono).toContain('"JetBrains Mono"');
  });

  it('no conserva ninguna cara editorial ni la familia de interfaz anterior', () => {
    // La serif de display y la grotesca geométrica eran la voz del sistema
    // anterior. Una app del sistema no tiene cara editorial: tiene una familia.
    for (const legacy of ['DM Serif Display', 'Manrope', 'IBM Plex']) {
      expect(fontsCss).not.toContain(legacy);
      expect(tokensCss).not.toContain(legacy);
    }
    // Una pila que termina en `serif` a secas pide una cara editorial; la de
    // este sistema termina siempre en `sans-serif` o en `monospace`.
    expect(tokensCss).not.toMatch(/--sc-font-(ui|display|heading):[^;]*[^-]serif;/);
    expect(tokensCss).not.toMatch(/--sc-font-[\w-]+:[^;]*Georgia/);
  });

  it('no envía ningún webfont retirado', () => {
    const retired = [
      'dm-serif-display-latin-400.woff2', 'manrope-latin-variable.woff2',
      'ibm-plex-sans-400.woff2', 'ibm-plex-sans-500.woff2', 'ibm-plex-sans-600.woff2',
      'ibm-plex-sans-700.woff2', 'ibm-plex-mono-400.woff2', 'ibm-plex-mono-500.woff2',
    ];
    const present = retired.filter((file) => existsSync(new URL(`../../public/fonts/${file}`, import.meta.url)));
    expect(present).toEqual([]);
  });

  it('usa la escala de cuerpos del escritorio, no la de la web', () => {
    // 13px es el cuerpo de una app del sistema. 14 es el de una página.
    expect(tokensCss).toMatch(/--sc-font-size-body:\s*13px;/);
    expect(tokensCss).toMatch(/--sc-font-size-control:\s*13px;/);
    expect(tokensCss).toMatch(/--sc-font-size-label:\s*11px;/);
    // El semibold real de SF es 590, no 600.
    expect(tokensCss).toMatch(/--sc-font-weight-semibold:\s*590;/);
  });

  it('aprieta el tracking al crecer el cuerpo y no lo abre en las etiquetas', () => {
    const tracking = (name: string) => Number.parseFloat(tokensCss.match(new RegExp(`--sc-tracking-${name}:\\s*(-?[0-9.]+)em`))?.[1] ?? 'NaN');
    expect(tracking('display')).toBeLessThan(tracking('tight'));
    expect(tracking('tight')).toBeLessThan(tracking('control'));
    expect(tracking('control')).toBeLessThanOrEqual(0);
    // La versalita trackeada a 0,16em era la voz anterior, y con ella se fue su
    // token: el sistema no abre las etiquetas, les sube el peso. Que
    // `--sc-tracking-eyebrow` no exista es parte del contrato, no un descuido.
    expect(tokensCss).not.toContain('--sc-tracking-eyebrow');
  });
  it('no baja del suelo de 10 px en ningún consumidor', () => {
    // Por debajo del cuerpo `caption` no hay tipografía, hay textura. Lo
    // decía el sistema y lo incumplían cuatro reglas, una de ellas con
    // `!important` para ganarle la cascada a quien intentara subirlo.
    const floor = Number.parseFloat(tokensCss.match(/--sc-font-size-caption:\s*([0-9.]+)px/)?.[1] ?? 'NaN');
    expect(floor).toBe(10);
    const offenders: string[] = [];
    for (const { file, css } of consumerCss) {
      for (const [index, line] of css.split('\n').entries()) {
        for (const match of line.matchAll(/font-size\s*:\s*([0-9.]+)px/g)) {
          if (Number(match[1]) >= floor) continue;
          offenders.push(`${file}:${index + 1} ${match[0]}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
