/**
 * Resource budgets for everything structureCo reads from disk.
 *
 * The rule these enforce is "reject before allocating": a file's declared size is
 * checked against a budget *before* its bytes are pulled into memory, and an archive's
 * declared entry sizes are checked *before* anything is inflated. A hostile or merely
 * corrupt file should cost a stat call, not a heap.
 *
 * Messages are Spanish sentences because `portableImportAdapter` maps them to
 * localized catalog keys; adding a message here means adding a key there too.
 */

export const FILE_BUDGETS = {
  /** Whole-file ceilings, applied to `File.size` before any read. */
  pdfBytes: 25 * 1024 * 1024,
  bundleBytes: 40 * 1024 * 1024,
  jsonBytes: 20 * 1024 * 1024,
  /** Applied when the kind is still unknown, i.e. before the signature is read. */
  unknownBytes: 40 * 1024 * 1024,
  /** Bytes read to identify a file by signature. */
  signatureBytes: 8,
} as const;

export const ARCHIVE_BUDGETS = {
  /** A real expediente holds five entries; the ceiling only has to stop absurd inputs. */
  maxEntries: 32,
  maxEntryBytes: 64 * 1024 * 1024,
  maxTotalBytes: 128 * 1024 * 1024,
  /** Deflate reaches ~1000:1 on pathological input; legitimate JSON and PDF stay far below. */
  maxCompressionRatio: 120,
  maxPathDepth: 6,
  maxNameLength: 180,
} as const;

export const PDF_BUDGETS = {
  maxPages: 120,
  maxAttachments: 24,
  maxAttachmentBytes: 20 * 1024 * 1024,
} as const;

const megabytes = (bytes: number): string => {
  const value = bytes / 1024 / 1024;
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
};

export class FileBudgetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FileBudgetError';
  }
}

/**
 * Rejects an oversized file from its declared size alone. Call this before
 * `arrayBuffer()`, `text()` or any other read.
 */
export const assertWithinBudget = (size: number, limit: number, label: string): void => {
  if (!Number.isFinite(size) || size < 0) {
    throw new FileBudgetError(`El archivo ${label} no declara un tamano valido.`);
  }
  if (size === 0) {
    throw new FileBudgetError(`El archivo ${label} esta vacio.`);
  }
  if (size > limit) {
    throw new FileBudgetError(`El archivo ${label} excede el limite de ${megabytes(limit)} MB.`);
  }
};

/** Reads only the leading bytes needed to identify a file, never the whole thing. */
export const readSignature = async (
  file: Blob,
  length: number = FILE_BUDGETS.signatureBytes,
): Promise<Uint8Array> =>
  new Uint8Array(await file.slice(0, Math.min(length, file.size)).arrayBuffer());

export const hasSignature = (bytes: Uint8Array, signature: readonly number[]): boolean =>
  bytes.length >= signature.length && signature.every((byte, index) => bytes[index] === byte);

export interface ArchiveEntryClaim {
  name: string;
  /** Compressed size as declared by the archive. */
  size: number;
  /** Uncompressed size as declared by the archive. */
  originalSize: number;
}

export interface ArchiveBudgetTracker {
  /** Throws when the entry, or the archive so far, exceeds a budget. */
  accept(entry: ArchiveEntryClaim): void;
}

const UNSAFE_PATH = /(^|[/\\])\.\.([/\\]|$)/;
const ABSOLUTE_PATH = /^([/\\]|[a-zA-Z]:)/;

/** Rejects traversal, absolute paths, drive letters, NUL bytes and absurd nesting. */
export const assertSafeArchivePath = (name: string): void => {
  if (name === '' || name.length > ARCHIVE_BUDGETS.maxNameLength) {
    throw new FileBudgetError('El paquete contiene una ruta interna no valida.');
  }
  if (name.includes('\0') || ABSOLUTE_PATH.test(name) || UNSAFE_PATH.test(name)) {
    throw new FileBudgetError(`El paquete contiene una ruta interna insegura: ${name}`);
  }
  if (name.split(/[/\\]/).length > ARCHIVE_BUDGETS.maxPathDepth) {
    throw new FileBudgetError(`El paquete contiene una ruta demasiado profunda: ${name}`);
  }
};

/**
 * Accumulates declared entry sizes so an archive is rejected before inflation.
 * Declared sizes can lie, which is why the caller must also cap the source bytes.
 */
export const createArchiveBudgetTracker = (): ArchiveBudgetTracker => {
  const seen = new Set<string>();
  let entries = 0;
  let totalOriginal = 0;

  return {
    accept(entry) {
      entries += 1;
      if (entries > ARCHIVE_BUDGETS.maxEntries) {
        throw new FileBudgetError(`El paquete supera las ${ARCHIVE_BUDGETS.maxEntries} entradas permitidas.`);
      }
      assertSafeArchivePath(entry.name);
      if (seen.has(entry.name)) {
        throw new FileBudgetError(`El paquete repite la entrada ${entry.name}.`);
      }
      seen.add(entry.name);

      if (entry.originalSize > ARCHIVE_BUDGETS.maxEntryBytes) {
        throw new FileBudgetError(
          `La entrada ${entry.name} excede el limite de ${megabytes(ARCHIVE_BUDGETS.maxEntryBytes)} MB descomprimidos.`,
        );
      }
      totalOriginal += entry.originalSize;
      if (totalOriginal > ARCHIVE_BUDGETS.maxTotalBytes) {
        throw new FileBudgetError(
          `El paquete supera los ${megabytes(ARCHIVE_BUDGETS.maxTotalBytes)} MB descomprimidos.`,
        );
      }
      if (entry.size > 0 && entry.originalSize / entry.size > ARCHIVE_BUDGETS.maxCompressionRatio) {
        throw new FileBudgetError(`La entrada ${entry.name} tiene una relacion de compresion sospechosa.`);
      }
    },
  };
};
