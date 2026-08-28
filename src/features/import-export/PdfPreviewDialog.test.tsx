// @vitest-environment jsdom
/**
 * Lo que el diálogo promete: enseña antes de entregar, deja quitar secciones y recompone una
 * sola vez aunque se marquen varias casillas, y distingue «no pude componerlo» —donde no hay
 * nada que descargar— de «no pude dibujarlo», donde el archivo sigue estando.
 */
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { es } from '../../i18n/catalogEs';
import { PdfPreviewDialog } from './PdfPreviewDialog';
import type { PreviewDocument } from './pdfPageRenderer';
import type { CalculationReportOptions } from '../../utils/pdf/reportContext';

const t = (key: string, values?: Record<string, string | number>) => {
  const template = (es as Record<string, string>)[key] ?? key;
  return values
    ? template.replace(/\{(\w+)\}/g, (_, name: string) => String(values[name] ?? ''))
    : template;
};

const previewDocument = (): PreviewDocument => ({
  pageCount: 4,
  renderPage: vi.fn().mockResolvedValue(undefined),
  aspectRatio: vi.fn().mockResolvedValue(1.414),
  destroy: vi.fn(),
});

const artifact = (bytes = new Uint8Array([1, 2, 3])) => ({
  bytes,
  filename: 'proyecto-memoria-calculo.pdf',
  payload: {} as never,
});

const setup = (overrides: Partial<Parameters<typeof PdfPreviewDialog>[0]> = {}) => {
  const buildReport = vi.fn(async (_options: CalculationReportOptions) => artifact());
  const onDownload = vi.fn().mockResolvedValue(undefined);
  const openDocument = vi.fn().mockResolvedValue(previewDocument());
  render(<PdfPreviewDialog
    open
    onOpenChange={vi.fn()}
    buildReport={buildReport}
    onDownload={onDownload}
    openDocument={openDocument}
    t={t}
    rebuildDelay={5}
    {...overrides}
  />);
  return { buildReport, onDownload, openDocument };
};

beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('PdfPreviewDialog', () => {
  it('compone el documento, lo enseña y no descarga nada hasta que se lo piden', async () => {
    const user = userEvent.setup();
    const { buildReport, onDownload } = setup();

    await waitFor(() => expect(buildReport).toHaveBeenCalledOnce());
    expect(await screen.findByText('Página 1 de 4')).toBeTruthy();
    expect(onDownload).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /Descargar/i }));
    await waitFor(() => expect(onDownload).toHaveBeenCalledOnce());
    expect(onDownload.mock.calls[0][0].filename).toBe('proyecto-memoria-calculo.pdf');
  });

  it('pide el documento completo la primera vez', async () => {
    const { buildReport } = setup();
    await waitFor(() => expect(buildReport).toHaveBeenCalledOnce());
    expect(buildReport.mock.calls[0][0]).toMatchObject({
      includeDiagrams: true,
      includeScope: true,
      includeProcedure: true,
      includeAnnex: true,
      includeEducationTrace: true,
    });
  });

  it('recompone sin la sección que se desmarca', async () => {
    const user = userEvent.setup();
    const { buildReport } = setup();
    await waitFor(() => expect(buildReport).toHaveBeenCalledOnce());

    await user.click(screen.getByRole('checkbox', { name: /Anexo técnico/i }));

    await waitFor(() => expect(buildReport).toHaveBeenCalledTimes(2));
    expect(buildReport.mock.calls[1][0]).toMatchObject({ includeAnnex: false, includeScope: true });
  });

  it('ata la traza al anexo, que es quien la dibuja', async () => {
    const user = userEvent.setup();
    const { buildReport } = setup();
    await waitFor(() => expect(buildReport).toHaveBeenCalledOnce());

    const trace = screen.getByRole('checkbox', { name: /Traza educativa/i }) as HTMLInputElement;
    expect(trace.disabled).toBe(false);
    await user.click(screen.getByRole('checkbox', { name: /Anexo técnico/i }));
    expect((screen.getByRole('checkbox', { name: /Traza educativa/i }) as HTMLInputElement).disabled).toBe(true);
  });

  it('sin documento no ofrece descarga', async () => {
    const buildReport = vi.fn().mockRejectedValue(new Error('roto'));
    setup({ buildReport });

    expect((await screen.findByRole('alert')).textContent).toContain('No se pudo generar el expediente.');
    await waitFor(() => expect((screen.getByRole('button', { name: /Descargar/i }) as HTMLButtonElement).disabled).toBe(true));
  });

  it('si sólo falla el dibujo, el archivo sigue estando', async () => {
    const openDocument = vi.fn().mockRejectedValue(new Error('sin lienzo'));
    setup({ openDocument });

    expect((await screen.findByRole('alert')).textContent).toContain('No se pudo dibujar la vista previa');
    await waitFor(() => expect((screen.getByRole('button', { name: /Descargar/i }) as HTMLButtonElement).disabled).toBe(false));
  });
});
