import { Dialog } from '../../design-system/components/overlays';
import { useI18n } from '../../i18n/useI18n';
import type { TranslationKey } from '../../i18n/catalogs';
import { SupportGlyph } from './SupportGlyph';
import {
  DEFAULT_ROLLER_ANGLE_DEG,
  entriesOfFamily,
  type SupportEntry,
  type SupportFamily,
} from './supportCatalog';

/**
 * La biblioteca: todo el vocabulario de apoyos de un vistazo, y dónde está el
 * límite del motor.
 *
 * POR QUÉ EXISTE SI YA HAY UN SELECTOR. El selector contesta «qué le pongo a
 * este nudo». Esta pantalla contesta otra pregunta —«qué existe, y en qué se
 * diferencia una guía de un rodillo»— y por eso enseña también lo que **no** se
 * puede aplicar: las cuatro condiciones de contacto que este motor no resuelve
 * y las dos conexiones que no son apoyos al terreno. Un catálogo que sólo
 * enseña lo disponible deja al estudiante creyendo que lo que falta no existe.
 *
 * NO ES UN SEGUNDO SELECTOR. Aquí no se pulsa nada que cambie el modelo: es
 * lectura. Duplicar la aplicación en dos superficies daría dos sitios donde
 * equivocarse sobre qué escribe cada tarjeta.
 */

const SECTIONS: readonly { family: SupportFamily; titleKey: TranslationKey; blurbKey: TranslationKey }[] = [
  { family: 'basic', titleKey: 'inspector.supportLibraryBasic', blurbKey: 'inspector.supportLibraryBasicBlurb' },
  { family: 'guided', titleKey: 'inspector.supportLibraryGuided', blurbKey: 'inspector.supportLibraryGuidedBlurb' },
  { family: 'elastic', titleKey: 'inspector.supportLibraryElastic', blurbKey: 'inspector.supportLibraryElasticBlurb' },
  { family: 'advanced', titleKey: 'inspector.supportLibraryAdvanced', blurbKey: 'inspector.supportLibraryAdvancedBlurb' },
  { family: 'connection', titleKey: 'inspector.supportLibraryConnection', blurbKey: 'inspector.supportLibraryConnectionBlurb' },
];

const LibraryCard = ({ entry }: { entry: SupportEntry }) => {
  const { t } = useI18n();
  return (
    <article className={`support-library__card${entry.kind === 'unavailable' ? ' is-unavailable' : ''}`}>
      <span className="support-library__glyph">
        <SupportGlyph glyph={entry.glyph} angleDeg={entry.angleDeg ?? DEFAULT_ROLLER_ANGLE_DEG} size={54} />
      </span>
      <strong>{t(entry.labelKey)}</strong>
      {/* Una sola notación por ficha. La línea `meta` ya dice `Ux ✕ · Uy ✕ · Rz ✓`
          con la leyenda de arriba; repetirla en fichas de colores obligaba a
          leer dos veces lo mismo, y en el rodillo las dos versiones ni siquiera
          usaban el mismo vocabulario. */}
      <span className="support-library__meta">{t(entry.metaKey)}</span>
      <p>{t(entry.descriptionKey)}</p>
      <code>{entry.model}</code>
      {entry.kind === 'unavailable' && entry.unavailableKey ? (
        <span className="support-library__flag">{t('inspector.supportUnavailableFlag')}</span>
      ) : null}
    </article>
  );
};

export const SupportLibraryDialog = ({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const { t } = useI18n();
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('inspector.supportLibraryTitle')}
      description={t('inspector.supportLibrarySubtitle')}
      closeLabel={t('inspector.supportLibraryClose')}
      className="support-library"
    >
      <p className="support-library__legend">
        <span className="is-free">✓ {t('inspector.supportDofFree')}</span>
        <span className="is-restrained">✕ {t('inspector.supportDofRestrained')}</span>
      </p>

      {SECTIONS.map((section) => (
        <section key={section.family} className="support-library__section">
          <h3>{t(section.titleKey)}</h3>
          <p className="support-library__blurb">{t(section.blurbKey)}</p>
          <div className="support-library__grid">
            {entriesOfFamily(section.family).map((entry) => <LibraryCard key={entry.id} entry={entry} />)}
          </div>
        </section>
      ))}

      {/* La regla que el prototipo pone en un recuadro aparte, y con razón: es
          la única diferencia que no se ve en el dibujo. */}
      <section className="support-library__rule">
        <h3>{t('inspector.supportOrientationRule')}</h3>
        <dl>
          <div>
            <dt>{t('inspector.supportOrientationRuleFixedPin')}</dt>
            <dd>{t('inspector.supportOrientationRuleFixedPinValue')}</dd>
          </div>
          <div>
            <dt>{t('inspector.supportOrientationRuleRoller')}</dt>
            <dd>{t('inspector.supportOrientationRuleRollerValue')}</dd>
          </div>
        </dl>
      </section>
    </Dialog>
  );
};
