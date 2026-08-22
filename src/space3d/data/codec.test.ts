import { describe, expect, it } from 'vitest';
import { parseSpace3DProject, serializeSpace3DProject } from './codec';
import { createBlankSpace3DProject, createSpace3DPortalExample } from '../model/defaultProject';
import { SPACE3D_LIMITS } from '../model/types';

const project = createSpace3DPortalExample();

describe('Space3D portable codec', () => {
  it('hace round-trip exacto del ejemplo y del proyecto vacío', () => {
    expect(parseSpace3DProject(serializeSpace3DProject(project))).toEqual(project);
    const blank = createBlankSpace3DProject();
    expect(parseSpace3DProject(serializeSpace3DProject(blank))).toEqual(blank);
  });

  it('emite JSON estable y legible', () => {
    expect(serializeSpace3DProject(project)).toBe(serializeSpace3DProject(project));
    expect(serializeSpace3DProject(project)).toContain('"analysisSpace": "space-3d"');
  });

  it('rechaza campos desconocidos en cualquier nivel', () => {
    expect(() => parseSpace3DProject(JSON.stringify({ ...project, surprise: true }))).toThrow(/unknown-field/);
    expect(() => parseSpace3DProject(JSON.stringify({
      ...project, nodes: [{ ...project.nodes[0], extra: 1 }, ...project.nodes.slice(1)],
    }))).toThrow(/unknown-field/);
    expect(() => parseSpace3DProject(JSON.stringify({
      ...project,
      members: [{ ...project.members[0], orientation: { ...project.members[0].orientation, twist: 2 } }, ...project.members.slice(1)],
    }))).toThrow(/unknown-field/);
  });

  it('rechaza una versión de esquema desconocida', () => {
    expect(() => parseSpace3DProject(JSON.stringify({ ...project, schemaVersion: 2 }))).toThrow(/schema-version/);
  });

  it('rechaza un archivo que no es del espacio 3D', () => {
    expect(() => parseSpace3DProject(JSON.stringify({ ...project, analysisSpace: 'plane-2d' }))).toThrow(/analysis-space/);
    const planar = { id: 'p', name: 'Plano', nodes: [], members: [], units: 'kN-m', settings: {} };
    expect(() => parseSpace3DProject(JSON.stringify(planar))).toThrow(/analysis-space/);
  });

  it('rechaza JSON malformado y valores no objeto', () => {
    expect(() => parseSpace3DProject('{')).toThrow(/malformed-json/);
    expect(() => parseSpace3DProject('[]')).toThrow(/malformed-json/);
    expect(() => parseSpace3DProject('null')).toThrow(/malformed-json/);
  });

  it('rechaza NaN e Infinity serializados como null o string', () => {
    const withNaN = JSON.parse(JSON.stringify(project));
    withNaN.nodes[0].x = Number.NaN;
    expect(() => parseSpace3DProject(JSON.stringify(withNaN))).toThrow(/not-a-number/);
    const asText = JSON.parse(JSON.stringify(project));
    asText.members[0].E = '200000000';
    expect(() => parseSpace3DProject(JSON.stringify(asText))).toThrow(/not-a-number/);
  });

  it('rechaza arrays por encima de los límites antes de construir el modelo', () => {
    const many = {
      ...project,
      nodes: Array.from({ length: SPACE3D_LIMITS.maxNodes + 1 }, (_, index) => ({ ...project.nodes[0], id: `N${index}` })),
    };
    expect(() => parseSpace3DProject(JSON.stringify(many))).toThrow(/limit-exceeded/);
  });

  it('rechaza un modelo estructuralmente inválido aunque el JSON esté bien formado', () => {
    const broken = JSON.parse(JSON.stringify(project));
    broken.members[0].j = 'missing';
    expect(() => parseSpace3DProject(JSON.stringify(broken))).toThrow(/invalid-model/);
  });

  it('no comparte referencias con la entrada', () => {
    const parsed = parseSpace3DProject(serializeSpace3DProject(project));
    expect(parsed.nodes).not.toBe(project.nodes);
    expect(parsed.members[0].orientation.localYReferenceGlobal).not.toBe(project.members[0].orientation.localYReferenceGlobal);
  });
});
