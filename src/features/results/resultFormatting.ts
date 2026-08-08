import { formatNumber, formatValue } from '../../utils/numberFormat';

/**
 * Results share the Inspector's reading rule: the same stored value must not read as
 * `1e-14` in one panel and `1.0000e-14` in the other.
 */
export const formatResultNumber = (value: number) => formatNumber(value, 'table');

export const formatResultValue = (value: number, unit: string) => formatValue(value, unit, 'table');
