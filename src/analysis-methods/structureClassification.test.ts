/**
 * The classification decides which methods the selector offers, so a wrong answer here does
 * not fail loudly — it quietly offers a method that cannot honour the structure.
 */
import { describe, expect, it } from 'vitest';
import { createDefaultProject, createHibbelerStyleDiagramPractice, createHibbelerStyleTrussPractice } from '../data/defaultProject';
import type { ProjectModel } from '../types';
import { classifyStructure, supportRestraintCount } from './structureClassification';

describe('supportRestraintCount', () => {
  it('cuenta los grados restringidos de cada tipo de apoyo', () => {
    expect(supportRestraintCount({ type: 'fixed' })).toBe(3);
    expect(supportRestraintCount({ type: 'pin' })).toBe(2);
    expect(supportRestraintCount({ type: 'roller' })).toBe(1);
    expect(supportRestraintCount({ type: 'none' })).toBe(0);
    expect(supportRestraintCount({ type: 'custom', restrainX: true, restrainR: true })).toBe(2);
  });
});

describe('classifyStructure', () => {
  it('reconoce una viga simple isostática', () => {
    const classification = classifyStructure(createHibbelerStyleDiagramPractice());
    expect(classification.kind).toBe('simple-beam');
    expect(classification.collinear).toBe(true);
    expect(classification.axisNodeIds).toEqual(['A', 'B']);
    expect(classification.reactionCount).toBe(3);
    // Para flexión sólo cuentan la restricción transversal y la de giro: articulación (1) y
    // rodillo vertical (1) ⇒ g = 2 − 2 = 0. La reacción horizontal del apoyo fijo no trabaja
    // contra la flexión, y las liberaciones de los extremos son el modelado de la articulación.
    expect(classification.indeterminacy).toBe(0);
  });

  it('reconoce la armadura y no la confunde con una viga', () => {
    const classification = classifyStructure(createHibbelerStyleTrussPractice());
    expect(classification.kind).toBe('truss');
    expect(classification.pinJointed).toBe(true);
  });

  it('reconoce un marco: no es colineal, así que la doble integración no aplicará', () => {
    const classification = classifyStructure(createDefaultProject());
    expect(classification.kind).toBe('frame');
    expect(classification.collinear).toBe(false);
    expect(classification.axisNodeIds).toEqual([]);
  });

  it('mide el grado de la viga hiperestática del ejemplo: empotramiento y dos rodillos', () => {
    // La viga de DELx: empotrada en A, rodillos en B y C, voladizo hasta D.
    const beam: ProjectModel = {
      ...createHibbelerStyleDiagramPractice(),
      nodes: [
        { id: 'A', x: 0, y: 0, support: { type: 'fixed' } },
        { id: 'B', x: 4, y: 0, support: { type: 'roller', angleDeg: 90 } },
        { id: 'C', x: 9, y: 0, support: { type: 'roller', angleDeg: 90 } },
        { id: 'D', x: 10.5, y: 0, support: { type: 'none' } },
      ],
      members: [
        { id: 'AB', i: 'A', j: 'B', type: 'frame', E: 200e6, A: 0.01, I: 1e-4 },
        { id: 'BC', i: 'B', j: 'C', type: 'frame', E: 200e6, A: 0.01, I: 1e-4 },
        { id: 'CD', i: 'C', j: 'D', type: 'frame', E: 200e6, A: 0.01, I: 1e-4 },
      ],
      memberLoads: [],
    };
    const classification = classifyStructure(beam);
    expect(classification.kind).toBe('continuous-beam');
    expect(classification.axisNodeIds).toEqual(['A', 'B', 'C', 'D']);
    expect(classification.reactionCount).toBe(5);
    // Empotramiento (Fy + M = 2) + dos rodillos verticales (1 + 1) = 4 restricciones de
    // flexión ⇒ g = 4 − 2 = 2, que es exactamente lo que declara el ejemplo de DELx.
    expect(classification.indeterminacy).toBe(2);
  });

  it('descuenta una articulación interior, y no las de los extremos', () => {
    const base = createHibbelerStyleDiagramPractice();
    const beam = (internalHinge: boolean): ProjectModel => ({
      ...base,
      nodes: [
        { id: 'A', x: 0, y: 0, support: { type: 'fixed' } },
        { id: 'B', x: 4, y: 0, support: { type: 'roller', angleDeg: 90 }, internalHinge },
        { id: 'C', x: 9, y: 0, support: { type: 'roller', angleDeg: 90 } },
      ],
      members: [
        { id: 'AB', i: 'A', j: 'B', type: 'frame', E: 200e6, A: 0.01, I: 1e-4 },
        { id: 'BC', i: 'B', j: 'C', type: 'frame', E: 200e6, A: 0.01, I: 1e-4 },
      ],
      memberLoads: [],
    });
    expect(classifyStructure(beam(false)).indeterminacy).toBe(2);
    expect(classifyStructure(beam(true)).indeterminacy).toBe(1);
  });

  it('un rodillo con su normal a lo largo del eje no restringe la flexión', () => {
    const base = createHibbelerStyleDiagramPractice();
    const beam: ProjectModel = {
      ...base,
      nodes: [
        { id: 'A', x: 0, y: 0, support: { type: 'pin' } },
        { id: 'B', x: 4, y: 0, support: { type: 'roller', angleDeg: 0 } },
        { id: 'C', x: 9, y: 0, support: { type: 'roller', angleDeg: 90 } },
      ],
      members: [
        { id: 'AB', i: 'A', j: 'B', type: 'frame', E: 200e6, A: 0.01, I: 1e-4 },
        { id: 'BC', i: 'B', j: 'C', type: 'frame', E: 200e6, A: 0.01, I: 1e-4 },
      ],
      memberLoads: [],
    };
    // Articulación (1) + rodillo horizontal (0) + rodillo vertical (1) = 2 ⇒ isostática.
    expect(classifyStructure(beam).indeterminacy).toBe(0);
  });

  it('ordena los nodos a lo largo del eje aunque se declaren en desorden', () => {
    const beam: ProjectModel = {
      ...createHibbelerStyleDiagramPractice(),
      nodes: [
        { id: 'C', x: 9, y: 0, support: { type: 'none' } },
        { id: 'A', x: 0, y: 0, support: { type: 'pin' } },
        { id: 'B', x: 4, y: 0, support: { type: 'roller', angleDeg: 90 } },
      ],
      members: [
        { id: 'AB', i: 'A', j: 'B', type: 'frame', E: 200e6, A: 0.01, I: 1e-4 },
        { id: 'BC', i: 'B', j: 'C', type: 'frame', E: 200e6, A: 0.01, I: 1e-4 },
      ],
      memberLoads: [],
    };
    expect(classifyStructure(beam).axisNodeIds).toEqual(['A', 'B', 'C']);
  });
});
