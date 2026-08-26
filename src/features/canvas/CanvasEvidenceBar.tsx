import { ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState, type Dispatch } from 'react';
import type { TranslationKey } from '../../i18n/catalogs';
import { useI18n } from '../../i18n/useI18n';
import type { ResultTab } from '../../store/ProjectContext';
import type { EditorLayerAction, EditorLayerState } from './editorLayers';
import { applyEvidenceLayerChoice, isEvidenceLayerActive, type EvidenceLayerId } from './evidenceLayers';
import { STACK_QUANTITIES, STACK_SYMBOLS, type StackQuantity } from './diagramStack';

/** Las cuatro evidencias que el lienzo sabe dibujar sobre la propia barra. */
const QUICK_LAYERS: ReadonlyArray<{ id: Extract<EvidenceLayerId, 'axial' | 'shear' | 'moment' | 'deformed'>; labelKey: TranslationKey }> = [
  { id: 'axial', labelKey: 'results.axial' },
  { id: 'shear', labelKey: 'results.shear' },
  { id: 'moment', labelKey: 'results.moment' },
  { id: 'deformed', labelKey: 'results.deformed' },
];

const stackLabelKeys: Readonly<Record<StackQuantity, TranslationKey>> = {
  axial: 'results.axial',
  shear: 'results.shear',
  moment: 'results.moment',
};

export interface CanvasEvidenceBarProps {
  layers: EditorLayerState;
  dispatchLayers: Dispatch<EditorLayerAction>;
  resultTab: ResultTab;
  setResultTab: (tab: ResultTab) => void;
  stackActive: boolean;
  stackQuantities: readonly StackQuantity[];
  onStackToggle: () => void;
  onStackQuantityToggle: (quantity: StackQuantity) => void;
}

/**
 * Acceso rápido a la evidencia, sobre el propio lienzo.
 *
 * Las cuatro primeras son las mismas capas del popover de capas —mismo estado,
 * misma función de conmutación— sacadas a la vista para no cobrar dos clics por
 * mirar el cortante. La quinta, ACM, es la única que añade algo: en vez de
 * turnarse sobre la barra, despliega axial, cortante y momento a la vez, cada
 * uno en su carril bajo el modelo, y deja elegir cuáles de los tres entran.
 */
export const CanvasEvidenceBar = ({
  layers,
  dispatchLayers,
  resultTab,
  setResultTab,
  stackActive,
  stackQuantities,
  onStackToggle,
  onStackQuantityToggle,
}: CanvasEvidenceBarProps) => {
  const { t } = useI18n();
  const [chooserOpen, setChooserOpen] = useState(false);
  const acmRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chooserOpen) return undefined;
    const onPointerDown = (event: PointerEvent) => {
      if (!acmRef.current?.contains(event.target as Node)) setChooserOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [chooserOpen]);

  return <div
    className="canvas-evidence-bar"
    role="group"
    aria-label={t('canvas.evidenceQuickAccess')}
    data-canvas-chrome="evidence-bar"
    onKeyDown={(event) => {
      if (event.key !== 'Escape' || !chooserOpen) return;
      event.stopPropagation();
      setChooserOpen(false);
    }}
  >
    {QUICK_LAYERS.map(({ id, labelKey }) => <button
      key={id}
      type="button"
      className={`canvas-evidence-layer canvas-evidence-layer--${id}`}
      aria-pressed={isEvidenceLayerActive(id, resultTab, layers)}
      data-evidence-layer={id}
      onClick={() => applyEvidenceLayerChoice(id, { resultTab, layers }, { setResultTab, dispatchLayers })}
    >{t(labelKey)}</button>)}
    <div className="canvas-evidence-acm" ref={acmRef}>
      <button
        type="button"
        className="canvas-evidence-layer canvas-evidence-layer--acm"
        aria-pressed={stackActive}
        data-evidence-layer="acm"
        title={t('canvas.evidenceStackDescription')}
        onClick={onStackToggle}
      >{t('canvas.evidenceStackName')}</button>
      <button
        type="button"
        className="canvas-evidence-acm__chooser"
        aria-label={t('canvas.evidenceStackChoose')}
        aria-expanded={chooserOpen}
        data-evidence-layer="acm-chooser"
        onClick={() => setChooserOpen((open) => !open)}
      ><ChevronDown size={14} aria-hidden="true" /></button>
      {chooserOpen ? <div className="canvas-evidence-acm__menu" role="group" aria-label={t('canvas.evidenceStackChoose')}>
        <span className="canvas-evidence-acm__title">{t('canvas.evidenceStackDescription')}</span>
        {STACK_QUANTITIES.map((quantity) => {
          const checked = stackQuantities.includes(quantity);
          return <label key={quantity} className="canvas-evidence-acm__option">
            <input
              type="checkbox"
              checked={checked}
              data-evidence-stack-quantity={quantity}
              // El último carril encendido no se puede apagar: el ACM sin
              // carriles sería un botón activo que no dibuja nada.
              disabled={checked && stackQuantities.length === 1}
              onChange={() => onStackQuantityToggle(quantity)}
            />
            <span>{STACK_SYMBOLS[quantity]} · {t(stackLabelKeys[quantity])}</span>
          </label>;
        })}
      </div> : null}
    </div>
  </div>;
};
