// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { createDefaultProject } from '../data/defaultProject';
import type { ProjectModel } from '../types';
import { useModelStudies } from './useModelStudies';

afterEach(cleanup);

/**
 * En jsdom no hay `Worker`, así que el hook toma su reserva síncrona. Es
 * deliberado: la ruta de reserva es la que corre en las pruebas y la que corre
 * en un navegador que niegue los workers, así que probarla es probar la que más
 * probabilidades tiene de quedarse sin vigilancia.
 */
describe('estudios del modelo · petición', () => {
  it('publica el certificado que se pidió', async () => {
    const { result } = renderHook(() => useModelStudies(createDefaultProject()));
    expect(result.current.certificate).toBeNull();
    act(() => { result.current.run('certificate'); });
    await waitFor(() => expect(result.current.certificate).not.toBeNull());
    expect(result.current.busy).toBeNull();
    expect(result.current.certificate!.checks.length).toBeGreaterThan(0);
  });

  it('marca cuál se está calculando, no un booleano suelto', async () => {
    const { result } = renderHook(() => useModelStudies(createDefaultProject()));
    act(() => { result.current.run('modal'); });
    expect(result.current.busy).toBe('modal');
    await waitFor(() => expect(result.current.busy).toBeNull());
  });

  it('cada estudio aterriza en su propia ranura y no pisa las otras', async () => {
    const { result } = renderHook(() => useModelStudies(createDefaultProject()));
    act(() => { result.current.run('modal'); });
    await waitFor(() => expect(result.current.modal).not.toBeNull());
    act(() => { result.current.run('certificate'); });
    await waitFor(() => expect(result.current.certificate).not.toBeNull());
    expect(result.current.modal).not.toBeNull();
    expect(result.current.buckling).toBeNull();
  });

  it('vacía las tres ranuras cuando se lo piden', async () => {
    const { result } = renderHook(() => useModelStudies(createDefaultProject()));
    act(() => { result.current.run('modal'); });
    await waitFor(() => expect(result.current.modal).not.toBeNull());
    act(() => { result.current.clear(); });
    expect(result.current.modal).toBeNull();
    expect(result.current.busy).toBeNull();
  });
});

describe('estudios del modelo · los dos relojes de invalidación', () => {
  it('el modelo que cambia tira los tres resultados', async () => {
    const project = createDefaultProject();
    const { result, rerender } = renderHook(({ model }: { model: ProjectModel }) => useModelStudies(model), {
      initialProps: { model: project },
    });
    act(() => { result.current.run('modal'); });
    await waitFor(() => expect(result.current.modal).not.toBeNull());

    const moved: ProjectModel = { ...project, nodes: project.nodes.map((node, index) => index === 0 ? { ...node, x: node.x + 1 } : node) };
    rerender({ model: moved });
    // Un modo de un modelo que cambió no es un modo de este modelo.
    expect(result.current.modal).toBeNull();
  });

  it('cambiar de combinación caduca pandeo y certificado, y NO los modos', async () => {
    const project = createDefaultProject();
    const { result, rerender } = renderHook(
      ({ combinationId }: { combinationId: string | null }) => useModelStudies(project, combinationId),
      { initialProps: { combinationId: null as string | null } },
    );
    act(() => { result.current.run('modal'); });
    await waitFor(() => expect(result.current.modal).not.toBeNull());
    act(() => { result.current.run('certificate'); });
    await waitFor(() => expect(result.current.certificate).not.toBeNull());

    rerender({ combinationId: 'ELU-1' });
    /* El pandeo se calcula sobre un estado axial y el certificado sobre un
       resultado: los dos dependen de la carga. Los modos propios no dependen de
       ninguna, y tirarlos sería descartar algo que sigue siendo cierto. */
    expect(result.current.certificate).toBeNull();
    expect(result.current.buckling).toBeNull();
    expect(result.current.modal).not.toBeNull();
  });

  it('un cambio que sólo es de presentación no tira nada', async () => {
    const project = createDefaultProject();
    const { result, rerender } = renderHook(({ model }: { model: ProjectModel }) => useModelStudies(model), {
      initialProps: { model: project },
    });
    act(() => { result.current.run('modal'); });
    await waitFor(() => expect(result.current.modal).not.toBeNull());

    // `analysisSignature` no mira los ajustes de dibujo, así que cambiar la
    // escala de la deformada no puede invalidar un modo propio.
    rerender({ model: { ...project, settings: { ...project.settings, deformedScale: 999 } } });
    expect(result.current.modal).not.toBeNull();
  });
});
