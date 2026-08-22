/// <reference types="node" />

/**
 * El contrato de cómo se escribe un atajo.
 *
 * Se comprueban las DOS plataformas pasando el booleano explícito, no
 * simulando `navigator`: lo que este módulo promete es una traducción, y una
 * traducción se verifica en los dos sentidos.
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ariaKeyShortcut, formatShortcut, isApplePlatform, modifierLabel } from './platformKeys';

describe('atajos por plataforma', () => {
  it('escribe los modificadores con el símbolo del sistema en Apple', () => {
    expect(modifierLabel('mod', true)).toBe('⌘');
    expect(modifierLabel('alt', true)).toBe('⌥');
    expect(modifierLabel('shift', true)).toBe('⇧');
    expect(modifierLabel('ctrl', true)).toBe('⌃');
  });

  it('escribe los modificadores con su nombre fuera de Apple', () => {
    expect(modifierLabel('mod', false)).toBe('Ctrl');
    expect(modifierLabel('alt', false)).toBe('Alt');
  });

  it('pega los modificadores a la tecla en Apple y los separa fuera', () => {
    // Así los escribe el sistema en sus propios menús: `⌘K`, no `⌘ + K`.
    expect(formatShortcut('mod+K', true)).toBe('⌘K');
    expect(formatShortcut('mod+K', false)).toBe('Ctrl K');
    expect(formatShortcut('mod+shift+Z', true)).toBe('⌘⇧Z');
    expect(formatShortcut('mod+shift+Z', false)).toBe('Ctrl Shift Z');
  });

  it('deja intacta una tecla sin modificador', () => {
    expect(formatShortcut('Delete', true)).toBe('Delete');
    expect(formatShortcut('R', false)).toBe('R');
  });

  it('da a `aria-keyshortcuts` nombres de tecla del DOM, nunca símbolos', () => {
    // La especificación pide nombres, separados por `+`. Un lector de pantalla
    // que reciba `⌘K` no tiene forma de anunciarlo.
    expect(ariaKeyShortcut('mod+K', true)).toBe('Meta+K');
    expect(ariaKeyShortcut('mod+K', false)).toBe('Control+K');
    expect(ariaKeyShortcut('mod+shift+Z', true)).toBe('Meta+Shift+Z');
    expect(ariaKeyShortcut('Delete', true)).toBe('Delete');
  });

  it('responde la convención portátil cuando no puede saber la plataforma', () => {
    // jsdom no expone `userAgentData` ni una `platform` de Apple. Ante la duda
    // se dice «Ctrl»: un usuario de Mac lo traduce, uno de Windows no traduce «⌘».
    expect(isApplePlatform()).toBe(false);
  });
});

describe('ningún atajo escrito a mano', () => {
  const sources = [
    '../features/workspace/commandRegistry.ts',
    '../features/canvas/ContextualActions.tsx',
    '../features/canvas/ToolRail.tsx',
    '../i18n/catalogs.ts',
  ].map((file) => ({ file, source: readFileSync(new URL(file, import.meta.url), 'utf8') }));

  it('no vuelve a decidir la plataforma por el lector', () => {
    // Convivían tres convenciones para lo mismo: `'Ctrl Z'`, `'Ctrl/Cmd+C'`
    // —que enseña las dos plataformas a la vez— y `<kbd>Ctrl K</kbd>` escrito a
    // mano. Un atajo se declara con `mod` y lo escribe `formatShortcut`.
    const offenders: string[] = [];
    for (const { file, source } of sources) {
      for (const [index, line] of source.split('\n').entries()) {
        if (line.trimStart().startsWith('//') || line.trimStart().startsWith('*')) continue;
        if (/Ctrl\s*\/\s*Cmd|<kbd>\s*Ctrl|shortcut:\s*'Ctrl/.test(line)) {
          offenders.push(`${file}:${index + 1} ${line.trim().slice(0, 80)}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
