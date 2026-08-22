import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Crosshair, X } from 'lucide-react';
import { Button, Field, IconButton, SegmentedControl, Select } from '../../design-system/components/controls';
import { UnitField } from '../../design-system/components/editor';
import { Accordion } from '../../design-system/components/disclosure';
import { Surface } from '../../design-system/components/surface';
import type { PlacementWarning } from '../../data/generators/generatorPlacement';
import type { GeneratedStructureSummary, GeneratorWarning } from '../../data/generators/generatorTypes';
import { standardMaterials } from '../../data/standardMaterials';
import { standardSections } from '../../data/standardSections';
import { unitLabel } from '../../engine/units';
import type { Language } from '../../i18n/catalogs';
import type { UnitSystemId } from '../../types';
import { createStructureGeneratorTranslator } from './structureGeneratorCopy';
import {
  GENERATOR_FAMILIES,
  GENERATOR_SPACING_FIELDS,
  GENERATOR_SUPPORT_CHOICES,
  GRID_MEMBER_MODES,
  TRUSS_TOPOLOGIES,
  explicitPropertiesFromCatalog,
  spacingDraftDivisions,
  type GeneratorFormErrors,
  type GeneratorFormState,
  type GeneratorSpacingDraft,
  type GeneratorSpacingField,
} from './structureGeneratorForm';
import {
  buildGeneratorSummaryRows,
  countGeneratorDecisions,
  presentGeneratorWarnings,
} from './structureGeneratorSummary';
import './structureGenerator.css';

/**
 * Panel de «Generar estructura» (CRI-38, fase 3).
 *
 * Se alimenta sólo de props y no toca `ProjectModel`: recibe el borrador, los
 * errores por campo y el resumen ya calculado, y devuelve por callback lo que
 * haga falta. Quien lo conecta con el proyecto es `StructureGeneratorSurface`;
 * así el panel se renderiza y se prueba con fixtures, igual que el de edición
 * múltiple.
 *
 * Vive sobre el lienzo y no encima de él: es una superficie flotante, no un
 * modal, porque lo que el usuario está mirando mientras ajusta parámetros es la
 * vista previa dibujada detrás. Un diálogo modal habría tapado justamente lo
 * que hay que ver.
 *
 * Entre ajustar y crear hay una revisión explícita. Generar añade decenas de
 * entidades, invalida los resultados vigentes y ocupa el historial: no es un
 * cambio que deba poder ocurrir por rozar un botón mientras se teclea.
 */

export interface StructureGeneratorPanelProps {
  form: GeneratorFormState;
  onFormChange: (form: GeneratorFormState) => void;
  errors: GeneratorFormErrors;
  units: UnitSystemId;
  language: Language;
  /** Resumen exacto de la geometría preparada; `null` mientras no se pueda preparar. */
  summary: GeneratedStructureSummary | null;
  warnings: readonly (GeneratorWarning | PlacementWarning)[];
  /**
   * Fallo del núcleo o del commit, tal cual lo produjo su dueño. Aquí llega
   * también el rechazo por vista previa obsoleta: la superficie vuelve a
   * preparar en cada cambio del proyecto, así que una revisión desfasada no es
   * un estado del panel sino una carrera que el commit detecta y nombra.
   */
  error?: string;
  generating?: boolean;
  originPicking?: boolean;
  onToggleOriginPick?: () => void;
  /** Confirma. Devolver `false` conserva la revisión, para no rehacer el trabajo. */
  onGenerate: () => boolean | void | Promise<boolean | void>;
  onCancel: () => void;
  className?: string;
}

const SPACING_GROUP_KEY: Record<GeneratorSpacingField, `spacing.${GeneratorSpacingField}`> = {
  spans: 'spacing.spans',
  bays: 'spacing.bays',
  stories: 'spacing.stories',
  panels: 'spacing.panels',
  columns: 'spacing.columns',
  rows: 'spacing.rows',
};

