// @vitest-environment jsdom
/// <reference types="node" />

import { beforeEach, describe, expect, it } from 'vitest';
import { claimShellInert, shellInertClaimCount } from './shellInert';

const shell = (): HTMLElement => document.querySelector<HTMLElement>('.app-shell')!;

describe('inercia del shell', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div class="app-shell"></div>';
  });

  it('marca el fondo mientras alguien lo reclame y lo suelta con el último', () => {
    const release = claimShellInert(shell(), 'prueba');
    expect(shell().inert).toBe(true);
    expect(shell().getAttribute('aria-hidden')).toBe('true');
    release();
    expect(shell().inert).toBe(false);
    expect(shell().getAttribute('aria-hidden')).toBeNull();
  });

  it('no deja el shell muerto cuando dos dueños se solapan', () => {
    // ÉSTE es el defecto. La hoja del riel de herramientas reclama primero; el
    // broker monta su capa encima y la cierra. Con el guardar-y-restaurar
    // anterior, el broker capturaba `inert = true` como estado de reposo y lo
    // reponía al cerrar: el shell quedaba inerte con la hoja ya cerrada y sin
    // ningún modal, es decir, la app entera muerta al tacto y al teclado.
    const releaseRail = claimShellInert(shell(), 'toolRail:sheet');
    const releaseBroker = claimShellInert(shell(), 'broker:datasheet');
    expect(shellInertClaimCount(shell())).toBe(2);

    releaseBroker();
    expect(shell().inert).toBe(true); // la hoja del riel sigue abierta

    releaseRail();
    expect(shell().inert).toBe(false);
    expect(shellInertClaimCount(shell())).toBe(0);
  });

  it('ignora una liberación repetida en vez de descontar de más', () => {
    const first = claimShellInert(shell(), 'uno');
    claimShellInert(shell(), 'dos');
    first();
    first();
    first();
    expect(shellInertClaimCount(shell())).toBe(1);
    expect(shell().inert).toBe(true);
  });

  it('no revienta sin fondo que reclamar', () => {
    expect(() => claimShellInert(null, 'sin-fondo')()).not.toThrow();
    expect(shellInertClaimCount(null)).toBe(0);
  });
});
