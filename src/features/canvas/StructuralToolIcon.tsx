/**
 * Frontera de compatibilidad: los glifos estructurales canónicos viven en
 * `src/design-system/icons/structural.tsx`. Este módulo conserva la API
 * histórica (tool → icono) que consume ToolRail (bandeja y dock móvil).
 */
import type { Tool } from '../../types';
import {
  DimensionGlyph,
  DistributedLoadGlyph,
  MemberGlyph,
  MomentLoadGlyph,
  NodeGlyph,
  PointLoadGlyph,
  SectionCutGlyph,
  SplitMemberGlyph,
  SupportGlyph,
} from '../../design-system/icons/structural';

interface StructuralToolIconProps {
  tool: Tool;
  size?: number;
}

export const STRUCTURAL_TOOL_IDS = new Set<Tool>([
  'node',
  'member',
  'support',
  'pointLoad',
  'distributedLoad',
  'moment',
  'dimension',
  'split',
  'cut',
]);

export const StructuralToolIcon = ({ tool, size = 22 }: StructuralToolIconProps) => {
  switch (tool) {
    case 'node': return <NodeGlyph size={size} />;
    case 'member': return <MemberGlyph size={size} />;
    case 'support': return <SupportGlyph size={size} />;
    case 'pointLoad': return <PointLoadGlyph size={size} />;
    case 'distributedLoad': return <DistributedLoadGlyph size={size} />;
    case 'moment': return <MomentLoadGlyph size={size} />;
    case 'dimension': return <DimensionGlyph size={size} />;
    case 'split': return <SplitMemberGlyph size={size} />;
    case 'cut': return <SectionCutGlyph size={size} />;
    default: return null;
  }
};
