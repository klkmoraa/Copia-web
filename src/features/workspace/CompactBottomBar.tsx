import { ChartNoAxesCombined, Layers3, Play, SlidersHorizontal, Wrench } from 'lucide-react';
import type { ReactNode } from 'react';
import { useI18n } from '../../i18n/useI18n';
import { useProjectAnalysis } from '../../store/ProjectContext';
import { useWorkspaceUI } from '../../store/WorkspaceUIContext';
import { ToolGlyph } from '../canvas/StructuralToolIcon';
import { TOOL_REGISTRY } from '../canvas/toolRegistry';
import { emitWorkspaceCommand } from './workspaceCommands';
import type { SurfaceId } from './surfacePresentation';

/**
 * La barra inferior de Compact (`K0`).
 *
 * POR QUÉ EXISTE: en teléfono el producto tenía CUATRO piezas disputándose el
 * borde de abajo —el dock de seis herramientas, el lanzador flotante de
 * superficies, el zócalo de la selección y la entrada por coordenadas— y ninguna
 * sabía de las otras. El lanzador flotaba literalmente encima del dock. Aquí hay
 * una sola barra, en su propia fila del shell, y el resto del chrome se apila
 * sobre ella con `--sc-chrome-tier-*` (tokens §7).
 *
 * POR QUÉ UNA SOLA RANURA DE HERRAMIENTA: un ítem de barra unificada enseña su
 * VALOR, no su categoría (decisión 3 de disposición). Seis ranuras de
 * herramienta no cabían junto a los destinos, y una ranura genérica con una
 * llave inglesa no dice nada; ésta enseña la herramienta activa y abre el
 * catálogo completo en la hoja que el riel ya tenía montada.
 *
 * POR QUÉ «Analizar» NO es una ranura más: las ranuras son DESTINOS y el acento
 * está reservado a la ACCIÓN (decisión 2 del sistema). Va aparte, al final, con
 * el relleno de acción — que es además donde alcanza el pulgar.
 */
export interface CompactBottomBarProps {
  onOpenSurface: (surface: SurfaceId, trigger?: HTMLElement | null) => void;
  isSurfaceActive: (surface: SurfaceId) => boolean;
}

interface Destination {
  id: SurfaceId;
  label: string;
  icon: ReactNode;
  controls?: string;
}

export const CompactBottomBar = ({ onOpenSurface, isSurfaceActive }: CompactBottomBarProps) => {
  const { t } = useI18n();
  const { activeTool } = useWorkspaceUI();
  const { isAnalyzing, analyze } = useProjectAnalysis();

  const definition = TOOL_REGISTRY.find((tool) => tool.id === activeTool);
  const toolLabel = definition ? t(definition.labelKey) : t('toolbar.label');

  const destinations: Destination[] = [
    { id: 'detail', label: t('inspector.tab'), icon: <SlidersHorizontal size={20} strokeWidth={1.8} />, controls: 'workspace-detail' },
    { id: 'view', label: t('inspector.viewTab'), icon: <Layers3 size={20} strokeWidth={1.8} /> },
    { id: 'results', label: t('results.outputs'), icon: <ChartNoAxesCombined size={20} strokeWidth={1.8} /> },
    { id: 'doctor', label: t('modelDoctor.short'), icon: <Wrench size={20} strokeWidth={1.8} /> },
  ];

  return <nav className="compact-bar" aria-label={t('shell.bottomBar')} data-compact-bar="">
    <button
      type="button"
      className="compact-bar__slot compact-bar__tool"
      aria-label={`${t('toolbar.changeTool')}: ${toolLabel}`}
      aria-haspopup="dialog"
      onClick={() => emitWorkspaceCommand('open-tool-palette')}
    >
      <span className="compact-bar__icon" aria-hidden="true">
        {definition ? <ToolGlyph definition={definition} size={20} /> : <SlidersHorizontal size={20} strokeWidth={1.8} />}
      </span>
      <span className="compact-bar__label">{toolLabel}</span>
    </button>

    {destinations.map(({ id, label, icon, controls }) => <button
      key={id}
      type="button"
      className="compact-bar__slot"
      data-compact-bar-slot={id}
      aria-label={label}
      aria-expanded={isSurfaceActive(id)}
      aria-controls={controls}
      onClick={(event) => onOpenSurface(id, event.currentTarget)}
    >
      <span className="compact-bar__icon" aria-hidden="true">{icon}</span>
      <span className="compact-bar__label">{label}</span>
    </button>)}

    <button
      type="button"
      className={`compact-bar__analyze${isAnalyzing ? ' is-analyzing' : ''}`}
      aria-label={isAnalyzing ? t('analysis.runningLabel') : t('analysis.run')}
      disabled={isAnalyzing}
      onClick={() => analyze()}
    ><Play size={18} fill="currentColor" aria-hidden="true" /></button>
  </nav>;
};
