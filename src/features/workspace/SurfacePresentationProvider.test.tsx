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
    <button onClick={(event) => broker.openSurface('datasheet', event.currentTarget)}>open datasheet</button>
    <button onClick={(event) => broker.openSurface('doctor', event.currentTarget)}>open doctor</button>
    <button onClick={() => broker.closeSurface('datasheet')}>close datasheet</button>
    <button onClick={() => broker.closeSurface('doctor')}>close doctor</button>
    <button onClick={() => broker.markSurfaceReady('datasheet', true)}>datasheet ready</button>
    <button onClick={() => broker.setSurfaceExtent('datasheet', 'peek')}>peek datasheet</button>
    <button onClick={() => broker.setSurfaceExtent('datasheet', 'default')}>restore datasheet</button>
    <output data-testid="datasheet-state">{broker.stateFor('datasheet').status}</output>
    <output data-testid="datasheet-extent">{broker.stateFor('datasheet').extent}</output>
    <output data-testid="doctor-state">{broker.stateFor('doctor').status}</output>
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
    fireEvent.click(screen.getByRole('button', { name: 'open datasheet' }));
    expect(screen.getByTestId('datasheet-state').textContent).toBe('active');
    expect(screen.queryByRole('dialog', { name: /datasheet/i })).toBeNull();
    expect(screen.getByTestId('background').hasAttribute('inert')).toBe(false);
  });

  it('retains a suspended surface instance and its real local draft', () => {
    const RetainedDraft = () => {
      const broker = useSurfacePresentation();
      return <>
        <Controls />
        {broker.isRetained('datasheet') ? <section
          data-workspace-surface="datasheet"
          hidden={broker.stateFor('datasheet').status !== 'active'}
        >
          <input aria-label="datasheet draft" defaultValue="" />
        </section> : null}
      </>;
    };
    render(<ProviderHarness><RetainedDraft /></ProviderHarness>);
    fireEvent.click(screen.getByRole('button', { name: 'open datasheet' }));
    fireEvent.change(screen.getByLabelText('datasheet draft'), { target: { value: 'sin aplicar' } });
    fireEvent.click(screen.getByRole('button', { name: 'open doctor' }));

    expect(screen.getByTestId('datasheet-state').textContent).toBe('suspended');
    expect((screen.getByLabelText('datasheet draft') as HTMLInputElement).value).toBe('sin aplicar');

    fireEvent.click(screen.getByRole('button', { name: 'close doctor' }));
    expect(screen.getByTestId('datasheet-state').textContent).toBe('active');
    expect((screen.getByLabelText('datasheet draft') as HTMLInputElement).value).toBe('sin aplicar');
  });

  it('returns focus to the centralized launcher only after a logical close', async () => {
    const Surface = () => {
      const broker = useSurfacePresentation();
      return <>
        <button onClick={(event) => broker.openSurface('datasheet', event.currentTarget)}>launcher</button>
        {broker.isRetained('datasheet') ? <section data-workspace-surface="datasheet">
          <button onClick={() => broker.closeSurface('datasheet')}>surface close</button>
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
    fireEvent.click(screen.getByRole('button', { name: 'open datasheet' }));
    expect(Boolean(backgroundRef.current?.inert)).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'datasheet ready' }));
    expect(backgroundRef.current?.inert).toBe(true);
    expect(backgroundRef.current?.getAttribute('aria-hidden')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: 'close datasheet' }));
    expect(Boolean(backgroundRef.current?.inert)).toBe(false);
    expect(backgroundRef.current?.hasAttribute('aria-hidden')).toBe(false);
  });

  it('clears inert the instant a ready modal surface degrades to peek, and reapplies it on restore (CRI-102)', () => {
    const backgroundRef = createRef<HTMLDivElement>();
    render(<ProviderHarness backgroundRef={backgroundRef} />);
    fireEvent.click(screen.getByRole('button', { name: 'open datasheet' }));
    fireEvent.click(screen.getByRole('button', { name: 'datasheet ready' }));
    expect(backgroundRef.current?.inert).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'peek datasheet' }));
    expect(screen.getByTestId('datasheet-extent').textContent).toBe('peek');
    // La superficie sigue abierta y retenida — sólo dejó de atrapar el fondo.
    expect(screen.getByTestId('datasheet-state').textContent).toBe('active');
    expect(Boolean(backgroundRef.current?.inert)).toBe(false);
    expect(backgroundRef.current?.hasAttribute('aria-hidden')).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'restore datasheet' }));
    expect(screen.getByTestId('datasheet-extent').textContent).toBe('default');
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