export const StructureGeneratorPanel = ({
  form,
  onFormChange,
  errors,
  units,
  language,
  summary,
  warnings,
  error,
  generating = false,
  originPicking = false,
  onToggleOriginPick,
  onGenerate,
  onCancel,
  className = '',
}: StructureGeneratorPanelProps) => {
  const t = createStructureGeneratorTranslator(language);
  const [reviewing, setReviewing] = useState(false);
  const [expanded, setExpanded] = useState<string[]>([]);
  const surfaceRef = useRef<HTMLElement>(null);
  const reviewTitleRef = useRef<HTMLHeadingElement>(null);
  const reviewTriggerRef = useRef<HTMLButtonElement>(null);
  /** Sólo se devuelve el foco si la revisión llegó a abrirse. */
  const wasReviewing = useRef(false);

  /**
   * Al abrir, el foco entra en la superficie; al cerrar, vuelve a quien la
   * abrió.
   *
   * No es un cepo de foco —esto no es un modal y el lienzo de detrás sigue
   * siendo del usuario—, sino el mínimo para que el panel exista de verdad para
   * el teclado: sin esto, Escape se lo queda el botón del ToolRail y cerrar con
   * teclado sólo funciona después de tabular a ciegas hasta dentro.
   */
  useEffect(() => {
    const opener = document.activeElement;
    surfaceRef.current?.focus({ preventScroll: true });
    return () => {
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    if (reviewing) reviewTitleRef.current?.focus();
    // Al cerrar, el foco vuelve al control que abrió la revisión: quien lo tenía
    // acaba de desmontarse, y sin esto cae en `<body>`.
    else if (wasReviewing.current) reviewTriggerRef.current?.focus();
    wasReviewing.current = reviewing;
  }, [reviewing]);

  useEffect(() => {
    // Revisar una geometría y confirmar otra es el fallo que esto impide: si los
    // parámetros dejan de poder prepararse, la revisión abierta ya no describe
    // nada que se pueda crear.
    if (!summary) setReviewing(false);
  }, [summary]);

  const lengthUnit = unitLabel(units, 'length');
  const patch = (changes: Partial<GeneratorFormState>) => onFormChange({ ...form, ...changes });
  const spacingFields = GENERATOR_SPACING_FIELDS[form.family];
  const rows = summary ? buildGeneratorSummaryRows(summary, units, language) : [];
  const presentedWarnings = presentGeneratorWarnings(warnings, language);
  const decisions = countGeneratorDecisions(warnings);

  const renderSpacing = (field: GeneratorSpacingField) => {
    const draft = form[field];
    const group = t(SPACING_GROUP_KEY[field]);
    const divisions = spacingDraftDivisions(draft);
    const setDraft = (changes: Partial<GeneratorSpacingDraft>) =>
      patch({ [field]: { ...draft, ...changes } } as Partial<GeneratorFormState>);

    return <section key={field} className="structure-generator__spacing" data-spacing-field={field}>
      <SegmentedControl
        size="sm"
        className="structure-generator__spacing-mode"
        label={t('spacing.mode', { group })}
        value={draft.mode}
        options={[
          { value: 'uniform', label: t('spacing.uniform') },
          { value: 'list', label: t('spacing.custom') },
        ]}
        onValueChange={(value) => setDraft({ mode: value === 'list' ? 'list' : 'uniform' })}
      />
      {draft.mode === 'uniform' ? <div className="structure-generator__pair">
        <Field
          label={t('spacing.count', { group })}
          value={draft.count}
          type="number"
          min={1}
          step={1}
          error={errors[field]}
          onChange={(event) => setDraft({ count: event.target.value })}
        />
        <UnitField
          label={t('spacing.spacingValue', { group })}
          value={draft.spacing}
          unit={lengthUnit}
          onValueChange={(value) => setDraft({ spacing: value })}
        />
      </div> : <Field
        label={t('spacing.list', { group })}
        value={draft.list}
        inputMode="decimal"
        hint={divisions === null ? t('spacing.listHint') : t('spacing.divisions', { count: divisions })}
        error={errors[field]}
        suffix={lengthUnit}
        onChange={(event) => setDraft({ list: event.target.value })}
      />}
    </section>;
  };

  const geometryFields = <div className="structure-generator__geometry">
    {spacingFields.map(renderSpacing)}

    {form.family === 'portal-frame' ? <UnitField
      label={t('height')}
      value={form.height}
      unit={lengthUnit}
      error={errors.height}
      onValueChange={(value) => patch({ height: value })}
    /> : null}

    {form.family === 'truss' ? <>
      <SegmentedControl
        size="sm"
        className="structure-generator__wide"
        label={t('topology')}
        value={form.topology}
        options={TRUSS_TOPOLOGIES.map((topology) => ({ value: topology, label: t(`topology.${topology}`) }))}
        onValueChange={(value) => patch({ topology: value as GeneratorFormState['topology'] })}
      />
      <UnitField
        label={t('depth')}
        value={form.depth}
        unit={lengthUnit}
        error={errors.depth}
        onValueChange={(value) => patch({ depth: value })}
      />
      {/* Sólo la Warren puede prescindir de los montantes: en Pratt y Howe el
          control mentiría, porque el núcleo los crea de todos modos. */}
      {form.topology === 'warren' ? <label className="structure-generator__check">
        <input
          type="checkbox"
          checked={form.includeVerticals}
          onChange={(event) => patch({ includeVerticals: event.target.checked })}
        />
        <span>
          <strong>{t('includeVerticals')}</strong>
          <small>{t('includeVerticalsHint')}</small>
        </span>
      </label> : null}
    </> : null}

    {form.family === 'grid' ? <SegmentedControl
      size="sm"
      className="structure-generator__wide"
      label={t('gridMembers')}
      value={form.gridMembers}
      options={GRID_MEMBER_MODES.map((mode) => ({ value: mode, label: t(`gridMembers.${mode}`) }))}
      onValueChange={(value) => patch({ gridMembers: value as GeneratorFormState['gridMembers'] })}
    /> : null}
  </div>;

  const placementFields = <div className="structure-generator__placement">
    <div className="structure-generator__pair">
      <UnitField
        label={t('origin.x')}
        value={form.originX}
        unit={lengthUnit}
        error={errors.originX}
        onValueChange={(value) => patch({ originX: value })}
      />
      <UnitField
        label={t('origin.y')}
        value={form.originY}
        unit={lengthUnit}
        error={errors.originY}
        onValueChange={(value) => patch({ originY: value })}
      />
    </div>
    {onToggleOriginPick ? <div className="structure-generator__pick">
      <Button
        variant={originPicking ? 'primary' : 'secondary'}
        size="touch"
        leadingIcon={<Crosshair size={17} />}
        aria-pressed={originPicking}
        onClick={onToggleOriginPick}
      >{t(originPicking ? 'origin.picking' : 'origin.pick')}</Button>
      <small>{t('origin.pickHint')}</small>
    </div> : null}
    <SegmentedControl
      size="sm"
      className="structure-generator__wide"
      label={t('support.label')}
      value={form.support}
      options={GENERATOR_SUPPORT_CHOICES.map((choice) => ({ value: choice, label: t(`support.${choice}`) }))}
      onValueChange={(value) => patch({ support: value as GeneratorFormState['support'] })}
    />
    <small className="structure-generator__hint">{t('support.hint')}</small>
  </div>;

  const propertyFields = <div className="structure-generator__properties">
    <SegmentedControl
      size="sm"
      className="structure-generator__wide"
      label={t('properties.source')}
      value={form.propertiesSource}
      options={[
        { value: 'catalog', label: t('properties.catalog') },
        { value: 'explicit', label: t('properties.custom') },
      ]}
      onValueChange={(value) => {
        if (value !== 'explicit') {
          patch({ propertiesSource: 'catalog' });
          return;
        }
        // Personalizar parte de lo que el catálogo ya resolvía: empezar en
        // blanco obligaría a teclear de memoria unos números que se acaban de
        // ver, y sembrar una constante inventaría propiedades que nadie pidió.
        const seeded = form.elasticModulus.trim() || form.area.trim() || form.inertia.trim()
          ? null
          : explicitPropertiesFromCatalog(form.materialId, form.sectionId, units);
        patch({ propertiesSource: 'explicit', ...(seeded ?? {}) });
      }}
    />
    {form.propertiesSource === 'catalog' ? <>
      <Select
        label={t('properties.material')}
        value={form.materialId}
        error={errors.materialId}
        onChange={(event) => patch({ materialId: event.target.value })}
      >
        {standardMaterials.map((material) => <option key={material.id} value={material.id}>{material.name}</option>)}
      </Select>
      <Select
        label={t('properties.section')}
        value={form.sectionId}
        error={errors.sectionId}
        onChange={(event) => patch({ sectionId: event.target.value })}
      >
        {standardSections.map((section) => <option key={section.id} value={section.id}>{section.name}</option>)}
      </Select>
    </> : <>
      <UnitField
        label={t('properties.elasticModulus')}
        value={form.elasticModulus}
        unit={unitLabel(units, 'elasticModulus')}
        error={errors.elasticModulus}
        onValueChange={(value) => patch({ elasticModulus: value })}
      />
      <div className="structure-generator__pair">
        <UnitField
          label={t('properties.area')}
          value={form.area}
          unit={unitLabel(units, 'area')}
          error={errors.area}
          onValueChange={(value) => patch({ area: value })}
        />
        <UnitField
          label={t('properties.inertia')}
          value={form.inertia}
          unit={unitLabel(units, 'inertia')}
          error={errors.inertia}
          onValueChange={(value) => patch({ inertia: value })}
        />
      </div>
    </>}
  </div>;

  const warningList = presentedWarnings.length ? <section
    className="structure-generator__warnings"
    aria-label={t('warnings.title')}
  >
    <h3>{t('warnings.title')}</h3>
    <ul>
      {presentedWarnings.map((warning) => <li key={warning.code} data-warning-tone={warning.tone}>
        <strong>{warning.title}</strong>
        <span>{warning.message}</span>
      </li>)}
    </ul>
  </section> : null;

  const summaryList = summary ? <section className="structure-generator__summary" aria-label={t('summary.title')}>
    <h3>{t('summary.title')}</h3>
    <dl>
      {rows.map((row) => <div key={row.id} data-summary-row={row.id}>
        <dt>{row.label}</dt>
        <dd>
          <strong>{row.value}</strong>
          {row.detail ? <small>{row.detail}</small> : null}
        </dd>
      </div>)}
    </dl>
  </section> : null;

  const confirm = async () => {
    const applied = await onGenerate();
    // Confirmar no cambia los parámetros, así que nada cierra la revisión por
    // su cuenta: el cierre tiene que ser explícito o el panel se queda pidiendo
    // confirmar algo que ya ocurrió.
    if (applied !== false) setReviewing(false);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    if (reviewing) setReviewing(false);
    else onCancel();
  };

  return <Surface
    as="section"
    ref={surfaceRef}
    level="floating"
    className={`structure-generator${className ? ` ${className}` : ''}`}
    aria-label={t('title')}
    data-structure-generator-surface
    data-structure-generator-view={reviewing ? 'review' : 'parameters'}
    tabIndex={-1}
    onKeyDown={onKeyDown}
  >
    <header className="structure-generator__header">
      <div>
        <strong>{t('title')}</strong>
        <span>{reviewing ? t('review.description') : t('description')}</span>
      </div>
      <IconButton label={t('close')} size="touch" onClick={onCancel}><X size={18} /></IconButton>
    </header>

    {reviewing ? <div className="structure-generator__body">
      {/* El encabezado recibe el foco: el botón que abrió la revisión ya no
          existe, y sin esto el foco cae en `<body>`. */}
      <h3 className="structure-generator__review-title" tabIndex={-1} ref={reviewTitleRef}>{t('review.title')}</h3>
      {summaryList}
      {warningList}
      {decisions > 0 ? <p className="structure-generator__decisions">{t('review.decisions', { count: decisions })}</p> : null}
      <p className="structure-generator__note">{t('previewNote')}</p>
      {error ? <p className="structure-generator__error" role="alert">{error}</p> : null}
    </div> : <div className="structure-generator__body">
      <SegmentedControl
        size="sm"
        className="structure-generator__families"
        label={t('familyLabel')}
        value={form.family}
        options={GENERATOR_FAMILIES.map((family) => ({ value: family, label: t(`family.${family}`) }))}
        onValueChange={(value) => patch({ family: value as GeneratorFormState['family'] })}
      />

      {geometryFields}

      <Accordion
        multiple
        className="structure-generator__advanced"
        expanded={expanded}
        onExpandedChange={setExpanded}
        items={[
          { id: 'placement', title: t('section.placement'), content: placementFields },
          { id: 'properties', title: t('section.properties'), content: propertyFields },
        ]}
      />

      {summaryList}
      {warningList}
      {summary ? null : <p className="structure-generator__message" role="status">{t('invalidParams')}</p>}
      {error ? <p className="structure-generator__error" role="alert">{error}</p> : null}
    </div>}

    <footer className="structure-generator__actions">
      {reviewing ? <>
        <Button variant="ghost" size="touch" onClick={() => setReviewing(false)}>{t('action.back')}</Button>
        <Button
          variant="primary"
          size="touch"
          disabled={!summary || Boolean(error)}
          loading={generating}
          loadingLabel={t('action.generating')}
          onClick={() => { void confirm(); }}
        >{t('action.generate')}</Button>
      </> : <>
        <Button variant="ghost" size="touch" onClick={onCancel}>{t('action.cancel')}</Button>
        <Button
          ref={reviewTriggerRef}
          variant="primary"
          size="touch"
          disabled={!summary}
          onClick={() => setReviewing(true)}
        >{t('action.review')}</Button>
      </>}
    </footer>
  </Surface>;
};
