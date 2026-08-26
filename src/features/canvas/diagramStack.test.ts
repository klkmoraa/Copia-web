import { describe, expect, it } from 'vitest';
import type { MemberResult, ProjectModel } from '../../types';
import {
  buildDiagramStack,
  laneScreenX,
  laneScreenY,
  notableStations,
  resolveStackMemberId,
  snapStation,
  STACK_QUANTITIES,
  stationFromScreenX,
  stationReadings,
  toggleStackQuantity,
} from './diagramStack';

/** Viga simple de 8 m: V lineal de 40 a −40, M parabólico con 80 en el centro. */
const beamResult = (memberId: string, length = 8): MemberResult => ({
  memberId,
  length,
  localDisplacements: [],
  localEndForces: [],
  diagramSegments: [{
    x0: 0,
    x1: length,
    axial: [0, 0, 0],
    shear: [40, -10, 0],
    moment: [0, 40, -5, 0],
    distributedAxial: [0, 0],
    distributedTransverse: [0, -10],
  }],
  diagramJumps: [],
  criticalPoints: [
    { x: 0, quantity: 'shear', value: 40, kind: 'end' },
    { x: length, quantity: 'shear', value: -40, kind: 'end' },
    { x: length / 2, quantity: 'moment', value: 80, kind: 'maximum' },
  ],
  diagram: [],
  deformation: [],
  deformationSegments: [],
  deformationCriticalPoints: [],
  maxAxial: 0,
  minAxial: 0,
  maxShear: 40,
  minShear: -40,
  maxMoment: 80,
  minMoment: 0,
});

const rect = { x: 100, y: 200, width: 400, laneHeight: 88, laneGap: 12 };

const projectWith = (members: ReadonlyArray<{ id: string }>): ProjectModel =>
  ({ members: members.map((member) => ({ ...member })) } as unknown as ProjectModel);

describe('toggleStackQuantity', () => {
  it('keeps the canonical A-C-M order however the user toggles', () => {
    expect(toggleStackQuantity(['moment'], 'axial')).toEqual(['axial', 'moment']);
    expect(toggleStackQuantity(['axial', 'moment'], 'shear')).toEqual(['axial', 'shear', 'moment']);
  });

  it('removes a lane but never empties the stack', () => {
    expect(toggleStackQuantity(STACK_QUANTITIES, 'shear')).toEqual(['axial', 'moment']);
    expect(toggleStackQuantity(['moment'], 'moment')).toEqual(['moment']);
  });
});

describe('resolveStackMemberId', () => {
  const results = new Map([['M1', beamResult('M1', 4)], ['M2', beamResult('M2', 9)]]);

  it('follows the selection before anything else', () => {
    expect(resolveStackMemberId(projectWith([{ id: 'M1' }, { id: 'M2' }]), { kind: 'member', id: 'M1' }, results)).toBe('M1');
    expect(resolveStackMemberId(projectWith([{ id: 'M1' }, { id: 'M2' }]), { kind: 'multi', nodeIds: [], memberIds: ['M2'] }, results)).toBe('M2');
  });

  it('falls back to the longest solved member, and to nothing without results', () => {
    expect(resolveStackMemberId(projectWith([{ id: 'M1' }, { id: 'M2' }]), null, results)).toBe('M2');
    expect(resolveStackMemberId(projectWith([{ id: 'M9' }]), null, results)).toBeNull();
  });

  it('ignores a selection the analysis never solved', () => {
    expect(resolveStackMemberId(projectWith([{ id: 'M1' }]), { kind: 'member', id: 'M9' }, results)).toBe('M1');
  });
});

