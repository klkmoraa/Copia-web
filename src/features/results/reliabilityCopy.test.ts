import { describe, expect, it } from 'vitest';
import { translate, type TranslationKey } from '../../i18n/catalogs';
import type { ReliabilityCheck, ReliabilityCheckId } from '../../types';
import { formatScientific } from '../../utils/numberFormat';
import { describeReliabilityCheck, reliabilityCheckLabel, reliabilityCheckLabelKey } from './reliabilityCopy';

const check = (overrides: Partial<ReliabilityCheck> = {}): ReliabilityCheck => ({
  id: 'condition',
  // El motor rellena `label` y `message` en español fijo: es diagnóstico interno,
  // no copy de interfaz, y nada de esto debe llegar a la pantalla tal cual.
  label: 'Condición κ₁ del sistema equilibrado',
  value: 4.2e10,
  limitedAbove: 1e10,
  unreliableAbove: 1e12,
  level: 'limited',
  message: 'Condición κ₁ del sistema equilibrado: 4.200e+10 supera 1e+10.',
  ...overrides,
});

const es = (key: TranslationKey, variables?: Record<string, string | number>) => translate('es', key, variables);
const en = (key: TranslationKey, variables?: Record<string, string | number>) => translate('en', key, variables);

const ALL_IDS: ReliabilityCheckId[] = [
  'condition', 'backward-error', 'forward-error', 'refinement', 'structural-residual',
  'constraints', 'equilibrium', 'load-audit', 'diagram-closure', 'compatibility',
  'p-delta-convergence',
];

describe('reliability cause copy', () => {
  it('names every check id in both languages', () => {
    for (const id of ALL_IDS) {
      expect(reliabilityCheckLabelKey[id], id).toBeTruthy();
      const spanish = reliabilityCheckLabel(check({ id }), es);
      const english = reliabilityCheckLabel(check({ id }), en);
      expect(spanish.length, id).toBeGreaterThan(0);
      expect(english.length, id).toBeGreaterThan(0);
      // Cada idioma dice lo suyo: si coincidieran, la clave estaría sin traducir.
      expect(english, id).not.toBe(spanish);
    }
  });

  it('never leaks the engine label or message into the interface', () => {
    const engineCheck = check();
    expect(reliabilityCheckLabel(engineCheck, en)).not.toBe(engineCheck.label);
    const described = describeReliabilityCheck(engineCheck, en);
    expect(described).not.toBe(engineCheck.message);
    expect(described).not.toContain('supera');
    expect(described).not.toContain('κ₁ del sistema equilibrado');
  });

  it('rebuilds the cause from the structured fields, in the active language', () => {
    // El valor y el umbral se formatean con la política numérica del producto,
    // no con una cadena a mano: así la causa se lee igual que el resto de cifras.
    const limited = check({ level: 'limited' });
    for (const t of [es, en]) {
      const described = describeReliabilityCheck(limited, t);
      expect(described).toContain(formatScientific(4.2e10, 3));
      // El umbral citado es el que se cruzó, no el otro.
      expect(described).toContain(formatScientific(1e10, 0));
      expect(described).not.toContain(formatScientific(1e12, 0));
    }

    const unreliable = check({ level: 'unreliable', value: 5e12 });
    for (const t of [es, en]) {
      expect(describeReliabilityCheck(unreliable, t)).toContain(formatScientific(1e12, 0));
    }
  });

  it('describes the two boolean checks without inventing a magnitude', () => {
    // `refinement` y `p-delta-convergence` valen 0 o 1: leerlos como «1.000e+0
    // supera 0e+0» sería ruido, no una causa.
    for (const id of ['refinement', 'p-delta-convergence'] as const) {
      const described = describeReliabilityCheck(check({ id, value: 1, limitedAbove: 0, level: 'limited' }), en);
      expect(described, id).not.toContain('1.000e+0');
      expect(described.length, id).toBeGreaterThan(0);
      expect(described, id).not.toBe(describeReliabilityCheck(check({ id, value: 1, limitedAbove: 0, level: 'limited' }), es));
    }
  });

  it('says the value could not be bounded when the solver reported none', () => {
    const described = describeReliabilityCheck(check({ value: Number.NaN, level: 'unreliable' }), en);
    expect(described).not.toContain('NaN');
    expect(described.length).toBeGreaterThan(0);
  });
});
