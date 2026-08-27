import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseAsciiDxf } from './dxfParser';

const fixture = (name: string): string =>
  readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');

describe('DXF representative fixture corpus', () => {
  it('imports R2013 LINE geometry in millimetres and preserves its layers', () => {
    const inspection = parseAsciiDxf(fixture('line-mm-r2013.dxf'));
    expect(inspection).toMatchObject({
      acadVersion: 'AC1027',
      insertionUnits: 4,
      canImport: true,
      requiresUnitSelection: false,
      counts: { accepted: 2, rejected: 0 },
      layers: ['AXIS', 'FRAME'],
    });
    expect(inspection.segments).toHaveLength(2);
  });

  it('expands a closed planar LWPOLYLINE into four straight segments', () => {
    const inspection = parseAsciiDxf(fixture('closed-lwpolyline-m.dxf'));
    expect(inspection.canImport).toBe(true);
    expect(inspection.layers).toEqual(['PERIMETER']);
    expect(inspection.counts).toEqual({ accepted: 1, rejected: 0 });
    expect(inspection.segments).toHaveLength(4);
  });

  it('keeps valid geometry inspectable when INSUNITS requires an explicit choice', () => {
    const inspection = parseAsciiDxf(fixture('line-units-missing.dxf'));
    expect(inspection.canImport).toBe(true);
    expect(inspection.requiresUnitSelection).toBe(true);
    expect(inspection.diagnostics).toContainEqual(expect.objectContaining({
      severity: 'warning', code: 'units-required',
    }));
  });

  it('blocks a mixed LINE plus CIRCLE instead of silently importing only the line', () => {
    const inspection = parseAsciiDxf(fixture('mixed-line-circle.dxf'));
    expect(inspection.counts).toEqual({ accepted: 1, rejected: 1 });
    expect(inspection.segments).toHaveLength(1);
    expect(inspection.canImport).toBe(false);
    expect(inspection.diagnostics).toContainEqual(expect.objectContaining({
      severity: 'error', code: 'unsupported-entity', entityType: 'CIRCLE',
    }));
  });

  it('reports INSERT and classic POLYLINE records as unsupported entities', () => {
    const insert = parseAsciiDxf(fixture('block-insert.dxf'));
    const classic = parseAsciiDxf(fixture('classic-polyline.dxf'));
    expect(insert.canImport).toBe(false);
    expect(insert.diagnostics).toContainEqual(expect.objectContaining({ entityType: 'INSERT' }));
    expect(classic.canImport).toBe(false);
    expect(classic.diagnostics).toContainEqual(expect.objectContaining({ entityType: 'POLYLINE' }));
  });

  it('rejects non-planar LINE geometry with a human diagnostic', () => {
    const inspection = parseAsciiDxf(fixture('non-planar-line.dxf'));
    expect(inspection.canImport).toBe(false);
    expect(inspection.diagnostics).toContainEqual(expect.objectContaining({
      severity: 'error', code: 'non-planar', entityType: 'LINE',
    }));
  });
});
