import React, { useMemo } from 'react';
import { Activity, AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react';
import { standardSections } from '../../data/standardSections';
import type { AnalysisResult, ProjectModel } from '../../types';

export interface StructuralHealthMeterProps {
  project: ProjectModel;
  analysis: AnalysisResult;
  onLocateMember?: (memberId: string) => void;
  yieldStrengthDefault?: number; // MPa (e.g. 250)
}

interface MemberDemand {
  memberId: string;
  maxAxial: number; // kN
  maxMoment: number; // kNm
  sigmaAxial: number; // MPa
  sigmaBending: number; // MPa
  sigmaTotal: number; // MPa
  yieldStrength: number; // MPa
  ratio: number; // η
}

/**
 * Medidor de Utilización y Salud Estructural Global (Structural Health & Demand Meter).
 * Evalúa las tensiones combinadas N + M en toda la estructura y destaca el elemento más exigido.
 */
export const StructuralHealthMeter: React.FC<StructuralHealthMeterProps> = ({
  project,
  analysis,
  onLocateMember,
  yieldStrengthDefault = 250,
}) => {
  const demandSummary = useMemo(() => {
    if (!analysis.success || !analysis.memberResults?.length) return null;

    const demands: MemberDemand[] = [];

    for (const res of analysis.memberResults) {
      const member = project.members.find((m) => m.id === res.memberId);
      if (!member || member.type === 'rigid') continue;

      const area = member.A > 0 ? member.A : 0.005;
      const inertia = member.I > 0 ? member.I : 0.00008;

      // Buscar si tiene un perfil estándar o calcular Wel aproximado
      const matchingSection = standardSections.find((s) => s.area === member.A && s.inertiaX === member.I);
      const depth = matchingSection?.depth ?? (Math.sqrt((12 * inertia) / area) || 0.3);
      const Wel = matchingSection?.sectionModulusX ?? (inertia / (depth / 2 > 0 ? depth / 2 : 1) || 0.0005);

      const maxAxialAbs = Math.max(Math.abs(res.maxAxial ?? 0), Math.abs(res.minAxial ?? 0));
      const maxMomentAbs = Math.max(Math.abs(res.maxMoment ?? 0), Math.abs(res.minMoment ?? 0));

      const sigmaAxial = (maxAxialAbs / area) / 1000; // MPa
      const sigmaBending = Wel > 0 ? (maxMomentAbs / Wel) / 1000 : 0; // MPa
      const sigmaTotal = sigmaAxial + sigmaBending;

      const fy = yieldStrengthDefault;
      const ratio = fy > 0 ? sigmaTotal / fy : 0;

      demands.push({
        memberId: member.id,
        maxAxial: maxAxialAbs,
        maxMoment: maxMomentAbs,
        sigmaAxial,
        sigmaBending,
        sigmaTotal,
        yieldStrength: fy,
        ratio,
      });
    }

    if (demands.length === 0) return null;

    demands.sort((a, b) => b.ratio - a.ratio);
    const critical = demands[0];
    const maxRatio = critical.ratio;
    const safetyFactor = maxRatio > 0 ? 1 / maxRatio : 99.9;

    return {
      demands,
      critical,
      maxRatio,
      safetyFactor,
    };
  }, [analysis, project.members, yieldStrengthDefault]);

  if (!demandSummary) return null;

  const { critical, maxRatio, safetyFactor } = demandSummary;
  const percentage = Math.min(Math.round(maxRatio * 100), 200);

  const statusTone =
    maxRatio > 1.0 ? 'overstressed' : maxRatio > 0.85 ? 'warning' : 'safe';

  const axialPercent = critical.sigmaTotal > 0
    ? Math.round((critical.sigmaAxial / critical.sigmaTotal) * 100)
    : 0;
  const bendingPercent = 100 - axialPercent;

  return (
    <div className="structural-health-card" data-testid="structural-health-meter">
      <div className="structural-health-header">
        <div className="health-title-group">
          <Activity size={16} className={`health-icon health-icon--${statusTone}`} />
          <strong>Utilización Estructural Global</strong>
        </div>
        <div className={`health-status-badge health-status-badge--${statusTone}`}>
          {statusTone === 'overstressed' ? (
            <>
              <ShieldAlert size={13} /> Sobre-esforzado ({percentage}%)
            </>
          ) : statusTone === 'warning' ? (
            <>
              <AlertTriangle size={13} /> Carga Elevada ({percentage}%)
            </>
          ) : (
            <>
              <CheckCircle2 size={13} /> Régimen Elástico Seguro ({percentage}%)
            </>
          )}
        </div>
      </div>

      {/* Barra de progreso de demanda */}
      <div className="health-meter-track" role="progressbar" aria-valuenow={percentage} aria-valuemin={0} aria-valuemax={100}>
        <div
          className={`health-meter-fill health-meter-fill--${statusTone}`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
        <div className="health-meter-marker" style={{ left: '85%' }} title="Límite recomendado (85%)" />
        <div className="health-meter-marker health-meter-marker--yield" style={{ left: '100%' }} title="Límite elástico fy (100%)" />
      </div>

      {/* Métricas y miembro crítico */}
      <div className="health-details-grid">
        <div className="health-detail-item">
          <small>Elemento Crítico</small>
          {onLocateMember ? (
            <button
              type="button"
              className="health-locate-btn"
              onClick={() => onLocateMember(critical.memberId)}
              title="Centrar en el elemento crítico"
            >
              <strong>{critical.memberId}</strong>
            </button>
          ) : (
            <strong>{critical.memberId}</strong>
          )}
        </div>

        <div className="health-detail-item">
          <small>Tensión Máx. (σ_max)</small>
          <strong>{critical.sigmaTotal.toFixed(1)} MPa</strong>
        </div>

        <div className="health-detail-item">
          <small>Factor de Seguridad (SF)</small>
          <strong>{safetyFactor >= 10 ? '>10' : safetyFactor.toFixed(2)}</strong>
        </div>

        <div className="health-detail-item">
          <small>Contribución N / M</small>
          <div className="health-split-bar" title={`Axial: ${axialPercent}% | Flexión: ${bendingPercent}%`}>
            <div className="split-axial" style={{ width: `${axialPercent}%` }} />
            <div className="split-bending" style={{ width: `${bendingPercent}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
};
