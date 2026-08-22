import { memo } from 'react';
import { LocateFixed } from 'lucide-react';
import { Surface } from '../../design-system/components/surface';
import { useI18n } from '../../i18n/useI18n';
import type { AnalysisResult, ReliabilityLevel } from '../../types';
import { ProvenanceCard } from './ProvenanceCard';
import type { ResultRef } from './provenance';
import { reliabilityLevelLabelKey } from './reliabilityCopy';

/**
 * La tarjeta de un extremo (CRI-101 · V-10).
 *
 * Conserva **a la vez** los cinco que cardificar suele costar: valor, unidad,
 * posición, fiabilidad y —cuando la magnitud es expresable como referencia—
 * procedencia. Ninguno se esconde detrás de un hover ni de un `title`.
 *
 * Tres reglas que este componente hace imposibles de romper por descuido:
 *
 * 1. **La materia no opina.** El nivel es siempre `raised`, para cualquier
 *    valor: un resultado favorable y uno desfavorable salen con la misma
 *    elevación, el mismo color de tarjeta y la misma estructura. No hay prop
 *    para subir de nivel, ni clase que dependa del signo o de un umbral.
 * 2. **La fiabilidad es una línea propia**, en texto, nunca un color aplicado
 *    sobre el número. Por eso se distingue en escala de grises.
 * 3. **El contenido de un `raised` no es otra tarjeta**: la procedencia entra
 *    en nivel `flat`, que es lo que corresponde dentro de un marco.
 *
 * `memo` no es adorno: `resultCursor` cambia con el puntero y hace re-render de
 * quien lo hospeda; un extremo no depende del cursor y no debe repintarse con
 * él (riesgo nombrado del slice). Sus props son primitivas o estables.
 */
export interface ResultExtremeCardProps {
  /** Qué extremo es — «Momento máximo absoluto», «Rx máxima». */
  label: string;
  /** Número ya formateado en las unidades activas. */
  value: string;
  /** Unidad del número, siempre visible junto a él. */
  unit: string;
  /** Dónde ocurre — barra y abscisa, o nudo. */
  position: string;
  /** Nivel de fiabilidad del análisis que produjo el número. */
  reliability: ReliabilityLevel;
  /**
   * Color técnico semántico de la etiqueta (axial/cortante/momento/deformada).
   * Nunca colorea el número ni la materia de la tarjeta.
   */
  accent?: 'axial' | 'shear' | 'moment' | 'deformation' | 'reaction';
  /** Lleva la selección y el cursor al punto descrito. Opcional. */
  onLocate?: () => void;
  /** Referencia del número para la procedencia; se omite si no aplica. */
  provenanceRef?: ResultRef;
  /** Análisis del que se resuelve la procedencia. */
  analysis?: AnalysisResult;
}

const ResultExtremeCardComponent = ({
  label,
  value,
  unit,
  position,
  reliability,
  accent,
  onLocate,
  provenanceRef,
  analysis,
}: ResultExtremeCardProps) => {
  const { t } = useI18n();
  return <Surface
    as="article"
    level="raised"
    className="result-extreme-card"
    data-accent={accent}
    aria-label={`${label}: ${value} ${unit}`}
  >
    <h4 className="result-extreme-card__label">{label}</h4>
    <p className="result-extreme-card__value">
      <strong>{value}</strong>
      <span className="result-extreme-card__unit">{unit}</span>
    </p>
    <dl className="result-extreme-card__facts">
      <div>
        <dt>{t('results.cardPosition')}</dt>
        <dd>{position}</dd>
      </div>
      {/* Línea propia, en texto: es la prueba de escala de grises del slice. */}
      <div className="result-extreme-card__reliability">
        <dt>{t('reliability.lineLabel')}</dt>
        <dd data-reliability={reliability}>{t(reliabilityLevelLabelKey[reliability])}</dd>
      </div>
    </dl>
    {provenanceRef && analysis
      ? <ProvenanceCard analysis={analysis} resultRef={provenanceRef} level="flat" />
      : null}
    {onLocate ? <button type="button" className="result-extreme-card__locate" onClick={onLocate}>
      <LocateFixed size={14} aria-hidden="true" />
      {t('results.cardLocate')}
    </button> : null}
  </Surface>;
};

export const ResultExtremeCard = memo(ResultExtremeCardComponent);
