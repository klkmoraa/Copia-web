// @vitest-environment jsdom
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { en } from '../../i18n/catalogEn';
import { es } from '../../i18n/catalogs';
import { ProjectProvider } from '../../store/ProjectContext';
import { ResultExtremeCard } from './ResultExtremeCard';

/**
 * Las guardas de V-10 que no pueden vivir sólo en la revisión visual.
 *
 * Un resultado favorable y uno desfavorable tienen que salir del mismo molde, y
 * las seis frases prohibidas tienen que seguir sin existir dentro de un año.
 * Por eso ambas cosas son pruebas y no una captura.
 */
const renderCard = (props: Partial<Parameters<typeof ResultExtremeCard>[0]> = {}) => render(
  <ProjectProvider>
    <ResultExtremeCard
      label="M máx. absoluto"
      value="75.000"
      unit="kN·m"
      position="AB · x 3.00 m"
      reliability="reliable"
      accent="moment"
      {...props}
    />
  </ProjectProvider>,
);

/** Lo que define la materia de una tarjeta, sin depender de CSS calculado. */
const materia = (card: HTMLElement) => ({
  level: card.getAttribute('data-level'),
  className: card.className,
  tag: card.tagName,
  shape: [...card.querySelectorAll('*')].map((node) => `${node.tagName}.${node.className}`),
});

afterEach(cleanup);

describe('Result card contracts (V-10)', () => {
  it('keeps value, unit, position and reliability visible at the same time', () => {
    renderCard();
    const card = screen.getByRole('article', { name: /M máx\. absoluto/ });

    expect(within(card).getByText('75.000')).toBeTruthy();
    expect(within(card).getByText('kN·m')).toBeTruthy();
    expect(within(card).getByText('AB · x 3.00 m')).toBeTruthy();
    // La fiabilidad es una línea propia, con su etiqueta y su lectura en texto.
    expect(within(card).getByText('Fiabilidad')).toBeTruthy();
    expect(within(card).getByText('Confiable')).toBeTruthy();
  });

  it('gives a favourable and an unfavourable result exactly the same matter', () => {
    const favourable = renderCard({ value: '12.500', reliability: 'reliable' });
    const favourableCard = screen.getByRole('article', { name: /M máx\. absoluto/ });
    const favourableMateria = materia(favourableCard);
    favourable.unmount();

    renderCard({ value: '-984.200', reliability: 'unreliable' });
    const unfavourableCard = screen.getByRole('article', { name: /M máx\. absoluto/ });

    // Mismo nivel, misma clase, misma estructura: la materia no opina sobre el
    // valor. Lo único que cambia es el texto — el número y la palabra de
    // fiabilidad.
    expect(materia(unfavourableCard)).toEqual(favourableMateria);
    expect(unfavourableCard.getAttribute('data-level')).toBe('raised');
  });

  it('never carries the reliability as a colour on the number', () => {
    renderCard({ reliability: 'unreliable' });
    const card = screen.getByRole('article', { name: /M máx\. absoluto/ });

    const value = card.querySelector('.result-extreme-card__value strong') as HTMLElement;
    expect(value.getAttribute('style')).toBeNull();
    expect(value.className).toBe('');
    expect(value.getAttribute('data-reliability')).toBeNull();
    // El estado sí viaja, pero en la línea de fiabilidad y como palabra.
    const reliability = card.querySelector('.result-extreme-card__reliability dd') as HTMLElement;
    expect(reliability.getAttribute('data-reliability')).toBe('unreliable');
    expect(reliability.textContent).toBe('No confiable');
  });
});

/**
 * Las seis frases prohibidas. Se buscan donde vive el copy de producto —los dos
 * catálogos— y en el propio código de Results, que es donde podría colarse un
 * literal sin pasar por i18n.
 *
 * `Controlado` se comprueba como veredicto (una lectura que empieza por esa
 * palabra), no como cualquier aparición: «reparto controlado» describe un
 * reparto de cargas y no dictamina sobre ningún resultado.
 */
const forbiddenPhrases = [
  'Análisis OK',
  'Cumple con los criterios de diseño',
  'Verificación global',
  'No conforme',
];

const percentageWithOk = /(\d\s*%[^\n]{0,16}\bOK\b)|(\bOK\b[^\n]{0,16}\d\s*%)/i;

const sourceFiles = (directory: string): string[] => readdirSync(directory).flatMap((entry) => {
  const absolute = path.join(directory, entry);
  if (statSync(absolute).isDirectory()) return sourceFiles(absolute);
  return /\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry) ? [absolute] : [];
});

describe('Forbidden result copy', () => {
  it('does not exist in either catalogue', () => {
    for (const catalogue of [es, en]) {
      for (const [key, value] of Object.entries(catalogue)) {
        if (typeof value !== 'string') continue;
        for (const phrase of forbiddenPhrases) {
          expect(`${key}: ${value}`).not.toContain(phrase);
        }
        expect(value).not.toMatch(percentageWithOk);
        expect(value.trim().startsWith('Controlado')).toBe(false);
      }
    }
  });

  it('does not exist as a literal inside Results either', () => {
    const files = sourceFiles(path.join(process.cwd(), 'src', 'features', 'results'));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      for (const phrase of forbiddenPhrases) {
        expect(`${path.basename(file)} :: ${content}`).not.toContain(phrase);
      }
    }
  });
});
