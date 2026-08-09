import React, { useState } from 'react';
import { Box, Layers } from 'lucide-react';
import type { StandardSection, SectionShapeType } from '../../data/standardSections';
import { toDisplay, unitLabel } from '../../engine/units';
import type { UnitSystemId } from '../../types';
import { formatInspectorValue } from './numericFormatting';
import { formatFixed } from '../../utils/numberFormat';

export interface SectionViewer2DProps {
  section?: StandardSection | null;
  area: number;
  inertia: number;
  units: UnitSystemId;
  axialForce?: number;
  bendingMoment?: number;
  yieldStrength?: number;
}

/**
 * Visualizador 2D / 3D Isométrico de sección transversal estructural con cotas y mapa de tensiones.
 * Permite alternar entre la vista técnica de cotas 2D y la extrusión isométrica 3D con tensiones de Navier.
 */
export const SectionViewer2D: React.FC<SectionViewer2DProps> = ({
  section,
  area,
  inertia,
  units,
  axialForce = 0,
  bendingMoment = 0,
}) => {
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d');
  const shapeType: SectionShapeType = section?.shapeType ?? 'RECT';
  
  // Dimensiones en metros
  const depth = section?.depth ?? (Math.sqrt((12 * inertia) / (area > 0 ? area : 1)) || 0.3);
  const width = section?.width ?? ((area / (depth > 0 ? depth : 1)) || 0.2);
  const tf = section?.flangeThickness ?? (depth * 0.1);
  const tw = section?.webThickness ?? (width * 0.1);

  // Módulo elástico W (m³)
  const Wel = section?.sectionModulusX ?? ((inertia / (depth / 2 > 0 ? depth / 2 : 1)) || 0.0005);

  // Tensiones normales elásticas de Navier: sigma = N/A ± M*y/I (en MPa)
  const sigmaAxial = area > 0 ? (axialForce / area) / 1e6 : 0;
  const sigmaBending = Wel > 0 ? (Math.abs(bendingMoment) / Wel) / 1e6 : 0;
  const sigmaTop = sigmaAxial - (bendingMoment >= 0 ? sigmaBending : -sigmaBending);
  const sigmaBot = sigmaAxial + (bendingMoment >= 0 ? sigmaBending : -sigmaBending);

  // Escala gráfica centrada en un viewBox de 200 x 140
  const svgWidth = 200;
  const svgHeight = 140;
  const padding = 28;
  const drawWidth = svgWidth - padding * 2;
  const drawHeight = svgHeight - padding * 2;

  const scale = Math.min(drawWidth / Math.max(width, 0.01), drawHeight / Math.max(depth, 0.01)) * 0.90;
  const pxW = width * scale;
  const pxH = depth * scale;
  const pxTf = Math.max(tf * scale, 3);
  const pxTw = Math.max(tw * scale, 3);

  // Perfectamente centrado
  const cx = svgWidth / 2;
  const cy = svgHeight / 2;

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
            strokeWidth="2"
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
              strokeWidth="2"
            />
            <rect
              x={inLeft}
              y={inTop}
              width={Math.max(inRight - inLeft, 2)}
              height={Math.max(inBottom - inTop, 2)}
              rx="2"
              fill="var(--sc-color-bg-app, var(--app-bg))"
              stroke="var(--sc-color-border, var(--border))"
              strokeWidth="1.2"
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
              strokeWidth="2"
            />
            <circle
              cx={cx}
              cy={cy}
              r={inRadius}
              fill="var(--sc-color-bg-app, var(--app-bg))"
              stroke="var(--sc-color-border, var(--border))"
              strokeWidth="1.2"
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
            strokeWidth="2"
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
            strokeWidth="2"
          />
        );
      }
    }
  };

  const dimWidthMm = formatFixed(width * (units === 'kN-m' ? 1000 : 1), 0, 'inspector');
  const dimDepthMm = formatFixed(depth * (units === 'kN-m' ? 1000 : 1), 0, 'inspector');

  // Renderizado 3D Isométrico extruido
  const render3DIsometric = () => {
    const isoX = cx - 26;
    const isoY = cy + 12;
    const extX = 54;
    const extY = -28;
    const w = pxW * 0.75;
    const h = pxH * 0.75;
    const l = isoX - w / 2;
    const r = isoX + w / 2;
    const t = isoY - h / 2;
    const b = isoY + h / 2;

    return (
      <g className="section-3d-iso-group">
        {/* Caras extruidas superiores y laterales */}
        <polygon
          points={`${l},${t} ${r},${t} ${r + extX},${t + extY} ${l + extX},${t + extY}`}
          fill="color-mix(in srgb, var(--sc-color-surface-elevated, #fff) 85%, var(--sc-color-action-primary, #087e5c) 15%)"
          stroke="var(--sc-color-border-strong, #b9afa1)"
          strokeWidth="1.2"
        />
        <polygon
          points={`${r},${t} ${r},${b} ${r + extX},${b + extY} ${r + extX},${t + extY}`}
          fill="color-mix(in srgb, var(--sc-color-surface-2, #f7f4ee) 70%, var(--sc-color-text-secondary, #607068) 30%)"
          stroke="var(--sc-color-border-strong, #b9afa1)"
          strokeWidth="1.2"
        />

        {/* Cara frontal con distribución de tensiones de Navier */}
        <rect
          x={l}
          y={t}
          width={w}
          height={h}
          rx="2"
          fill="url(#stress-gradient-iso)"
          stroke="var(--sc-color-action-primary, var(--accent))"
          strokeWidth="1.8"
        />

        {/* Eje Neutro en perspectiva */}
        <line
          x1={l - 12}
          y1={isoY}
          x2={r + extX + 12}
          y2={isoY + extY}
          stroke="var(--sc-color-brand-secondary, #1f88b8)"
          strokeWidth="1.4"
          strokeDasharray="4 2"
        />
        <text
          x={l - 14}
          y={isoY + 3}
          textAnchor="end"
          fontSize="7.5"
          fontWeight="700"
          fontFamily="var(--sc-font-mono)"
          fill="var(--sc-color-brand-secondary, #1f88b8)"
        >
          E.N.
        </text>

        {/* Gradiente de tensiones */}
        <defs>
          <linearGradient id="stress-gradient-iso" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--sc-violet-500, #7d63c9)" stopOpacity="0.85" />
            <stop offset="50%" stopColor="var(--sc-color-surface-1, #fffcf7)" stopOpacity="0.9" />
            <stop offset="100%" stopColor="var(--sc-color-action-primary, #087e5c)" stopOpacity="0.85" />
          </linearGradient>
        </defs>

        {/* Etiquetas de tensiones extremas */}
        <g transform={`translate(${l - 8}, ${t + 4})`}>
          <text textAnchor="end" fontSize="7.5" fontWeight="700" fontFamily="var(--sc-font-mono)" fill="var(--sc-violet-500, #7d63c9)">
            σ_sup = {formatFixed(sigmaTop, 1)} MPa
          </text>
        </g>
        <g transform={`translate(${l - 8}, ${b})`}>
          <text textAnchor="end" fontSize="7.5" fontWeight="700" fontFamily="var(--sc-font-mono)" fill="var(--sc-color-action-primary, #087e5c)">
            σ_inf = {formatFixed(sigmaBot, 1)} MPa
          </text>
        </g>
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
        <div className="section-viewer-mode-toggle" role="group" aria-label="Modo de visualización de sección">
          <button
            type="button"
            className={`section-toggle-btn${viewMode === '2d' ? ' active' : ''}`}
            onClick={() => setViewMode('2d')}
            title="Vista 2D de cotas dimensionales"
          >
            <Layers size={12} />
            2D Cotas
          </button>
          <button
            type="button"
            className={`section-toggle-btn${viewMode === '3d' ? ' active' : ''}`}
            onClick={() => setViewMode('3d')}
            title="Vista 3D Isométrica con tensiones de Navier"
          >
            <Box size={12} />
            3D Isométrico
          </button>
        </div>
      </div>

      <div className="section-viewer-canvas-wrap">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="section-viewer-svg"
          aria-label={`Dimensiones de sección ${section?.name ?? 'personalizada'}`}
        >
          {viewMode === '3d' ? render3DIsometric() : (
            <>
              {/* Eje Neutro (N.A.) */}
              <line
                x1={cx - pxW / 2 - 18}
                y1={cy}
                x2={cx + pxW / 2 + 18}
                y2={cy}
                stroke="var(--sc-color-technical-axis, var(--axis))"
                strokeWidth="1.2"
                strokeDasharray="4 2"
              />
              <text
                x={cx - pxW / 2 - 20}
                y={cy + 3}
                textAnchor="end"
                fontSize="8"
                fontWeight="700"
                fontFamily="var(--sc-font-mono)"
                fill="var(--sc-color-text-secondary, var(--muted))"
              >
                N.A.
              </text>

              {/* Perfil centrado */}
              {renderShape()}

              {/* Cota Superior de Ancho (b) */}
              <g className="dimension-width-group">
                <line
                  x1={cx - pxW / 2}
                  y1={cy - pxH / 2 - 8}
                  x2={cx + pxW / 2}
                  y2={cy - pxH / 2 - 8}
                  stroke="var(--sc-color-technical-dimension, var(--dimension))"
                  strokeWidth="1"
                />
                <line
                  x1={cx - pxW / 2}
                  y1={cy - pxH / 2 - 12}
                  x2={cx - pxW / 2}
                  y2={cy - pxH / 2 - 4}
                  stroke="var(--sc-color-technical-dimension, var(--dimension))"
                  strokeWidth="1"
                />
                <line
                  x1={cx + pxW / 2}
                  y1={cy - pxH / 2 - 12}
                  x2={cx + pxW / 2}
                  y2={cy - pxH / 2 - 4}
                  stroke="var(--sc-color-technical-dimension, var(--dimension))"
                  strokeWidth="1"
                />
                <text
                  x={cx}
                  y={cy - pxH / 2 - 12}
                  textAnchor="middle"
                  fontSize="8.5"
                  fontWeight="700"
                  fontFamily="var(--sc-font-mono)"
                  fill="var(--sc-color-text-primary, var(--text))"
                >
                  b = {dimWidthMm} mm
                </text>
              </g>

              {/* Cota Lateral de Peralte (h) */}
              <g className="dimension-depth-group">
                <line
                  x1={cx + pxW / 2 + 10}
                  y1={cy - pxH / 2}
                  x2={cx + pxW / 2 + 10}
                  y2={cy + pxH / 2}
                  stroke="var(--sc-color-technical-dimension, var(--dimension))"
                  strokeWidth="1"
                />
                <line
                  x1={cx + pxW / 2 + 6}
                  y1={cy - pxH / 2}
                  x2={cx + pxW / 2 + 14}
                  y2={cy - pxH / 2}
                  stroke="var(--sc-color-technical-dimension, var(--dimension))"
                  strokeWidth="1"
                />
                <line
                  x1={cx + pxW / 2 + 6}
                  y1={cy + pxH / 2}
                  x2={cx + pxW / 2 + 14}
                  y2={cy + pxH / 2}
                  stroke="var(--sc-color-technical-dimension, var(--dimension))"
                  strokeWidth="1"
                />
                <text
                  x={cx + pxW / 2 + 16}
                  y={cy}
                  textAnchor="middle"
                  fontSize="8.5"
                  fontWeight="700"
                  fontFamily="var(--sc-font-mono)"
                  fill="var(--sc-color-text-primary, var(--text))"
                  transform={`rotate(90 ${cx + pxW / 2 + 16} ${cy})`}
                >
                  h = {dimDepthMm} mm
                </text>
              </g>
            </>
          )}
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
          <strong>{formatFixed(Wel * 1e6, 0, 'inspector')} cm³</strong>
        </div>
      </div>
    </div>
  );
};
