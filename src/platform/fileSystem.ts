/**
 * Guardar y abrir contra el disco de verdad, cuando el navegador lo permite.
 *
 * Hasta aquí un expediente sólo se podía **descargar**: cada guardado dejaba
 * `modelo (3).structureco` en Descargas y el usuario tenía que reconciliar
 * copias a mano. La File System Access API permite lo que se espera de una
 * aplicación local-first —elegir el archivo una vez y volver a escribir en
 * él—, y donde no existe, la ruta de descarga que ya funcionaba sigue intacta.
 *
 * ## Por qué la reserva no es un caso de error
 *
 * Firefox y Safari no implementan esta API. Tratar eso como un fallo dejaría a
 * media base de usuarios viendo un mensaje por usar un navegador correcto. La
 * detección es una bifurcación, no una excepción, y el resultado dice **por qué
 * ruta** se guardó para que la interfaz pueda decir la verdad («guardado en el
 * archivo» frente a «descargado»).
 *
 * El manejador (`handle`) se devuelve para que el llamador pueda reutilizarlo en
 * el siguiente guardado. No se guarda aquí: un módulo que retuviera manejadores
 * los compartiría entre proyectos.
 */
import { downloadPortableBytes } from '../utils/portableDownload';

/** Sólo lo que este módulo usa de la API; evita depender de tipos que TypeScript aún no trae. */
interface WritableHandle {
  createWritable(): Promise<{ write(data: BufferSource): Promise<void>; close(): Promise<void> }>;
  getFile(): Promise<File>;
  readonly name: string;
}

interface FilePickerWindow {
  showSaveFilePicker?: (options: unknown) => Promise<WritableHandle>;
  showOpenFilePicker?: (options: unknown) => Promise<WritableHandle[]>;
}

export type FileSystemSupport = 'native' | 'download-only';

export const detectFileSystemSupport = (): FileSystemSupport =>
  typeof (window as unknown as FilePickerWindow).showSaveFilePicker === 'function' ? 'native' : 'download-only';

export interface SaveRequest {
  bytes: Uint8Array;
  filename: string;
  mimeType: string;
  /** Extensión con punto, p. ej. `.structureco`. */
  extension: string;
  description: string;
  /** Manejador de un guardado anterior: escribe encima sin volver a preguntar. */
  handle?: unknown;
}

export type SaveOutcome =
  | { status: 'written'; handle: unknown; filename: string }
  | { status: 'downloaded'; filename: string }
  | { status: 'cancelled' };

const asWritable = (handle: unknown): WritableHandle | null =>
  handle && typeof (handle as WritableHandle).createWritable === 'function' ? handle as WritableHandle : null;

const write = async (handle: WritableHandle, bytes: Uint8Array): Promise<void> => {
  const stream = await handle.createWritable();
  // `slice()` materializa un ArrayBuffer propio: escribir la vista de un búfer
  // compartido puede volcar bytes que no son del archivo.
  await stream.write(bytes.slice().buffer);
  await stream.close();
};

const isAbort = (error: unknown): boolean =>
  error instanceof DOMException && (error.name === 'AbortError' || error.name === 'NotAllowedError');

/**
 * Escribe los bytes en disco. Con manejador previo escribe directamente; sin él
 * pregunta una vez; sin API, descarga.
 */
export const saveBytes = async (request: SaveRequest): Promise<SaveOutcome> => {
  const existing = asWritable(request.handle);
  if (existing) {
    try {
      await write(existing, request.bytes);
      return { status: 'written', handle: existing, filename: existing.name };
    } catch (error) {
      if (isAbort(error)) return { status: 'cancelled' };
      // Un manejador puede caducar —el archivo se movió o se revocó el permiso—.
      // Bajar a descarga es mejor que perder el guardado.
      downloadPortableBytes(request.bytes, request.filename, request.mimeType);
      return { status: 'downloaded', filename: request.filename };
    }
  }

  const picker = (window as unknown as FilePickerWindow).showSaveFilePicker;
  if (!picker) {
    downloadPortableBytes(request.bytes, request.filename, request.mimeType);
    return { status: 'downloaded', filename: request.filename };
  }

  try {
    const handle = await picker({
      suggestedName: request.filename,
      types: [{ description: request.description, accept: { [request.mimeType]: [request.extension] } }],
    });
    await write(handle, request.bytes);
    return { status: 'written', handle, filename: handle.name };
  } catch (error) {
    if (isAbort(error)) return { status: 'cancelled' };
    downloadPortableBytes(request.bytes, request.filename, request.mimeType);
    return { status: 'downloaded', filename: request.filename };
  }
};

export interface OpenedFile {
  file: File;
  /** Manejador para escribir después en el mismo archivo, si el navegador lo dio. */
  handle?: unknown;
}

/**
 * Abre un archivo con el selector nativo cuando existe. Sin API devuelve `null`
 * para que el llamador use su `<input type="file">`, que sigue siendo la ruta
 * universal.
 */
export const openFile = async (accept: Record<string, string[]>, description: string): Promise<OpenedFile | null> => {
  const picker = (window as unknown as FilePickerWindow).showOpenFilePicker;
  if (!picker) return null;
  try {
    const [handle] = await picker({ multiple: false, types: [{ description, accept }] });
    if (!handle) return null;
    return { file: await handle.getFile(), handle };
  } catch (error) {
    if (isAbort(error)) return null;
    return null;
  }
};

/** Archivo con el que el sistema operativo abrió la aplicación, si lo hubo. */
export interface LaunchedFile {
  file: File;
  handle?: unknown;
}

/**
 * Atiende la cola de lanzamiento del sistema operativo.
 *
 * Es lo que hace que un doble clic sobre un `.structureco` abra este proyecto en
 * vez de un modelo vacío, y va de la mano de `file_handlers` en el manifiesto:
 * declarar el tipo sin atender la cola registra la aplicación como capaz de
 * abrir un archivo que después ignora.
 */
export const consumeLaunchQueue = (onFile: (launched: LaunchedFile) => void): void => {
  const queue = (window as unknown as {
    launchQueue?: { setConsumer(consumer: (params: { files?: WritableHandle[] }) => void): void };
  }).launchQueue;
  if (!queue) return;
  queue.setConsumer(async (params) => {
    const [handle] = params.files ?? [];
    if (!handle) return;
    try {
      onFile({ file: await handle.getFile(), handle });
    } catch {
      // Un lanzamiento sin permiso de lectura no puede abrir nada; la
      // aplicación arranca normal en vez de quedarse a medias.
    }
  });
};
