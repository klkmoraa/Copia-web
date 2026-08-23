import { afterEach, describe, expect, it, vi } from 'vitest';
import { en } from './catalogEn';
import { es, translate, type TranslationKey } from './catalogs';

describe('i18n catalogs', () => {
  it('keeps the Spanish and English catalogs structurally identical', () => {
    const expected = Object.keys(es).sort();
    expect(Object.keys(en).sort()).toEqual(expected);
  });

  it('resolves every declared key in both languages', () => {
    for (const key of Object.keys(es) as TranslationKey[]) {
      expect(translate('es', key)).not.toBe('');
      expect(translate('en', key)).not.toBe('');
    }
  });

  it('keeps interpolation placeholders identical between languages', () => {
    const placeholders = (value: string) => [...value.matchAll(/\{([A-Za-z][A-Za-z0-9_]*)\}/g)]
      .map((match) => match[1])
      .sort();
    for (const key of Object.keys(es) as TranslationKey[]) {
      expect(placeholders(en[key]), key).toEqual(placeholders(es[key]));
    }
  });

  it('preserves technical identifiers and magnitudes during interpolation', () => {
    const variables = { completed: 'N-07', total: '12.50 kN' };
    expect(translate('es', 'classroom.progressCount', variables)).toContain('N-07');
    expect(translate('es', 'classroom.progressCount', variables)).toContain('12.50 kN');
    expect(translate('en', 'classroom.progressCount', variables)).toContain('N-07');
    expect(translate('en', 'classroom.progressCount', variables)).toContain('12.50 kN');
  });

  it('interpolates named values without evaluating input', () => {
    const key = 'app.name';
    expect(translate('en', key, { unused: '<script>' })).toBe('structureCo');
  });
});

describe('carga del catálogo bajo demanda', () => {
  /* El arranque de Vitest registra el inglés para todas las demás pruebas, así
     que aquí se importa un módulo *fresco* con `resetModules`: es la única
     forma de observar el estado que ve un usuario real en el primer pintado,
     antes de que la importación dinámica termine. */
  const freshModule = async () => {
    vi.resetModules();
    return import('./catalogs');
  };

  afterEach(() => { vi.resetModules(); });

  it('responde en español mientras el catálogo pedido no ha llegado', async () => {
    const module = await freshModule();
    expect(module.isCatalogReady('en')).toBe(false);
    expect(module.translate('en', 'app.name')).toBe(module.es['app.name']);
  });

  it('registra el catálogo pedido y a partir de ahí traduce con él', async () => {
    const module = await freshModule();
    await module.loadCatalog('en');
    expect(module.isCatalogReady('en')).toBe(true);
    expect(module.translate('en', 'welcome.sectionStart')).not.toBe(module.es['welcome.sectionStart']);
  });

  it('avisa a los suscriptores exactamente una vez por idioma', async () => {
    const module = await freshModule();
    let notifications = 0;
    module.subscribeToCatalogs(() => { notifications += 1; });
    await module.loadCatalog('en');
    await module.loadCatalog('en');
    expect(notifications).toBe(1);
  });

  it('nunca deja la aplicación sin texto: el español está desde el primer instante', async () => {
    const module = await freshModule();
    expect(module.isCatalogReady('es')).toBe(true);
  });
});
