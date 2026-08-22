import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, SegmentedControl } from '../../design-system/components/controls';
import { Accordion, Tabs } from '../../design-system/components/disclosure';
import type { Language } from '../../i18n/catalogs';
import type { UnitSystemId } from '../../types';
import { BulkChangeSummary } from './BulkChangeSummary';
import { BulkPropertyField } from './BulkPropertyField';
import { BulkSectionPreview } from './BulkSectionPreview';
import { BulkSelectionSummary } from './BulkSelectionSummary';
import { aggregateBulkSelection, editableBulkProperties } from './bulkEditAggregation';
import { createBulkEditTranslator } from './bulkEditCopy';
import {
  EMPTY_BULK_DRAFT,
  buildBulkChangeSummary,
  buildBulkEditIntent,
  resolveBulkChange,
  stageBulkChange,
  untouchBulkChange,
} from './bulkEditIntent';
import { BULK_DISCLOSED_GROUPS, bulkPropertyGroups, bulkScopeOptions, propertiesInScope, type BulkScopeId } from './bulkEditScope';
import type {
  BulkEditDraft,
  BulkEditIntent,
  BulkPropertyId,
  BulkPropertyState,
  BulkSelectionAggregate,
  BulkSelectionInput,
} from './bulkEditTypes';
import { buildBulkSectionPreview } from './bulkSectionPreviewModel';
import './bulkEdit.css';

/**
 * Panel de edición múltiple.
 *
 * Se alimenta sólo de props y no toca `ProjectModel`: recibe la selección ya
 * resuelta y devuelve por callback lo que hace falta para preparar el comando.
 * Quien conecta esto con el proyecto es `BulkEditInspectorPanel`; así el panel
 * sigue renderizándose y probándose con fixtures.
 *
 * Mientras se edita, nada sale de aquí: el borrador es estado local, de modo que
 * escribir en un campo no publica al store, no persiste y no invalida análisis.
 * Entre preparar y publicar hay una revisión explícita, porque aplicar invalida
 * los resultados y ocupa el historial.
 */

/** Las decisiones frecuentes van arriba; el resto queda tras una revelación progresiva. */
const PRIMARY_PROPERTIES: readonly BulkPropertyId[] = [
  'member.type',
  'member.materialId',
  'member.sectionId',
  'node.support.type',
  /*
   * Lo que el tipo de apoyo desbloquea va con él. Un apoyo personalizado ES sus
   * tres restricciones y un rodillo ES su normal: nacer plegados dentro de «Más
   * propiedades» dejaba sin efecto práctico el habilitar-y-configurar en una
   * sola pasada, porque el usuario no veía lo que acababa de desbloquear.
   * Sólo aparecen cuando la selección los admite, así que no estorban al resto.
   */
  'node.support.restrainX',
  'node.support.restrainY',
  'node.support.restrainR',
  'node.support.angleDeg',
  // La articulación interna es una decisión de modelado, no un número avanzado.
  'node.internalHinge',
  'nodalLoad.caseId',
  'memberLoad.caseId',
];

/**
 * Identidad de la selección. El borrador se refiere a *estos* objetos: si la
 * selección cambia, un cambio preparado sobre los anteriores no puede seguir
 * vivo, o se aplicaría a objetos que el usuario nunca editó.
 */
const selectionSignature = (selection: BulkSelectionInput): string => [
  ...selection.members.map((member) => `m:${member.id}`),
  ...selection.nodes.map((node) => `n:${node.id}`),
].join('|');

/**
 * Lo que el panel entrega al confirmar. Lleva la intención (qué se cambió), el
 * borrador (con qué valores) y la agregación (sobre qué objetos y con qué
 * compatibilidad), que es exactamente lo que hace falta para preparar el
 * comando sin volver a recorrer la selección.
 */
export interface BulkEditApplyRequest {
  intent: BulkEditIntent;
  draft: BulkEditDraft;
  aggregate: BulkSelectionAggregate;
}

export interface BulkEditPanelProps {
  selection: BulkSelectionInput;
  units: UnitSystemId;
  language: Language;
  /**
   * Confirma la edición. Devolver `false` —o una promesa que resuelva a
   * `false`— significa que el commit se rechazó: el panel conserva entonces el
   * borrador y la revisión, para no obligar a rehacer el trabajo.
   */
  onApply: (request: BulkEditApplyRequest) => boolean | void | Promise<boolean | void>;
  onCancel?: () => void;
  /** Mensaje de fallo del commit, p. ej. una intención obsoleta. */
  error?: string;
  /** Nota bajo el resumen; la usa el Inspector para avisar del análisis. */
  note?: string;
  className?: string;
}

