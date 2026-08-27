// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  PERSONAL_SECTIONS_STORAGE_KEY,
  calculateParametricSection,
  createPersonalSection,
  decodePersonalSections,
  deletePersonalSection,
  duplicatePersonalSection,
  encodePersonalSections,
  importPersonalSections,
  readPersonalSections,
  updatePersonalSection,
  writePersonalSections,
} from './personalSections';

const NOW = '2026-08-24T12:00:00.000Z';
const LATER = '2026-08-24T13:00:00.000Z';

beforeEach(() => localStorage.clear());

describe('parametric personal sections', () => {
  it('calculates independently checkable solid rectangle and circle properties', () => {
    const rectangle = calculateParametricSection({ family: 'rectangle', width: 0.3, depth: 0.5 });
    expect(rectangle.area).toBeCloseTo(0.15, 15);
    expect(rectangle.inertiaX).toBeCloseTo(0.003125, 15);
    expect(rectangle.inertiaY).toBeCloseTo(0.001125, 15);
    expect(rectangle.sectionModulusX).toBeCloseTo(0.0125, 15);
    expect(rectangle.sectionModulusY).toBeCloseTo(0.0075, 15);
    expect(rectangle.radiusX).toBeCloseTo(Math.sqrt(0.003125 / 0.15), 15);
    expect(rectangle.radiusY).toBeCloseTo(Math.sqrt(0.001125 / 0.15), 15);

    const circle = calculateParametricSection({ family: 'circle', diameter: 0.2 });
    expect(circle.area).toBeCloseTo(Math.PI * 0.2 ** 2 / 4, 15);
    expect(circle.inertiaX).toBeCloseTo(Math.PI * 0.2 ** 4 / 64, 15);
    expect(circle.inertiaY).toBe(circle.inertiaX);
    expect(circle.radiusX).toBeCloseTo(0.05, 15);
  });

  it('calculates symmetric I and uniform rectangular box by subtraction', () => {
    const iSection = calculateParametricSection({
      family: 'symmetric-i', depth: 0.5, width: 0.2, webThickness: 0.01, flangeThickness: 0.02,
    });
    const expectedArea = 2 * 0.2 * 0.02 + (0.5 - 2 * 0.02) * 0.01;
    const expectedIx = (0.2 * 0.5 ** 3 - (0.2 - 0.01) * (0.5 - 2 * 0.02) ** 3) / 12;
    expect(iSection.area).toBeCloseTo(expectedArea, 15);
    expect(iSection.inertiaX).toBeCloseTo(expectedIx, 15);

    const box = calculateParametricSection({ family: 'rectangular-box', depth: 0.4, width: 0.3, thickness: 0.02 });
    expect(box.area).toBeCloseTo(0.3 * 0.4 - 0.26 * 0.36, 15);
    expect(box.inertiaX).toBeCloseTo((0.3 * 0.4 ** 3 - 0.26 * 0.36 ** 3) / 12, 15);
  });

  it('rejects non-finite, implausible, or self-intersecting geometry with field paths', () => {
    expect(() => calculateParametricSection({ family: 'rectangle', width: 0, depth: 0.5 })).toThrow(/width/);
    expect(() => calculateParametricSection({ family: 'circle', diameter: Number.NaN })).toThrow(/diameter/);
    expect(() => calculateParametricSection({ family: 'rectangular-box', depth: 0.2, width: 0.2, thickness: 0.1 })).toThrow(/thickness/);
    expect(() => calculateParametricSection({ family: 'symmetric-i', depth: 0.2, width: 0.2, webThickness: 0.2, flangeThickness: 0.01 })).toThrow(/webThickness/);
    expect(() => calculateParametricSection({ family: 'rectangle', width: 11, depth: 0.5 })).toThrow(/width/);
  });

  it('creates, revises, duplicates, and deletes stable personal identities without catalog ids', () => {
    const created = createPersonalSection([], {
      name: '  Viga 30 × 50  ', definition: { family: 'rectangle', width: 0.3, depth: 0.5 },
    }, 'personal-section:one', NOW);
    expect(created[0]).toMatchObject({
      kind: 'personal-parametric-section', id: 'personal-section:one', revision: 1,
      name: 'Viga 30 × 50', formulaVersion: 'section-properties-v1', createdAt: NOW, updatedAt: NOW,
      definition: { family: 'rectangle', width: 0.3, depth: 0.5 },
      properties: { area: 0.15 },
    });
    expect(created[0].properties.inertiaX).toBeCloseTo(0.003125, 15);
    expect(created[0]).not.toHaveProperty('sectionId');

    const updated = updatePersonalSection(created, 'personal-section:one', {
      name: 'Viga revisada', definition: { family: 'rectangle', width: 0.25, depth: 0.5 },
    }, LATER);
    expect(updated[0]).toMatchObject({ id: 'personal-section:one', revision: 2, name: 'Viga revisada', createdAt: NOW, updatedAt: LATER });
    expect(created[0].revision).toBe(1);

    const duplicated = duplicatePersonalSection(updated, 'personal-section:one', 'Viga copia', 'personal-section:two', LATER);
    expect(duplicated[1]).toMatchObject({ id: 'personal-section:two', revision: 1, name: 'Viga copia', createdAt: LATER });
    expect(deletePersonalSection(duplicated, 'personal-section:one')).toEqual([duplicated[1]]);
  });

  it('round-trips a versioned export and refuses collisions or tampered derived properties', () => {
    const library = createPersonalSection([], {
      name: 'Caja', definition: { family: 'rectangular-box', depth: 0.4, width: 0.3, thickness: 0.02 },
    }, 'personal-section:box', NOW);
    const serialized = encodePersonalSections(library);
    expect(decodePersonalSections(serialized)).toEqual(library);
    expect(() => importPersonalSections(library, serialized)).toThrow(/identificador/i);

    const tampered = JSON.parse(serialized) as { sections: Array<{ properties: { area: number } }> };
    tampered.sections[0].properties.area = 999;
    expect(() => decodePersonalSections(JSON.stringify(tampered))).toThrow(/properties\.area/);
  });

  it('keeps storage separate from projects and rejects corrupt envelopes without rewriting', () => {
    const project = '{"protected":"project"}';
    localStorage.setItem('structureCo.project', project);
    const library = createPersonalSection([], {
      name: 'Círculo', definition: { family: 'circle', diameter: 0.2 },
    }, 'personal-section:circle', NOW);
    expect(writePersonalSections(localStorage, library)).toEqual({ ok: true });
    expect(readPersonalSections(localStorage)).toEqual(library);
    expect(localStorage.getItem('structureCo.project')).toBe(project);

    const corrupt = '{not-json';
    localStorage.setItem(PERSONAL_SECTIONS_STORAGE_KEY, corrupt);
    expect(readPersonalSections(localStorage)).toEqual([]);
    expect(localStorage.getItem(PERSONAL_SECTIONS_STORAGE_KEY)).toBe(corrupt);
  });
});
