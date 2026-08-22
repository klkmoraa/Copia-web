import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  prepareStructureGeneration,
  type PreparedStructureGeneration,
} from '../../commands/structureGeneration';
import { projectCommandSnapshot } from '../../commands/projectCommand';
import { toDisplay } from '../../engine/units';
import { useProjectModel } from '../../store/ProjectModelContext';
import { useWorkspaceUI } from '../../store/WorkspaceUIContext';
import { serializeNumber } from '../../utils/numberFormat';
import { emitWorkspaceCommand } from '../workspace/workspaceCommands';
import { StructureGeneratorPanel } from './StructureGeneratorPanel';
import { createStructureGeneratorTranslator } from './structureGeneratorCopy';
import {
  DEFAULT_GENERATOR_FORM,
  buildGeneratorParams,
  generatorParamsSignature,
  type GeneratorFormState,
} from './structureGeneratorForm';

/**
 * Superficie conectada de «Generar estructura» (CRI-38, fase 3).
 *
 * Es la única pieza de esta fase que conoce el proyecto. Su trabajo es traducir
 * el borrador a parámetros, preparar la generación contra el modelo vigente y
 * publicar la vista previa; el panel no ve nada de eso y el núcleo no ve React.
 *
 * Preparar no muta: `prepareStructureGeneration` calcula sobre copias, no
 * reserva identidad y no deja rastro, así que teclear no cuesta nada más que un
 * cálculo. Por eso la vista previa puede recalcularse en cada cambio real de
 * parámetros sin ninguna transacción abierta ni nada que revertir al cerrar.
 *
 * Cerrar es, literalmente, no confirmar: no hay `cancel` que llamar porque no
 * hay nada empezado. Lo único que se limpia es el ghost dibujado.
 */

export interface StructureGeneratorSurfaceProps {
  /** Punto elegido en el lienzo; el token distingue dos elecciones del mismo punto. */
  pickedOrigin?: { readonly x: number; readonly y: number; readonly token: number } | null;
  originPicking?: boolean;
  onToggleOriginPick?: () => void;
  /** Se llama al consumir un punto elegido, para que el lienzo desarme el puntero. */
  onOriginPickResolved?: () => void;
  onGhostChange?: (ghost: PreparedStructureGeneration['ghost'] | null) => void;
  /** Origen en coordenadas de modelo, para dibujar el ancla junto al ghost. */
  onOriginChange?: (origin: { readonly x: number; readonly y: number } | null) => void;
  onClose: () => void;
  className?: string;
}

interface PreparationState {
  readonly prepared: PreparedStructureGeneration | null;
  readonly error: string;
}

export const StructureGeneratorSurface = ({
  pickedOrigin,
  originPicking = false,
  onToggleOriginPick,
  onOriginPickResolved,
  onGhostChange,
  onOriginChange,
  onClose,
  className,
}: StructureGeneratorSurfaceProps) => {
  const { project, executePreparedStructureGeneration } = useProjectModel();
  const { setSelection } = useWorkspaceUI();
  const units = project.settings.units;
  const language = project.settings.language;
  const t = createStructureGeneratorTranslator(language);

  const [form, setForm] = useState<GeneratorFormState>(DEFAULT_GENERATOR_FORM);
  const [commitError, setCommitError] = useState('');
  const [generating, setGenerating] = useState(false);
  const consumedPickToken = useRef<number | null>(null);

  const built = useMemo(() => buildGeneratorParams(form, units), [form, units]);
  const signature = built.ok ? generatorParamsSignature(built.params) : '';
  const projectSnapshot = projectCommandSnapshot(project);

  /**
   * La preparación se memoriza por firma de parámetros y estado del proyecto,
   * no por identidad del borrador: pasar de `5` a `5.` mientras se teclea no
   * cambia nada que el núcleo pueda ver, y no debe costar una regeneración ni
   * redibujar el ghost.
   */
  const { prepared, error: preparationError } = useMemo<PreparationState>(() => {
    if (!built.ok) return { prepared: null, error: '' };
    try {
      return { prepared: prepareStructureGeneration(project, built.params), error: '' };
    } catch (cause) {
      return { prepared: null, error: cause instanceof Error ? cause.message : String(cause) };
    }
    // `signature` y `projectSnapshot` describen exactamente de qué depende el
    // resultado; `built.params` y `project` cambian de identidad sin cambiarlo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [built.ok, signature, projectSnapshot]);

  useEffect(() => {
    onGhostChange?.(prepared?.ghost ?? null);
  }, [onGhostChange, prepared]);

  useEffect(() => {
    onOriginChange?.(built.ok ? (built.params.origin ?? { x: 0, y: 0 }) : null);
  }, [built, onOriginChange]);

  // Al desmontarse, la vista previa desaparece con la superficie: no queda un
  // ghost huérfano dibujado sobre un modelo que ya nadie está generando.
  useEffect(() => () => {
    onGhostChange?.(null);
    onOriginChange?.(null);
  }, [onGhostChange, onOriginChange]);

  useEffect(() => {
    if (!pickedOrigin || consumedPickToken.current === pickedOrigin.token) return;
    consumedPickToken.current = pickedOrigin.token;
    setForm((current) => ({
      ...current,
      originX: serializeNumber(toDisplay(pickedOrigin.x, units, 'length')),
      originY: serializeNumber(toDisplay(pickedOrigin.y, units, 'length')),
    }));
    onOriginPickResolved?.();
  }, [onOriginPickResolved, pickedOrigin, units]);

  const changeForm = useCallback((next: GeneratorFormState) => {
    setForm(next);
    // Un parámetro nuevo invalida el motivo por el que falló el commit anterior.
    setCommitError('');
  }, []);

  const generate = useCallback(async (): Promise<boolean> => {
    if (!prepared) return false;
    setGenerating(true);
    setCommitError('');
    try {
      const result = await executePreparedStructureGeneration(prepared);
      if (!result.applied) return false;
      // Lo creado queda seleccionado: generar y no saber qué se generó obligaría
      // a buscarlo a ojo para el primer ajuste.
      setSelection({ kind: 'multi', nodeIds: [...result.nodeIds], memberIds: [...result.memberIds] });
      emitWorkspaceCommand('show-toast', {
        message: t('toastGenerated'),
        description: t('toastGeneratedDetail', {
          nodes: result.nodeIds.length,
          members: result.memberIds.length,
        }),
        tone: 'success',
      });
      onClose();
      return true;
    } catch (cause) {
      setCommitError(cause instanceof Error ? cause.message : String(cause));
      return false;
    } finally {
      setGenerating(false);
    }
  }, [executePreparedStructureGeneration, onClose, prepared, setSelection, t]);

  return <StructureGeneratorPanel
    form={form}
    onFormChange={changeForm}
    errors={built.ok ? {} : built.errors}
    units={units}
    language={language}
    summary={prepared?.summary ?? null}
    warnings={prepared?.warnings ?? []}
    error={commitError || preparationError}
    generating={generating}
    originPicking={originPicking}
    onToggleOriginPick={onToggleOriginPick}
    onGenerate={generate}
    onCancel={onClose}
    {...(className ? { className } : {})}
  />;
};

export default StructureGeneratorSurface;
