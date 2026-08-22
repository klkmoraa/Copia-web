import { ArrowRight } from 'lucide-react';
import { findStandardSection } from '../../data/standardSections';
import { toDisplay, unitLabel } from '../../engine/units';
import type { Language } from '../../i18n/catalogs';
import type { UnitSystemId } from '../../types';
import { formatFixed } from '../../utils/numberFormat';
import { SectionShape } from '../inspector/SectionShape';
import { resolveSectionGeometry, sectionShapeLayout, type SectionGeometry } from '../inspector/sectionGeometry';
import { createBulkEditTranslator, type BulkEditTranslate } from './bulkEditCopy';
import { bulkSectionLabel } from './bulkEditPresentation';
import type { BulkSectionPreviewModel, BulkSectionSource } from './bulkSectionPreviewModel';

/**
 * Vista previa ACTUAL → OBJETIVO de la sección.
 *
 * Reutiliza la geometría y el lenguaje visual del visor del Inspector: la misma
 * resolución de forma (`resolveSectionGeometry`), el mismo contorno
 * (`SectionShape`) y las mismas clases de la tarjeta `section-viewer`.
 *
 * Sólo dibuja una forma real cuando hay identidad de catálogo. Una sección
 * equivalente se rotula como equivalente, y una selección con secciones
 * distintas se muestra como «Varios» en vez de elegir una.
 */

const SVG_WIDTH = 160;
const SVG_HEIGHT = 120;
const PADDING = 24;

interface SectionSlotDescription {
  /** `null` cuando no hay forma honesta que dibujar. */
  geometry: SectionGeometry | null;
  name: string;
  detail: string;
}

/**
 * Un `switch` exhaustivo con el tipo de retorno declarado: cuando el Section
 * Builder añada la procedencia paramétrica a `BulkSectionSource`, esto deja de
 * compilar en lugar de dibujarla en silencio como «Sin sección».
 */
const describeSource = (
  source: BulkSectionSource,
  language: Language,
  t: BulkEditTranslate,
): SectionSlotDescription => {
  switch (source.kind) {
    case 'catalog': {
      const catalog = findStandardSection(source.sectionId);
      if (!catalog) return { geometry: null, name: t('preview.none'), detail: t('preview.noneHint') };
      return {
        geometry: resolveSectionGeometry({
          area: catalog.area,
          inertia: catalog.inertiaX,
          sectionId: catalog.id,
          sectionOrigin: 'catalog',
        }),
        name: bulkSectionLabel(language, catalog.id),
        detail: `${catalog.shapeType} · ${catalog.standard}`,
      };
    }
    case 'equivalent':
      return {
        geometry: resolveSectionGeometry({ area: source.area, inertia: source.inertia }),
        name: t('preview.equivalent'),
        detail: t('preview.equivalentHint'),
      };
    case 'mixed':
      return { geometry: null, name: t('preview.mixed'), detail: t('preview.mixedHint') };
    case 'none':
      return { geometry: null, name: t('preview.none'), detail: t('preview.noneHint') };
  }
};

const SectionSlot = ({
  title,
  source,
  units,
  language,
  t,
  testId,
}: {
  title: string;
  source: BulkSectionSource;
  units: UnitSystemId;
  language: Language;
  t: BulkEditTranslate;
  testId: string;
}) => {
  const { geometry, name, detail } = describeSource(source, language, t);

  return <figure className="section-viewer bulk-preview__slot" data-testid={testId} data-source={source.kind}>
    <figcaption className="bulk-preview__slot-caption">
      <small>{title}</small>
      <strong>{name}</strong>
      <span>{detail}</span>
    </figcaption>
    <div className="section-viewer-canvas bulk-preview__canvas">
      {geometry ? <svg
        viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
        role="img"
        aria-label={t('preview.shape', {
          name,
          depth: formatFixed(toDisplay(geometry.depth, units, 'length'), 3, 'inspector'),
          width: formatFixed(toDisplay(geometry.width, units, 'length'), 3, 'inspector'),
          unit: unitLabel(units, 'length'),
        })}
      >
        <SectionShape
          shapeType={geometry.shapeType}
          layout={sectionShapeLayout(geometry, { width: SVG_WIDTH, height: SVG_HEIGHT, padding: PADDING })}
        />
      </svg> : <p className="bulk-preview__placeholder" aria-hidden="true">
        {/* El pie ya nombra el estado; repetirlo aquí lo duplicaría al leerlo. */}
        ×
      </p>}
    </div>
  </figure>;
};

export const BulkSectionPreview = ({
  preview,
  units,
  language,
}: {
  preview: BulkSectionPreviewModel;
  units: UnitSystemId;
  language: Language;
}) => {
  const t = createBulkEditTranslator(language);

  // Sin cambio preparado, dos dibujos idénticos a los lados de una flecha se
  // leen como una transición que no existe: se muestra una sola sección.
  if (!preview.changed) {
    return <section className="bulk-preview is-unchanged" aria-label={t('preview.label')}>
      <SectionSlot
        testId="bulk-section-preview-current"
        title={t('preview.unchanged')}
        source={preview.current}
        units={units}
        language={language}
        t={t}
      />
    </section>;
  }

  return <section className="bulk-preview" aria-label={t('preview.label')}>
    <SectionSlot
      testId="bulk-section-preview-current"
      title={t('preview.current')}
      source={preview.current}
      units={units}
      language={language}
      t={t}
    />
    <span className="bulk-preview__arrow" aria-hidden="true"><ArrowRight size={18} /></span>
    <SectionSlot
      testId="bulk-section-preview-target"
      title={t('preview.target')}
      source={preview.target}
      units={units}
      language={language}
      t={t}
    />
  </section>;
};
