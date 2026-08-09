import React from 'react';
import type { StandardSection, SectionShapeType } from '../../data/standardSections';
import { toDisplay, unitLabel } from '../../engine/units';
import type { UnitSystemId } from '../../types';
import { formatInspectorValue } from './numericFormatting';

export interface SectionViewer2DProps {
  section?: StandardSection | null;
  area: number;
  inertia: number;
  units: UnitSystemId;
  axialForce?: number; // kN (internal)
  bendingMoment?: number; // kNm (internal)
  yieldStrength?: number; // MPa (e.g. 250, 355)
}

/**
 * Visualizador interactivo 2.5D de sección transversal estructural.
 * Dibuja el perfil a escala con cotas técnicas, eje neutro y distribución de tensiones elásticas (σ).
 */
export const SectionViewer2D: React.FC<SectionViewer2DProps> = ({
  section,
  area,
  inertia,
  units,
  axialForce = 0,
  bendingMoment = 0,
  yieldStrength = 250,
}) => {
  const shapeType: SectionShapeType = section?.shapeType ?? 'RECT';
  
  // Dimensiones en metros
  const depth = section?.depth ?? (Math.sqrt((12 * inertia) / (area > 0 ? area : 1)) || 0.3);
  const width = section?.width ?? ((area / (depth > 0 ? depth : 1)) || 0.2);
  const tf = section?.flangeThickness ?? (depth * 0.1);
  const tw = section?.webThickness ?? (width * 0.1);

  // Modulo elástico W (m³)
  const Wel = section?.sectionModulusX ?? ((inertia / (depth / 2 > 0 ? depth / 2 : 1)) || 0.0005);

  // Tensiones normales elásticas σ (MPa = N/mm² = kN/m² / 1000)
  // σ = (N / A) ± (M / Wel)
  const sigmaAxial = area > 0 ? (axialForce / area) / 1000 : 0; // MPa
  const sigmaBending = Wel > 0 ? (bendingMoment / Wel) / 1000 : 0; // MPa
  const sigmaTop = sigmaAxial - sigmaBending;
  const sigmaBot = sigmaAxial + sigmaBending;
  const maxStress = Math.max(Math.abs(sigmaTop), Math.abs(sigmaBot));
  const utilizationRatio = yieldStrength > 0 ? (maxStress / yieldStrength) : 0;

  // Escala gráfica dentro de un viewBox de 200 x 140
  const svgWidth = 200;
  const svgHeight = 140;
  const padding = 24;
  const drawWidth = svgWidth - padding * 2;
  const drawHeight = svgHeight - padding * 2;

  const scale = Math.min(drawWidth / Math.max(width, 0.01), drawHeight / Math.max(depth, 0.01)) * 0.85;
  const pxW = width * scale;
  const pxH = depth * scale;
  const pxTf = Math.max(tf * scale, 3);
  const pxTw = Math.max(tw * scale, 3);

  const cx = padding + drawWidth / 2 - 20; // desplazamiento a la izquierda para dejar espacio al diagrama σ
  const cy = padding + drawHeight / 2;

  // Renderizado SVG de la forma
  const renderShape = () => {
    const left = cx - pxW / 2;
    const right = cx + pxW / 2;
    const top = cy - pxH / 2;
    const bottom = cy + pxH / 2;

    switch (shapeType) {
      case 'I': {
        const webLeft = cx - pxTw / 2;
        const webRight = cx + pxTw / 2;
        const topFlangeBottom = top + pxTf;
        const botFlangeTop = bottom - pxTf;

        const pathData = [
          `M ${left} ${top}`,
          `H ${right}`,
          `V ${topFlangeBottom}`,
          `H ${webRight}`,
          `V ${botFlangeTop}`,
          `H ${right}`,
          `V ${bottom}`,
          `H ${left}`,
          `V ${botFlangeTop}`,
          `H ${webLeft}`,
          `V ${topFlangeBottom}`,
          `H ${left}`,
          'Z',
        ].join(' ');

        return (
          <path
            d={pathData}
            fill="var(--sc-color-surface-2, var(--surface-2))"
            stroke="var(--sc-color-action-primary, var(--accent))"
            strokeWidth="1.75"
            strokeLinejoin="round"
          />
        );
      }
      case 'HSS_RECT': {
        const inLeft = left + pxTw;
        const inRight = right - pxTw;
        const inTop = top + pxTf;
        const inBottom = bottom - pxTf;

        return (
          <g>
            <rect
              x={left}
              y={top}
              width={pxW}
              height={pxH}
              rx="4"
              fill="var(--sc-color-surface-2, var(--surface-2))"
              stroke="var(--sc-color-action-primary, var(--accent))"
              strokeWidth="1.75"
            />
            <rect
              x={inLeft}
              y={inTop}
              width={Math.max(inRight - inLeft, 2)}
              height={Math.max(inBottom - inTop, 2)}
              rx="2"
              fill="var(--sc-color-bg-app, var(--app-bg))"
              stroke="var(--sc-color-border, var(--border))"
              strokeWidth="1"
            />
          </g>
        );
      }
      case 'HSS_ROUND': {
        const radius = Math.min(pxW, pxH) / 2;
        const inRadius = Math.max(radius - pxTw, 2);
        return (
          <g>
            <circle
              cx={cx}
              cy={cy}
              r={radius}
              fill="var(--sc-color-surface-2, var(--surface-2))"
              stroke="var(--sc-color-action-primary, var(--accent))"
              strokeWidth="1.75"
            />
            <circle
              cx={cx}
              cy={cy}
              r={inRadius}
              fill="var(--sc-color-bg-app, var(--app-bg))"
              stroke="var(--sc-color-border, var(--border))"
              strokeWidth="1"
            />
          </g>
        );
      }
      case 'C': {
        const webRight = left + pxTw;
        const topFlangeBottom = top + pxTf;
        const botFlangeTop = bottom - pxTf;

        const pathData = [
          `M ${left} ${top}`,
          `H ${right}`,
          `V ${topFlangeBottom}`,
          `H ${webRight}`,
          `V ${botFlangeTop}`,
          `H ${right}`,
          `V ${bottom}`,
          `H ${left}`,
          'Z',
        ].join(' ');

        return (
          <path
            d={pathData}
            fill="var(--sc-color-surface-2, var(--surface-2))"
            stroke="var(--sc-color-action-primary, var(--accent))"
            strokeWidth="1.75"
            strokeLinejoin="round"
          />
        );
      }
      case 'RECT':
      default: {
        return (
          <rect
            x={left}
            y={top}
            width={pxW}
            height={pxH}
            rx="3"
            fill="var(--sc-color-surface-2, var(--surface-2))"
            stroke="var(--sc-color-action-primary, var(--accent))"
            strokeWidth="1.75"
          />
        );
      }
    }
  };

  // Diagrama de tensiones elásticas σ
  const renderStressDiagram = () => {
    const stressX = cx + pxW / 2 + 22;
    const topY = cy - pxH / 2;
    const botY = cy + pxH / 2;
    const maxBarW = 28;
    const stressScale = maxStress > 0 ? maxBarW / maxStress : 0;

    const topOffset = sigmaTop * stressScale;
    const botOffset = sigmaBot * stressScale;

    return (
      <g className="stress-distribution-overlay">
        {/* Línea base de tensión cero */}
        <line
          x1={stressX}
          y1={topY - 4}
          x2={stressX}
          y2={botY + 4}
          stroke="var(--sc-color-border-strong, var(--muted))"
          strokeWidth="1.2"
          strokeDasharray="2 2"
        />

        {/* Polígono de tensiones */}
        {maxStress > 0.001 && (
          <>
            <polygon
              points={`${stressX},${topY} ${stressX + topOffset},${topY} ${stressX + botOffset},${botY} ${stressX},${botY}`}
              fill="color-mix(in srgb, var(--sc-color-action-primary, var(--accent)) 20%, transparent)"
              stroke="var(--sc-color-action-primary, var(--accent))"
              strokeWidth="1"
            />
            {/* Flechas superiores e inferiores */}
            <line
              x1={stressX}
              y1={topY}
              x2={stressX + topOffset}
              y2={topY}
              stroke={sigmaTop < 0 ? 'var(--sc-color-state-error, var(--error))' : 'var(--sc-color-action-primary, var(--accent))'}
              strokeWidth="1.5"
            />
            <line
              x1={stressX}
              y1={botY}
              x2={stressX + botOffset}
              y2={botY}
              stroke={sigmaBot < 0 ? 'var(--sc-color-state-error, var(--error))' : 'var(--sc-color-action-primary, var(--accent))'}
              strokeWidth="1.5"
            />
            {/* Lecturas de texto σ */}
            <text
              x={stressX + topOffset + (topOffset >= 0 ? 3 : -3)}
              y={topY + 3}
              textAnchor={topOffset >= 0 ? 'start' : 'end'}
              fontSize="7.5"
              fontWeight="700"
              fontFamily="var(--sc-font-mono)"
              fill={sigmaTop < 0 ? 'var(--sc-color-state-error, var(--error))' : 'var(--sc-color-text-primary, var(--text))'}
            >
              {sigmaTop.toFixed(1)}
            </text>
            <text
              x={stressX + botOffset + (botOffset >= 0 ? 3 : -3)}
              y={botY + 3}
              textAnchor={botOffset >= 0 ? 'start' : 'end'}
              fontSize="7.5"
              fontWeight="700"
              fontFamily="var(--sc-font-mono)"
              fill={sigmaBot < 0 ? 'var(--sc-color-state-error, var(--error))' : 'var(--sc-color-text-primary, var(--text))'}
            >
              {sigmaBot.toFixed(1)}
            </text>
          </>
        )}
      </g>
    );
  };

  return (
    <div className="section-viewer-2d-card" data-testid="section-viewer-2d">
      <div className="section-viewer-header">
        <div className="section-viewer-title">
          <strong>{section?.name ?? 'Sección Personalizada'}</strong>
          <span>{shapeType} · {section?.standard ?? 'Genérico'}</span>
        </div>
        {utilizationRatio > 0 && (
          <div
            className={`section-utilization-badge ${utilizationRatio > 1.0 ? 'overstressed' : utilizationRatio > 0.85 ? 'warning' : 'safe'}`}
            title={`Ratio de Utilización Elástica: ${(utilizationRatio * 100).toFixed(1)}%`}
          >
            η = {(utilizationRatio * 100).toFixed(0)}%
          </div>
        )}
      </div>

      <div className="section-viewer-canvas-wrap">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="section-viewer-svg"
          aria-label={`Geometría de sección ${section?.name ?? 'personalizada'}`}
        >
          {/* Eje Neutro (N.A.) */}
          <line
            x1={cx - pxW / 2 - 14}
            y1={cy}
            x2={cx + pxW / 2 + 14}
            y2={cy}
            stroke="var(--sc-color-technical-axis, var(--axis))"
            strokeWidth="1.2"
            strokeDasharray="4 2"
          />
          <text
            x={cx - pxW / 2 - 16}
            y={cy + 3}
            textAnchor="end"
            fontSize="7"
            fontWeight="700"
            fontFamily="var(--sc-font-mono)"
            fill="var(--sc-color-text-secondary, var(--muted))"
          >
            N.A.
          </text>

          {/* Perfil */}
          {renderShape()}

          {/* Diagrama de Tensiones σ */}
          {renderStressDiagram()}

          {/* Cotas técnicas h y b */}
          <text
            x={cx}
            y={cy - pxH / 2 - 5}
            textAnchor="middle"
            fontSize="8"
            fontWeight="600"
            fontFamily="var(--sc-font-mono)"
            fill="var(--sc-color-text-secondary, var(--muted))"
          >
            b = {(width * (units === 'kN-m' ? 1000 : 1)).toFixed(0)} mm
          </text>
          <text
            x={cx - pxW / 2 - 6}
            y={cy}
            textAnchor="middle"
            fontSize="8"
            fontWeight="600"
            fontFamily="var(--sc-font-mono)"
            fill="var(--sc-color-text-secondary, var(--muted))"
            transform={`rotate(-90 ${cx - pxW / 2 - 6} ${cy})`}
          >
            h = {(depth * (units === 'kN-m' ? 1000 : 1)).toFixed(0)} mm
          </text>
        </svg>
      </div>

      <div className="section-properties-chips">
        <div className="section-chip">
          <small>Área (A)</small>
          <strong>{formatInspectorValue(toDisplay(area, units, 'area'), unitLabel(units, 'area'))}</strong>
        </div>
        <div className="section-chip">
          <small>Inercia (I)</small>
          <strong>{formatInspectorValue(toDisplay(inertia, units, 'inertia'), unitLabel(units, 'inertia'))}</strong>
        </div>
        <div className="section-chip">
          <small>Mód. Elástico (W)</small>
          <strong>{(Wel * 1e6).toFixed(0)} cm³</strong>
        </div>
      </div>
    </div>
  );
};
