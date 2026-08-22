import { useMemo, useState, type ReactNode } from 'react';
import { Anchor, Box, Layers, MapPin, Scissors, Weight } from 'lucide-react';
import { findStandardMaterial } from '../../data/standardMaterials';
import { Button, Select } from '../../design-system/components/controls';
import { UnitField } from '../../design-system/components/editor';
import { Surface } from '../../design-system/components/surface';
import { toDisplay, unitLabel } from '../../engine/units';
import type { Language, TranslationKey } from '../../i18n/catalogs';
import type { MemberLoad, MemberModel, NodalLoad, NodeModel, ProjectModel, UnitSystemId } from '../../types';
import { SectionViewer2D } from '../inspector/SectionViewer2D';
import { serializeInspectorNumber } from '../inspector/numericFormatting';
import type { DatasheetEditError, DatasheetEditErrorCode } from './datasheetEditDraft';
import { datasheetField, type DatasheetFieldId } from './datasheetEditModel';
import type { DatasheetRowKind } from './datasheetModel';
import { datasheetFieldOptions, formatDatasheetNumber } from './datasheetPresentation';

/**
 * Editores visuales del datasheet: «ver lo que estás creando».
 *
 * Cada tarjeta dibuja el **proyecto de preview**, no sus propios campos. Por eso
 * el glifo del apoyo, la forma de la sección, la posición del nudo y la flecha de
 * la carga cambian en vivo sin una sola línea de lógica de dibujo nueva: se
 * dibuja el modelo resultante, que es exactamente el que se va a escribir.
 *
 * Las tarjetas son de borrador aunque el usuario toque un solo campo, porque
 * ninguna toca un solo campo del modelo: el material escribe identidad, E, G y
 * densidad; el apoyo escribe tipo, ángulo y tres restricciones. Aplicarlas a
 * mitad de camino escribiría estados que nadie pidió.
 *
 * Los controles son componentes de **primer nivel** a propósito. Definidos
 * dentro del render tendrían identidad nueva en cada pulsación, React
 * desmontaría el `input` y el foco se perdería al teclear el segundo dígito.
 */

type Translate = (key: TranslationKey, variables?: Record<string, string | number>) => string;

const NODE_VIEW = { width: 200, height: 120, padding: 26 };

/** Sufijo de la clave del mensaje; el código lleva guiones y la clave no. */
const ERROR_SUFFIX: Record<DatasheetEditErrorCode, string> = {
  'not-a-number': 'notANumber',
  'not-positive': 'notPositive',
  'out-of-range': 'outOfRange',
  'unknown-option': 'unknownOption',
  ineligible: 'ineligible',
  'unknown-row': 'unknownRow',
};

/** Todo lo que un control necesita para leer, escribir y explicarse. */
interface FieldContext {
  rowId: string;
  units: UnitSystemId;
  language: Language;
  t: Translate;
  /** Proyecto de preview; de él salen las opciones que declara el proyecto. */
  previewProject: ProjectModel;
  draftText: (fieldId: DatasheetFieldId) => string | undefined;
  onStage: (fieldId: DatasheetFieldId, raw: string) => void;
  errors: readonly DatasheetEditError[];
}

const errorFor = (ctx: FieldContext, fieldId: DatasheetFieldId): string | undefined => {
  const error = ctx.errors.find((candidate) => candidate.fieldId === fieldId && candidate.rowId === ctx.rowId);
  if (!error) return undefined;
  return ctx.t(`datasheet.error.${ERROR_SUFFIX[error.code]}` as TranslationKey, {
    row: error.rowId,
    raw: error.raw,
  });
};

/**
 * Campo numérico.
 *
 * Sirve la cadena tecleada mientras la haya, y si no el valor del **modelo
 * real** convertido a las unidades mostradas. Servir el valor del preview haría
 * que el campo se reescribiera a sí mismo con su propio resultado.
 */
const NumberRow = ({
  ctx,
  fieldId,
  label,
  base,
}: {
  ctx: FieldContext;
  fieldId: DatasheetFieldId;
  label: string;
  base: number | undefined;
}) => {
  const field = datasheetField(fieldId);
  const pending = ctx.draftText(fieldId);
  const value = pending !== undefined
    ? pending
    : base === undefined
      ? ''
      : serializeInspectorNumber(field.quantity ? toDisplay(base, ctx.units, field.quantity) : base);

  return <UnitField
    label={label}
    unit={field.quantity ? unitLabel(ctx.units, field.quantity) : field.unit ?? ''}
    value={value}
    error={errorFor(ctx, fieldId)}
    onValueChange={(raw) => ctx.onStage(fieldId, raw)}
  />;
};

