// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDefaultProject } from '../../data/defaultProject';
import { PROJECT_STORAGE_KEY } from '../../data/projectStorage';
import { ProjectProvider } from '../../store/ProjectContext';
import type { NumericCertificate } from '../../engine/certificate';
import type { ModelStudiesState } from '../../engine/useModelStudies';
import { CertificateCard } from './CertificateCard';

afterEach(cleanup);

const certificate = (overrides: Partial<NumericCertificate> = {}): NumericCertificate => ({
  verdict: 'verified',
  extraSolves: 4,
  summary: 'Las 4 comprobaciones independientes se cumplen.',
  checks: [
    { id: 'global-equilibrium', label: 'Equilibrio global', status: 'passed', value: 1e-12, tolerance: 1e-8, message: 'La resultante se anula.' },
    { id: 'linearity', label: 'Linealidad de la respuesta', status: 'passed', value: 0, tolerance: 1e-10, message: 'Duplicar la carga duplica la respuesta.' },
    { id: 'maxwell-betti', label: 'Reciprocidad de Maxwell-Betti', status: 'passed', value: 2e-14, tolerance: 1e-8, message: 'Coincide con el recíproco.' },
    { id: 'h-refinement', label: 'Error de discretización (refinamiento h)', status: 'observed', value: 0.07, tolerance: 0.05, message: 'Duplicar la malla mueve los desplazamientos un 7 %.' },
  ],
  ...overrides,
});

const studiesStub = (overrides: Partial<ModelStudiesState> = {}): ModelStudiesState => ({
  buckling: null, modal: null, certificate: null, busy: null, error: null,
  run: vi.fn(), clear: vi.fn(), ...overrides,
});

const renderCard = (studies: ModelStudiesState) => {
  localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(createDefaultProject()));
  return render(<ProjectProvider><CertificateCard studies={studies} /></ProjectProvider>);
};

describe('tarjeta del certificado', () => {
  it('antes de calcular explica qué son las cuatro comprobaciones', () => {
    renderCard(studiesStub());
    expect(screen.getByText(/vuelven a resolver el modelo/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Comprobar el resultado' })).toBeTruthy();
  });

  it('pide el certificado al pulsar', async () => {
    const user = userEvent.setup();
    const run = vi.fn();
    renderCard(studiesStub({ run }));
    await user.click(screen.getByRole('button', { name: 'Comprobar el resultado' }));
    expect(run).toHaveBeenCalledWith('certificate');
  });

  it('enseña las cuatro comprobaciones con su estado y su mensaje', () => {
    renderCard(studiesStub({ certificate: certificate() }));
    expect(screen.getAllByRole('listitem')).toHaveLength(4);
    expect(screen.getByText('Reciprocidad de Maxwell-Betti')).toBeTruthy();
    expect(screen.getByText('Duplicar la malla mueve los desplazamientos un 7 %.')).toBeTruthy();
    // El refinamiento h no es un aprobado: es una medida que merece atención.
    expect(screen.getByText('Merece atención')).toBeTruthy();
    expect(screen.getAllByText('Se cumple')).toHaveLength(3);
  });

  it('publica lo que costó, porque quien lo pide tiene derecho a saberlo', () => {
    renderCard(studiesStub({ certificate: certificate() }));
    expect(screen.getByText('Resoluciones extra')).toBeTruthy();
    expect(screen.getByText('4')).toBeTruthy();
  });

  it('el límite se pinta en la tarjeta, no se queda en el código', () => {
    /* La cabecera de `certificate.ts` avisa de que un modelo equivocado y bien
       resuelto sale con las cuatro en verde. Esa frase tiene que estar donde
       alguien pueda malinterpretar cuatro visto buenos: aquí. */
    renderCard(studiesStub({ certificate: certificate() }));
    expect(screen.getByText(/uno equivocado y bien resuelto sale de aquí con las cuatro en verde/)).toBeTruthy();
  });

  it('y también antes de calcular, no sólo con el resultado delante', () => {
    renderCard(studiesStub());
    expect(screen.getByText(/uno equivocado y bien resuelto/)).toBeTruthy();
  });

  it('distingue el veredicto sin cambiar la materia de la tarjeta', () => {
    const clean = renderCard(studiesStub({ certificate: certificate() }));
    const cleanLevel = screen.getByLabelText('Certificado numérico').getAttribute('data-level');
    expect(screen.getByText('Las comprobaciones se cumplen')).toBeTruthy();
    clean.unmount();

    renderCard(studiesStub({ certificate: certificate({ verdict: 'observations' }) }));
    expect(screen.getByText('Hay algo que mirar')).toBeTruthy();
    // Misma elevación: el veredicto se lee en el texto, nunca en la materia.
    expect(screen.getByLabelText('Certificado numérico').getAttribute('data-level')).toBe(cleanLevel);
  });

  it('un fallo del estudio se dice, no se queda en blanco', () => {
    renderCard(studiesStub({ error: { kind: 'certificate', message: 'No se pudo completar el estudio del modelo.' } }));
    expect(screen.getByRole('alert').textContent).toContain('No se pudo completar');
  });
});
