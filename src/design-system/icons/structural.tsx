/**
 * structureCo · Iconografía estructural propia.
 *
 * Gramática compartida por toda la familia (y alineada con lucide-react,
 * que cubre los conceptos genéricos de interfaz):
 *   - viewBox 24×24, tamaño óptico centrado.
 *   - stroke: currentColor · strokeWidth 1.8 · terminales/uniones redondeadas.
 *   - fill sólo para puntos focales pequeños (currentColor) o máscaras
 *     (var(--surface)).
 *   - `aria-hidden` por defecto: el texto accesible lo aporta el control
 *     que lo contiene (label/aria-label), nunca el propio glifo.
 *
 * Los conceptos genéricos (cerrar, expandir, menú, tema…) se resuelven con
 * lucide-react; aquí viven únicamente los conceptos de ingeniería
 * estructural que ninguna librería general representa bien.
 */
import type { SVGProps } from 'react';

export interface StructuralGlyphProps extends SVGProps<SVGSVGElement> {
  size?: number;
}

const strokeProps = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

const base = (size: number | undefined, rest: SVGProps<SVGSVGElement>) => ({
  width: size ?? 22,
  height: size ?? 22,
  viewBox: '0 0 24 24',
  'aria-hidden': true,
  ...strokeProps,
  ...rest,
});

/* — Modelado ------------------------------------------------------------ */

export const NodeGlyph = ({ size, ...rest }: StructuralGlyphProps) => (
  <svg {...base(size, rest)}>
    <circle cx="12" cy="12" r="5.2" />
    <circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none" />
  </svg>
);

export const MemberGlyph = ({ size, ...rest }: StructuralGlyphProps) => (
  <svg {...base(size, rest)}>
    <path d="M5.5 17.5 18.5 6.5" />
    <circle cx="5.5" cy="17.5" r="2.2" fill="var(--surface)" />
    <circle cx="18.5" cy="6.5" r="2.2" fill="var(--surface)" />
  </svg>
);

export const SupportGlyph = ({ size, ...rest }: StructuralGlyphProps) => (
  <svg {...base(size, rest)}>
    <circle cx="12" cy="5.2" r="2" fill="var(--surface)" />
    <path d="m12 7.3-6.1 8.1h12.2L12 7.3Z" />
    <path d="M4.7 18.2h14.6M6.5 20.8l2-2.6m3 2.6 2-2.6m3 2.6 2-2.6" />
  </svg>
);

export const PinSupportGlyph = ({ size, ...rest }: StructuralGlyphProps) => (
  <svg {...base(size, rest)}>
    <circle cx="12" cy="6" r="1.9" fill="currentColor" stroke="none" />
    <path d="m12 6-5.6 8h11.2L12 6Z" />
    <path d="M4.6 17.6h14.8" />
  </svg>
);

export const RollerSupportGlyph = ({ size, ...rest }: StructuralGlyphProps) => (
  <svg {...base(size, rest)}>
    <circle cx="12" cy="5.6" r="1.9" fill="currentColor" stroke="none" />
    <path d="m12 5.6-5.4 7.6h10.8L12 5.6Z" />
    <circle cx="8.4" cy="16.4" r="1.7" />
    <circle cx="15.6" cy="16.4" r="1.7" />
    <path d="M4.6 19.6h14.8" />
  </svg>
);

export const FixedSupportGlyph = ({ size, ...rest }: StructuralGlyphProps) => (
  <svg {...base(size, rest)}>
    <path d="M9.4 4v16" />
    <path d="M9.4 6.4h8.2M9.4 12h8.2M9.4 17.6h8.2" />
    <path d="m6.4 6.6-2.2 2.4m2.2 3-2.2 2.4m2.2 3-2.2 2.4" />
  </svg>
);

