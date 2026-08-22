import { useMemo, useState } from 'react';
import { useI18n } from '../../i18n/useI18n';
import { useProjectModel } from '../../store/ProjectModelContext';
import type { Selection } from '../../types';
import { BulkEditPanel, type BulkEditApplyRequest } from './BulkEditPanel';
import { prepareBulkEdit, type PreparedBulkEdit } from './bulkEditCommand';
import { createBulkEditTranslator } from './bulkEditCopy';

/**
 * Conecta el panel de edición múltiple con el proyecto real.
 *
 * Es la única pieza de la funcionalidad que conoce el store, y hace exactamente
 * tres cosas: resolver la selección a entidades, preparar el comando cuando el
 * usuario confirma, y traducir un fallo del commit a un mensaje.
 *
 * La atomicidad, el historial y la invalidación del análisis no se implementan
 * aquí: `executeProjectCommand` calcula el proyecto resultante completo y sólo
 * entonces lo publica con una sola entrada de historial. Un fallo en cualquier
 * miembro deja cero cambios.
 */
/**
 * Una operación vacía no se envía. Se comprueban las cuatro familias, no dos:
 * omitir una convierte «no hay nada que aplicar» en «se perdió lo que sí había».
 */
const hasAnyEntry = (command: PreparedBulkEdit['command']): boolean =>
  command.entries.length > 0
  || command.nodeEntries.length > 0
  || command.nodalLoadEntries.length > 0
  || command.memberLoadEntries.length > 0;

export const BulkEditInspectorPanel = ({ selection }: { selection: Extract<Selection, { kind: 'multi' }> }) => {
  const { project, executeProjectCommand } = useProjectModel();
  const { language } = useI18n();
  const t = createBulkEditTranslator(language);
  const [error, setError] = useState<string>();

  // La selección guarda ids; el panel necesita las entidades. Un id que ya no
  // existe se descarta aquí, de modo que el panel nunca agrega un fantasma.
  const resolved = useMemo(() => {
    // Índices, no búsquedas lineales: con `includes` sobre el array de ids, cada
    // objeto del proyecto recorría la selección entera, y el coste crecía con el
    // producto de ambos tamaños justo cuando la selección es grande.
    const selectedMembers = new Set(selection.memberIds);
    const selectedNodes = new Set(selection.nodeIds);
    const members = project.members.filter((member) => selectedMembers.has(member.id));
    const nodes = project.nodes.filter((node) => selectedNodes.has(node.id));
    const memberIds = new Set(members.map((member) => member.id));
    const nodeIds = new Set(nodes.map((node) => node.id));
    return {
      members,
      nodes,
      // La selección del modelo no transporta cargas, así que entran las que
      // cuelgan de lo seleccionado. Nunca se edita una carga suelta por error.
      nodalLoads: project.nodalLoads.filter((load) => nodeIds.has(load.nodeId)),
      memberLoads: project.memberLoads.filter((load) => memberIds.has(load.memberId)),
      loadCases: project.loadCases.map((item) => item.id),
    };
  }, [project.members, project.nodes, project.nodalLoads, project.memberLoads, project.loadCases,
    selection.memberIds, selection.nodeIds]);

  /**
   * Devuelve si la edición llegó a publicarse. El panel lo necesita para saber
   * si puede cerrar la revisión y descartar el borrador: tras un rechazo, perder
   * el borrador obligaría a rehacer el trabajo entero.
   */
  const apply = async ({ draft, aggregate }: BulkEditApplyRequest): Promise<boolean> => {
    setError(undefined);
    const prepared = prepareBulkEdit(project, aggregate, draft, t('command.description', {
      count: aggregate.total,
    }));
    // Toda familia cuenta. Mirar sólo miembros y nudos descartaba en silencio
    // una edición que únicamente tocaba cargas: el panel aceptaba la
    // confirmación y no ocurría nada.
    if (!hasAnyEntry(prepared.command)) return false;
    try {
      await executeProjectCommand(prepared.command);
      return true;
    } catch (cause: unknown) {
      // Fail closed: si el modelo se movió bajo la intención preparada, el
      // comando la rechaza entera y aquí sólo se informa.
      setError(cause instanceof Error ? cause.message : t('action.applyFailed'));
      return false;
    }
  };

  return <BulkEditPanel
    selection={resolved}
    units={project.settings.units}
    language={language}
    error={error}
    note={t('action.analysisNote')}
    onApply={apply}
    onCancel={() => setError(undefined)}
  />;
};
