import { describe, expect, it } from 'vitest';
import { es } from '../../i18n/catalogs';
import { bulkPropertyDescriptors } from './bulkEditProperties';
import { translateBulkEdit, type BulkEditCopyKey } from './bulkEditCopy';

/**
 * La paridad es/en, los marcadores de interpolación y la resolución de cada
 * clave los cubre `src/i18n/catalogs.test.ts` para todo el catálogo, incluidas
 * las claves `bulk.*`. Aquí sólo queda lo que ese test no puede saber: que cada
 * propiedad y cada opción declarada por un descriptor tiene su etiqueta.
 */
const bulkKeys = new Set(Object.keys(es).filter((key) => key.startsWith('bulk.')));

describe('bulk edit copy', () => {
  it('labels every declared property and every enum option', () => {
    for (const descriptor of bulkPropertyDescriptors) {
      expect(bulkKeys, descriptor.id).toContain(`bulk.property.${descriptor.id}`);
      for (const option of descriptor.options ?? []) {
        expect(bulkKeys, `${descriptor.id}/${option}`).toContain(`bulk.option.${descriptor.id}.${option}`);
      }
    }
  });

  it('resolves through the global catalog with the bulk prefix', () => {
    expect(translateBulkEdit('es', 'value.mixed')).toBe('Varios');
    expect(translateBulkEdit('en', 'value.mixed')).toBe('Mixed');
    expect(translateBulkEdit('es', 'summary.members', { count: 12 })).toBe('12 miembros seleccionados');
  });

  it('keeps the key type derived from the catalog, not from a private copy', () => {
    const key: BulkEditCopyKey = 'panel.label';
    expect(translateBulkEdit('es', key)).toBe('Edición múltiple');
  });
});
