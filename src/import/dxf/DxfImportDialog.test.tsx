// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultProject } from '../../data/defaultProject';
import { PROJECT_STORAGE_KEY } from '../../data/projectStorage';
import { ProjectProvider } from '../../store/ProjectContext';
import { InMemoryProjectRepository } from '../../storage/projectRepository';
import { DxfImportDialog } from './DxfImportDialog';

const DXF_LINE = ['0', 'SECTION', '2', 'HEADER', '9', '$INSUNITS', '70', '4', '0', 'ENDSEC', '0', 'SECTION', '2', 'ENTITIES', '0', 'LINE', '8', 'FRAME', '10', '0', '20', '0', '11', '1000', '21', '0', '0', 'ENDSEC', '0', 'EOF'].join('\n');

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(createDefaultProject()));
  window.requestAnimationFrame ??= (callback: FrameRequestCallback) => window.setTimeout(() => callback(performance.now()), 0);
  window.cancelAnimationFrame ??= (handle: number) => window.clearTimeout(handle);
});
afterEach(() => cleanup());

describe('DxfImportDialog', () => {
  it('requires preview, creates a recovery, and appends one reversible import', async () => {
    const repository = new InMemoryProjectRepository();
    const onImported = vi.fn();
    render(<ProjectProvider><DxfImportDialog
      open
      onOpenChange={() => undefined}
      onImported={onImported}
      repository={repository}
      readFile={async () => DXF_LINE}
    /></ProjectProvider>);

    const file = new File([DXF_LINE], 'frame.dxf', { type: 'application/dxf' });
    fireEvent.change(screen.getByLabelText('Archivo DXF ASCII'), { target: { files: [file] } });
    expect(await screen.findByText('1 entidad aceptada · 0 rechazadas')).toBeTruthy();
    expect(screen.getByText(/Capas detectadas.*FRAME/)).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: 'Crear copia e importar' }));
    await waitFor(() => expect(onImported).toHaveBeenCalledTimes(1));
    const recoveries = await repository.listRecoveries();
    expect(recoveries).toHaveLength(1);
    expect(recoveries[0].reason).toBe('dxf-import');
  });

  it('keeps confirmation disabled when unsupported entities are present', async () => {
    const repository = new InMemoryProjectRepository();
    const unsupported = ['0', 'SECTION', '2', 'ENTITIES', '0', 'CIRCLE', '10', '0', '20', '0', '40', '1', '0', 'ENDSEC', '0', 'EOF'].join('\n');
    render(<ProjectProvider><DxfImportDialog open onOpenChange={() => undefined} onImported={() => undefined} repository={repository} readFile={async () => unsupported} /></ProjectProvider>);
    fireEvent.change(screen.getByLabelText('Archivo DXF ASCII'), { target: { files: [new File([unsupported], 'circle.dxf')] } });
    await screen.findByText(/CIRCLE queda fuera/);
    expect(screen.getByRole('button', { name: 'Crear copia e importar' }).hasAttribute('disabled')).toBe(true);
  });
});
