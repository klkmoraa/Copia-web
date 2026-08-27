import { describe, expect, it } from 'vitest';
import { findStandardMaterial } from '../../data/standardMaterials';
import { findStandardSection } from '../../data/standardSections';
import type { MemberModel, ProjectModel } from '../../types';
import {
  buildStructuralBom,
  buildStructuralBomCsv,
  createStructuralBomCsvBlob,
  structuralBomCsvFilename,
} from './structuralBom';

const material = findStandardMaterial('steel-a992')!;
const section = findStandardSection('w6x9')!;

const catalogMember = (id: string, i: string, j: string, type: 'frame' | 'truss' = 'frame'): MemberModel => ({
  id, i, j, type,
  E: material.elasticModulus,
  A: section.area,
  I: type === 'truss' ? 0 : section.inertiaX,
  density: material.density,
  materialId: material.id,
  materialOrigin: 'catalog',
  sectionId: section.id,
  sectionOrigin: 'catalog',
});

const project = (): ProjectModel => ({
  schemaVersion: 6,
  id: 'P-BOM',
  name: 'Pórtico número 1, clase',
  nodes: [
    { id: 'N1', x: 0, y: 0, support: { type: 'none' } },
    { id: 'N2', x: 3, y: 4, support: { type: 'none' } },
    { id: 'N3', x: 6, y: 4, support: { type: 'none' } },
    { id: 'N4', x: 9, y: 8, support: { type: 'none' } },
  ],
  members: [
    catalogMember('M1', 'N1', 'N2'),                       // 5 m
    catalogMember('M2', 'N2', 'N3'),                       // 3 m, discontinuous segment
    catalogMember('M3', 'N1', 'N2'),                       // duplicate geometry counts independently
    catalogMember('GF-001', 'N1', 'N3', 'truss'),          // generated IDs are ordinary provenance
    {
      id: 'U1', i: 'N3', j: 'N4', type: 'frame',
      E: 25_000_000, A: 0.01, I: 8e-5, density: 2_400,
      materialOrigin: 'custom', sectionOrigin: 'custom',
    },
    {
      id: 'R1', i: 'N1', j: 'N2', type: 'rigid',
      E: 1, A: 1, I: 1, density: 1,
      materialOrigin: 'custom', sectionOrigin: 'custom',
    },
    catalogMember('BAD', 'N1', 'MISSING'),
  ],
  loadCases: [], combinations: [], nodalLoads: [], memberLoads: [], memberInitialEffects: [],
  settings: {
    units: 'kN-m', language: 'es', gridSize: 1, snap: true,
    showGrid: true, showNodeLabels: true, showMemberLabels: true,
    showLocalAxes: false, showLoads: true, showDimensions: true,
    showResultValues: true, diagramScale: 1, deformedScale: 1, diagramSide: 'positive',
  },
});

