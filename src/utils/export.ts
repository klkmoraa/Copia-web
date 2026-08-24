import type { ProjectModel } from '../types';
import { normalizeProject } from '../data/migrate';
import { assertWithinBudget, FILE_BUDGETS } from './fileGuards';
import { buildStandaloneSvg, serializeStandaloneSvg, type SvgExportOptions } from './svgExport';

const download = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
};

/** Nombre de archivo seguro a partir del nombre del proyecto, compartido por todas las rutas de guardado. */
export const safeProjectFilename = (name: string): string => name
  .normalize('NFKD')
  .replace(/[^a-zA-Z0-9 _-]/g, '')
  .trim()
  .replace(/\s+/g, '-')
  .toLowerCase() || 'structureco-project';

export const exportProjectJson = (project: ProjectModel) => {
  const normalized = normalizeProject(project);
  download(
    new Blob([JSON.stringify(normalized, null, 2)], { type: 'application/json' }),
    `${safeProjectFilename(normalized.name)}.structureco.json`,
  );
};

export const importProjectJson = async (file: File): Promise<ProjectModel> => {
  assertWithinBudget(file.size, FILE_BUDGETS.jsonBytes, 'JSON');
  const text = await file.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw new Error('El archivo no contiene JSON válido.');
  }
  return normalizeProject(parsed);
};

export const exportSvgElement = (
  svg: SVGSVGElement,
  filename: string,
  options: SvgExportOptions = {},
) => {
  const markup = serializeStandaloneSvg(svg, options);
  download(new Blob([markup], { type: 'image/svg+xml;charset=utf-8' }), filename);
};

export interface PngExportOptions extends SvgExportOptions {
  /** Device-independent multiplier. 1 = screen, 2 = high resolution, 3 = presentation. */
  scale?: number;
}

/** Browsers refuse to read back canvases beyond roughly this area; fail loudly instead. */
const MAX_RASTER_PIXELS = 64_000_000;

export const rasterScaleFor = (
  width: number,
  height: number,
  requested: number | undefined,
): number => {
  const wanted = Number.isFinite(requested) && (requested ?? 0) > 0
    ? (requested as number)
    : Math.min(3, Math.max(2, Math.round(globalThis.devicePixelRatio || 1)));
  if (width <= 0 || height <= 0) return wanted;
  const affordable = Math.sqrt(MAX_RASTER_PIXELS / (width * height));
  // The floor of 1 is deliberate. A drawing whose natural size already exceeds the limit
  // is never silently shrunk — downscaling an engineering drawing loses information. It
  // stays at 1x, and if the browser then refuses, `exportSvgAsPng` rejects and says so.
  return Math.max(1, Math.min(wanted, affordable));
};

/**
 * Rasterizes the same standalone SVG the file export produces, so PNG and SVG cannot
 * drift apart. The bitmap is rendered at its final size — never rendered small and
 * upscaled — and every path releases the object URL.
 */
export const exportSvgAsPng = (
  svg: SVGSVGElement,
  filename: string,
  options: PngExportOptions = {},
): Promise<void> => new Promise((resolve, reject) => {
  const standalone = buildStandaloneSvg(svg, options);
  const width = Number(standalone.getAttribute('width')) || svg.clientWidth || 1;
  const height = Number(standalone.getAttribute('height')) || svg.clientHeight || 1;
  const scale = rasterScaleFor(width, height, options.scale);
  const markup = new XMLSerializer().serializeToString(standalone);
  const url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml;charset=utf-8' }));

  const image = new Image();
  const release = () => URL.revokeObjectURL(url);
  image.onerror = () => {
    release();
    reject(new Error('No se pudo rasterizar el dibujo.'));
  };
  image.onload = () => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('El navegador no ofrece un contexto 2D para exportar PNG.');
      // The background already lives in the SVG, so PNG and SVG cannot disagree about it.
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        release();
        if (!blob) {
          reject(new Error('El navegador no pudo generar el PNG.'));
          return;
        }
        download(blob, filename);
        resolve();
      }, 'image/png');
    } catch (error) {
      release();
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  };
  image.src = url;
});
