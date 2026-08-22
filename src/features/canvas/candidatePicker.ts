import type { Selection } from '../../types';

/** An explicit canvas identity. Candidate selection never compares geometry or material values. */
export interface CandidateTarget {
  kind: 'node' | 'member' | 'nodalLoad' | 'memberLoad';
  id: string;
}

export interface CandidatePickerState {
  candidates: readonly CandidateTarget[];
  activeIndex: number;
  previousSelection: Selection;
  /** The original selection gesture asked to extend the selection. */
  additive: boolean;
  anchor: { x: number; y: number };
}

export type CandidatePickerCycle = 'next' | 'previous' | 'first' | 'last';

export const shouldOpenCandidatePicker = (candidateCount: number): boolean => candidateCount > 1;

export const createCandidatePickerState = (
  candidates: readonly CandidateTarget[],
  previousSelection: Selection,
  anchor: { x: number; y: number },
  activeIndex = 0,
  additive = false,
): CandidatePickerState | null => {
  if (!shouldOpenCandidatePicker(candidates.length)) return null;
  return {
    candidates: [...candidates],
    activeIndex: Math.min(Math.max(0, activeIndex), candidates.length - 1),
    previousSelection,
    additive,
    anchor,
  };
};

export const activeCandidate = (picker: CandidatePickerState): CandidateTarget => picker.candidates[picker.activeIndex]!;

export const cycleCandidatePicker = (
  picker: CandidatePickerState,
  direction: CandidatePickerCycle,
): CandidatePickerState => {
  const lastIndex = picker.candidates.length - 1;
  const activeIndex = direction === 'first'
    ? 0
    : direction === 'last'
      ? lastIndex
      : direction === 'next'
        ? (picker.activeIndex + 1) % picker.candidates.length
        : (picker.activeIndex - 1 + picker.candidates.length) % picker.candidates.length;
  return activeIndex === picker.activeIndex ? picker : { ...picker, activeIndex };
};

export const candidateToSelection = (candidate: CandidateTarget): Selection => ({
  kind: candidate.kind,
  id: candidate.id,
});
