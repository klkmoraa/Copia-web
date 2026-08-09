import { formatFixed } from '../../utils/numberFormat';

export interface CanvasTouchLoupeProps {
  active: boolean;
  screenX: number;
  screenY: number;
  modelX: number;
  modelY: number;
  unit?: string;
}

export const CanvasTouchLoupe = ({
  active,
  screenX,
  screenY,
  modelX,
  modelY,
  unit = 'm',
}: CanvasTouchLoupeProps) => {
  if (!active) return null;

  return (
    <div
      className={`touch-loupe${active ? ' active' : ''}`}
      style={{
        left: `${screenX}px`,
        top: `${screenY}px`,
      }}
      aria-hidden="true"
    >
      <div className="touch-loupe-reticle" />
      <span className="touch-loupe-coord">
        X: {formatFixed(modelX, 2)} {unit} · Y: {formatFixed(modelY, 2)} {unit}
      </span>
    </div>
  );
};
