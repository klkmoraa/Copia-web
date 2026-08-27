import { describe, expect, it } from 'vitest';
import type { MemberLoad } from '../../types';
import {
  OVERLAP_TAIL_EXTENSION_PX,
  POINT_LANE_SPACING_PX,
  resolveMemberLoadPresentation,
} from './loadPresentation';

const distributed = (id = 'Q'): MemberLoad => ({
  id,
  memberId: 'M1',
  caseId: 'LC1',
  type: 'distributed',
  coordinateSystem: 'global',
  lengthBasis: 'real',
  start: 0.2,
  end: 0.8,
  qxStart: 0,
  qxEnd: 0,
  qyStart: -8,
  qyEnd: -8,
});

const point = (id: string, caseId: string, position = 0.5): MemberLoad => ({
  id,
  memberId: 'M1',
  caseId,
  type: 'point',
  coordinateSystem: 'global',
  lengthBasis: 'real',
  start: 0,
  end: 1,
  position,
  px: 0,
  py: -12,
});

const moment = (id = 'MA'): MemberLoad => ({
  id,
  memberId: 'M1',
  caseId: 'LC1',
  type: 'moment',
  coordinateSystem: 'local',
  lengthBasis: 'real',
  start: 0,
  end: 1,
  position: 0.5,
  moment: 7,
});

describe('resolveMemberLoadPresentation', () => {
  it('places a point load outside an overlapping distributed load without moving model data', () => {
    const loads = [point('P', 'LC1'), distributed()];
    const snapshot = structuredClone(loads);

    const presentation = resolveMemberLoadPresentation(loads);

    expect(loads).toEqual(snapshot);
    expect(presentation.map((item) => item.load.id)).toEqual(['Q', 'P']);
    expect(presentation[0]).toMatchObject({ lane: 'inner', paintOrder: 0, tailExtensionPx: 0 });
    expect(presentation[1]).toMatchObject({
      lane: 'point-outer',
      paintOrder: 1,
      tailExtensionPx: OVERLAP_TAIL_EXTENSION_PX,
      lateralOffsetPx: 0,
    });
  });

  it('fans coincident point loads symmetrically using stable case and id order', () => {
    const loads = [point('P-B', 'B'), point('P-A', 'A'), distributed(), moment()];
    const forward = resolveMemberLoadPresentation(loads);
    const reverse = resolveMemberLoadPresentation([...loads].reverse());

    const summarize = (items: typeof forward) => items.map((item) => ({
      id: item.load.id,
      lane: item.lane,
      paintOrder: item.paintOrder,
      lateralOffsetPx: item.lateralOffsetPx,
    }));

    expect(summarize(forward)).toEqual(summarize(reverse));
    expect(summarize(forward)).toEqual([
      { id: 'Q', lane: 'inner', paintOrder: 0, lateralOffsetPx: 0 },
      { id: 'P-A', lane: 'point-outer', paintOrder: 1, lateralOffsetPx: -POINT_LANE_SPACING_PX / 2 },
      { id: 'P-B', lane: 'point-outer', paintOrder: 1, lateralOffsetPx: POINT_LANE_SPACING_PX / 2 },
      { id: 'MA', lane: 'moment-outer', paintOrder: 2, lateralOffsetPx: 0 },
    ]);
  });

  it('does not extend a point outside the distributed interval', () => {
    const presentation = resolveMemberLoadPresentation([distributed(), point('P', 'LC1', 0.9)]);

    expect(presentation.find((item) => item.load.id === 'P')).toMatchObject({
      lane: 'point',
      tailExtensionPx: 0,
    });
  });
});
