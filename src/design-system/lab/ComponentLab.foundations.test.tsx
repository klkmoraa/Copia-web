// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ComponentLab } from './ComponentLab';

afterEach(() => cleanup());

describe('ComponentLab Clay foundations', () => {
  it('shows the approved reading roles and separates applied loads from responses', () => {
    const { container } = render(<ComponentLab />);

    expect(screen.getByRole('heading', { name: 'Tipografía estructural' })).toBeTruthy();
    expect(screen.getByText('DM Serif Display')).toBeTruthy();
    expect(screen.getByText('Manrope')).toBeTruthy();
    expect(screen.getByText('JetBrains Mono')).toBeTruthy();

    expect(screen.getByRole('heading', { name: 'Acción aplicada · respuesta estructural' })).toBeTruthy();
    expect(screen.getByText('P · Carga puntual')).toBeTruthy();
    expect(screen.getByText('q · Carga distribuida')).toBeTruthy();
    expect(screen.getByText('Mₐ · Momento aplicado')).toBeTruthy();
    expect(screen.getByText('N · V · M · δ · Aula')).toBeTruthy();

    expect(container.querySelectorAll('.component-lab__material-level')).toHaveLength(6);
    expect(screen.getByText(/prefers-reduced-motion/)).toBeTruthy();
  });
});
