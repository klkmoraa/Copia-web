// @vitest-environment jsdom
import { useState } from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { Button } from './controls';
import { Dialog, Drawer, Popover, Tooltip } from './overlays';

beforeAll(() => {
  if (!window.requestAnimationFrame) {
    window.requestAnimationFrame = (callback: FrameRequestCallback) => window.setTimeout(() => callback(performance.now()), 0);
    window.cancelAnimationFrame = (handle: number) => window.clearTimeout(handle);
  }
});

afterEach(() => {
  cleanup();
  document.body.style.overflow = '';
});

const PopoverHarness = () => {
  const [open, setOpen] = useState(false);
  return <Popover label="Preferencias" open={open} onOpenChange={setOpen} trigger={<span>Abrir preferencias</span>}>
    <button type="button">Acción contextual</button>
  </Popover>;
};

const ModalHarness = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  return <>
    <button type="button" onClick={() => setDialogOpen(true)}>Abrir diálogo</button>
    <button type="button" onClick={() => setDrawerOpen(true)}>Abrir panel</button>
    <Dialog
      open={dialogOpen}
      onOpenChange={setDialogOpen}
      title="Confirmación"
      description="Diálogo de prueba"
      footer={<Button onClick={() => setDialogOpen(false)}>Aceptar</Button>}
    ><FieldInModal /></Dialog>
    <Drawer open={drawerOpen} onOpenChange={setDrawerOpen} title="Propiedades" footer={<Button>Cerrar panel</Button>}>
      <p>Contenido del panel</p>
    </Drawer>
  </>;
};

const FieldInModal = () => <button type="button">Acción interna</button>;

const VisibilityModalHarness = () => {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" onClick={() => setOpen(true)}>Abrir filtro</button>
    <Dialog open={open} onOpenChange={setOpen} title="Filtro de foco">
      <button type="button">Acción visible</button>
      <details>
        <summary>Opciones avanzadas</summary>
        <button type="button">Acción dentro de detalle cerrado</button>
      </details>
      <button type="button" style={{ display: 'none' }}>Acción oculta por CSS</button>
      <div aria-hidden="true"><button type="button">Acción oculta semánticamente</button></div>
    </Dialog>
  </>;
};

describe('component-library overlays', () => {
  it('adds tooltip description without replacing an existing one', () => {
    render(<Tooltip content="Ayuda contextual"><button type="button" aria-describedby="existing">Acción</button></Tooltip>);
    const trigger = screen.getByRole('button', { name: 'Acción' });
    const tooltip = screen.getByRole('tooltip');
    expect(trigger.getAttribute('aria-describedby')?.split(' ')).toContain('existing');
    expect(trigger.getAttribute('aria-describedby')?.split(' ')).toContain(tooltip.id);
  });

  it('closes a popover with Escape and restores focus', async () => {
    const user = userEvent.setup();
    render(<PopoverHarness />);
    const trigger = screen.getByRole('button', { name: 'Preferencias' });
    await user.click(trigger);
    expect(screen.getByRole('dialog', { name: 'Preferencias' })).toBeTruthy();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Preferencias' })).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it('traps modal focus, closes with Escape, and restores the invoking control', async () => {
    const user = userEvent.setup();
    render(<ModalHarness />);
    const trigger = screen.getByRole('button', { name: 'Abrir diálogo' });
    await user.click(trigger);
    const dialog = screen.getByRole('dialog', { name: 'Confirmación' });
    expect(document.body.style.overflow).toBe('hidden');
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));

    const close = screen.getByRole('button', { name: 'Close' });
    close.focus();
    await user.keyboard('{Shift>}{Tab}{/Shift}');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Aceptar' }));

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Confirmación' })).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
    expect(document.body.style.overflow).toBe('');
  });

  it('renders the drawer as an accessible modal and dismisses it', async () => {
    const user = userEvent.setup();
    render(<ModalHarness />);
    const trigger = screen.getByRole('button', { name: 'Abrir panel' });
    await user.click(trigger);
    expect(screen.getByRole('dialog', { name: 'Propiedades' }).getAttribute('aria-modal')).toBe('true');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Propiedades' })).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it('traps focus using only visible controls and the summary of closed details', async () => {
    const user = userEvent.setup();
    render(<VisibilityModalHarness />);
    await user.click(screen.getByRole('button', { name: 'Abrir filtro' }));
    const close = screen.getByRole('button', { name: 'Close' });
    await waitFor(() => expect(document.activeElement).toBe(close));

    await user.keyboard('{Shift>}{Tab}{/Shift}');
    expect(document.activeElement).toBe(screen.getByText('Opciones avanzadas'));
    await user.tab();
    expect(document.activeElement).toBe(close);
  });
});
