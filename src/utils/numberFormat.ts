/**
 * Single numeric presentation policy for structureCo.
 *
 * Before this module the product had five independent formatters with incompatible
 * thresholds, so one stored value could read as `1e-14` in the Inspector, `1.0000e-14`
 * in Results and something else again in the PDF. Every surface now derives from the
 * same rule and differs only by a declared preset.
 *
 * Three invariants hold for every preset:
 *
 *  1. Formatting is presentational. Nothing here is ever written back into the model —
 *     internal precision is untouched.
 *  2. Absence, error and zero stay distinguishable. A non-finite value renders as the
 *     preset's `notAvailable` marker, never as `0`, `NaN` or `Infinity`.
 *  3. `-0` renders as `0`. A negative sign in front of a zero is noise, not information.
 */

export interface NumberFormatPolicy {
  /** Significant digits kept for display. */
  significantDigits: number;
  /** Below this magnitude the value switches to scientific notation. */
  scientificBelow: number;
  /** At or above this magnitude the value switches to scientific notation. */
  scientificAtOrAbove: number;
  /** Rendered when the value is not a finite number. */
  notAvailable: string;
}

export type NumberFormatContext =
  | 'canvas'
  | 'chart'
  | 'inspector'
  | 'table'
  | 'tooltip'
  | 'report'
  | 'annex'
  | 'clipboard';

/**
 * Digits grow with how much room and attention the surface has: a canvas label is read
 * at a glance next to the geometry, an annex row is read with a calculator beside it.
 * The scientific window widens with the digit count so a preset never renders an
 * exponent it had no room to justify.
 */
export const NUMBER_FORMATS: Record<NumberFormatContext, NumberFormatPolicy> = {
  canvas: { significantDigits: 4, scientificBelow: 1e-3, scientificAtOrAbove: 1e6, notAvailable: '—' },
  chart: { significantDigits: 4, scientificBelow: 1e-3, scientificAtOrAbove: 1e6, notAvailable: '—' },
  inspector: { significantDigits: 6, scientificBelow: 1e-4, scientificAtOrAbove: 1e7, notAvailable: '—' },
  table: { significantDigits: 6, scientificBelow: 1e-4, scientificAtOrAbove: 1e7, notAvailable: '—' },
  tooltip: { significantDigits: 8, scientificBelow: 1e-6, scientificAtOrAbove: 1e9, notAvailable: '—' },
  report: { significantDigits: 6, scientificBelow: 1e-4, scientificAtOrAbove: 1e7, notAvailable: 'n/d' },
  annex: { significantDigits: 8, scientificBelow: 1e-6, scientificAtOrAbove: 1e9, notAvailable: 'n/d' },
  clipboard: { significantDigits: 15, scientificBelow: 1e-6, scientificAtOrAbove: 1e15, notAvailable: '' },
};

export interface NumberFormatOptions extends Partial<NumberFormatPolicy> {
  /** Hard cap on decimals, applied on top of the significant-digit rule. */
  maximumFractionDigits?: number;
}

const clampInteger = (value: number | undefined, fallback: number, minimum: number, maximum: number): number => {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.trunc(value)));
};

/** `1.2300` carries no more information than `1.23`, and misaligns tabular columns. */
const stripTrailingFractionZeros = (text: string): string => {
  if (!text.includes('.')) return text;
  return text.replace(/(\.\d*?[1-9])0+$/, '$1').replace(/\.0+$/, '');
};

const toScientificText = (value: number, significantDigits: number, maximumFractionDigits?: number): string => {
  const fractionDigits = maximumFractionDigits === undefined
    ? significantDigits - 1
    : Math.min(significantDigits - 1, maximumFractionDigits);
  const [mantissa, rawExponent] = value.toExponential(clampInteger(fractionDigits, 0, 0, 100)).split('e');
  const exponent = Number(rawExponent);
  return `${stripTrailingFractionZeros(mantissa)}e${exponent >= 0 ? '+' : ''}${exponent}`;
};

/**
 * Formats one number for reading. `value` accepts `undefined` and `null` so callers can
 * hand over an optional result without first inventing a placeholder number.
 */
