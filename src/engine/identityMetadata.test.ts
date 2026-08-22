import { describe, expect, it } from 'vitest';
import { createDefaultProject } from '../data/defaultProject';
import { analyzeProject } from './solver';

describe('material and section identity engine safety', () => {
  it('produces identical structural results for identical numeric properties regardless of identity metadata', () => {
    const numericOnly = createDefaultProject();
    const withIdentity = structuredClone(numericOnly);
    Object.assign(withIdentity.members[0] as object, {
      materialId: 'steel-a992',
      materialOrigin: 'catalog',
      sectionId: 'ipe-300',
      sectionOrigin: 'catalog',
    });

    expect(analyzeProject(withIdentity)).toEqual(analyzeProject(numericOnly));
  });
});
