import type { SectionShapeType } from '../../data/standardSections';
import type { SectionShapeLayout } from './sectionGeometry';

/**
 * Contorno SVG de una sección transversal.
 *
 * La forma se dibuja una sola vez y sirve para tres cosas: el trazo visible, el
 * contorno sobre el mapa de tensiones y la máscara que recorta ese mapa. Antes,
 * el modo Stress pintaba un rectángulo con degradado sobre *cualquier* perfil,
 * así que una I, una C, un HSS o una L acababan representados como una caja.
 *
 * En la máscara el blanco es material y el negro es hueco: por eso los huecos se
 * pintan de negro en lugar de con el color del lienzo, y así el ánima hueca de
 * un tubo sigue vacía bajo el degradado.
 */
export type SectionShapeVariant = 'draw' | 'outline' | 'mask';

export const SectionShape = ({
  shapeType,
  layout,
  variant = 'draw',
}: {
  shapeType: SectionShapeType;
  layout: SectionShapeLayout;
  variant?: SectionShapeVariant;
}) => {
  const { left, right, top, bottom, cx, cy, pxWidth, pxHeight, pxWeb, pxFlange } = layout;
  const isMask = variant === 'mask';
  const solid = isMask
    ? { fill: 'white', stroke: 'none' as const }
    : { className: variant === 'outline' ? 'section-shape section-shape--outline' : 'section-shape' };
  const hollow = isMask
    ? { fill: 'black', stroke: 'none' as const }
    : { className: 'section-shape-void' };

  switch (shapeType) {
    case 'I':
    case 'C': {
      const webLeft = shapeType === 'C' ? left : cx - pxWeb / 2;
      const webRight = shapeType === 'C' ? left + pxWeb : cx + pxWeb / 2;
      const flangeBottom = top + pxFlange;
      const flangeTop = bottom - pxFlange;
      return <path
        {...solid}
        d={[
          `M ${left} ${top}`, `H ${right}`, `V ${flangeBottom}`, `H ${webRight}`, `V ${flangeTop}`,
          `H ${right}`, `V ${bottom}`, `H ${left}`,
          ...(shapeType === 'I' ? [`V ${flangeTop}`, `H ${webLeft}`, `V ${flangeBottom}`, `H ${left}`] : []),
          'Z',
        ].join(' ')}
        strokeLinejoin="round"
      />;
    }
    case 'HSS_RECT':
      return <g>
        <rect {...solid} x={left} y={top} width={pxWidth} height={pxHeight} rx="4" />
        <rect
          {...hollow}
          x={left + pxWeb}
          y={top + pxFlange}
          width={Math.max(pxWidth - pxWeb * 2, 2)}
          height={Math.max(pxHeight - pxFlange * 2, 2)}
          rx="2"
        />
      </g>;
    case 'HSS_ROUND': {
      const radius = Math.min(pxWidth, pxHeight) / 2;
      return <g>
        <circle {...solid} cx={cx} cy={cy} r={radius} />
        <circle {...hollow} cx={cx} cy={cy} r={Math.max(radius - pxWeb, 2)} />
      </g>;
    }
    case 'L':
      return <path
        {...solid}
        d={`M ${left} ${top} H ${left + pxWeb} V ${bottom - pxFlange} H ${right} V ${bottom} H ${left} Z`}
        strokeLinejoin="round"
      />;
    default:
      return <rect {...solid} x={left} y={top} width={pxWidth} height={pxHeight} rx="3" />;
  }
};
