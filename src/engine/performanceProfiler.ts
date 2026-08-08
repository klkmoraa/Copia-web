/**
 * Opt-in phase-timing harness for `analyzeProject` (AG-011). Disabled by default: every
 * `profileStart`/`profileEnd` call site in `solver.ts` degrades to a single boolean check
 * when no benchmark has called `beginProfiling`, so normal analysis runs pay no
 * `performance.now()` cost from this instrumentation.
 */

export type ProfiledPhase =
  | 'assembly'
  | 'linearSolve'
  | 'diagrams'
  | 'deformations'
  | 'auditAndReliability'
  | 'explanation'
  | 'educationTrace';

export type PhaseTimings = Record<ProfiledPhase, number> & { total: number };

const zeroTimings = (): Record<ProfiledPhase, number> => ({
  assembly: 0,
  linearSolve: 0,
  diagrams: 0,
  deformations: 0,
  auditAndReliability: 0,
  explanation: 0,
  educationTrace: 0,
});

let active = false;
let accumulator: Record<ProfiledPhase, number> | null = null;
let startedAt = 0;

/** True while a benchmark harness is measuring phase timings; false in every normal run. */
export const isProfilingActive = (): boolean => active;

/** Opens a fresh measurement window. Pair with exactly one `endProfiling()` call. */
export const beginProfiling = (): void => {
  active = true;
  accumulator = zeroTimings();
  startedAt = performance.now();
};

/** Closes the measurement window and returns the accumulated phase breakdown, in ms. */
export const endProfiling = (): PhaseTimings => {
  if (!accumulator) throw new Error('endProfiling() llamado sin un beginProfiling() previo.');
  const total = performance.now() - startedAt;
  const timings: PhaseTimings = { ...accumulator, total };
  active = false;
  accumulator = null;
  return timings;
};

/**
 * Marks the start of a profiled phase. Returns `null` while profiling is inactive so the
 * matching `profileEnd` short-circuits on a single comparison instead of calling
 * `performance.now()`.
 */
export const profileStart = (): number | null => (active ? performance.now() : null);

export const profileEnd = (phase: ProfiledPhase, since: number | null): void => {
  if (since === null || !accumulator) return;
  accumulator[phase] += performance.now() - since;
};
