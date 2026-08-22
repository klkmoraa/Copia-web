const DECIMAL_VALUE = /^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/;

export const parseLocalizedDecimal = (raw: string): number | null => {
  const value = raw.trim();
  if (!DECIMAL_VALUE.test(value)) return null;
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
};

export const parseQuickEntryPair = (firstRaw: string, secondRaw: string):
  | { ok: true; value: { first: number; second: number } }
  | { ok: false } => {
  const first = parseLocalizedDecimal(firstRaw);
  const second = parseLocalizedDecimal(secondRaw);
  return first === null || second === null
    ? { ok: false }
    : { ok: true, value: { first, second } };
};
