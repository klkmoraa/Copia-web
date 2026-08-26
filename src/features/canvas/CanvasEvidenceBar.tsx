import { ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState, type Dispatch, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { TranslationKey } from '../../i18n/catalogs';
import { useI18n } from '../../i18n/useI18n';
import type { ResultTab } from '../../store/ProjectContext';
import type { EditorLayerAction, EditorLayerState } from './editorLayers';
import { applyEvidenceLayerChoice, isEvidenceLayerActive, type EvidenceLayerId } from './evidenceLayers';
import { STACK_QUANTITIES, STACK_SYMBOLS, type StackQuantity } from './diagramStack';

/**
 * Las cuatro evidencias que el lienzo sabe dibujar sobre la propia barra. El
 * símbolo no es decoración: es lo que queda cuando el lienzo se estrecha y el
 * nombre no cabe, y es como se llaman estas magnitudes en un diagrama.
 */
const QUICK_LAYERS: ReadonlyArray<{
  id: Extract<EvidenceLayerId, 'axial' | 'shear' | 'moment' | 'deformed'>;
  labelKey: TranslationKey;
  symbol: string;
}> = [
  { id: 'axial', labelKey: 'results.axial', symbol: 'N' },
  { id: 'shear', labelKey: 'results.shear', symbol: 'V' },
  { id: 'moment', labelKey: 'results.moment', symbol: 'M' },
  { id: 'deformed', labelKey: 'results.deformed', symbol: 'δ' },
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
  /** Falso mientras no haya un análisis del que colgar carriles. */
  stackAvailable: boolean;
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
 *
 * Es una barra de herramientas, no una lista de botones sueltos: un solo alto
 * en el tabulador y las flechas recorren los mandos, que es como se navega un
 * `toolbar` y como ya se navegan las otras barras del producto.
 */
export const CanvasEvidenceBar = ({
  layers,
  dispatchLayers,
  resultTab,
  setResultTab,
  stackActive,
  stackAvailable,
  stackQuantities,
  onStackToggle,
  onStackQuantityToggle,
}: CanvasEvidenceBarProps) => {
  const { t } = useI18n();
  const [chooserOpen, setChooserOpen] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  const acmRef = useRef<HTMLDivElement>(null);
  const chooserButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chooserOpen) return undefined;
    const onPointerDown = (event: PointerEvent) => {
      if (!acmRef.current?.contains(event.target as Node)) setChooserOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [chooserOpen]);

  // Abrir con el teclado y quedarse fuera del menú deja al usuario tabulando a
  // ciegas; cerrarlo sin devolver el foco lo deja en la nada.
  useEffect(() => {
    if (chooserOpen) menuRef.current?.querySelector('input')?.focus();
  }, [chooserOpen]);
  const closeChooser = () => {
    setChooserOpen(false);
    chooserButtonRef.current?.focus();
  };

  const moveFocus = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const keys = ['ArrowRight', 'ArrowLeft', 'Home', 'End'];
    if (!keys.includes(event.key) || !barRef.current) return;
    const controls = Array.from(barRef.current.querySelectorAll<HTMLButtonElement>('button:not([disabled])'));
    const current = controls.indexOf(document.activeElement as HTMLButtonElement);
    if (current < 0) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0
      : event.key === 'End' ? controls.length - 1
        : (current + (event.key === 'ArrowRight' ? 1 : controls.length - 1)) % controls.length;
    controls[next]?.focus();
  };

  return <div
    className="canvas-evidence-bar"
    role="toolbar"
    aria-orientation="horizontal"
    aria-label={t('canvas.evidenceQuickAccess')}
    data-canvas-chrome="evidence-bar"
    ref={barRef}
    onKeyDown={(event) => {
      if (event.key === 'Escape' && chooserOpen) {
        event.stopPropagation();
        closeChooser();
        return;
      }
      moveFocus(event);
    }}
  >
    {QUICK_LAYERS.map(({ id, labelKey, symbol }) => <button
      key={id}
      type="button"
      className={`canvas-evidence-layer canvas-evidence-layer--${id}`}
      aria-pressed={isEvidenceLayerActive(id, resultTab, layers)}
      // El nombre accesible no cambia con el ancho: la etiqueta corta es un
      // recorte visual, no otra cosa.
      aria-label={t(labelKey)}
      data-evidence-layer={id}
      onClick={() => applyEvidenceLayerChoice(id, { resultTab, layers }, { setResultTab, dispatchLayers })}
    >
      <span className="canvas-evidence-layer__name" aria-hidden="true">{t(labelKey)}</span>
      <span className="canvas-evidence-layer__symbol" aria-hidden="true">{symbol}</span>
    </button>)}
    <div className="canvas-evidence-acm" ref={acmRef}>
      <button
        type="button"
        className="canvas-evidence-layer canvas-evidence-layer--acm"
        aria-pressed={stackActive}
        data-evidence-layer="acm"
        disabled={!stackAvailable}
        title={stackAvailable ? t('canvas.evidenceStackDescription') : t('canvas.evidenceStackUnavailable')}
        onClick={onStackToggle}
      >{t('canvas.evidenceStackName')}</button>
      <button
        type="button"
        className="canvas-evidence-acm__chooser"
        aria-label={t('canvas.evidenceStackChoose')}
        aria-expanded={chooserOpen}
        data-evidence-layer="acm-chooser"
        ref={chooserButtonRef}
        onClick={() => (chooserOpen ? closeChooser() : setChooserOpen(true))}
      ><ChevronDown size={14} aria-hidden="true" /></button>
      {chooserOpen ? <div
        className="canvas-evidence-acm__menu"
        role="group"
        aria-label={t('canvas.evidenceStackChoose')}
        ref={menuRef}
      >
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
