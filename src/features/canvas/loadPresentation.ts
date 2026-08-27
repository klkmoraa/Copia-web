import type { MemberLoad } from '../../types';

export const OVERLAP_TAIL_EXTENSION_PX = 18;
export const POINT_LANE_SPACING_PX = 8;

const STATION_TOLERANCE = 1e-6;

export type MemberLoadLane = 'inner' | 'point' | 'point-outer' | 'moment-outer';

export interface MemberLoadPresentation {
  load: MemberLoad;
  lane: MemberLoadLane;
  paintOrder: 0 | 1 | 2;
  tailExtensionPx: number;
  lateralOffsetPx: number;
}

const stationOf = (load: MemberLoad) => load.position ?? 0.5;

const stableLoadCompare = (left: MemberLoad, right: MemberLoad) => (
  left.memberId.localeCompare(right.memberId)
  || stationOf(left) - stationOf(right)
  || left.caseId.localeCompare(right.caseId)
  || left.id.localeCompare(right.id)
);

const typeOrder = (load: MemberLoad): 0 | 1 | 2 => (
  load.type === 'distributed' ? 0 : load.type === 'point' ? 1 : 2
);

const sameStation = (left: MemberLoad, right: MemberLoad) => (
  left.memberId === right.memberId
  && Math.abs(stationOf(left) - stationOf(right)) <= STATION_TOLERANCE
);

const overlapsDistributed = (point: MemberLoad, distributedLoads: readonly MemberLoad[]) => {
  const station = stationOf(point);
  return distributedLoads.some((load) => {
    if (load.memberId !== point.memberId || load.type !== 'distributed') return false;
    const start = Math.min(load.start, load.end);
    const end = Math.max(load.start, load.end);
    return station >= start - STATION_TOLERANCE && station <= end + STATION_TOLERANCE;
  });
};

/**
 * Resolves only screen presentation metadata. The returned records retain the
 * original load references and never write to the project or its load arrays.
 */
export const resolveMemberLoadPresentation = (
  loads: readonly MemberLoad[],
): MemberLoadPresentation[] => {
  const distributedLoads = loads.filter((load) => load.type === 'distributed');
  const pointLoads = loads.filter((load) => load.type === 'point').sort(stableLoadCompare);

  return [...loads]
    .sort((left, right) => typeOrder(left) - typeOrder(right) || stableLoadCompare(left, right))
    .map((load) => {
      const paintOrder = typeOrder(load);
      if (load.type === 'distributed') {
        return { load, lane: 'inner', paintOrder, tailExtensionPx: 0, lateralOffsetPx: 0 };
      }
      if (load.type === 'moment') {
        return { load, lane: 'moment-outer', paintOrder, tailExtensionPx: 0, lateralOffsetPx: 0 };
      }

      const coincident = pointLoads.filter((candidate) => sameStation(candidate, load));
      const index = coincident.findIndex((candidate) => candidate.id === load.id && candidate.caseId === load.caseId);
      const lateralOffsetPx = (index - (coincident.length - 1) / 2) * POINT_LANE_SPACING_PX;
      const overlapping = overlapsDistributed(load, distributedLoads);
      return {
        load,
        lane: overlapping ? 'point-outer' : 'point',
        paintOrder,
        tailExtensionPx: overlapping ? OVERLAP_TAIL_EXTENSION_PX : 0,
        lateralOffsetPx,
      };
    });
};
