import { rebuildSupport } from '../../commands/projectCommand';
import type { MemberType, SupportType } from '../../types';
import type { BulkEditDraft, BulkPropertyId, BulkSelectionInput } from './bulkEditTypes';

/**
 * Habilitar y configurar en una sola intención.
 *
 * Hay dos propiedades que no describen un valor sino **qué otras propiedades
 * existen**: el tipo de miembro y el tipo de apoyo. Derivar la elegibilidad del
 * modelo almacenado obligaba a dos pasadas —cambiar el tipo, aplicar, reabrir el
 * panel y sólo entonces configurar—, porque el panel seguía mirando un apoyo que
 * el usuario ya había decidido sustituir.
 *
 * Aquí la selección se proyecta con esas dos decisiones ya tomadas, de modo que
 * la elegibilidad y el valor de partida de las propiedades dependientes son los
 * que tendrán tras aplicar. La proyección reutiliza `rebuildSupport`, la misma
 * función con la que el comando escribe: previsión y escritura no pueden
 * divergir.
 *
 * Sólo se proyectan estas dos puertas, y sólo desde un `set`:
 *
 * - ambas son `clearable: false`, así que no hay un `clear` ambiguo que
 *   interpretar;
 * - el resultado que produce el aplicador es determinista y completo, no una
 *   fusión con lo que hubiera antes;
 * - ninguna otra propiedad de la edición múltiple gobierna la existencia de
 *   otra, así que extender esto sería inventar una semántica que el modelo no
 *   tiene.
 *
 * La proyección no escribe nada: cambia lo que se **ofrece** y lo que se lee
 * como valor de partida. El borrador sigue conteniendo únicamente lo que el
 * usuario tocó, y un cambio dependiente cuya puerta se retira deja de ser
 * compatible y por tanto no puede entrar en ninguna intención ni en ningún
 * comando.
 */
export const BULK_GATE_PROPERTIES: readonly BulkPropertyId[] = ['member.type', 'node.support.type'];

const stagedValue = (draft: BulkEditDraft, id: BulkPropertyId): string | undefined => {
  const change = draft[id];
  return change?.kind === 'set' && typeof change.value === 'string' ? change.value : undefined;
};

export const projectBulkSelection = (
  selection: BulkSelectionInput,
  draft: BulkEditDraft,
): BulkSelectionInput => {
  const memberType = stagedValue(draft, 'member.type') as MemberType | undefined;
  const supportType = stagedValue(draft, 'node.support.type') as SupportType | undefined;
  if (memberType === undefined && supportType === undefined) return selection;

  return {
    ...selection,
    members: memberType === undefined
      ? selection.members
      : selection.members.map((member) => ({ ...member, type: memberType })),
    nodes: supportType === undefined
      ? selection.nodes
      : selection.nodes.map((node) => (node.support.type === supportType
        ? node
        : { ...node, support: rebuildSupport(node.support, supportType) })),
  };
};