export const SpringGlyph = ({ size, ...rest }: StructuralGlyphProps) => (
  <svg {...base(size, rest)}>
    <path d="M12 3.4v3l3.4 1.4-6.8 2.4 6.8 2.4-6.8 2.4 3.4 1.4v3" />
    <path d="M6.8 21.4h10.4" />
  </svg>
);

export const HingeGlyph = ({ size, ...rest }: StructuralGlyphProps) => (
  <svg {...base(size, rest)}>
    <path d="M3.6 16.8 10 12M20.4 16.8 14 12" />
    <circle cx="12" cy="10.6" r="2.6" fill="var(--surface)" />
  </svg>
);

export const ReleaseGlyph = ({ size, ...rest }: StructuralGlyphProps) => (
  <svg {...base(size, rest)}>
    <path d="M3.8 12h5.4M14.8 12h5.4" />
    <circle cx="12" cy="12" r="2.4" strokeDasharray="2.6 2.2" />
  </svg>
);

export const SplitMemberGlyph = ({ size, ...rest }: StructuralGlyphProps) => (
  <svg {...base(size, rest)}>
    <path d="M4 17.6 10.2 12M13.8 12 20 6.4" />
    <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
    <path d="M12 5.4v2.4M12 16.2v2.4" strokeDasharray="2 2.4" />
  </svg>
);

export const SectionCutGlyph = ({ size, ...rest }: StructuralGlyphProps) => (
  <svg {...base(size, rest)}>
    <path d="M3.6 14.6h6.8M13.6 14.6h6.8" />
    <path d="M13 4.6 9.6 19.4" strokeDasharray="3 2.6" />
    <path d="m6.2 11.2-1.8 3.4 1.8 3.2M17.8 11.2l1.8 3.4-1.8 3.2" />
  </svg>
);

export const DimensionGlyph = ({ size, ...rest }: StructuralGlyphProps) => (
  <svg {...base(size, rest)}>
    <path d="M4 6.2v11.6m16-11.6v11.6M5.2 12h13.6" />
    <path d="m8 9.3-2.8 2.8L8 14.8m8-5.5 2.8 2.8-2.8 2.7" />
  </svg>
);

/* — Cargas -------------------------------------------------------------- */

export const PointLoadGlyph = ({ size, ...rest }: StructuralGlyphProps) => (
  <svg {...base(size, rest)}>
    <path d="M12 3.5v12.2" />
    <path d="m8.5 12.2 3.5 3.5 3.5-3.5" />
    <path d="M5 20.2h14" />
  </svg>
);

export const DistributedLoadGlyph = ({ size, ...rest }: StructuralGlyphProps) => (
  <svg {...base(size, rest)}>
    <path d="M4 5.2h16M5.8 5.2v10.2m6.2-10.2v10.2m6.2-10.2v10.2" />
    <path d="m3.8 12.8 2 2.6 2-2.6m2.2 0 2 2.6 2-2.6m2.2 0 2 2.6 2-2.6" />
    <path d="M3.2 19.6h17.6" />
  </svg>
);

export const MomentLoadGlyph = ({ size, ...rest }: StructuralGlyphProps) => (
  <svg {...base(size, rest)}>
    <path d="M17.8 7.1A7 7 0 1 0 18.9 15" />
    <path d="m18.1 3.8-.3 3.3-3.3-.3" />
  </svg>
);

export const LoadTrainGlyph = ({ size, ...rest }: StructuralGlyphProps) => (
  <svg {...base(size, rest)}>
    <path d="M5.6 4.6v5.2m6.4-5.2v5.2m6.4-5.2v5.2" />
    <path d="m3.8 7.4 1.8 2.4 1.8-2.4m2.8 0 1.8 2.4 1.8-2.4m2.8 0 1.8 2.4 1.8-2.4" />
    <path d="M3.4 13.4h17.2" />
    <path d="M6.8 17.2h10.4l1.6 3H5.2l1.6-3Z" />
  </svg>
);

/* — Resultados ---------------------------------------------------------- */

