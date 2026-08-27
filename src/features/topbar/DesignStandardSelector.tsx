import { memo, useMemo, useState } from 'react';
import { BookOpenCheck, ChevronDown, Check } from 'lucide-react';
import { useProject } from '../../store/ProjectContext';
import { Popover } from '../../design-system/components/overlays';
import { formatFixed } from '../../utils/numberFormat';
import {
  STANDARD_TITLES,
  summarizeStructureDesign,
} from '../../design/memberUtilization';
import type { DesignStandardId } from '../../design/types';
import { emitWorkspaceCommand } from '../workspace/workspaceCommands';
import './designStandardSelector.css';

interface DesignStandardSelectorProps {
  standardId?: DesignStandardId;
  onStandardChange?: (id: DesignStandardId) => void;
}

export const DesignStandardSelector = memo(({
  standardId = 'aisc-360-16-lrfd',
  onStandardChange,
}: DesignStandardSelectorProps) => {
  const { project, analysis, selectedCombinationId, setSelection } = useProject();
  const [activeStandard, setActiveStandard] = useState<DesignStandardId>(standardId);
  const [open, setOpen] = useState(false);

  const currentStandard = activeStandard;

  const handleSelectStandard = (id: DesignStandardId) => {
    setActiveStandard(id);
    onStandardChange?.(id);
    setOpen(false);
  };

  const summary = useMemo(() => {
    return summarizeStructureDesign(project, analysis, selectedCombinationId, currentStandard);
  }, [project, analysis, selectedCombinationId, currentStandard]);

  const standards: readonly { id: DesignStandardId; label: string; desc: string }[] = [
    {
      id: 'aisc-360-16-lrfd',
      label: STANDARD_TITLES['aisc-360-16-lrfd'],
      desc: 'Diseño por factores de carga y resistencia (LRFD, φ = 0.90)',
    },
    {
      id: 'aisc-360-16-asd',
      label: STANDARD_TITLES['aisc-360-16-asd'],
      desc: 'Diseño por esfuerzos permisibles (ASD, Ω = 1.67)',
    },
    {
      id: 'eurocode-3',
      label: STANDARD_TITLES['eurocode-3'],
      desc: 'Norma europea EN 1993-1-1 con coeficientes parciales γM',
    },
    {
      id: 'ntc-2023',
      label: STANDARD_TITLES['ntc-2023'],
      desc: 'Normas Técnicas Complementarias CDMX 2023 (Acero)',
    },
  ];

  const hasResults = summary.evaluatedMembers > 0;
  const maxRatioPercent = formatFixed(summary.maxRatio * 100, 0);
  const badgeClass = !hasResults
    ? 'is-unrated'
    : summary.criticalCount > 0
      ? 'is-critical'
      : summary.warningCount > 0
        ? 'is-warning'
        : summary.optimalCount > 0
          ? 'is-optimal'
          : 'is-safe';

  const handleLocateGoverning = () => {
    if (summary.governingMemberId) {
      setSelection({ kind: 'member', id: summary.governingMemberId });
      emitWorkspaceCommand('focus-object', { kind: 'member', id: summary.governingMemberId });
    }
  };

  const trigger = (
    <span
      className="sc-design-standard-trigger"
      data-testid="design-standard-trigger"
      aria-label="Seleccionar norma de diseño estructural"
      title={`Norma de diseño activa: ${STANDARD_TITLES[currentStandard]}`}
    >
      <BookOpenCheck size={15} aria-hidden="true" className="sc-design-icon" />
      <span className="sc-design-standard-name">{STANDARD_TITLES[currentStandard]}</span>
      <span
        className={`sc-design-util-badge ${badgeClass}`}
        data-testid="design-util-badge"
        title={
          hasResults
            ? `Aprovechamiento máximo: ${maxRatioPercent}% (${summary.criticalCount} en fallo, ${summary.warningCount} alerta)`
            : 'Sin resultados calculados'
        }
      >
        {hasResults ? `η = ${formatFixed(summary.maxRatio, 2)}` : '—'}
      </span>
      <ChevronDown size={13} aria-hidden="true" className="sc-design-chevron" />
    </span>
  );

  return (
    <div className="sc-design-standard-selector" data-testid="design-standard-selector">
      <Popover
        label="Normas de Diseño Estructural"
        trigger={trigger}
        open={open}
        onOpenChange={setOpen}
        align="end"
      >
        <div className="sc-design-standard-popover">
          <header className="sc-design-popover-header">
            <strong>Verificación Normativa</strong>
            <small>Comprobación de estados límite en tiempo real</small>
          </header>

          <div className="sc-design-standards-list" role="menu">
            {standards.map((std) => (
              <button
                key={std.id}
                type="button"
                role="menuitemradio"
                aria-checked={std.id === currentStandard}
                className={`sc-design-standard-option ${std.id === currentStandard ? 'is-selected' : ''}`}
                onClick={() => handleSelectStandard(std.id)}
              >
                <div className="sc-design-option-info">
                  <div className="sc-design-option-title">
                    <strong>{std.label}</strong>
                    {std.id === currentStandard && <Check size={14} className="sc-check-icon" />}
                  </div>
                  <p>{std.desc}</p>
                </div>
              </button>
            ))}
          </div>

          {hasResults && (
            <footer className="sc-design-popover-summary">
              <div className="sc-design-summary-row">
                <span>Miembros evaluados:</span>
                <strong>{summary.evaluatedMembers} / {summary.totalMembers}</strong>
              </div>
              <div className="sc-design-summary-row">
                <span>Aprovechamiento pico:</span>
                <strong className={`util-text ${badgeClass}`}>
                  {formatFixed(summary.maxRatio * 100, 1)}% ({formatFixed(summary.maxRatio, 2)})
                </strong>
              </div>
              {summary.governingMemberId && (
                <button
                  type="button"
                  className="sc-design-locate-btn"
                  onClick={handleLocateGoverning}
                >
                  Localizar barra crítica ({summary.governingMemberId})
                </button>
              )}
            </footer>
          )}
        </div>
      </Popover>
    </div>
  );
});

DesignStandardSelector.displayName = 'DesignStandardSelector';
