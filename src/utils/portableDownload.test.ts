// @vitest-environment jsdom

/**
 * One export, one file.
 *
 * AG-014 reported "descargas múltiples o residuales" from the PDF export. Reading the
 * orchestrator showed a single blob and a single synthetic click — the JSON expediente is
 * *attached inside* the PDF by `attachPortablePayload`, never downloaded beside it — so the
 * report could not be reproduced. This test pins that shape so a future refactor cannot
 * quietly reintroduce a second download, and so the claim stays answered with evidence
 * rather than with a reading of the code.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { downloadPortableBytes, shareOrDownloadPortableBytes } from './portableDownload';

const anchorClicks: string[] = [];
const createdUrls: string[] = [];
const revokedUrls: string[] = [];

beforeEach(() => {
  anchorClicks.length = 0;
  createdUrls.length = 0;
  revokedUrls.length = 0;
  let counter = 0;
  vi.stubGlobal('URL', Object.assign(Object.create(URL), {
    createObjectURL: () => {
      const url = `blob:structureco/${counter += 1}`;
      createdUrls.push(url);
      return url;
    },
    revokeObjectURL: (url: string) => void revokedUrls.push(url),
  }));
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function click(this: HTMLAnchorElement) {
    anchorClicks.push(this.download);
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]);

describe('descarga del expediente', () => {
  it('emite exactamente un archivo por exportacion', () => {
    downloadPortableBytes(bytes, 'memoria.pdf', 'application/pdf');

    expect(anchorClicks).toEqual(['memoria.pdf']);
    expect(createdUrls).toHaveLength(1);
  });

  it('no deja el anchor ni el object URL colgando en el documento', () => {
    vi.useFakeTimers();
    try {
      downloadPortableBytes(bytes, 'memoria.pdf', 'application/pdf');
      // A leftover anchor is the residue the report described: invisible, but it keeps the
      // blob alive and accumulates one node per export.
      expect(document.querySelectorAll('a[download]')).toHaveLength(0);
      expect(revokedUrls).toHaveLength(0);
      vi.advanceTimersByTime(30_000);
      expect(revokedUrls).toEqual(createdUrls);
    } finally {
      vi.useRealTimers();
    }
  });

  it('comparte sin descargar cuando el navegador acepta el archivo', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { share, canShare: () => true });

    await expect(shareOrDownloadPortableBytes(bytes, 'memoria.pdf', 'application/pdf')).resolves.toBe('shared');
    expect(share).toHaveBeenCalledTimes(1);
    expect(anchorClicks).toEqual([]);
  });

  it('descarga una sola vez cuando compartir falla, sin duplicar el archivo', async () => {
    const share = vi.fn().mockRejectedValue(new Error('share unavailable'));
    vi.stubGlobal('navigator', { share, canShare: () => true });

    await expect(shareOrDownloadPortableBytes(bytes, 'memoria.pdf', 'application/pdf')).resolves.toBe('downloaded');
    expect(anchorClicks).toEqual(['memoria.pdf']);
  });

  it('no descarga nada cuando el usuario cancela el dialogo de compartir', async () => {
    const share = vi.fn().mockRejectedValue(new DOMException('cancelled', 'AbortError'));
    vi.stubGlobal('navigator', { share, canShare: () => true });

    await expect(shareOrDownloadPortableBytes(bytes, 'memoria.pdf', 'application/pdf')).resolves.toBe('cancelled');
    expect(anchorClicks).toEqual([]);
    expect(createdUrls).toEqual([]);
  });
});