describe('buildDiagramStack', () => {
  it('lays one lane per chosen quantity, in canonical order and stacked downwards', () => {
    const lanes = buildDiagramStack(beamResult('M1'), ['moment', 'axial'], rect);
    expect(lanes.map((lane) => lane.quantity)).toEqual(['axial', 'moment']);
    expect(lanes[0].top).toBe(200);
    expect(lanes[1].top).toBe(200 + 88 + 12);
    expect(lanes.map((lane) => lane.symbol)).toEqual(['N', 'M']);
  });

  it('spans the given width and scales every lane by its own maximum', () => {
    const lanes = buildDiagramStack(beamResult('M1'), STACK_QUANTITIES, rect);
    for (const lane of lanes) {
      expect(lane.left).toBe(100);
      expect(lane.right).toBe(500);
      expect(lane.linePath.startsWith('M ')).toBe(true);
      expect(lane.fillPath.endsWith('Z')).toBe(true);
    }
    // Cada carril con su escala: un axial nulo no puede aplastar el momento.
    expect(lanes[0].maxAbs).toBeCloseTo(1e-9);
    expect(lanes[1].maxAbs).toBe(40);
    expect(lanes[2].maxAbs).toBe(80);
  });

  it('places the moment peak at mid span, above its baseline', () => {
    const [moment] = buildDiagramStack(beamResult('M1'), ['moment'], rect);
    expect(moment.extremes).toHaveLength(1);
    expect(moment.extremes[0].screen.x).toBe(300);
    expect(moment.extremes[0].screen.y).toBeLessThan(moment.baselineY);
    expect(moment.extremes[0].value).toBe(80);
  });

  it('marks both signs of the shear and draws nothing without segments', () => {
    const [shear] = buildDiagramStack(beamResult('M1'), ['shear'], rect);
    expect(shear.extremes.map((extreme) => extreme.kind)).toEqual(['max', 'min']);
    expect(buildDiagramStack({ ...beamResult('M1'), diagramSegments: [] }, STACK_QUANTITIES, rect)).toEqual([]);
  });
});

describe('reading a station', () => {
  const result = beamResult('M1');
  const [lane] = buildDiagramStack(result, ['moment'], rect);

  it('maps screen x back to a station, clamped to the member', () => {
    expect(stationFromScreenX(lane, 8, 100)).toBe(0);
    expect(stationFromScreenX(lane, 8, 300)).toBe(4);
    expect(stationFromScreenX(lane, 8, 900)).toBe(8);
    expect(stationFromScreenX(lane, 8, -50)).toBe(0);
  });

  it('round-trips a station and a value through the lane scales', () => {
    expect(laneScreenX(lane, 4)).toBe(300);
    expect(laneScreenY(lane, 0)).toBe(lane.baselineY);
    expect(laneScreenY(lane, lane.maxAbs)).toBeCloseTo(lane.baselineY - lane.amplitude);
  });

  it('lists the stations the engine actually solved, sorted and deduplicated', () => {
    expect(notableStations(result)).toEqual([0, 4, 8]);
  });

  it('snaps to a notable station, and leaves the rest of the span alone', () => {
    expect(snapStation(result, 4.04)).toBe(4);
    expect(snapStation(result, 7.97)).toBe(8);
    // Fuera de la tolerancia (1,2 % de 8 m ≈ 0,096 m) la lectura es la que pidió el puntero.
    expect(snapStation(result, 4.5)).toBe(4.5);
  });

  it('reads the three quantities of one section in a single pass', () => {
    const readings = stationReadings(result, 4);
    expect(readings.map((reading) => reading.quantity)).toEqual(['axial', 'shear', 'moment']);
    expect(readings[1].value).toBeCloseTo(0);
    expect(readings[2].value).toBeCloseTo(80);
    expect(readings.every((reading) => reading.jump === null)).toBe(true);
  });

  it('reports both lateral limits where the diagram jumps', () => {
    const jumped: MemberResult = {
      ...result,
      diagramSegments: [
        { x0: 0, x1: 4, axial: [0, 0, 0], shear: [40, 0, 0], moment: [0, 40, 0, 0], distributedAxial: [0, 0], distributedTransverse: [0, 0] },
        { x0: 4, x1: 8, axial: [0, 0, 0], shear: [-40, 0, 0], moment: [160, -40, 0, 0], distributedAxial: [0, 0], distributedTransverse: [0, 0] },
      ],
      diagramJumps: [{ x: 4, axialDelta: 0, shearDelta: -80, momentDelta: 0 }],
    };
    const shear = stationReadings(jumped, 4).find((reading) => reading.quantity === 'shear');
    expect(shear?.jump).toEqual({ left: 40, right: -40 });
    expect(stationReadings(jumped, 4).find((reading) => reading.quantity === 'moment')?.jump).toBeNull();
  });
});
