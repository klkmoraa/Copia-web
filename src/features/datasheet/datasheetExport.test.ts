import { describe, expect, it } from 'vitest';
import type { DatasheetColumn, DatasheetRow } from './datasheetModel';
import { formatDatasheetAsCsv, formatDatasheetAsTsv } from './datasheetExport';

describe('datasheetExport', () => {
  const columns: DatasheetColumn[] = [
    { id: 'id', labelKey: 'datasheet.column.id', editability: 'identity' },
    { id: 'x', labelKey: 'datasheet.column.x', editability: 'inline', quantity: 'length', numeric: true },
    { id: 'y', labelKey: 'datasheet.column.y', editability: 'inline', quantity: 'length', numeric: true },
  ];

  const rows: DatasheetRow[] = [
    {
      id: 'N1',
      kind: 'node',
      values: {
        id: { kind: 'text', text: 'N1' },
        x: { kind: 'number', value: 0, quantity: 'length' },
        y: { kind: 'number', value: 5, quantity: 'length' },
      },
    },
    {
      id: 'N2',
      kind: 'node',
      values: {
        id: { kind: 'text', text: 'N2' },
        x: { kind: 'number', value: 3.5, quantity: 'length' },
        y: { kind: 'number', value: 5, quantity: 'length' },
      },
    },
  ];

  const fakeTranslate = (key: string) => {
    if (key === 'datasheet.column.id') return 'ID';
    if (key === 'datasheet.column.x') return 'X';
    if (key === 'datasheet.column.y') return 'Y';
    return key;
  };

  it('formats rows as tab-separated values with column units', () => {
    const tsv = formatDatasheetAsTsv(columns, rows, 'kN-m', fakeTranslate as any);
    const lines = tsv.split('\n');
    expect(lines[0]).toBe('ID\tX (m)\tY (m)');
    expect(lines[1]).toBe('N1\t0\t5');
    expect(lines[2]).toBe('N2\t3.5\t5');
  });

  it('formats rows as CSV with quotes around cells and CRLF line endings', () => {
    const csv = formatDatasheetAsCsv(columns, rows, 'kN-m', fakeTranslate as any);
    const lines = csv.split('\r\n');
    expect(lines[0]).toBe('"ID","X (m)","Y (m)"');
    expect(lines[1]).toBe('"N1","0","5"');
    expect(lines[2]).toBe('"N2","3.5","5"');
  });
});
