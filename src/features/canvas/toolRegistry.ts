import type { TranslationKey } from '../../i18n/catalogs';
import type { Tool } from '../../types';

export type ToolGroupId = 'navigate' | 'create' | 'loads' | 'measure';
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
  destructive?: boolean;
}

/**
 * Cuatro grupos, no cinco: "Editar" desapareció. `pan` y `delete` seguían
 * ahí con botón propio pese a tener ya sendos caminos sin botón —barra
 * espaciadora+arrastre y clic central para desplazar; Supr y el "Borrar"
 * siempre visible de la barra de selección para eliminar—, y "Editar
 * selección" duplicaba la acción primaria que la barra de selección ya
 * ofrece para nodo/miembro/multiselección. Tres caminos al mismo sitio no
 * son comodidad (regla de disposición 2 del sistema de diseño).
 */
export const TOOL_GROUPS: readonly ToolGroupDefinition[] = [
  { id: 'navigate', labelKey: 'toolbar.groupNavigate' },
  { id: 'create', labelKey: 'toolbar.groupCreate' },
  { id: 'loads', labelKey: 'toolbar.groupLoads' },
  { id: 'measure', labelKey: 'toolbar.groupMeasure' },
] as const;

export const TOOL_REGISTRY: readonly ToolDefinition[] = [
  { id: 'select', group: 'navigate', labelKey: 'toolbar.select', shortcut: 'V', activationKey: 'v', mobile: 'primary' },
  { id: 'node', group: 'create', labelKey: 'toolbar.node', shortcut: 'N', activationKey: 'n', mobile: 'primary' },
  { id: 'member', group: 'create', labelKey: 'toolbar.member', shortcut: 'M', activationKey: 'm', mobile: 'primary' },
  { id: 'support', group: 'create', labelKey: 'toolbar.support', shortcut: 'S', activationKey: 's', mobile: 'primary' },
  // Parte geometría, luego la crea: sube desde el antiguo grupo "Editar" al
  // que de verdad describe lo que hace.
  { id: 'split', group: 'create', labelKey: 'toolbar.split', detailKey: 'toolbar.splitDetail', shortcut: 'B', activationKey: 'b', mobile: 'more' },
  { id: 'pointLoad', group: 'loads', labelKey: 'toolbar.pointLoad', detailKey: 'toolbar.pointLoadDetail', shortcut: 'P', activationKey: 'p', mobile: 'loads' },
  { id: 'distributedLoad', group: 'loads', labelKey: 'toolbar.distributedLoad', detailKey: 'toolbar.distributedLoadDetail', shortcut: 'D', activationKey: 'd', mobile: 'loads' },
  { id: 'moment', group: 'loads', labelKey: 'toolbar.moment', detailKey: 'toolbar.momentDetail', shortcut: 'O', activationKey: 'o', mobile: 'loads' },
  // Ex-"Anotar e inspeccionar", renombrado por lo que hace. Ya no se esconden
  // en modo Aula: son las dos herramientas que explican el modelo —cota mide,
  // corte abre el diagrama de cuerpo libre con sus residuos— y esconderlas
  // detrás de un "Más" en el modo pensado para enseñar era lo contrario de
  // la intención de `classroomAdvanced`.
  { id: 'dimension', group: 'measure', labelKey: 'toolbar.dimension', detailKey: 'toolbar.dimensionDetail', shortcut: 'C', activationKey: 'c', mobile: 'more' },
  { id: 'cut', group: 'measure', labelKey: 'toolbar.cut', detailKey: 'toolbar.cutDetail', shortcut: 'X', activationKey: 'x', mobile: 'more' },
] as const;

/**
 * `pan` no tiene botón —el gesto ya existe por barra espaciadora+arrastre y
 * clic central (`StructuralCanvas.tsx`)— pero conserva su atajo de teclado
 * para quien no pueda usar ninguno de los dos. `delete` no necesita entrada
 * aquí: Supr/Retroceso los maneja un listener aparte, nunca pasaron por
 * este mapa.
 */
const EXTRA_TOOL_SHORTCUTS: ReadonlyArray<readonly [string, Tool]> = [
  ['h', 'pan'],
];

export const TOOL_SHORTCUTS = new Map<string, Tool>([
  ...TOOL_REGISTRY.flatMap((definition) => definition.activationKey
    ? [[definition.activationKey, definition.id] as const]
    : []),
  ...EXTRA_TOOL_SHORTCUTS,
]);

export const toolFromShortcut = (key: string): Tool | undefined =>
  TOOL_SHORTCUTS.get(key.toLowerCase());

export const toolsInGroup = (
  group: ToolGroupId,
  definitions: readonly ToolDefinition[] = TOOL_REGISTRY,
): ToolDefinition[] => definitions.filter((definition) => definition.group === group);
