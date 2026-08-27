// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultProject } from '../../data/defaultProject';
import { PROJECT_STORAGE_KEY } from '../../data/projectStorage';
import { ProjectProvider } from '../../store/ProjectContext';
import { ClassroomSessionProvider } from '../../store/ClassroomSessionContext';
import { DesignStandardSelector } from './DesignStandardSelector';

const Harness = ({ children }: { children: React.ReactNode }) => (
  <ProjectProvider>
    <ClassroomSessionProvider projectId="selector-test">
      {children}
    </ClassroomSessionProvider>
  </ProjectProvider>
);

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(createDefaultProject()));
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('DesignStandardSelector', () => {
  it('renders default standard name and trigger', () => {
    render(
      <Harness>
        <DesignStandardSelector />
      </Harness>
    );

    const trigger = screen.getByTestId('design-standard-trigger');
    expect(trigger).not.toBeNull();
    expect(trigger.textContent).toContain('AISC 360-16 (LRFD)');
  });

  it('opens popover on click and lists all design standards', async () => {
    const user = userEvent.setup();
    render(
      <Harness>
        <DesignStandardSelector />
      </Harness>
    );

    const triggerButton = screen.getByRole('button', { name: /normas de diseño estructural/i });
    await user.click(triggerButton);

    expect(screen.getByText('Verificación Normativa')).not.toBeNull();
    expect(screen.getByText(/Eurocódigo 3/i)).not.toBeNull();
    expect(screen.getByText(/AISC 360-16 \(ASD\)/i)).not.toBeNull();
    expect(screen.getByText(/NTC Acero CDMX 2023/i)).not.toBeNull();
  });

  it('changes active standard when an option is selected', async () => {
    const user = userEvent.setup();
    const onStandardChange = vi.fn();
    render(
      <Harness>
        <DesignStandardSelector onStandardChange={onStandardChange} />
      </Harness>
    );

    const triggerButton = screen.getByRole('button', { name: /normas de diseño estructural/i });
    await user.click(triggerButton);

    const eurocodeOption = screen.getByRole('menuitemradio', { name: /Eurocódigo 3/i });
    await user.click(eurocodeOption);

    expect(onStandardChange).toHaveBeenCalledWith('eurocode-3');
    await waitFor(() => {
      expect(screen.getByTestId('design-standard-trigger').textContent).toContain('Eurocódigo 3');
    });
  });
});
