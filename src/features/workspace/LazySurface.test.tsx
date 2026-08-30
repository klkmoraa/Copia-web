// @vitest-environment jsdom
import { lazy, type ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { LazySurface } from './LazySurface';
import { ProjectProvider } from '../../store/ProjectContext';

/**
 * Lo que se prueba es el modo de fallo que motivó esta pieza: un chunk que no
 * llega. Antes subía hasta la raíz y se llevaba la aplicación entera; aquí tiene
 * que quedarse en su hueco.
 */
const Boom = lazy(() => Promise.reject(new Error('chunk 404')));
const Fine = lazy(() => Promise.resolve({ default: () => <p>panel vivo</p> }));
/** No resuelve nunca: es la unica forma de observar el estado de espera. */
const Pending = lazy(() => new Promise<never>(() => {}));

const withProject = (children: ReactNode) => <ProjectProvider>{children}</ProjectProvider>;

describe('LazySurface', () => {
  beforeEach(() => {
    // React registra el error en consola antes de entregarlo a la frontera.
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it('deja pasar la superficie cuando su chunk llega', async () => {
    render(withProject(<LazySurface><Fine /></LazySurface>));
    expect(await screen.findByText('panel vivo')).toBeTruthy();
  });

  it('acota el fallo a su hueco en vez de tumbar lo que tiene al lado', async () => {
    render(withProject(<>
      <p>el modelo sigue aqui</p>
      <LazySurface><Boom /></LazySurface>
    </>));

    // El aviso aparece...
    expect(await screen.findByRole('alert')).toBeTruthy();
    // ...y lo de al lado no se ha ido con el, que es el punto entero.
    expect(screen.getByText('el modelo sigue aqui')).toBeTruthy();
  });

  it('ofrece recargar, que es la unica salida real cuando el modulo no esta', async () => {
    render(withProject(<LazySurface><Boom /></LazySurface>));
    await screen.findByRole('alert');
    expect(screen.getByRole('button')).toBeTruthy();
  });

  it('pinta lo pendiente mientras el chunk viaja', () => {
    render(withProject(<LazySurface pending={<span>cargando</span>}><Pending /></LazySurface>));
    expect(screen.getByText('cargando')).toBeTruthy();
  });
});