export const formatNumber = (
  value: number | undefined | null,
  context: NumberFormatContext = 'table',
  options: NumberFormatOptions = {},
): string => {
  const policy = { ...NUMBER_FORMATS[context], ...options };
  if (typeof value !== 'number' || !Number.isFinite(value)) return policy.notAvailable;
  if (value === 0) return '0';

  const significantDigits = clampInteger(policy.significantDigits, 6, 1, 21);
  const maximumFractionDigits = options.maximumFractionDigits === undefined
    ? undefined
    : clampInteger(options.maximumFractionDigits, 0, 0, 100);
  const magnitude = Math.abs(value);

  if (magnitude < policy.scientificBelow || magnitude >= policy.scientificAtOrAbove) {
    return toScientificText(value, significantDigits, maximumFractionDigits);
  }

  const rounded = Number(value.toPrecision(significantDigits));
  const text = maximumFractionDigits === undefined
    ? String(rounded)
    : rounded.toFixed(maximumFractionDigits);
  const normalized = stripTrailingFractionZeros(text);
  // `(-0.004).toFixed(2)` is `"-0.00"`: rounding can manufacture a signed zero.
  return normalized === '-0' ? '0' : normalized;
};

/** Appends a unit with a regular space, and omits it when there is none. */
export const formatValue = (
  value: number | undefined | null,
  unit = '',
  context: NumberFormatContext = 'table',
  options: NumberFormatOptions = {},
): string => {
  const formatted = formatNumber(value, context, options);
  return unit ? `${formatted} ${unit}` : formatted;
};

/**
 * Shortest representation that parses back to the exact same double. Used for editing
 * drafts, clipboard and JSON, where reducing precision would be data loss.
 */
export const serializeNumber = (value: number | undefined | null): string => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '';
  return Object.is(value, -0) ? '0' : String(value);
};

/**
 * Fixed-decimal reading, for cursor readouts, chart ticks and any column that must stay
 * vertically aligned while the value changes.
 *
 * `toFixed` alone is unsafe for results: `(-0.0004).toFixed(3)` is `"-0.000"`, a displayed
 * negative zero, and shear crossing zero produces exactly that. `NaN.toFixed(3)` is
 * `"NaN"`. Both are normalized here.
 */
export const formatFixed = (
  value: number | undefined | null,
  fractionDigits: number,
  context: NumberFormatContext = 'table',
): string => {
  const digits = clampInteger(fractionDigits, 2, 0, 100);
  if (typeof value !== 'number' || !Number.isFinite(value)) return NUMBER_FORMATS[context].notAvailable;
  const text = value.toFixed(digits);
  return /^-0(?:\.0+)?$/.test(text) ? text.slice(1) : text;
};

/**
 * Always-scientific reading, for residuals, error bounds and stiffness matrices, where
 * the exponent is the information and a fixed-decimal column would be all zeros.
 */
export const formatScientific = (
  value: number | undefined | null,
  fractionDigits = 2,
  context: NumberFormatContext = 'table',
): string => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return NUMBER_FORMATS[context].notAvailable;
  if (value === 0) return '0';
  return toScientificText(value, clampInteger(fractionDigits, 2, 0, 100) + 1);
};

/**
 * Reading with an explicit significant-digit count, for derived quantities whose useful
 * precision is fixed by the physics rather than by the surface.
 */
export const formatSignificant = (
  value: number | undefined | null,
  significantDigits: number,
  context: NumberFormatContext = 'table',
): string => formatNumber(value, context, { significantDigits });

/**
 * Machine-readable cell for CSV: no locale separators, no `-0`, blank for non-finite,
 * and enough significant digits that a spreadsheet re-reads the analysis faithfully.
 */
export const formatMachineNumber = (value: number | undefined | null, significantDigits = 15): string => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '';
  if (value === 0) return '0';
  return String(Number(value.toPrecision(clampInteger(significantDigits, 15, 1, 21))));
};

/**
 * Collapses values that are zero only up to the solver's tolerance, so a residual like
 * `-3.2e-17` beside a reaction of `48 kN` reads as `0` instead of as a real force.
 * The comparison is relative to `reference`, never absolute.
 */
export const formatNearZero = (
  value: number | undefined | null,
  reference: number,
  context: NumberFormatContext = 'report',
  options: NumberFormatOptions = {},
): string => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return formatNumber(value, context, options);
  const scale = Math.max(1, Math.abs(Number.isFinite(reference) ? reference : 1));
  if (Math.abs(value) <= 1e-9 * scale) return '0';
  return formatNumber(value, context, options);
};
