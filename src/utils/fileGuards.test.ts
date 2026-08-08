import { describe, expect, it } from 'vitest';
import {
  ARCHIVE_BUDGETS,
  assertSafeArchivePath,
  assertWithinBudget,
  createArchiveBudgetTracker,
  FILE_BUDGETS,
  FileBudgetError,
  hasSignature,
  readSignature,
} from './fileGuards';

describe('assertWithinBudget', () => {
  it('accepts a file inside its budget', () => {
    expect(() => assertWithinBudget(1024, FILE_BUDGETS.jsonBytes, 'JSON')).not.toThrow();
  });

  it('rejects an empty file instead of parsing nothing', () => {
    expect(() => assertWithinBudget(0, FILE_BUDGETS.jsonBytes, 'JSON')).toThrow(/vacio/);
  });

  it('rejects a file past the budget and names the limit in megabytes', () => {
    expect(() => assertWithinBudget(FILE_BUDGETS.jsonBytes + 1, FILE_BUDGETS.jsonBytes, 'JSON'))
      .toThrow('El archivo JSON excede el limite de 20 MB.');
  });

  it('rejects a size that is not a real number', () => {
    expect(() => assertWithinBudget(Number.NaN, FILE_BUDGETS.jsonBytes, 'JSON')).toThrow(/tamano valido/);
    expect(() => assertWithinBudget(-1, FILE_BUDGETS.jsonBytes, 'JSON')).toThrow(/tamano valido/);
    expect(() => assertWithinBudget(Number.POSITIVE_INFINITY, FILE_BUDGETS.jsonBytes, 'JSON')).toThrow(/tamano valido/);
  });

  it('throws FileBudgetError so callers can tell budgets from parse failures', () => {
    expect(() => assertWithinBudget(0, 10, 'JSON')).toThrow(FileBudgetError);
  });
});

describe('readSignature', () => {
  it('reads only the leading bytes, not the whole blob', async () => {
    const blob = new Blob([new Uint8Array(4096).fill(0x41)]);
    const signature = await readSignature(blob, 8);
    expect(signature).toHaveLength(8);
  });

  it('never reads past the end of a short blob', async () => {
    const signature = await readSignature(new Blob([new Uint8Array([0x7b, 0x7d])]), 8);
    expect(Array.from(signature)).toEqual([0x7b, 0x7d]);
  });
});

describe('hasSignature', () => {
  it('matches a known prefix', () => {
    expect(hasSignature(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]), [0x25, 0x50, 0x44, 0x46])).toBe(true);
  });

  it('does not match when the file is shorter than the signature', () => {
    expect(hasSignature(new Uint8Array([0x25, 0x50]), [0x25, 0x50, 0x44, 0x46])).toBe(false);
  });
});

describe('assertSafeArchivePath', () => {
  const rejected = [
    '../escape.json',
    'nested/../../escape.json',
    'a/b/../c.json',
    '/absolute.json',
    '\\absolute.json',
    'C:/windows/system32.json',
    'payload\0.json',
    '',
    'a/b/c/d/e/f/g/too-deep.json',
    'x'.repeat(ARCHIVE_BUDGETS.maxNameLength + 1),
  ];

  for (const name of rejected) {
    it(`rejects ${JSON.stringify(name.slice(0, 40))}`, () => {
      expect(() => assertSafeArchivePath(name)).toThrow(FileBudgetError);
    });
  }

  it('accepts the paths a real expediente uses', () => {
    for (const name of ['manifest.json', 'portable/payload.json', 'analysis/result.json', 'report/calculation-report.pdf']) {
      expect(() => assertSafeArchivePath(name)).not.toThrow();
    }
    // A file merely containing dots is not traversal.
    expect(() => assertSafeArchivePath('report/v1.2..3.pdf')).not.toThrow();
  });
});

describe('createArchiveBudgetTracker', () => {
  const entry = (name: string, originalSize: number, size = Math.max(1, Math.ceil(originalSize / 4))) =>
    ({ name, size, originalSize });

  it('accepts a realistic expediente', () => {
    const budget = createArchiveBudgetTracker();
    expect(() => {
      budget.accept(entry('manifest.json', 400));
      budget.accept(entry('portable/payload.json', 240_000));
      budget.accept(entry('project.json', 60_000));
      budget.accept(entry('analysis/result.json', 900_000));
      budget.accept(entry('report/calculation-report.pdf', 1_800_000, 1_700_000));
    }).not.toThrow();
  });

  it('rejects an archive with too many entries', () => {
    const budget = createArchiveBudgetTracker();
    expect(() => {
      for (let index = 0; index <= ARCHIVE_BUDGETS.maxEntries; index += 1) {
        budget.accept(entry(`file-${index}.json`, 10));
      }
    }).toThrow(/entradas permitidas/);
  });

  it('rejects a duplicated entry name', () => {
    const budget = createArchiveBudgetTracker();
    budget.accept(entry('manifest.json', 100));
    expect(() => budget.accept(entry('manifest.json', 100))).toThrow(/repite la entrada/);
  });

  it('rejects a single oversized entry before inflating it', () => {
    const budget = createArchiveBudgetTracker();
    expect(() => budget.accept(entry('huge.json', ARCHIVE_BUDGETS.maxEntryBytes + 1)))
      .toThrow(/MB descomprimidos/);
  });

  it('rejects an archive whose entries add up past the total budget', () => {
    const budget = createArchiveBudgetTracker();
    const chunk = ARCHIVE_BUDGETS.maxEntryBytes;
    expect(() => {
      for (let index = 0; index < ARCHIVE_BUDGETS.maxEntries; index += 1) {
        budget.accept(entry(`chunk-${index}.bin`, chunk));
      }
    }).toThrow(/MB descomprimidos/);
  });

  it('rejects a zip bomb by its declared compression ratio', () => {
    const budget = createArchiveBudgetTracker();
    expect(() => budget.accept({ name: 'bomb.bin', size: 1_000, originalSize: 1_000 * (ARCHIVE_BUDGETS.maxCompressionRatio + 1) }))
      .toThrow(/relacion de compresion/);
  });

  it('rejects a traversal path found inside an archive', () => {
    const budget = createArchiveBudgetTracker();
    expect(() => budget.accept(entry('../../etc/passwd', 10))).toThrow(/insegura/);
  });

  it('tolerates a stored entry whose compressed size equals its original size', () => {
    const budget = createArchiveBudgetTracker();
    expect(() => budget.accept({ name: 'stored.bin', size: 4096, originalSize: 4096 })).not.toThrow();
  });
});
