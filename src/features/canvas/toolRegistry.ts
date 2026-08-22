import type { TranslationKey } from '../../i18n/catalogs';
import type { Tool } from '../../types';

export type ToolGroupId = 'navigate' | 'create' | 'loads' | 'inspect' | 'edit';
export type MobileToolPlacement = 'primary' | 'loads' | 'more';

export interface ToolGroupDefinition {
  id: ToolGroupId;
  labelKey: TranslationKey;
}

export interface ToolDefinition {
  id: Tool;
  group: ToolGroupId;
  labelKey: TranslationKey;
  detailKey?: TranslationKey;
  shortcut: string;
  activationKey?: string;
  mobile: MobileToolPlacement;
  classroomAdvanced?: boolean;
  destructive?: boolean;
}

export const TOOL_GROUPS: readonly ToolGroupDefinition[] = [
  { id: 'navigate', labelKey: 'toolbar.groupNavigate' },
  { id: 'create', labelKey: 'toolbar.groupCreate' },
  { id: 'loads', labelKey: 'toolbar.groupLoads' },
  { id: 'inspect', labelKey: 'toolbar.groupInspect' },
  { id: 'edit', labelKey: 'toolbar.groupEdit' },
] as const;

export const TOOL_REGISTRY: readonly ToolDefinition[] = [
  { id: 'select', group: 'navigate', labelKey: 'toolbar.select', shortcut: 'V', activationKey: 'v', mobile: 'primary' },
  { id: 'pan', group: 'navigate', labelKey: 'toolbar.pan', detailKey: 'toolbar.panDetail', shortcut: 'H', activationKey: 'h', mobile: 'more' },
  { id: 'node', group: 'create', labelKey: 'toolbar.node', shortcut: 'N', activationKey: 'n', mobile: 'primary' },
  { id: 'member', group: 'create', labelKey: 'toolbar.member', shortcut: 'M', activationKey: 'm', mobile: 'primary' },
  { id: 'support', group: 'create', labelKey: 'toolbar.support', shortcut: 'S', activationKey: 's', mobile: 'primary' },
  { id: 'pointLoad', group: 'loads', labelKey: 'toolbar.pointLoad', detailKey: 'toolbar.pointLoadDetail', shortcut: 'P', activationKey: 'p', mobile: 'loads' },
  { id: 'distributedLoad', group: 'loads', labelKey: 'toolbar.distributedLoad', detailKey: 'toolbar.distributedLoadDetail', shortcut: 'D', activationKey: 'd', mobile: 'loads' },
  { id: 'moment', group: 'loads', labelKey: 'toolbar.moment', detailKey: 'toolbar.momentDetail', shortcut: 'O', activationKey: 'o', mobile: 'loads' },
  { id: 'dimension', group: 'inspect', labelKey: 'toolbar.dimension', detailKey: 'toolbar.dimensionDetail', shortcut: 'C', activationKey: 'c', mobile: 'more', classroomAdvanced: true },
  { id: 'cut', group: 'inspect', labelKey: 'toolbar.cut', detailKey: 'toolbar.cutDetail', shortcut: 'X', activationKey: 'x', mobile: 'more', classroomAdvanced: true },
  { id: 'split', group: 'edit', labelKey: 'toolbar.split', detailKey: 'toolbar.splitDetail', shortcut: 'B', activationKey: 'b', mobile: 'more', classroomAdvanced: true },
  { id: 'delete', group: 'edit', labelKey: 'toolbar.delete', detailKey: 'toolbar.deleteDetail', shortcut: '⌫', mobile: 'more', classroomAdvanced: true, destructive: true },
] as const;

export const TOOL_SHORTCUTS = new Map<string, Tool>(
  TOOL_REGISTRY.flatMap((definition) => definition.activationKey
    ? [[definition.activationKey, definition.id] as const]
    : []),
);

export const toolFromShortcut = (key: string): Tool | undefined =>
  TOOL_SHORTCUTS.get(key.toLowerCase());

export const toolsInGroup = (
  group: ToolGroupId,
  definitions: readonly ToolDefinition[] = TOOL_REGISTRY,
): ToolDefinition[] => definitions.filter((definition) => definition.group === group);

