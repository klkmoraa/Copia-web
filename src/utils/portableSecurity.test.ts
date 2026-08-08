/**
 * Adversarial corpus for the import path. Every hostile fixture is synthesised in
 * memory: nothing large or binary is committed to the repository.
 */
import { describe, expect, it } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import { ARCHIVE_BUDGETS, FILE_BUDGETS } from './fileGuards';
import { readPortableBundle } from './portableBundle';
import { inspectPortableFile } from './portableFile';
import { PORTABLE_FORMAT_VERSION } from './portableTypes';

const asFile = (bytes: Uint8Array | string, name: string, type = ''): File =>
  new File([typeof bytes === 'string' ? bytes : (bytes.slice().buffer as ArrayBuffer)], name, { type });

/** A File that reports a huge size without allocating one, to exercise early rejection. */
const oversizedFile = (name: string, size: number, type = ''): File => {
  const file = asFile('{}', name, type);
  Object.defineProperty(file, 'size', { value: size, configurable: true });
  return file;
};

const validManifest = {
  format: 'structureco-bundle',
  formatVersion: PORTABLE_FORMAT_VERSION,
  createdAt: '2026-08-02T00:00:00.000Z',
  appVersion: '0.8.1',
  projectName: 'Adversarial',
  payloadChecksum: 'f'.repeat(64),
  files: {
    payload: 'portable/payload.json',
    project: 'project.json',
    analysis: 'analysis/result.json',
    report: 'report/calculation-report.pdf',
  },
};

const zipOf = (entries: Record<string, Uint8Array>) => zipSync(entries, { level: 0 });

describe('rechazo temprano por tamano', () => {
  it('rechaza un PDF sobredimensionado sin leerlo', async () => {
    const file = oversizedFile('enorme.pdf', FILE_BUDGETS.pdfBytes + 1, 'application/pdf');
    await expect(inspectPortableFile(file)).rejects.toThrow(/excede el limite/);
  });

  it('rechaza un .structureco sobredimensionado sin descomprimirlo', async () => {
    const file = oversizedFile('enorme.structureco', FILE_BUDGETS.bundleBytes + 1);
    await expect(inspectPortableFile(file)).rejects.toThrow(/excede el limite/);
  });

  it('rechaza un JSON sobredimensionado sin parsearlo', async () => {
    const file = oversizedFile('enorme.json', FILE_BUDGETS.jsonBytes + 1, 'application/json');
    await expect(inspectPortableFile(file)).rejects.toThrow(/excede el limite/);
  });

  it('aplica el techo desconocido antes de conocer el tipo', async () => {
    const file = oversizedFile('sin-extension', FILE_BUDGETS.unknownBytes + 1);
    await expect(inspectPortableFile(file)).rejects.toThrow(/seleccionado excede el limite/);
  });

  it('rechaza un archivo vacio en vez de intentar interpretarlo', async () => {
    await expect(inspectPortableFile(new File([], 'vacio.json'))).rejects.toThrow(/vacio/);
  });

  it('rechaza un formato que no reconoce por firma ni por nombre', async () => {
    await expect(inspectPortableFile(asFile(new Uint8Array([0x00, 0x01, 0x02, 0x03]), 'raro.bin')))
      .rejects.toThrow(/Formato no compatible/);
  });

  it('clasifica por firma real aunque la extension mienta', async () => {
    // Un ZIP disfrazado de .json debe entrar por la ruta de paquete, no por JSON.parse.
    const zip = zipOf({ 'nota.txt': strToU8('no es un expediente') });
    await expect(inspectPortableFile(asFile(zip, 'disfrazado.json', 'application/json')))
      .rejects.toThrow(/manifest\.json/);
  });
});

