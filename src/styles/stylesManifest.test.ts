import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import postcss from 'postcss';

const ROOT = path.resolve(import.meta.dirname, '..');
const MANIFEST = path.join(ROOT, 'styles.css');
const SHEETS_DIR = path.join(ROOT, 'styles');

const manifest = readFileSync(MANIFEST, 'utf8');
const importedPaths = [...manifest.matchAll(/@import\s+'([^']+)'/g)].map((match) => match[1]);
const importedChunks = importedPaths
  .filter((imported) => imported.startsWith('./styles/'))
  .map((imported) => imported.replace('./styles/', ''));
const chunkFiles = readdirSync(SHEETS_DIR).filter((file) => file.endsWith('.css'));

describe('manifiesto de hojas', () => {
  it('no declara nada por su cuenta: sólo ordena', () => {
    const root = postcss.parse(manifest, { from: MANIFEST });
    const rules: string[] = [];
    root.walkRules((rule) => { rules.push(rule.selector); });
    expect(rules).toEqual([]);
  });

  it('importa cada tramo exactamente una vez, y no deja ninguno huérfano', () => {
    expect([...importedChunks].sort()).toEqual([...chunkFiles].sort());
    expect(new Set(importedChunks).size).toBe(importedChunks.length);
  });

  it('trae los tokens y las caras antes que cualquier consumidor', () => {
    expect(importedPaths[0]).toBe('./design-system/tokens.css');
    expect(importedPaths[1]).toBe('./design-system/fonts.css');
  });

  /**
   * EL GATE QUE SOSTIENE EL CORTE.
   *
   * Los tramos están numerados porque **ese orden ES la cascada**: cada archivo
   * es un trozo contiguo del monolito, en su sitio. Con la misma especificidad
   * gana la última declaración, y aquí «la última» quiere decir «la del número
   * más alto».
   *
   * No es teórico. Se intentó primero el corte limpio por dominio y movía 2 267
   * selectores: dos selectores distintos que casan sobre el mismo elemento
   * —`.analysis-status` y `.analyze-button` en la barra superior— cambiaron de
   * ganador y el botón de Analizar dejó de ser pulsable a 690×390. Lo cazó
   * `npm run qa`. Reordenar el manifiesto, o renumerar un tramo sin moverlo,
   * reintroduce exactamente esa clase de fallo, y por eso este orden se fija.
   */
  it('importa los tramos en su orden numérico, que es el orden de la cascada', () => {
    const numbered = importedChunks.map((chunk) => {
      const match = /^(\d+)-/.exec(chunk);
      expect(match, `el tramo ${chunk} no lleva número de orden`).toBeTruthy();
      return Number(match?.[1]);
    });
    expect(numbered).toEqual([...numbered].sort((first, second) => first - second));
    // Sin huecos ni repetidos: 01..N, para que el número diga la posición.
    expect(numbered).toEqual(numbered.map((_, index) => index + 1));
  });

  it('mantiene los tramos a un tamaño legible', () => {
    for (const chunk of chunkFiles) {
      const lines = readFileSync(path.join(SHEETS_DIR, chunk), 'utf8').split('\n').length;
      expect(lines, `${chunk} tiene ${lines} líneas`).toBeLessThan(1200);
    }
  });
});
