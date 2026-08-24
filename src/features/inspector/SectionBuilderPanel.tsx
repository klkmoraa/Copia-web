import { useMemo, useState } from 'react';
import { buildSection, type SectionProperties } from '../../data/sectionBuilder';
import type { StandardSection } from '../../data/standardSections';
import { Button } from '../../design-system/components/controls';
import { toDisplay, unitLabel } from '../../engine/units';
import type { TranslationKey } from '../../i18n/catalogs';
import { useI18n } from '../../i18n/useI18n';
import type { UnitSystemId } from '../../types';
import { InspectorDerivedList, InspectorHelper, PhysicalNumberField } from './InspectorPrimitives';
import { formatInspectorValue } from './numericFormatting';
import { SectionShape } from './SectionShape';
import { sectionShapeLayout } from './sectionGeometry';
import {
  DEFAULT_SECTION_DIMENSIONS,
  SECTION_BUILDER_KINDS,
  SECTION_DIMENSION_KEYS,
  SECTION_SHAPE_TYPE_OF_KIND,
  previewGeometryOf,
  sectionBuilderIssue,
  seedFromStandardSection,
  shapeFromDimensions,
  type SectionBuilderIssue,
  type SectionBuilderKind,
  type SectionDimensionKey,
  type SectionDimensions,
} from './sectionBuilderForm';

/**
 * Constructor de secciones dentro del Inspector.
 *
 * Cierra el hueco entre las dos únicas formas que había de dar una sección a un
 * miembro: elegir una del catálogo, o escribir A e I a mano. Lo de en medio
 * —«un cajón de 300×200 y 8 mm»— no tenía sitio, y calcularlo aparte para
 * teclear dos números es exactamente donde se cuela un error de exponente.
 *
 * ## Lo que este panel escribe, y lo que no
 *
 * Escribe **A e I**, que son las dos entradas que el solver usa, mediante la
 * misma edición genérica que un valor tecleado. Eso degrada la identidad del
 * miembro a «personalizada», y así debe ser: una sección descrita aquí no es un
 * perfil del catálogo, y fingir que lo es rompería la regla de identidad que
 * sostiene el dibujo de la sección y la memoria.
 *
 * **No guarda la descripción.** El modelo no tiene dónde ponerla, y darle sitio
 * es tocar el tipo del miembro, la persistencia, el diff y la memoria: su
 * propia tanda. La consecuencia se dice en voz alta en el panel en vez de
 * dejarla como sorpresa — tras aplicar, el visor vuelve a la rectangular
 * equivalente, porque A e I es todo lo que queda escrito.
 *
 * ## Por qué el eje se elige
 *
 * `MemberModel.I` es la inercia respecto del eje de flexión del plano, y el
 * catálogo aplica siempre la fuerte. Una columna montada con el alma en el otro
 * sentido flecta con Iy, y hasta ahora la única manera de decirlo era teclear el
 * número. Las dos inercias se enseñan y una de las dos se aplica; cuál, lo dice
 * la persona.
 */

const KIND_LABEL_KEYS: Readonly<Record<SectionBuilderKind, TranslationKey>> = {
  'i-shape': 'inspector.sectionBuilderKindIShape',
  channel: 'inspector.sectionBuilderKindChannel',
  box: 'inspector.sectionBuilderKindBox',
  tube: 'inspector.sectionBuilderKindTube',
  angle: 'inspector.sectionBuilderKindAngle',
  rectangle: 'inspector.sectionBuilderKindRectangle',
};

const DIMENSION_LABEL_KEYS: Readonly<Record<SectionDimensionKey, TranslationKey>> = {
  depth: 'inspector.sectionBuilderDepth',
  width: 'inspector.sectionBuilderWidth',
  webThickness: 'inspector.sectionBuilderWebThickness',
  flangeThickness: 'inspector.sectionBuilderFlangeThickness',
  thickness: 'inspector.sectionBuilderThickness',
  outerDiameter: 'inspector.sectionBuilderOuterDiameter',
};

/** El angular no tiene canto ni ancho sino dos alas; sus dos cotas se renombran. */
const ANGLE_LABEL_KEYS: Partial<Record<SectionDimensionKey, TranslationKey>> = {
  depth: 'inspector.sectionBuilderVerticalLeg',
  width: 'inspector.sectionBuilderHorizontalLeg',
};

