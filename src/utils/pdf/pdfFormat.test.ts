import { expect, it } from 'vitest';
import * as pdfFormat from './pdfFormat';

it('does not expose the superseded fixed-threshold matrix formatter', () => {
  expect('matrixSummary' in pdfFormat).toBe(false);
});