export const AxialGlyph = ({ size, ...rest }: StructuralGlyphProps) => (
  <svg {...base(size, rest)}>
    <path d="M7.4 12h9.2" />
    <path d="m10 8.6-3.4 3.4L10 15.4M14 8.6l3.4 3.4L14 15.4" />
    <path d="M3.6 5.4v13.2M20.4 5.4v13.2" />
  </svg>
);

export const ShearGlyph = ({ size, ...rest }: StructuralGlyphProps) => (
  <svg {...base(size, rest)}>
    <path d="M4 15.8h5.4V8.2H15v7.6h5" />
    <path d="M4 19.4h16" strokeDasharray="2 2.6" />
  </svg>
);

export const MomentDiagramGlyph = ({ size, ...rest }: StructuralGlyphProps) => (
  <svg {...base(size, rest)}>
    <path d="M4 16.6c2.6-7.4 13.4-7.4 16 0" />
    <path d="M4 16.6h16" strokeDasharray="2 2.6" />
    <circle cx="12" cy="11" r="1.4" fill="currentColor" stroke="none" />
  </svg>
);

export const DeformedShapeGlyph = ({ size, ...rest }: StructuralGlyphProps) => (
  <svg {...base(size, rest)}>
    <path d="M4 9.4h16" strokeDasharray="2.4 2.4" />
    <path d="M4 9.4c3.2 5.8 12.8 5.8 16 0" />
    <circle cx="4" cy="9.4" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="20" cy="9.4" r="1.5" fill="currentColor" stroke="none" />
  </svg>
);

export const ReactionGlyph = ({ size, ...rest }: StructuralGlyphProps) => (
  <svg {...base(size, rest)}>
    <path d="M12 20.4V8.2" />
    <path d="m8.5 11.7 3.5-3.5 3.5 3.5" />
    <path d="M5 3.6h14" />
  </svg>
);

export const InfluenceLineGlyph = ({ size, ...rest }: StructuralGlyphProps) => (
  <svg {...base(size, rest)}>
    <path d="M3.6 14.4h16.8" strokeDasharray="2.4 2.4" />
    <path d="M3.6 14.4c4-6.2 8.4 3.4 16.8-4.6" />
    <circle cx="9.2" cy="12.4" r="1.5" fill="currentColor" stroke="none" />
  </svg>
);

export const EnvelopeGlyph = ({ size, ...rest }: StructuralGlyphProps) => (
  <svg {...base(size, rest)}>
    <path d="M4 12c2.6-4.6 13.4-4.6 16 0" />
    <path d="M4 12c2.6 4.6 13.4 4.6 16 0" />
    <path d="M4 12h16" strokeDasharray="2 2.6" />
  </svg>
);

export const CriticalPointGlyph = ({ size, ...rest }: StructuralGlyphProps) => (
  <svg {...base(size, rest)}>
    <path d="M4 16.6c2.6-7 13.4-7 16 0" />
    <circle cx="12" cy="11.3" r="2.2" />
    <path d="M12 5.2v2M12 15.4v2" />
  </svg>
);

/* — Expedientes portables ------------------------------------------------ */

export const PortableCaseGlyph = ({ size, ...rest }: StructuralGlyphProps) => (
  <svg {...base(size, rest)}>
    <path d="M6 3.6h8.4L19.6 8.8v11.6H6V3.6Z" />
    <path d="M14.4 3.6v5.2h5.2" />
    <path d="m9 14.6 2 2 3.6-3.8" />
  </svg>
);

export const ChecksumGlyph = ({ size, ...rest }: StructuralGlyphProps) => (
  <svg {...base(size, rest)}>
    <path d="M12 3.6 5 6.4v5.2c0 4.4 3 7.4 7 8.8 4-1.4 7-4.4 7-8.8V6.4l-7-2.8Z" />
    <path d="m9 11.8 2 2 3.8-4" />
  </svg>
);