const ISSUE_KEYS: Readonly<Record<SectionBuilderIssue, TranslationKey>> = {
  'non-positive': 'inspector.sectionBuilderIssueNonPositive',
  'flanges-consume-depth': 'inspector.sectionBuilderIssueFlanges',
  'web-wider-than-flange': 'inspector.sectionBuilderIssueWeb',
  'thickness-consumes-leg': 'inspector.sectionBuilderIssueLeg',
  'thickness-closes-hole': 'inspector.sectionBuilderIssueHole',
  'thickness-closes-tube': 'inspector.sectionBuilderIssueTube',
};

const PREVIEW_BOX = { width: 148, height: 120, padding: 12 };

export interface SectionBuilderPanelProps {
  units: UnitSystemId;
  /** Perfil con el que el miembro está identificado hoy, si lo está. */
  seedSection?: StandardSection;
  /** A e I actuales del miembro, para enseñar contra qué se compara. */
  currentArea: number;
  currentInertia: number;
  disabled?: boolean;
  onApply: (properties: { A: number; I: number }) => void;
}

export const SectionBuilderPanel = ({
  units,
  seedSection,
  currentArea,
  currentInertia,
  disabled = false,
  onApply,
}: SectionBuilderPanelProps) => {
  const { t } = useI18n();
  const [form, setForm] = useState<{ kind: SectionBuilderKind; dimensions: SectionDimensions }>(
    () => seedSection ? seedFromStandardSection(seedSection) : { kind: 'i-shape', dimensions: DEFAULT_SECTION_DIMENSIONS },
  );
  const [seedId, setSeedId] = useState(seedSection?.id);
  const [axis, setAxis] = useState<'x' | 'y'>('x');

  /* Elegir otro perfil en el selector de arriba rearranca el formulario desde
     ese perfil: es la misma intención —«quiero partir de éste»— expresada un
     campo más arriba. Se ajusta en el render y no en un efecto porque no hay
     nada externo que sincronizar, sólo un estado derivado de una prop que
     cambió. Aplicar NO rearranca: al aplicar, la identidad de catálogo
     desaparece y `seedSection` pasa a `undefined`, que esta condición ignora. */
  if (seedSection && seedSection.id !== seedId) {
    setSeedId(seedSection.id);
    setForm(seedFromStandardSection(seedSection));
  }

  const { kind, dimensions } = form;
  const shape = useMemo(() => shapeFromDimensions(kind, dimensions), [kind, dimensions]);

  /* La autoridad es `buildSection`: si se niega, no se aplica nada, dé la
     opinión que dé la enumeración de motivos. El motivo sólo elige la frase. */
  const properties = useMemo<SectionProperties | null>(() => {
    try { return buildSection(shape); } catch { return null; }
  }, [shape]);
  const issue: SectionBuilderIssue | undefined = sectionBuilderIssue(shape) ?? (properties ? undefined : 'non-positive');

  const geometry = previewGeometryOf(kind, dimensions);
  const layout = sectionShapeLayout(geometry, PREVIEW_BOX);

  const dimensionUnit = unitLabel(units, 'sectionDimension');
  const showDimension = (value: number) =>
    formatInspectorValue(toDisplay(value, units, 'sectionDimension'), dimensionUnit);
  const showArea = (value: number) => formatInspectorValue(toDisplay(value, units, 'area'), unitLabel(units, 'area'));
  const showInertia = (value: number) => formatInspectorValue(toDisplay(value, units, 'inertia'), unitLabel(units, 'inertia'));
  const showModulus = (value: number) =>
    formatInspectorValue(toDisplay(value, units, 'sectionModulus'), unitLabel(units, 'sectionModulus'));

  const appliedInertia = properties ? (axis === 'x' ? properties.inertiaX : properties.inertiaY) : 0;

  /* Tras aplicar, lo descrito y lo que el miembro tiene son la misma cosa. Una
     flecha entre dos números idénticos no informa de nada y sugiere un cambio
     que no existe; en ese estado el panel dice que ya está aplicada y no
     ofrece volver a aplicarla. */
  const matchesMember = Boolean(properties)
    && Object.is(currentArea, properties?.area)
    && Object.is(currentInertia, appliedInertia);

  const setDimension = (key: SectionDimensionKey, value: number) =>
    setForm((current) => ({ ...current, dimensions: { ...current.dimensions, [key]: value } }));

  /* Sin `aria-label` propio: dentro del Inspector este panel vive en un
     plegable cuyo cuerpo ya es una región etiquetada por su disparador.
     Repetir el nombre publicaba dos regiones anidadas con el mismo título, que
     es exactamente el ruido que un lector de pantalla no necesita. */
  return <section className="section-builder">
    <p className="section-builder__intro">{t('inspector.sectionBuilderIntro')}</p>

    <label className="select-field">
      <span>{t('inspector.sectionBuilderShape')}</span>
      <select
        value={kind}
        disabled={disabled}
        onChange={(event) => setForm((current) => ({ ...current, kind: event.target.value as SectionBuilderKind }))}
      >
        {SECTION_BUILDER_KINDS.map((candidate) => (
          <option key={candidate} value={candidate}>{t(KIND_LABEL_KEYS[candidate])}</option>
        ))}
      </select>
    </label>

    <div className="section-builder__body">
      <div className="section-builder__fields">
        {SECTION_DIMENSION_KEYS[kind].map((key) => (
          <PhysicalNumberField
            key={key}
            label={t((kind === 'angle' ? ANGLE_LABEL_KEYS[key] : undefined) ?? DIMENSION_LABEL_KEYS[key])}
            value={dimensions[key]}
            units={units}
            quantity="sectionDimension"
            resetKey={`section-builder:${kind}:${key}`}
            disabled={disabled}
            onCommit={(value) => setDimension(key, value)}
          />
        ))}
      </div>
      <figure className="section-builder__preview">
        <svg
          viewBox={`0 0 ${PREVIEW_BOX.width} ${PREVIEW_BOX.height}`}
          width={PREVIEW_BOX.width}
          height={PREVIEW_BOX.height}
          role="img"
          aria-label={t('inspector.sectionBuilderPreview')}
          data-shape={SECTION_SHAPE_TYPE_OF_KIND[kind]}
        >
          <SectionShape shapeType={SECTION_SHAPE_TYPE_OF_KIND[kind]} layout={layout} />
        </svg>
        <figcaption>{showDimension(geometry.depth)} × {showDimension(geometry.width)}</figcaption>
      </figure>
    </div>

    {issue ? <p className="section-builder__issue" role="alert">{t(ISSUE_KEYS[issue])}</p> : null}

    {properties ? <>
      <InspectorDerivedList rows={[
        { label: 'A', value: showArea(properties.area) },
        { label: 'Ix', value: showInertia(properties.inertiaX) },
        { label: 'Iy', value: showInertia(properties.inertiaY) },
        { label: 'Wx', value: showModulus(properties.sectionModulusX), description: t('inspector.sectionBuilderElasticModulus') },
        { label: 'Zx', value: showModulus(properties.plasticModulusX), description: t('inspector.sectionBuilderPlasticModulus') },
        { label: 'rx', value: showDimension(properties.radiusOfGyrationX) },
        { label: 'ry', value: showDimension(properties.radiusOfGyrationY) },
      ]} />

      <label className="select-field">
        <span>{t('inspector.sectionBuilderAxis')}<small>{t('inspector.sectionBuilderAxisHint')}</small></span>
        <select value={axis} disabled={disabled} onChange={(event) => setAxis(event.target.value as 'x' | 'y')}>
          <option value="x">{t('inspector.sectionBuilderAxisStrong')}</option>
          <option value="y">{t('inspector.sectionBuilderAxisWeak')}</option>
        </select>
      </label>

      <p className="section-builder__delta">
        {matchesMember ? t('inspector.sectionBuilderAlreadyApplied') : <>
          {`A ${showArea(currentArea)} → ${showArea(properties.area)}`}
          <span aria-hidden="true"> · </span>
          {`I ${showInertia(currentInertia)} → ${showInertia(appliedInertia)}`}
        </>}
      </p>
    </> : null}

    <Button
      variant="primary"
      size="sm"
      fullWidth
      className="section-builder__apply"
      disabled={disabled || !properties || matchesMember}
      onClick={() => { if (properties) onApply({ A: properties.area, I: appliedInertia }); }}
    >
      {t('inspector.sectionBuilderApply')}
    </Button>

    <InspectorHelper>{t('inspector.sectionBuilderIdentityNote')}</InspectorHelper>
  </section>;
};
