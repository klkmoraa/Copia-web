// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectProvider } from '../../store/ProjectContext';
import { CommandPalette } from './CommandPalette';

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('CommandPalette', () => {
  it('does not render when isOpen is false', () => {
    render(
      <ProjectProvider>
        <CommandPalette isOpen={false} onClose={vi.fn()} />
      </ProjectProvider>
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders commands and allows searching and executing', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <ProjectProvider>
        <CommandPalette isOpen={true} onClose={onClose} />
      </ProjectProvider>
    );

    expect(screen.getByRole('dialog')).toBeTruthy();
    const input = screen.getByPlaceholderText(/Buscar comando/i);
    expect(input).toBeTruthy();

    // Type query to filter
    await user.type(input, 'Auto-encuadrar');
    expect(screen.getByText(/Auto-encuadrar Canvas/i)).toBeTruthy();

    // Click on command
    await user.click(screen.getByText(/Auto-encuadrar Canvas/i));
    expect(onClose).toHaveBeenCalled();
  });

  it('closes on Escape key press', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <ProjectProvider>
        <CommandPalette isOpen={true} onClose={onClose} />
      </ProjectProvider>
    );

    const input = screen.getByPlaceholderText(/Buscar comando/i);
    await user.type(input, '{Escape}');
    expect(onClose).toHaveBeenCalled();
  });
});
