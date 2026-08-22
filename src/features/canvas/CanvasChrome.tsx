import { X } from 'lucide-react';
import type { Dispatch } from 'react';
import { useI18n } from '../../i18n/useI18n';
import { IconButton } from '../../design-system/components/controls';
import type { ResultTab } from '../../store/ProjectContext';
import { CanvasLayers } from './CanvasLayers';
import type { EditorLayerAction, EditorLayerState } from './editorLayers';

export interface CanvasChromeProps {
  modeLabel: string;
  placementInstruction: string | null;
  showHelp: boolean;
  layers: EditorLayerState;
  dispatchLayers: Dispatch<EditorLayerAction>;
  resultTab: ResultTab;
  setResultTab: (tab: ResultTab) => void;
  snapEnabled: boolean;
  gridEnabled: boolean;
  onSnapChange: (snap: boolean) => void;
  onGridChange: (grid: boolean) => void;
  onCancelPlacement: () => void;
}

/**
 * Presentation-only canvas controls: qué estoy haciendo (badge de modo) y qué
 * estoy viendo (capas, snap/rejilla — dentro del mismo popover). Cámara,
 * coordenadas y minimapa viven en `CanvasNavigator` — dónde estoy, la otra
 * esquina.
 */
export const CanvasChrome = ({
  modeLabel,
  placementInstruction,
  showHelp,
  layers,
  dispatchLayers,
  resultTab,
  setResultTab,
  snapEnabled,
  gridEnabled,
  onSnapChange,
  onGridChange,
  onCancelPlacement,
}: CanvasChromeProps) => {
  const { t } = useI18n();

  return <>
    <div className={`canvas-mode-badge${placementInstruction ? ' placing-load' : ''}`} role="status" aria-live="polite" data-canvas-chrome="mode">
      <strong>{modeLabel}</strong>
      {placementInstruction ? <span className="canvas-action-instruction">{placementInstruction}</span> : showHelp ? <>
        <span className="desktop-gesture-hint">{t('canvas.gestureDesktop')}</span>
        <span className="touch-gesture-hint">{t('canvas.gestureTouch')}</span>
      </> : null}
      {placementInstruction ? <IconButton size="sm" label={t('canvas.cancelPlacement')} onClick={onCancelPlacement}><X size={14} /></IconButton> : null}
    </div>
    <CanvasLayers
      layers={layers}
      dispatch={dispatchLayers}
      resultTab={resultTab}
      setResultTab={setResultTab}
      snapEnabled={snapEnabled}
      gridEnabled={gridEnabled}
      onSnapChange={onSnapChange}
      onGridChange={onGridChange}
    />
  </>;
};
