// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { detectFileSystemSupport, openFile, saveBytes } from './fileSystem';
import { claimLaunchedFile, onLaunchedFile, resetLaunchQueueForTests, startLaunchQueue } from './launchedFile';

const BYTES = new Uint8Array([1, 2, 3, 4]);
const request = (handle?: unknown) => ({
  bytes: BYTES, filename: 'modelo.structureco', mimeType: 'application/x-structureco',
  extension: '.structureco', description: 'Expediente structureCo', handle,
});

/** Manejador de escritura falso que recuerda lo que se le escribió. */
const fakeHandle = (name = 'guardado.structureco') => {
  const written: ArrayBuffer[] = [];
  return {
    name,
    written,
    async createWritable() {
      return {
        async write(data: BufferSource) { written.push(data as ArrayBuffer); },
        async close() {},
      };
    },
    async getFile() { return new File([BYTES], name); },
  };
};

const withoutPickers = () => {
  delete (window as unknown as Record<string, unknown>).showSaveFilePicker;
  delete (window as unknown as Record<string, unknown>).showOpenFilePicker;
};

describe('detección de soporte', () => {
  afterEach(() => { withoutPickers(); vi.restoreAllMocks(); });

  it('sin la API declara que sólo hay descarga, que no es un error', () => {
    withoutPickers();
    expect(detectFileSystemSupport()).toBe('download-only');
  });

  it('con la API declara soporte nativo', () => {
    (window as unknown as Record<string, unknown>).showSaveFilePicker = () => {};
    expect(detectFileSystemSupport()).toBe('native');
  });
});

describe('guardar', () => {
  afterEach(() => { withoutPickers(); vi.restoreAllMocks(); });

  it('escribe directamente cuando ya hay manejador, sin volver a preguntar', async () => {
    const handle = fakeHandle();
    const picker = vi.fn();
    (window as unknown as Record<string, unknown>).showSaveFilePicker = picker;
    const outcome = await saveBytes(request(handle));
    expect(outcome.status).toBe('written');
    expect(picker).not.toHaveBeenCalled();
    expect(handle.written).toHaveLength(1);
  });

  it('pregunta una vez cuando no hay manejador y devuelve el nuevo', async () => {
    const handle = fakeHandle('elegido.structureco');
    (window as unknown as Record<string, unknown>).showSaveFilePicker = vi.fn(async () => handle);
    const outcome = await saveBytes(request());
    expect(outcome.status).toBe('written');
    if (outcome.status === 'written') {
      expect(outcome.handle).toBe(handle);
      expect(outcome.filename).toBe('elegido.structureco');
    }
  });

  it('sin la API descarga, y lo dice', async () => {
    withoutPickers();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    vi.stubGlobal('URL', { ...URL, createObjectURL: () => 'blob:x', revokeObjectURL: () => {} });
    const outcome = await saveBytes(request());
    expect(outcome.status).toBe('downloaded');
    expect(click).toHaveBeenCalled();
  });

  it('distingue que el usuario cancele de que algo falle', async () => {
    (window as unknown as Record<string, unknown>).showSaveFilePicker = vi.fn(async () => {
      throw new DOMException('cancelado', 'AbortError');
    });
    expect((await saveBytes(request())).status).toBe('cancelled');
  });

  it('un manejador caducado baja a descarga en vez de perder el guardado', async () => {
    const broken = {
      name: 'viejo.structureco',
      async createWritable() { throw new DOMException('sin permiso', 'NotFoundError'); },
      async getFile() { return new File([BYTES], 'viejo.structureco'); },
    };
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    vi.stubGlobal('URL', { ...URL, createObjectURL: () => 'blob:x', revokeObjectURL: () => {} });
    const outcome = await saveBytes(request(broken));
    expect(outcome.status).toBe('downloaded');
    expect(click).toHaveBeenCalled();
  });
});

describe('abrir', () => {
  afterEach(() => { withoutPickers(); vi.restoreAllMocks(); });

  it('sin la API devuelve null para que el llamador use su input de archivo', async () => {
    withoutPickers();
    expect(await openFile({ 'application/x-structureco': ['.structureco'] }, 'Expediente')).toBeNull();
  });

  it('devuelve el archivo y su manejador', async () => {
    const handle = fakeHandle('abierto.structureco');
    (window as unknown as Record<string, unknown>).showOpenFilePicker = vi.fn(async () => [handle]);
    const opened = await openFile({ 'application/x-structureco': ['.structureco'] }, 'Expediente');
    expect(opened?.file.name).toBe('abierto.structureco');
    expect(opened?.handle).toBe(handle);
  });

  it('una cancelación no es un fallo: devuelve null', async () => {
    (window as unknown as Record<string, unknown>).showOpenFilePicker = vi.fn(async () => {
      throw new DOMException('cancelado', 'AbortError');
    });
    expect(await openFile({ 'application/x-structureco': ['.structureco'] }, 'Expediente')).toBeNull();
  });
});

describe('buzón de lanzamiento', () => {
  beforeEach(() => { resetLaunchQueueForTests(); });
  afterEach(() => {
    resetLaunchQueueForTests();
    delete (window as unknown as Record<string, unknown>).launchQueue;
  });

  it('sin cola del sistema operativo no hay nada que reclamar, y eso es lo normal', () => {
    startLaunchQueue();
    expect(claimLaunchedFile()).toBeNull();
  });

  it('guarda el archivo del arranque hasta que alguien lo reclama', async () => {
    const handle = fakeHandle('lanzado.structureco');
    let consumer: ((params: { files?: unknown[] }) => void) | null = null;
    (window as unknown as Record<string, unknown>).launchQueue = { setConsumer: (fn: typeof consumer) => { consumer = fn; } };
    startLaunchQueue();
    consumer!({ files: [handle] });
    await Promise.resolve();
    await Promise.resolve();
    const claimed = claimLaunchedFile();
    expect(claimed?.file.name).toBe('lanzado.structureco');
    // De un solo uso: volver a Inicio no puede reabrir el mismo archivo.
    expect(claimLaunchedFile()).toBeNull();
  });

  it('entrega directamente a un oyente si la aplicación ya estaba escuchando', async () => {
    const handle = fakeHandle('directo.structureco');
    let consumer: ((params: { files?: unknown[] }) => void) | null = null;
    (window as unknown as Record<string, unknown>).launchQueue = { setConsumer: (fn: typeof consumer) => { consumer = fn; } };
    startLaunchQueue();
    const received: string[] = [];
    onLaunchedFile((launched) => received.push(launched.file.name));
    consumer!({ files: [handle] });
    await Promise.resolve();
    await Promise.resolve();
    expect(received).toEqual(['directo.structureco']);
  });

  it('un oyente que llega tarde recibe lo que había esperando', async () => {
    const handle = fakeHandle('pendiente.structureco');
    let consumer: ((params: { files?: unknown[] }) => void) | null = null;
    (window as unknown as Record<string, unknown>).launchQueue = { setConsumer: (fn: typeof consumer) => { consumer = fn; } };
    startLaunchQueue();
    consumer!({ files: [handle] });
    await Promise.resolve();
    await Promise.resolve();
    const received: string[] = [];
    onLaunchedFile((launched) => received.push(launched.file.name));
    expect(received).toEqual(['pendiente.structureco']);
  });
});
