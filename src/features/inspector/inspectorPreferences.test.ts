// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  INSPECTOR_EXPANDED_STORAGE_KEY,
  readExpandedSectionsForSurface,
  writeExpandedSectionsForSurface,
} from './inspectorPreferences';

beforeEach(() => localStorage.clear());

describe('legacy Inspector accordion preferences', () => {
  it('routes known legacy sections to their new owners without resetting unknown ids', () => {
    localStorage.setItem(INSPECTOR_EXPANDED_STORAGE_KEY, JSON.stringify([
      'advanced-member', 'analysis-load-cases', 'view-layers', 'future-plugin-section',
    ]));

    expect(readExpandedSectionsForSurface('detail')).toEqual(['advanced-member']);
    expect(readExpandedSectionsForSurface('analysisSetup')).toEqual(['analysis-load-cases']);
    expect(readExpandedSectionsForSurface('view')).toEqual(['view-layers']);

    writeExpandedSectionsForSurface('detail', ['advanced-node']);
    expect(JSON.parse(localStorage.getItem(INSPECTOR_EXPANDED_STORAGE_KEY) ?? '[]')).toEqual([
      'analysis-load-cases', 'view-layers', 'future-plugin-section', 'advanced-node',
    ]);
  });

  it('ignores malformed legacy storage without overwriting it during a read', () => {
    localStorage.setItem(INSPECTOR_EXPANDED_STORAGE_KEY, '{not json');
    expect(readExpandedSectionsForSurface('detail')).toEqual([]);
    expect(localStorage.getItem(INSPECTOR_EXPANDED_STORAGE_KEY)).toBe('{not json');
  });
});
