import { expect, it } from 'vitest';
import * as glyphs from './structural';

it('exports only glyphs consumed by the production tool surface', () => {
  expect(Object.keys(glyphs).sort()).toEqual([
    'DimensionGlyph',
    'DistributedLoadGlyph',
    'MemberGlyph',
    'MomentLoadGlyph',
    'NodeGlyph',
    'PointLoadGlyph',
    'SectionCutGlyph',
    'SplitMemberGlyph',
    'SupportGlyph',
  ]);
});