export const BulkEditPanel = ({
  selection,
  units,
  language,
  onApply,
  onCancel,
  error,
  note,
  className = '',
}: BulkEditPanelProps) => {
  const t = createBulkEditTranslator(language);
  const [draft, setDraft] = useState<BulkEditDraft>(EMPTY_BULK_DRAFT);
  const [tab, setTab] = useState('properties');
  const [expanded, setExpanded] = useState<string[]>([]);
  const [scope, setScope] = useState<BulkScopeId>('all');
  const [reviewing, setReviewing] = useState(false);
  const reviewTitleRef = useRef<HTMLHeadingElement>(null);
  const reviewTriggerRef = useRef<HTMLButtonElement>(null);
  /** Sólo se devuelve el foco si la revisión llegó a abrirse. */
  const wasReviewing = useRef(false);

  useEffect(() => {
    if (reviewing) reviewTitleRef.current?.focus();
    // Al cerrar, el foco vuelve al control que abrió la revisión: quien lo tenía
    // acaba de desmontarse, y sin esto cae en `<body>`.
    else if (wasReviewing.current) reviewTriggerRef.current?.focus();
    wasReviewing.current = reviewing;
  }, [reviewing]);


  const signature = useMemo(() => selectionSignature(selection), [selection]);
  useEffect(() => {
    setDraft(EMPTY_BULK_DRAFT);
    // Revisar unos objetos y confirmar sobre otros es el fallo que la firma
    // existe para impedir: al cambiar la selección la revisión se abandona.
    setReviewing(false);
  }, [signature]);

  // El borrador entra en la agregación para que habilitar una propiedad y
  // configurarla quepan en una sola intención preparada.
  const aggregate = useMemo(() => aggregateBulkSelection(selection, draft), [selection, draft]);
  const properties = useMemo(() => editableBulkProperties(aggregate), [aggregate]);
  const intent = useMemo(() => buildBulkEditIntent(aggregate, draft), [aggregate, draft]);
  const summaryRows = useMemo(() => buildBulkChangeSummary(aggregate, draft), [aggregate, draft]);
  const preview = useMemo(() => buildBulkSectionPreview(aggregate, draft), [aggregate, draft]);
  const scopes = useMemo(() => bulkScopeOptions(aggregate), [aggregate]);

  // Un filtro que deja de existir —porque esa familia ya no está— no puede
  // seguir ocultando el resto del panel.
  const activeScope = scopes.includes(scope) ? scope : 'all';
  const groups = useMemo(
    () => bulkPropertyGroups(propertiesInScope(properties, activeScope)),
    [properties, activeScope],
  );

  const renderField = (state: BulkPropertyState) => <BulkPropertyField
    key={state.id}
    state={state}
    change={resolveBulkChange(draft, state.id)}
    units={units}
    language={language}
    onStage={(change) => setDraft((current) => stageBulkChange(current, state, change))}
    onUntouch={() => setDraft((current) => untouchBulkChange(current, state.id))}
  />;

  const cancel = () => {
    setDraft(EMPTY_BULK_DRAFT);
    setReviewing(false);
    onCancel?.();
  };

  /**
   * Confirmar no cambia qué objetos están seleccionados, así que el efecto que
   * descarta el borrador al cambiar la selección nunca se dispara aquí: el
   * cierre tiene que ser explícito, o el panel se queda en la pantalla de
   * revisión de un cambio que ya ocurrió, con el botón todavía activo.
   */
  const confirm = async () => {
    const applied = await onApply({ intent, draft, aggregate });
    if (applied === false) return;
    setDraft(EMPTY_BULK_DRAFT);
    setReviewing(false);
  };

  if (aggregate.total === 0) {
    return <section className={`bulk-edit-panel is-empty ${className}`.trim()} aria-label={t('panel.label')}>
      <BulkSelectionSummary aggregate={aggregate} language={language} />
    </section>;
  }

  if (reviewing) {
    return <section className={`bulk-edit-panel is-reviewing ${className}`.trim()} aria-label={t('panel.label')}>
      <BulkSelectionSummary aggregate={aggregate} language={language} />

      <section
        className="bulk-review"
        aria-label={t('review.title')}
        /*
         * Escape abandona la confirmación y vuelve a la edición. Se consume
         * porque aquí sí hay algo concreto que cancelar; en la edición no se
         * captura, para que una hoja móvil contenedora pueda seguir cerrándose.
         */
        onKeyDown={(event) => {
          if (event.key !== 'Escape') return;
          event.preventDefault();
          event.stopPropagation();
          setReviewing(false);
        }}
      >
        {/* El encabezado recibe el foco: el botón que abrió la revisión ya no
            existe, y sin esto el foco cae en `<body>`. */}
        <h3 className="bulk-review__title" tabIndex={-1} ref={reviewTitleRef}>{t('review.title')}</h3>
        <BulkChangeSummary
          aggregate={aggregate}
          rows={summaryRows}
          units={units}
          language={language}
          expandUntouched
        />
        {/* Que la edición deje objetos fuera es una decisión, no un detalle: se
            anuncia una vez arriba y cada fila da el número y el motivo. */}
        {intent.hasIncompatibleTargets
          ? <p className="bulk-review__incompatible">{t('review.incompatible')}</p>
          : null}
        {note ? <p className="bulk-edit-panel__note">{note}</p> : null}
        {error ? <p className="bulk-edit-panel__error" role="alert">{error}</p> : null}

        <footer className="bulk-edit-panel__actions">
          <div className="bulk-edit-panel__buttons">
            {/* Dice lo que hace: vuelve a la edición y conserva el borrador.
                Llamarlo «Cancelar», como al del pie de edición —que sí descarta
                el borrador entero—, convertía ese otro en una trampa para quien
                hubiera aprendido éste. */}
            <Button variant="ghost" onClick={() => setReviewing(false)}>{t('action.backToEditing')}</Button>
            <Button
              variant="primary"
              disabled={intent.entries.length === 0}
              onClick={confirm}
            >{t('action.apply', { count: intent.affected.length })}</Button>
          </div>
        </footer>
      </section>
    </section>;
  }

  const renderGroup = (group: ReturnType<typeof bulkPropertyGroups>[number]) => {
    // Los grupos de carga se muestran enteros: son pocos campos y son el objeto
    // de la edición, así que plegarlos escondía justo lo que se venía a cambiar.
    const discloses = BULK_DISCLOSED_GROUPS.includes(group.id);
    const primary = group.properties.filter(
      (property) => !discloses || PRIMARY_PROPERTIES.includes(property.id),
    );
    const advanced = discloses
      ? group.properties.filter((property) => !PRIMARY_PROPERTIES.includes(property.id))
      : [];
    return <section key={group.id} className="bulk-edit-panel__group" data-group={group.id}>
      {groups.length > 1 ? <h3 className="bulk-edit-panel__group-title">{t(`group.${group.id}`)}</h3> : null}
      <div className="bulk-edit-panel__properties">{primary.map(renderField)}</div>
      {advanced.length > 0 ? <Accordion
        multiple
        className="bulk-edit-panel__advanced"
        expanded={expanded}
        onExpandedChange={setExpanded}
        items={[{
          id: `bulk-advanced-${group.id}`,
          title: t('panel.advanced'),
          content: <div className="bulk-edit-panel__properties">{advanced.map(renderField)}</div>,
        }]}
      /> : null}
    </section>;
  };

  return <section className={`bulk-edit-panel ${className}`.trim()} aria-label={t('panel.label')}>
    <BulkSelectionSummary aggregate={aggregate} language={language} />

    {/* El filtro es una lente del Inspector: no toca la selección del lienzo. */}
    {scopes.length > 1 ? <div className="bulk-edit-panel__scope">
      <SegmentedControl
        size="sm"
        className="bulk-edit-panel__scope-control"
        label={t('scope.label')}
        value={activeScope}
        options={scopes.map((id) => ({ value: id, label: t(`scope.filter.${id}`) }))}
        onValueChange={(value) => setScope(value as BulkScopeId)}
      />
      <small className="bulk-edit-panel__scope-hint">{t('scope.hint')}</small>
    </div> : null}

    <Tabs
      className="bulk-edit-panel__tabs"
      label={t('panel.tabs')}
      value={tab}
      onValueChange={setTab}
      items={[
        {
          id: 'properties',
          label: t('tab.properties'),
          content: <div className="bulk-edit-panel__groups">{groups.map(renderGroup)}</div>,
        },
        {
          id: 'section',
          label: t('tab.section'),
          content: <BulkSectionPreview preview={preview} units={units} language={language} />,
        },
      ]}
    />

    <BulkChangeSummary aggregate={aggregate} rows={summaryRows} units={units} language={language} />

    {note ? <p className="bulk-edit-panel__note">{note}</p> : null}
    {error ? <p className="bulk-edit-panel__error" role="alert">{error}</p> : null}

    <footer className="bulk-edit-panel__actions">
      {/* La razón por la que no se puede aplicar es texto visible, no un
          `title`: un botón deshabilitado no recibe foco ni puntero. */}
      {intent.entries.length === 0
        ? <p className="bulk-edit-panel__apply-hint">{t('action.applyHint')}</p>
        : null}
      <div className="bulk-edit-panel__buttons">
        <Button variant="ghost" onClick={cancel}>{t('action.cancel')}</Button>
        <Button
          ref={reviewTriggerRef}
          variant="primary"
          disabled={intent.entries.length === 0}
          onClick={() => setReviewing(true)}
        >
          {intent.entries.length === 0
            ? t('action.reviewEmpty')
            : t('action.review', { count: intent.entries.length })}
        </Button>
      </div>
    </footer>
  </section>;
};
