import { formatNumber, formatValue, serializeNumber } from '../../utils/numberFormat';

export interface InspectorNumberFormatOptions {
  maximumFractionDigits?: number;
  significantDigits?: number;
}

export type InspectorNumberParseResult =
  | { ok: true; value: number }
  | { ok: false; reason: 'empty' | 'invalid' | 'non-finite' };

const DECIMAL_NUMBER_PATTERN = /^[+-]?(?:(?:\d+(?:\.\d*)?)|(?:\.\d+))(?:[eE][+-]?\d+)?$/;

/**
 * Formats an Inspector value for reading. This is deliberately presentational:
 * it never feeds a rounded value back into project state. The rule itself lives in
 * `utils/numberFormat` so the Inspector, Results, the canvas and the PDF agree.
 */
export const formatInspectorNumber = (
  value: number,
  options: InspectorNumberFormatOptions = {},
): string => formatNumber(value, 'inspector', options);

export const formatInspectorValue = (
  value: number,
  unit = '',
  options: InspectorNumberFormatOptions = {},
): string => formatValue(value, unit, 'inspector', options);

/**
 * Returns JavaScript's shortest round-trip representation for editing. Unlike
 * the reading formatter, this function performs no precision reduction.
 */
export const serializeInspectorNumber = (value: number): string => serializeNumber(value);

/** Accepts decimal/scientific input only; blank, hexadecimal and Infinity are rejected. */
export const parseInspectorNumber = (text: string): InspectorNumberParseResult => {
  const normalized = text.trim();
  if (normalized === '') return { ok: false, reason: 'empty' };
  if (!DECIMAL_NUMBER_PATTERN.test(normalized)) return { ok: false, reason: 'invalid' };

  const value = Number(normalized);
  if (!Number.isFinite(value)) return { ok: false, reason: 'non-finite' };
  return { ok: true, value };
};