describe('presupuestos de archivo .structureco', () => {
  it('rechaza un ZIP con demasiadas entradas', () => {
    const entries: Record<string, Uint8Array> = {};
    for (let index = 0; index <= ARCHIVE_BUDGETS.maxEntries; index += 1) {
      entries[`entrada-${index}.txt`] = strToU8('x');
    }
    return expect(readPortableBundle(zipOf(entries))).rejects.toThrow(/entradas permitidas/);
  });

  it('rechaza una entrada con path traversal', () => {
    const zip = zipOf({ 'manifest.json': strToU8('{}'), '../fuera.json': strToU8('{}') });
    return expect(readPortableBundle(zip)).rejects.toThrow(/insegura/);
  });

  it('rechaza una entrada con ruta absoluta', () => {
    const zip = zipOf({ 'manifest.json': strToU8('{}'), '/etc/passwd': strToU8('{}') });
    return expect(readPortableBundle(zip)).rejects.toThrow(/insegura/);
  });

  it('rechaza una zip bomb por su relacion de compresion declarada', () => {
    // Un megabyte de ceros comprime muy por encima del maximo permitido.
    const zip = zipSync({ 'bomba.bin': new Uint8Array(1024 * 1024) }, { level: 9 });
    return expect(readPortableBundle(zip)).rejects.toThrow(/relacion de compresion/);
  });

  it('rechaza un paquete que no es ZIP', () => expect(readPortableBundle(strToU8('no soy un zip')))
    .rejects.toThrow(/no es un paquete ZIP valido/));

  it('rechaza un ZIP sin manifest', () => expect(readPortableBundle(zipOf({ 'a.txt': strToU8('a') })))
    .rejects.toThrow(/no contiene manifest\.json/));
});

describe('validacion del manifest', () => {
  const bundleWith = (manifest: unknown) => zipOf({ 'manifest.json': strToU8(JSON.stringify(manifest)) });

  it('rechaza un manifest sin bloque files en vez de fallar con TypeError', async () => {
    const { files: _files, ...withoutFiles } = validManifest;
    await expect(readPortableBundle(bundleWith(withoutFiles)))
      .rejects.toThrow(/manifest structureCo compatible/);
  });

  it('rechaza un manifest cuyo bloque files es un array', () => expect(readPortableBundle(bundleWith({ ...validManifest, files: [] })))
    .rejects.toThrow(/manifest structureCo compatible/));

  it('rechaza un manifest al que le falta una ruta obligatoria', () => {
    const { report: _report, ...partial } = validManifest.files;
    return expect(readPortableBundle(bundleWith({ ...validManifest, files: partial })))
      .rejects.toThrow(/manifest structureCo compatible/);
  });

  it('rechaza una ruta de manifest con traversal', () => expect(readPortableBundle(bundleWith({
    ...validManifest,
    files: { ...validManifest.files, payload: '../../robo.json' },
  }))).rejects.toThrow(/insegura/));

  it('rechaza una version de formato futura', () => expect(readPortableBundle(bundleWith({
    ...validManifest,
    formatVersion: PORTABLE_FORMAT_VERSION + 1,
  }))).rejects.toThrow(/manifest structureCo compatible/));

  it('rechaza un checksum que no es texto', () => expect(readPortableBundle(bundleWith({
    ...validManifest,
    payloadChecksum: 42,
  }))).rejects.toThrow(/manifest structureCo compatible/));

  it('informa que el paquete esta incompleto cuando el manifest es valido pero faltan archivos', () => expect(
    readPortableBundle(bundleWith(validManifest)),
  ).rejects.toThrow(/esta incompleto/));
});

describe('JSON hostil', () => {
  it('rechaza JSON invalido con un mensaje comprensible', () => expect(
    inspectPortableFile(asFile('{ esto no es json', 'roto.json', 'application/json')),
  ).rejects.toThrow(/JSON no es valido/));

  it('no adopta __proto__ del archivo importado', async () => {
    const hostile = JSON.stringify({
      schemaVersion: 1,
      name: 'Hostil',
      nodes: [],
      members: [],
      __proto__: { contaminado: true },
    });
    const inspection = await inspectPortableFile(asFile(hostile, 'hostil.json', 'application/json'));
    expect(inspection.kind).toBe('project-json');
    expect(({} as Record<string, unknown>).contaminado).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(Object.prototype, 'contaminado')).toBe(false);
  });
});
