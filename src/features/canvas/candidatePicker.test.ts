import { describe, expect, it } from 'vitest';
import {
  activeCandidate,
  createCandidatePickerState,
  cycleCandidatePicker,
  shouldOpenCandidatePicker,
} from './candidatePicker';

const candidates = [
  { kind: 'node' as const, id: 'N1' },
  { kind: 'member' as const, id: 'M1' },
  { kind: 'nodalLoad' as const, id: 'NL1' },
];

describe('candidate picker state', () => {
  it('keeps the one-candidate path outside the picker', () => {
    expect(shouldOpenCandidatePicker(1)).toBe(false);
    expect(createCandidatePickerState([candidates[0]], { kind: 'member', id: 'M0' }, { x: 12, y: 24 })).toBeNull();
  });

  it('opens an ambiguous point with the explicit first candidate previewed and prior selection intact', () => {
    const previousSelection = { kind: 'member' as const, id: 'M0' };
    const picker = createCandidatePickerState(candidates, previousSelection, { x: 12, y: 24 });

    expect(shouldOpenCandidatePicker(candidates.length)).toBe(true);
    expect(picker).toMatchObject({
      activeIndex: 0,
      previousSelection,
      anchor: { x: 12, y: 24 },
    });
    expect(activeCandidate(picker!)).toEqual({ kind: 'node', id: 'N1' });
  });

  it('cycles preview without committing and supports first/last keyboard bounds', () => {
    const picker = createCandidatePickerState(candidates, { kind: 'node', id: 'N9' }, { x: 1, y: 1 })!;

    expect(activeCandidate(cycleCandidatePicker(picker, 'next'))).toEqual({ kind: 'member', id: 'M1' });
    expect(activeCandidate(cycleCandidatePicker(picker, 'previous'))).toEqual({ kind: 'nodalLoad', id: 'NL1' });
    expect(activeCandidate(cycleCandidatePicker(picker, 'first'))).toEqual({ kind: 'node', id: 'N1' });
    expect(activeCandidate(cycleCandidatePicker(picker, 'last'))).toEqual({ kind: 'nodalLoad', id: 'NL1' });
  });
});
