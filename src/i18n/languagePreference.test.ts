// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { preloadPreferredCatalog, rememberLanguage } from './languagePreference';

describe('pista de idioma', () => {
  beforeEach(() => { window.localStorage.clear(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('sin pista guardada da por probable el español, que ya viaja con la aplicación', () => {
    expect(preloadPreferredCatalog()).toBe('es');
  });

  it('recuerda el idioma del proyecto y lo usa en el arranque siguiente', () => {
    rememberLanguage('en');
    expect(preloadPreferredCatalog()).toBe('en');
  });

  it('descarta una pista que no es un idioma en vez de pedir un catálogo inexistente', () => {
    window.localStorage.setItem('structureCo.languageHint', 'klingon');
    expect(preloadPreferredCatalog()).toBe('es');
  });

  it('sobrevive a un almacenamiento denegado sin romper el arranque', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denegado'); });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denegado'); });
    expect(() => rememberLanguage('en')).not.toThrow();
    expect(preloadPreferredCatalog()).toBe('es');
  });
});
