/// <reference types="node" />

/**
 * Guards the single numeric presentation policy. structureCo previously had five
 * independent formatters; this test fails the build if a sixth starts growing.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const SOURCE_ROOT = path.resolve(import.meta.dirname, '..');
const POLICY_MODULE = path.join(SOURCE_ROOT, 'utils', 'numberFormat.ts');

/** The engine may round for numerical reasons; only presentation is constrained here. */
const PRESENTATION_ROOTS = ['features', 'design-system', 'education'];

const RAW_FORMATTERS = /\.(toFixed|toPrecision|toExponential)\s*\(/;

const walk = (directory: string): string[] => readdirSync(directory).flatMap((entry) => {
  const full = path.join(directory, entry);
  if (statSync(full).isDirectory()) return walk(full);
  return /\.(ts|tsx)$/.test(entry) && !/\.test\.tsx?$/.test(entry) ? [full] : [];
});

const presentationSources = PRESENTATION_ROOTS
  .map((root) => path.join(SOURCE_ROOT, root))
  .flatMap(walk);

const relative = (file: string) => path.relative(SOURCE_ROOT, file).replaceAll('\\', '/');

describe('numeric presentation policy', () => {
  it('finds the presentation sources it is meant to scan', () => {
    expect(presentationSources.length).toBeGreaterThan(30);
  });

  it('routes every displayed number through utils/numberFormat', () => {
    const offenders = presentationSources
      .filter((file) => RAW_FORMATTERS.test(readFileSync(file, 'utf8')))
      .map(relative);

    // A raw toFixed prints "-0.000" for a shear that crosses zero and "NaN" for a
    // failed analysis. Use formatFixed / formatNumber instead.
    expect(offenders).toEqual([]);
  });

  it('keeps the policy module as the only place that reaches for the primitives', () => {
    expect(RAW_FORMATTERS.test(readFileSync(POLICY_MODULE, 'utf8'))).toBe(true);
  });

  it('declares a not-available marker for every context so absence is never a number', () => {
    const source = readFileSync(POLICY_MODULE, 'utf8');
    const contexts = source.match(/^\s{2}(\w+): \{ significantDigits/gm) ?? [];
    const markers = source.match(/notAvailable: '[^']*'/g) ?? [];
    expect(contexts.length).toBeGreaterThan(0);
    expect(markers).toHaveLength(contexts.length);
  });
});
