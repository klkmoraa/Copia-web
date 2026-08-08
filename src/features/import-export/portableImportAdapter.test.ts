// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createBlankProject } from '../../data/defaultProject';
import { inspectPortableFile } from '../../utils/portableFile';
import { createPortableImportCenterAdapter } from './portableImportAdapter';

vi.mock('../../utils/portableFile', () => ({
  inspectPortableFile: vi.fn(),
}));

const inspectPortableFileMock = vi.mocked(inspectPortableFile);

describe('portableImportCenterAdapter presentation localization', () => {
  beforeEach(() => {
    inspectPortableFileMock.mockReset();
  });

  it('presents project inspection and completion feedback in English without changing project data', async () => {
    const project = createBlankProject();
    project.name = 'Bridge N-07';
    inspectPortableFileMock.mockResolvedValue({
      fileName: 'bridge.json',
      size: 1024,
      kind: 'project-json',
      canRestoreProject: true,
      project,
    });
    const adapter = createPortableImportCenterAdapter('en');
    const file = new File(['{}'], 'bridge.json', { type: 'application/json' });

    const inspection = await adapter.inspect(file);
    expect(inspection.sourceLabel).toBe('structureCo JSON project');
    expect(inspection.summary).toContain('Bridge N-07');
    expect(inspection.summary).toContain('validated');
    expect(inspection.statistics.map((item) => item.label)).toEqual(['Nodes', 'Members', 'Loads', 'Procedures']);
    expect(inspection.contents.map((item) => item.label)).toEqual([
      'Geometry and properties',
      'Supports and displacements',
      'Loads, cases and combinations',
      'Analysis results',
      'FBD and N–V–M diagrams',
      'Procedures and calculations',
      'Provenance and integrity',
    ]);
    expect(JSON.stringify(inspection)).not.toMatch(/Proyecto|Geometría|Miembros|Cargas|Procedimientos/);

    const outcome = await adapter.importFile(file, inspection, {
      mode: 'new',
      content: ['geometry', 'supports', 'loads'],
      saveCurrent: false,
    });
    expect(outcome.project.name).toBe('Bridge N-07');
    expect(outcome.title).toBe('Project imported');
    expect(outcome.message).toContain('run Analyze');
  });

  it('keeps the established Spanish presentation as the default adapter contract', async () => {
    const project = createBlankProject();
    project.name = 'Puente N-07';
    inspectPortableFileMock.mockResolvedValue({
      fileName: 'puente.json',
      size: 1024,
      kind: 'project-json',
      canRestoreProject: true,
      project,
    });
    const adapter = createPortableImportCenterAdapter('es');
    const inspection = await adapter.inspect(new File(['{}'], 'puente.json', { type: 'application/json' }));

    expect(inspection.sourceLabel).toBe('Proyecto structureCo JSON');
    expect(inspection.summary).toContain('Puente N-07');
    expect(inspection.contents[0]?.label).toBe('Geometría y propiedades');
  });

  it('localizes first-party reader errors at the presentation boundary', async () => {
    inspectPortableFileMock.mockRejectedValue(new Error('El archivo JSON no es valido.'));
    const adapter = createPortableImportCenterAdapter('en');

    await expect(adapter.inspect(new File(['{'], 'broken.json', { type: 'application/json' })))
      .rejects.toThrow('The JSON file is invalid.');
  });

  it('explains a rejected file instead of leaking the raw budget message', async () => {
    // Every guard in fileGuards must reach the user as a sentence, not as internals.
    const cases: Array<[string, RegExp]> = [
      ['El archivo PDF excede el limite de 25 MB.', /The PDF file exceeds the 25 MB limit/],
      ['El archivo JSON esta vacio.', /The JSON file is empty/],
      ['El archivo seleccionado no declara un tamano valido.', /does not report a valid size/],
      ['El paquete supera las 32 entradas permitidas.', /too many entries/],
      ['El paquete contiene una ruta interna insegura: ../fuera.json', /unsafe internal path \(\.\.\/fuera\.json\)/],
      ['El paquete contiene una ruta demasiado profunda: a/b/c/d/e/f/g.json', /nested too deeply/],
      ['El paquete repite la entrada manifest.json.', /repeats the entry manifest\.json/],
      ['La entrada huge.bin excede el limite de 64 MB descomprimidos.', /exceed the allowed limit/],
      ['El paquete supera los 128 MB descomprimidos.', /exceed the allowed limit/],
      ['La entrada bomba.bin tiene una relacion de compresion sospechosa.', /anomalous compression ratio/],
      ['El paquete contiene una ruta interna no valida.', /invalid internal path/],
    ];
    const adapter = createPortableImportCenterAdapter('en');
    const file = new File(['x'], 'any.bin');

    for (const [raw, expected] of cases) {
      inspectPortableFileMock.mockRejectedValueOnce(new Error(raw));
      await expect(adapter.inspect(file)).rejects.toThrow(expected);
    }
  });
});