describe('structural BOM', () => {
  it('groups only explicit catalog identities and keeps every source member as provenance', () => {
    const source = project();
    const before = JSON.stringify(source);
    const bom = buildStructuralBom(source);

    expect(bom).toMatchObject({
      schemaVersion: 1,
      kind: 'structural-bom',
      project: { id: 'P-BOM', schemaVersion: 6 },
      basis: {
        geometry: 'node-to-node-euclidean',
        grouping: 'explicit-material-section-member-type',
        allowancePercent: 0,
        lengthUnit: 'm', massUnit: 'kg', selfWeightUnit: 'kN',
      },
    });

    const frame = bom.rows.find((row) => row.rowId === 'catalog:frame:steel-a992:w6x9')!;
    expect(frame.identityStatus).toBe('catalog');
    expect(frame.memberCount).toBe(3);
    expect(frame.totalLengthM).toBeCloseTo(13, 12);
    expect(frame.totalVolumeM3).toBeCloseTo(13 * section.area, 12);
    expect(frame.totalMassKg).toBeCloseTo(13 * section.area * material.density, 12);
    expect(frame.totalSelfWeightKn).toBeCloseTo(frame.totalMassKg! * 9.80665 / 1000, 12);
    expect(frame.provenance).toEqual([
      { memberId: 'M1', nodeI: 'N1', nodeJ: 'N2', lengthM: 5 },
      { memberId: 'M2', nodeI: 'N2', nodeJ: 'N3', lengthM: 3 },
      { memberId: 'M3', nodeI: 'N1', nodeJ: 'N2', lengthM: 5 },
    ]);

    const generated = bom.rows.find((row) => row.rowId === 'catalog:truss:steel-a992:w6x9')!;
    expect(generated.provenance.map((item) => item.memberId)).toEqual(['GF-001']);

    const unresolved = bom.rows.find((row) => row.rowId === 'member:U1')!;
    expect(unresolved).toMatchObject({
      identityStatus: 'unresolved',
      memberCount: 1,
      totalLengthM: 5,
      totalVolumeM3: 0.05,
      totalMassKg: 120,
      warnings: ['explicit-catalog-identity-required'],
    });
    expect(unresolved.provenance.map((item) => item.memberId)).toEqual(['U1']);

    expect(bom.excluded).toEqual([
      { memberId: 'BAD', reason: 'invalid-geometry' },
      { memberId: 'R1', reason: 'rigid-member' },
    ]);
    expect(JSON.stringify(source)).toBe(before);
  });

  it('filters by family and identity without changing the model or inventing a purchase allowance', () => {
    const source = project();
    const bom = buildStructuralBom(source, { memberTypes: ['frame'], identity: 'catalog' });

    expect(bom.filters).toEqual({ memberTypes: ['frame'], identity: 'catalog' });
    expect(bom.rows.map((row) => row.rowId)).toEqual(['catalog:frame:steel-a992:w6x9']);
    expect(bom.totals).toMatchObject({ rowCount: 1, memberCount: 3, totalLengthM: 13 });
    expect(bom.basis.allowancePercent).toBe(0);
    expect(bom).not.toHaveProperty('cost');
    expect(JSON.stringify(source)).toBe(JSON.stringify(project()));
  });

  it('fails catalog grouping closed when quantity properties drift and never merges unresolved members numerically', () => {
    const source = project();
    source.members = [
      { ...catalogMember('D1', 'N1', 'N2'), A: section.area * 1.01 },
      { ...catalogMember('D2', 'N2', 'N3'), density: material.density * 0.99 },
    ];
    const bom = buildStructuralBom(source);

    expect(bom.rows.map((row) => row.rowId)).toEqual(['member:D1', 'member:D2']);
    expect(bom.rows.every((row) => row.identityStatus === 'unresolved' && row.memberCount === 1)).toBe(true);
    expect(bom.rows.map((row) => row.warnings)).toEqual([
      ['catalog-quantity-properties-drifted'],
      ['catalog-quantity-properties-drifted'],
    ]);
  });

  it('exports one stable rectangular CSV with machine numbers and explicit provenance', async () => {
    const source = project();
    const bom = buildStructuralBom(source);
    const first = buildStructuralBomCsv(bom);
    const second = buildStructuralBomCsv(buildStructuralBom(source));

    expect(first).toBe(second);
    expect(first.startsWith('\uFEFFschema_version,row_id,identity_status')).toBe(true);
    expect(first.endsWith('\r\n')).toBe(true);
    expect(first).toContain('catalog:frame:steel-a992:w6x9,catalog,frame');
    expect(first).toContain('M1:N1-N2:5|M2:N2-N3:3|M3:N1-N2:5');
    expect(first).not.toMatch(/cost|price|waste|allowance/i);
    expect(structuralBomCsvFilename(source)).toBe('portico-numero-1-clase-bom-estructural.csv');

    const blob = createStructuralBomCsvBlob(bom);
    expect(blob.type).toBe('text/csv;charset=utf-8');
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    // Blob.text() strips a UTF-8 BOM while decoding; the remaining payload is
    // still exactly the stable CSV body after that deliberate prefix.
    expect(await blob.text()).toBe(first.slice(1));
  });
});
