// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createRef, useRef, type ReactNode, type RefObject } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { SurfacePresentationProvider } from './SurfacePresentationProvider';
import { useSurfacePresentation } from './useSurfacePresentation';
import type { ShellClass } from './shellComposition';

const Controls = () => {
  const broker = useSurfacePresentation();
  return <>
    {/* La superficie modal del producto es UNA: «Datos». Este arnés usaba
        `datasheet` y `doctor` como dos modales distintas para provocar una
        suspensión entre ellas; ahora la segunda pieza es el panel derecho,
        que en Compact disputa la misma ranura contextual. */}
    <button onClick={(event) => broker.openSurface('data', event.currentTarget)}>open data</button>
    <button onClick={(event) => broker.openSurface('detail', event.currentTarget)}>open detail</button>
    <button onClick={() => broker.closeSurface('data')}>close data</button>
    <button onClick={() => broker.closeSurface('detail')}>close detail</button>
    <button onClick={() => broker.markSurfaceReady('data', true)}>data ready</button>
    <button onClick={() => broker.setSurfaceExtent('data', 'peek')}>peek data</button>
    <button onClick={() => broker.setSurfaceExtent('data', 'default')}>restore data</button>
    <output data-testid="data-state">{broker.stateFor('data').status}</output>
    <output data-testid="data-extent">{broker.stateFor('data').extent}</output>
    <output data-testid="detail-state">{broker.stateFor('detail').status}</output>
  </>;
};

const ProviderHarness = ({
  shellClass = 'X2',
  backgroundRef = createRef<HTMLDivElement>(),
  children = <Controls />,
}: {
  shellClass?: ShellClass;
  backgroundRef?: RefObject<HTMLDivElement | null>;
  children?: ReactNode;
}) => <SurfacePresentationProvider
  shellClass={shellClass}
  initialOpen={[]}
  backgroundRef={backgroundRef}
>
  <div ref={backgroundRef} data-testid="background">background</div>
  {children}
</SurfacePresentationProvider>;

afterEach(() => {
  cleanup();
});

describe('SurfacePresentationProvider', () => {
  it('keeps an open intent before any lazy surface has mounted', () => {
    render(<ProviderHarness />);
    fireEvent.click(screen.getByRole('button', { name: 'open data' }));
    expect(screen.getByTestId('data-state').textContent).toBe('active');
    expect(screen.queryByRole('dialog', { name: /datos/i })).toBeNull();
    expect(screen.getByTestId('background').hasAttribute('inert')).toBe(false);
  });

  /**
   * Suspender es retener, nunca destruir. Se prueba en `K0` porque es la única
   * clase con una sola ranura contextual: en X2 la superficie modal y el panel
   * derecho conviven, así que ahí no hay suspensión que demostrar.
   */
  it('retains a suspended surface instance and its real local draft', () => {
    const RetainedDraft = () => {
      const broker = useSurfacePresentation();
      return <>
        <Controls />
        {broker.isRetained('data') ? <section
          data-workspace-surface="data"
          hidden={broker.stateFor('data').status !== 'active'}
        >
          <input aria-label="data draft" defaultValue="" />
        </section> : null}
      </>;
    };
    render(<ProviderHarness shellClass="K0"><RetainedDraft /></ProviderHarness>);
    fireEvent.click(screen.getByRole('button', { name: 'open data' }));
    fireEvent.change(screen.getByLabelText('data draft'), { target: { value: 'sin aplicar' } });
    fireEvent.click(screen.getByRole('button', { name: 'open detail' }));

    expect(screen.getByTestId('data-state').textContent).toBe('suspended');
    expect((screen.getByLabelText('data draft') as HTMLInputElement).value).toBe('sin aplicar');

    fireEvent.click(screen.getByRole('button', { name: 'close detail' }));
    expect(screen.getByTestId('data-state').textContent).toBe('active');
    expect((screen.getByLabelText('data draft') as HTMLInputElement).value).toBe('sin aplicar');
  });

  it('returns focus to the centralized launcher only after a logical close', async () => {
    const Surface = () => {
      const broker = useSurfacePresentation();
      return <>
        <button onClick={(event) => broker.openSurface('data', event.currentTarget)}>launcher</button>
        {broker.isRetained('data') ? <section data-workspace-surface="data">
          <button onClick={() => broker.closeSurface('data')}>surface close</button>
        </section> : null}
      </>;
    };
    render(<ProviderHarness><Surface /></ProviderHarness>);
    const launcher = screen.getByRole('button', { name: 'launcher' });
    launcher.focus();
    fireEvent.click(launcher);
    screen.getByRole('button', { name: 'surface close' }).focus();
    fireEvent.click(screen.getByRole('button', { name: 'surface close' }));
    await waitFor(() => expect(document.activeElement).toBe(launcher));
  });

  it('applies and completely cleans inert plus aria-hidden after modal readiness', () => {
    const backgroundRef = createRef<HTMLDivElement>();
    render(<ProviderHarness backgroundRef={backgroundRef} />);
    fireEvent.click(screen.getByRole('button', { name: 'open data' }));
    expect(Boolean(backgroundRef.current?.inert)).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'data ready' }));
    expect(backgroundRef.current?.inert).toBe(true);
    expect(backgroundRef.current?.getAttribute('aria-hidden')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: 'close data' }));
    expect(Boolean(backgroundRef.current?.inert)).toBe(false);
    expect(backgroundRef.current?.hasAttribute('aria-hidden')).toBe(false);
  });

  it('clears inert the instant a ready modal surface degrades to peek, and reapplies it on restore (CRI-102)', () => {
    const backgroundRef = createRef<HTMLDivElement>();
    render(<ProviderHarness backgroundRef={backgroundRef} />);
    fireEvent.click(screen.getByRole('button', { name: 'open data' }));
    fireEvent.click(screen.getByRole('button', { name: 'data ready' }));
    expect(backgroundRef.current?.inert).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'peek data' }));
    expect(screen.getByTestId('data-extent').textContent).toBe('peek');
    // La superficie sigue abierta y retenida — sólo dejó de atrapar el fondo.
    expect(screen.getByTestId('data-state').textContent).toBe('active');
    expect(Boolean(backgroundRef.current?.inert)).toBe(false);
    expect(backgroundRef.current?.hasAttribute('aria-hidden')).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'restore data' }));
    expect(screen.getByTestId('data-extent').textContent).toBe('default');
    expect(backgroundRef.current?.inert).toBe(true);
    expect(backgroundRef.current?.getAttribute('aria-hidden')).toBe('true');
  });

  it('moves focus to the semantic equivalent when presentation replaces the physical element', async () => {
    const MigratingSurface = () => {
      const { presentationFor } = useSurfacePresentation();
      const presentation = presentationFor('detail');
      return <section data-workspace-surface="detail">
        <input
          key={presentation}
          data-surface-focus-key="member-length"
          data-testid={`field-${presentation}`}
          aria-label="member length"
        />
      </section>;
    };
    const Wrapper = ({ shellClass }: { shellClass: ShellClass }) => {
      const backgroundRef = useRef<HTMLDivElement>(null);
      return <SurfacePresentationProvider shellClass={shellClass} initialOpen={['detail']} backgroundRef={backgroundRef}>
        <div ref={backgroundRef}>background</div>
        <MigratingSurface />
      </SurfacePresentationProvider>;
    };
    const rendered = render(<Wrapper shellClass="X2" />);
    const dockField = screen.getByTestId('field-dock');
    dockField.focus();
    expect(document.activeElement).toBe(dockField);

    rendered.rerender(<Wrapper shellClass="K0" />);
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId('field-sheet')));
  });
});
