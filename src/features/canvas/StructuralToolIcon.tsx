/**
 * Frontera de compatibilidad: los glifos estructurales canónicos viven en
 * `src/design-system/icons/structural.tsx`. Este módulo conserva la API
 * histórica (tool → icono) que consume ToolRail (bandeja y dock móvil).
 */
import {
  CircleDot,
  Component,
  Crosshair,
  Delete,
  GitCommitHorizontal,
  Hand,
  MousePointer2,
  MoveDiagonal2,
  RotateCcw,
  Ruler,
  Scissors,
  Sigma,
  type LucideIcon,
} from 'lucide-react';
import type { Tool } from '../../types';
import type { ToolDefinition } from './toolRegistry';
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

/**
 * Un icono por herramienta, para las que NO tienen glifo estructural propio.
 * Vivía dentro de `ToolRail`, que era su único consumidor; la barra inferior de
 * Compact enseña la herramienta activa y necesita exactamente lo mismo, así que
 * la tabla baja a donde ya vive la iconografía de herramienta en vez de
 * duplicarse.
 */
const toolIcons: Record<Tool, LucideIcon> = {
  select: MousePointer2,
  pan: Hand,
  node: CircleDot,
  member: GitCommitHorizontal,
  support: Component,
  pointLoad: MoveDiagonal2,
  distributedLoad: Sigma,
  moment: RotateCcw,
  dimension: Ruler,
  split: Scissors,
  cut: Crosshair,
  delete: Delete,
};

/** El glifo canónico de una herramienta: estructural si lo tiene, icono si no. */
export const ToolGlyph = ({ definition, size = 22 }: { definition: ToolDefinition; size?: number }) => {
  const Icon = toolIcons[definition.id];
  return STRUCTURAL_TOOL_IDS.has(definition.id)
    ? <StructuralToolIcon tool={definition.id} size={size} />
    : <Icon size={size} strokeWidth={1.8} />;
};
