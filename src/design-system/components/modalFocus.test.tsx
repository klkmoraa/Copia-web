// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { useRef, useState } from 'react';
import { useModalFocus } from './modalFocus';

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

const ModalHarness = () => {
  const [open, setOpen] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  useModalFocus({
    open,
    containerRef: modalRef,
    onEscape: () => setOpen(false),
    initialFocus: (container) => container.querySelector('[data-initial-focus]'),
  });

  return <>
    <button type="button" onClick={() => setOpen(true)}>Open modal</button>
    {open ? <div ref={modalRef} role="dialog" aria-label="Test modal">
      <button type="button" data-initial-focus>First action</button>
      <button type="button">Last action</button>
    </div> : null}
  </>;
};

describe('useModalFocus', () => {
  it('focuses the requested control, traps Tab, closes on Escape, and restores focus and body scroll', async () => {
    const user = userEvent.setup();
    document.body.style.overflow = 'clip';
    render(<ModalHarness />);
    const opener = screen.getByRole('button', { name: 'Open modal' });

    await user.click(opener);
    const first = screen.getByRole('button', { name: 'First action' });
    const last = screen.getByRole('button', { name: 'Last action' });
    await waitFor(() => expect(document.activeElement).toBe(first));
    expect(document.body.style.overflow).toBe('hidden');

    first.focus();
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(last);
    await user.tab();
    expect(document.activeElement).toBe(first);

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(opener));
    expect(document.body.style.overflow).toBe('clip');
  });
});