const OptionSelect = ({
  ctx,
  fieldId,
  label,
  current,
}: {
  ctx: FieldContext;
  fieldId: DatasheetFieldId;
  label: string;
  current: string;
}) => {
  const options = datasheetFieldOptions(datasheetField(fieldId), ctx.previewProject, ctx.language, ctx.t);
  const groups = [...new Set(options.map((option) => option.group))];
  return <Select
    label={label}
    value={ctx.draftText(fieldId) ?? current}
    error={errorFor(ctx, fieldId)}
    onChange={(event) => ctx.onStage(fieldId, event.target.value)}
  >
    {groups.map((group) => {
      const inGroup = options.filter((option) => option.group === group);
      if (group === undefined) {
        return inGroup.map((option) => <option key={option.value} value={option.value}>{option.label}</option>);
      }
      return <optgroup key={group} label={group}>
        {inGroup.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </optgroup>;
    })}
  </Select>;
};

const CheckRow = ({
  ctx,
  fieldId,
  label,
  checked,
}: {
  ctx: FieldContext;
  fieldId: DatasheetFieldId;
  label: string;
  checked: boolean;
}) => <label className="datasheet-check">
  <input
    type="checkbox"
    checked={checked}
    onChange={(event) => ctx.onStage(fieldId, event.target.checked ? 'true' : 'false')}
  />
  {label}
</label>;

const Card = ({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof MapPin;
  title: string;
  children: ReactNode;
}) => <Surface as="section" level="raised" className="datasheet-card" aria-label={title}>
  <h3 className="datasheet-card__title"><Icon size={16} aria-hidden="true" />{title}</h3>
  {children}
</Surface>;

const Facts = ({ items }: { items: ReadonlyArray<{ label: string; value: string }> }) =>
  <dl className="datasheet-facts">
    {items.map((item) => <div key={item.label}>
      <dt>{item.label}</dt>
      <dd>{item.value}</dd>
    </div>)}
  </dl>;

/** Transición explícita del valor: sin ella un preview no dice qué cambió. */
const BeforeAfter = ({ before, after, t }: { before: string; after: string; t: Translate }) =>
  before === after
    ? null
    : <p className="datasheet-transition">
      <span><small>{t('datasheet.field.before')}</small>{before}</span>
      <span><small>{t('datasheet.field.after')}</small>{after}</span>
    </p>;

/** Glifo de apoyo con la misma convención de dibujo que el preview del Inspector. */
const SupportGlyph = ({ support }: { support: NodeModel['support'] }) => {
  if (support.type === 'none') return null;
  const x = 40;
  const y = 26;
  if (support.type === 'fixed') {
    return <g className="datasheet-support-glyph">
      <line x1={x - 16} y1={y + 9} x2={x + 16} y2={y + 9} />
      {[-12, -5, 2, 9].map((offset) => <line key={offset} x1={x + offset} y1={y + 9} x2={x + offset - 6} y2={y + 16} />)}
    </g>;
  }
  return <g className="datasheet-support-glyph">
    <polygon points={`${x},${y} ${x - 12},${y + 16} ${x + 12},${y + 16}`} />
    <line x1={x - 15} y1={y + 16} x2={x + 15} y2={y + 16} />
    {support.type === 'roller'
      ? <>
        <circle cx={x - 6} cy={y + 20} r="3.2" />
        <circle cx={x + 6} cy={y + 20} r="3.2" />
      </>
      : [-9, -2, 5].map((offset) => <line key={offset} x1={x + offset} y1={y + 16} x2={x + offset - 6} y2={y + 23} />)}
  </g>;
};

/**
 * Vecindad del nudo, dibujada del preview, con el fantasma de la posición
 * anterior. El encuadre se calcula sobre la vecindad **y sobre las dos
 * posiciones**, para que mover un nudo no lo saque del recuadro que debe
 * mostrarlo.
 */
const NodeNeighborhood = ({
  project,
  node,
  previous,
}: {
  project: ProjectModel;
  node: NodeModel;
  previous: { x: number; y: number } | null;
}) => {
  const geometry = useMemo(() => {
    const nodeById = new Map(project.nodes.map((item) => [item.id, item]));
    const edges = project.members
      .filter((member) => member.i === node.id || member.j === node.id)
      .map((member) => nodeById.get(member.i === node.id ? member.j : member.i))
      .filter((item): item is NodeModel => item !== undefined);
    const points = [node, ...edges, ...(previous ? [previous] : [])];
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    const spanX = Math.max(Math.max(...xs) - Math.min(...xs), 1e-6);
    const spanY = Math.max(Math.max(...ys) - Math.min(...ys), 1e-6);
    const scale = Math.min(
      (NODE_VIEW.width - NODE_VIEW.padding * 2) / spanX,
      (NODE_VIEW.height - NODE_VIEW.padding * 2) / spanY,
    );
    const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
    const centerY = (Math.min(...ys) + Math.max(...ys)) / 2;
    const toScreen = (point: { x: number; y: number }) => ({
      x: NODE_VIEW.width / 2 + (point.x - centerX) * scale,
      // Y del modelo hacia arriba, Y del SVG hacia abajo.
      y: NODE_VIEW.height / 2 - (point.y - centerY) * scale,
    });
    return {
      edges: edges.map(toScreen),
      center: toScreen(node),
      ghost: previous ? toScreen(previous) : null,
    };
  }, [node, previous, project.members, project.nodes]);

  return <svg
    className="datasheet-node-preview"
    data-testid="datasheet-node-preview"
    viewBox={`0 0 ${NODE_VIEW.width} ${NODE_VIEW.height}`}
    role="presentation"
  >
    {geometry.edges.map((point, index) => <line
      key={index}
      className="datasheet-node-preview__member"
      x1={geometry.center.x}
      y1={geometry.center.y}
      x2={point.x}
      y2={point.y}
    />)}
    {geometry.ghost ? <circle
      className="datasheet-node-preview__ghost"
      data-testid="datasheet-node-preview-ghost"
      cx={geometry.ghost.x}
      cy={geometry.ghost.y}
      r="4.5"
    /> : null}
    <circle
      className="datasheet-node-preview__node"
      cx={geometry.center.x}
      cy={geometry.center.y}
      r="4.5"
    />
  </svg>;
};

/**
 * Cargas que llegan al objeto enfocado, de sólo lectura.
 *
 * Se editan en su propia pestaña, donde cada una es una fila con sus campos.
 * Duplicar aquí sus editores obligaría a decidir cuál de las dos superficies
 * manda; enseñarlas y decir dónde se editan conserva la información que daba la
 * fase de auditoría sin abrir una segunda ruta de escritura.
 */
const AttachedLoads = ({
  ctx,
  nodalLoads,
  memberLoads,
}: {
  ctx: FieldContext;
  nodalLoads: readonly NodalLoad[];
  memberLoads: readonly MemberLoad[];
}) => {
  const { t, units, previewProject } = ctx;
  const caseName = (caseId: string) =>
    previewProject.loadCases.find((item) => item.id === caseId)?.name ?? caseId;
  const total = nodalLoads.length + memberLoads.length;

  return <Card icon={Weight} title={t('datasheet.card.load')}>
    {total === 0
      ? <p className="datasheet-card__empty">{t('datasheet.card.noLoads')}</p>
      : <>
        <ul className="datasheet-load-list">
          {nodalLoads.map((load) => <li key={load.id}>
            <span className="datasheet-load-list__case">{caseName(load.caseId)}</span>
            <span>{`Fx ${formatDatasheetNumber(load.fx, units, 'force')} · Fy ${formatDatasheetNumber(load.fy, units, 'force')} · Mz ${formatDatasheetNumber(load.mz, units, 'moment')}`}</span>
          </li>)}
          {memberLoads.map((load) => <li key={load.id}>
            <span className="datasheet-load-list__case">{caseName(load.caseId)}</span>
            <span>{describeMemberLoad(load, units)}</span>
          </li>)}
        </ul>
        <p className="datasheet-card__note">{t('datasheet.card.loadsEditedInTab')}</p>
      </>}
  </Card>;
};

/** Resumen de una carga de barra en su propia familia; nada de campos ajenos. */
const describeMemberLoad = (load: MemberLoad, units: UnitSystemId): string => {
  if (load.type === 'moment') {
    return `M ${formatDatasheetNumber(load.moment ?? 0, units, 'moment')} ${unitLabel(units, 'moment')}`;
  }
  if (load.type === 'point') {
    const px = formatDatasheetNumber(load.px ?? 0, units, 'force');
    const py = formatDatasheetNumber(load.py ?? 0, units, 'force');
    return `Px ${px} · Py ${py} ${unitLabel(units, 'force')}`;
  }
  const start = formatDatasheetNumber(load.qyStart ?? 0, units, 'distributedForce');
  const end = formatDatasheetNumber(load.qyEnd ?? load.qyStart ?? 0, units, 'distributedForce');
  return `q ${start} → ${end} ${unitLabel(units, 'distributedForce')}`;
};

const NodeCards = ({
  ctx,
  node,
  sourceNode,
  previewProject,
}: {
  ctx: FieldContext;
  node: NodeModel;
  sourceNode: NodeModel;
  previewProject: ProjectModel;
}) => {
  const { t, units } = ctx;
  const moved = sourceNode.x !== node.x || sourceNode.y !== node.y;

  return <>
    <Card icon={MapPin} title={t('datasheet.card.node')}>
      <NodeNeighborhood project={previewProject} node={node} previous={moved ? sourceNode : null} />
      <div className="datasheet-field-grid">
        <NumberRow ctx={ctx} fieldId="node.x" label={`X (${unitLabel(units, 'length')})`} base={sourceNode.x} />
        <NumberRow ctx={ctx} fieldId="node.y" label={`Y (${unitLabel(units, 'length')})`} base={sourceNode.y} />
      </div>
      <CheckRow
        ctx={ctx}
        fieldId="node.internalHinge"
        label={t('datasheet.column.hinge')}
        checked={node.internalHinge === true}
      />
    </Card>

    <Card icon={Anchor} title={t('datasheet.card.support')}>
      <svg
        className="datasheet-support-preview"
        data-testid="datasheet-support-preview"
        data-support={node.support.type}
        viewBox="0 0 80 60"
        role="presentation"
      >
        <circle className="datasheet-node-preview__node" cx="40" cy="26" r="4" />
        <SupportGlyph support={node.support} />
      </svg>
      <OptionSelect
        ctx={ctx}
        fieldId="node.support.type"
        label={t('datasheet.column.support')}
        current={sourceNode.support.type}
      />
      {node.support.type === 'roller' ? <NumberRow
        ctx={ctx}
        fieldId="node.support.angleDeg"
        label={t('datasheet.field.normalAngle')}
        base={sourceNode.support.angleDeg ?? 90}
      /> : null}
      {node.support.type === 'custom' ? <fieldset className="datasheet-checks">
        <legend>{t('datasheet.column.restraints')}</legend>
        <CheckRow ctx={ctx} fieldId="node.support.restrainX" label="X" checked={node.support.restrainX === true} />
        <CheckRow ctx={ctx} fieldId="node.support.restrainY" label="Y" checked={node.support.restrainY === true} />
        <CheckRow ctx={ctx} fieldId="node.support.restrainR" label="Rz" checked={node.support.restrainR === true} />
      </fieldset> : null}
    </Card>

    <AttachedLoads
      ctx={ctx}
      nodalLoads={previewProject.nodalLoads.filter((load) => load.nodeId === node.id)}
      memberLoads={[]}
    />
  </>;
};

/**
 * Material: los dos modos que el modelo ya distingue, hechos visibles.
 *
 * **Catálogo** fija la identidad y sus números juntos, igual que hace
 * `member.material.apply`. **Personalizado** edita E, G y ρ directamente, lo que
 * degrada el origen a `custom`. La regla existe en el modelo desde siempre; el
 * editor la enseña en vez de dejar que ocurra de lado.
 *
 * El modo es estado de la interfaz, no del modelo: elegirlo no escribe nada. Lo
 * que escribe es elegir un material o teclear un número.
 */
const MaterialCard = ({
  ctx,
  member,
  sourceMember,
}: {
  ctx: FieldContext;
  member: MemberModel;
  sourceMember: MemberModel;
}) => {
  const { t, units } = ctx;
  const [mode, setMode] = useState<'catalog' | 'custom'>(
    member.materialOrigin === 'catalog' ? 'catalog' : 'custom',
  );

  const name = (candidate: MemberModel) => candidate.materialOrigin === 'catalog' && candidate.materialId
    ? findStandardMaterial(candidate.materialId)?.name ?? candidate.materialId
    : t('datasheet.origin.custom');

  return <Card icon={Layers} title={t('datasheet.card.material')}>
    <div className="datasheet-mode" role="radiogroup" aria-label={t('datasheet.material.mode')}>
      {([['catalog', t('datasheet.material.catalog')], ['custom', t('datasheet.material.custom')]] as const)
        .map(([candidate, label]) => <button
          key={candidate}
          type="button"
          role="radio"
          aria-checked={mode === candidate}
          className={mode === candidate ? 'active' : ''}
          onClick={() => setMode(candidate)}
        >{label}</button>)}
    </div>

    <BeforeAfter before={name(sourceMember)} after={name(member)} t={t} />

    {mode === 'catalog'
      ? <OptionSelect
        ctx={ctx}
        fieldId="member.materialId"
        label={t('datasheet.column.material')}
        current={sourceMember.materialId ?? ''}
      />
      : <div className="datasheet-field-grid">
        <NumberRow ctx={ctx} fieldId="member.E" label={`E (${unitLabel(units, 'elasticModulus')})`} base={sourceMember.E} />
        <NumberRow ctx={ctx} fieldId="member.G" label={`G (${unitLabel(units, 'elasticModulus')})`} base={sourceMember.G} />
        <NumberRow ctx={ctx} fieldId="member.density" label={`ρ (${unitLabel(units, 'density')})`} base={sourceMember.density} />
      </div>}

    <p className="datasheet-card__note">{t('datasheet.material.originHint')}</p>
  </Card>;
};

const MemberCards = ({
  ctx,
  member,
  sourceMember,
}: {
  ctx: FieldContext;
  member: MemberModel;
  sourceMember: MemberModel;
}) => {
  const { t, units } = ctx;
  const sectionChanged = sourceMember.sectionId !== member.sectionId
    || sourceMember.A !== member.A
    || sourceMember.I !== member.I;

  return <>
    {/* La clave reinicia el modo al cambiar de barra: es estado de la
        interfaz y no puede arrastrarse de un miembro al siguiente. */}
    <MaterialCard key={sourceMember.id} ctx={ctx} member={member} sourceMember={sourceMember} />

    <Card icon={Box} title={t('datasheet.card.section')}>
      <div className="datasheet-section-pair">
        {sectionChanged ? <>
          <div>
            <small>{t('datasheet.field.before')}</small>
            <SectionViewer2D
              area={sourceMember.A}
              inertia={sourceMember.I}
              sectionId={sourceMember.sectionId}
              sectionOrigin={sourceMember.sectionOrigin}
              units={units}
            />
          </div>
          <div>
            <small>{t('datasheet.field.after')}</small>
            <SectionViewer2D
              area={member.A}
              inertia={member.I}
              sectionId={member.sectionId}
              sectionOrigin={member.sectionOrigin}
              units={units}
            />
          </div>
        </> : <div>
          {/* Sin cambio preparado se dibuja una vez: repetir la misma imagen
              sugeriría una diferencia que no existe. */}
          <SectionViewer2D
            area={member.A}
            inertia={member.I}
            sectionId={member.sectionId}
            sectionOrigin={member.sectionOrigin}
            units={units}
          />
        </div>}
      </div>
      <OptionSelect
        ctx={ctx}
        fieldId="member.sectionId"
        label={t('datasheet.column.section')}
        current={sourceMember.sectionId ?? ''}
      />
      <div className="datasheet-field-grid">
        <NumberRow ctx={ctx} fieldId="member.A" label={`A (${unitLabel(units, 'area')})`} base={sourceMember.A} />
        <NumberRow ctx={ctx} fieldId="member.I" label={`I (${unitLabel(units, 'inertia')})`} base={sourceMember.I} />
      </div>
    </Card>

    <Card icon={Scissors} title={t('datasheet.card.releases')}>
      {member.type === 'frame'
        ? <fieldset className="datasheet-checks">
          <legend>{t('datasheet.column.releases')}</legend>
          <CheckRow
            ctx={ctx}
            fieldId="member.releases.iMoment"
            label={t('datasheet.field.releaseI')}
            checked={member.releases?.iMoment === true}
          />
          <CheckRow
            ctx={ctx}
            fieldId="member.releases.jMoment"
            label={t('datasheet.field.releaseJ')}
            checked={member.releases?.jMoment === true}
          />
        </fieldset>
        // Las liberaciones son propias del pórtico: ofrecerlas en una armadura
        // prometería una escritura que el modelo rechaza.
        : <p className="datasheet-card__empty">{t('datasheet.releases.frameOnly')}</p>}
    </Card>

    <AttachedLoads
      ctx={ctx}
      nodalLoads={[]}
      memberLoads={ctx.previewProject.memberLoads.filter((load) => load.memberId === member.id)}
    />
  </>;
};

/**
 * Carga: la flecha **es** la carga, no un adorno. Su sentido sale del signo del
 * valor del preview, así que editar el número la gira sin ninguna lógica de
 * preview aparte.
 */
const LoadCard = ({
  ctx,
  nodalLoad,
  memberLoad,
}: {
  ctx: FieldContext;
  nodalLoad: NodalLoad | undefined;
  memberLoad: MemberLoad | undefined;
}) => {
  const { t, units } = ctx;
  const vertical = nodalLoad
    ? nodalLoad.fy
    : memberLoad?.type === 'distributed'
      ? memberLoad.qyStart ?? 0
      : memberLoad?.type === 'point'
        ? memberLoad.py ?? 0
        : memberLoad?.moment ?? 0;
  const direction = vertical > 0 ? 'up' : vertical < 0 ? 'down' : 'none';
  const forceUnit = unitLabel(units, 'force');

  return <Card icon={Weight} title={t('datasheet.card.load')}>
    <svg
      className="datasheet-load-preview"
      data-testid="datasheet-load-preview"
      data-direction={direction}
      viewBox="0 0 80 60"
      role="presentation"
    >
      <line className="datasheet-load-preview__base" x1="10" y1="46" x2="70" y2="46" />
      {direction === 'none' ? null : <g
        className="datasheet-load-preview__arrow"
        transform={direction === 'up' ? undefined : 'rotate(180 40 27)'}
      >
        <line x1="40" y1="44" x2="40" y2="14" />
        <polygon points="40,8 34,20 46,20" />
      </g>}
    </svg>

    {nodalLoad ? <>
      <div className="datasheet-field-grid">
        <NumberRow ctx={ctx} fieldId="nodalLoad.fx" label={`Fx (${forceUnit})`} base={nodalLoad.fx} />
        <NumberRow ctx={ctx} fieldId="nodalLoad.fy" label={`Fy (${forceUnit})`} base={nodalLoad.fy} />
        <NumberRow ctx={ctx} fieldId="nodalLoad.mz" label={`Mz (${unitLabel(units, 'moment')})`} base={nodalLoad.mz} />
      </div>
      <OptionSelect
        ctx={ctx}
        fieldId="nodalLoad.caseId"
        label={t('datasheet.column.loadCase')}
        current={nodalLoad.caseId}
      />
    </> : null}

    {memberLoad ? <>
      {memberLoad.type === 'distributed' ? <div className="datasheet-field-grid">
        <NumberRow
          ctx={ctx}
          fieldId="memberLoad.qyStart"
          label={`qy ${t('datasheet.column.start')} (${unitLabel(units, 'distributedForce')})`}
          base={memberLoad.qyStart}
        />
        <NumberRow
          ctx={ctx}
          fieldId="memberLoad.qyEnd"
          label={`qy ${t('datasheet.column.end')} (${unitLabel(units, 'distributedForce')})`}
          base={memberLoad.qyEnd}
        />
      </div> : null}
      {memberLoad.type === 'point' ? <div className="datasheet-field-grid">
        <NumberRow ctx={ctx} fieldId="memberLoad.px" label={`Px (${forceUnit})`} base={memberLoad.px} />
        <NumberRow ctx={ctx} fieldId="memberLoad.py" label={`Py (${forceUnit})`} base={memberLoad.py} />
      </div> : null}
      {memberLoad.type === 'moment' ? <NumberRow
        ctx={ctx}
        fieldId="memberLoad.moment"
        label={`M (${unitLabel(units, 'moment')})`}
        base={memberLoad.moment}
      /> : null}
      <OptionSelect
        ctx={ctx}
        fieldId="memberLoad.caseId"
        label={t('datasheet.column.loadCase')}
        current={memberLoad.caseId}
      />
      <Facts items={[{
        label: t('datasheet.column.loadFamily'),
        value: t(`datasheet.loadFamily.${memberLoad.type}` as TranslationKey),
      }]} />
    </> : null}
  </Card>;
};

export interface DatasheetEditorPanelProps {
  /** Modelo real; sólo lo lee el lado «Antes» de cada transición. */
  project: ProjectModel;
  /** Modelo con el plan aplicado; es el que dibujan todos los previews. */
  previewProject: ProjectModel;
  target: { kind: DatasheetRowKind; id: string } | null;
  units: UnitSystemId;
  language: Language;
  t: Translate;
  draftText: (fieldId: DatasheetFieldId) => string | undefined;
  onStage: (fieldId: DatasheetFieldId, raw: string) => void;
  pendingCount: number;
  planApplicable: boolean;
  planErrors: readonly DatasheetEditError[];
  onApply: () => void;
  onCancelDraft: () => void;
  onFocusObject: () => void;
  focusLabel: string;
}

export const DatasheetEditorPanel = ({
  project,
  previewProject,
  target,
  units,
  language,
  t,
  draftText,
  onStage,
  pendingCount,
  planApplicable,
  planErrors,
  onApply,
  onCancelDraft,
  onFocusObject,
  focusLabel,
}: DatasheetEditorPanelProps) => {
  const byId = <T extends { id: string }>(items: readonly T[]): T | undefined =>
    target ? items.find((item) => item.id === target.id) : undefined;

  const node = target?.kind === 'node' ? byId(previewProject.nodes) : undefined;
  const sourceNode = target?.kind === 'node' ? byId(project.nodes) : undefined;
  const member = target?.kind === 'member' ? byId(previewProject.members) : undefined;
  const sourceMember = target?.kind === 'member' ? byId(project.members) : undefined;
  const nodalLoad = target?.kind === 'nodalLoad' ? byId(previewProject.nodalLoads) : undefined;
  const memberLoad = target?.kind === 'memberLoad' ? byId(previewProject.memberLoads) : undefined;

  const ctx: FieldContext = {
    rowId: target?.id ?? '',
    units,
    language,
    t,
    previewProject,
    draftText,
    onStage,
    errors: planErrors,
  };

  const hasCards = Boolean(node || member || nodalLoad || memberLoad);

  return <aside className="datasheet-context" aria-label={t('datasheet.contextLabel')}>
    <header className="datasheet-context__header">
      <p className="datasheet-context__object">{target?.id ?? '—'}</p>
      <button type="button" className="datasheet-focus-action" onClick={onFocusObject} disabled={!target}>
        {focusLabel}
      </button>
    </header>

    <div className="datasheet-context__body">
      {node && sourceNode
        ? <NodeCards ctx={ctx} node={node} sourceNode={sourceNode} previewProject={previewProject} />
        : null}
      {member && sourceMember
        ? <MemberCards ctx={ctx} member={member} sourceMember={sourceMember} />
        : null}
      {nodalLoad || memberLoad
        ? <LoadCard ctx={ctx} nodalLoad={nodalLoad} memberLoad={memberLoad} />
        : null}
      {hasCards ? null : <p className="datasheet-card__empty">{t('datasheet.contextEmpty')}</p>}
    </div>

    {pendingCount > 0 ? <footer className="datasheet-draft-bar">
      <p role="status">
        {pendingCount === 1
          ? t('datasheet.draft.countOne')
          : t('datasheet.draft.count', { count: pendingCount })}
      </p>
      <Button variant="ghost" onClick={onCancelDraft}>{t('datasheet.draft.cancel')}</Button>
      <Button variant="primary" disabled={!planApplicable} onClick={onApply}>
        {t('datasheet.draft.apply')}
      </Button>
    </footer> : null}
  </aside>;
};

export default DatasheetEditorPanel;
