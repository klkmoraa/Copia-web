import type { TranslationKey } from '../../i18n/catalogs';
import type { UnitSystemId } from '../../types';
import type { DatasheetColumn, DatasheetRow } from './datasheetModel';
import { datasheetCellText, datasheetColumnHeader } from './datasheetPresentation';

/**
 * Serializa la rejilla activa en formato TSV (valores separados por tabulador),
 * óptimo para pegar directamente en hojas de cálculo (Excel, Sheets).
 */
export const formatDatasheetAsTsv = (
  columns: readonly DatasheetColumn[],
  rows: readonly DatasheetRow[],
  units: UnitSystemId,
  t: (key: TranslationKey) => string,
): string => {
  const headers = columns.map((col) => datasheetColumnHeader(col, units, t));
  const lines = [headers.join('\t')];
  for (const row of rows) {
    const cells = columns.map((col) => datasheetCellText(row.values[col.id], units, t));
    lines.push(cells.join('\t'));
  }
  return lines.join('\n');
};

/**
 * Serializa la rejilla activa en formato CSV (valores separados por comas y escapados).
 */
export const formatDatasheetAsCsv = (
  columns: readonly DatasheetColumn[],
  rows: readonly DatasheetRow[],
  units: UnitSystemId,
  t: (key: TranslationKey) => string,
): string => {
  const escapeCsv = (val: string) => `"${val.replace(/"/g, '""')}"`;
  const headers = columns.map((col) => escapeCsv(datasheetColumnHeader(col, units, t)));
  const lines = [headers.join(',')];
  for (const row of rows) {
    const cells = columns.map((col) => escapeCsv(datasheetCellText(row.values[col.id], units, t)));
    lines.push(cells.join(','));
  }
  return lines.join('\r\n');
};

/**
 * Copia texto al portapapeles con fallback robusto para entornos variados.
 */
export const copyTextToClipboard = async (text: string): Promise<boolean> => {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fallback abajo
  }
  try {
    if (typeof document === 'undefined') return false;
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textarea);
    return successful;
  } catch {
    return false;
  }
};

/**
 * Dispara la descarga de un archivo de texto en el navegador.
 */
export const downloadTextFile = (
  filename: string,
  content: string,
  mimeType = 'text/csv;charset=utf-8;',
) => {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
};
