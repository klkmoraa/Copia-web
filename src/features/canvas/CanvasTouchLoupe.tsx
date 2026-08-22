import { formatFixed } from '../../utils/numberFormat';

export interface CanvasTouchLoupeProps {
  /** Punto dentro del lienzo, en píxeles locales del host. */
  screenX: number;
  screenY: number;
  modelX: number;
  modelY: number;
  lengthLabel: string;
  /** `id` del grupo que envuelve la escena del lienzo principal. */
  sceneId: string;
  /** Alto del lienzo, para decidir si la lente cabe encima del dedo. */
  canvasHeight: number;
}

/** Diámetro de la lente en píxeles de pantalla. */
const LENS_SIZE = 104;
/** Aumento. 2,4× separa dos nudos a distancia de captura sin perder el contexto. */
const LENS_ZOOM = 2.4;
/** Holgura entre el centro del dedo y el borde de la lente. */
const LENS_CLEARANCE = 40;
const CENTER = LENS_SIZE / 2;

/**
 * Lupa táctil.
 *
 * Bajo el dedo el punto de contacto queda tapado por la propia mano, así que
 * esto amplía *de verdad* esa zona y la enseña apartada: la lente es la misma
 * escena del lienzo — nudos, barras, cargas, diagramas — vista con un `<use>`
 * que clona el grupo `sceneId` y le aplica el aumento centrado en el contacto.
 *
 * Reutilizar el render en lugar de redibujarlo importa: la lupa no conoce el
 * modelo, no decide qué es un nudo ni qué está seleccionado, y no puede
 * desincronizarse del lienzo porque no tiene una segunda copia que mantener.
 * Antes sólo dibujaba una retícula y la cota, que es justo lo que el dedo ya
 * tapaba.
 *
 * La retícula se queda en el punto de contacto y la cota sigue estando: la
 * ampliación responde "qué hay ahí", la cota responde "dónde estoy".
 *
 * Es sólo lectura y `aria-hidden`: la posición ya la anuncia el readout de
 * coordenadas del chrome, y repetirla en el árbol de accesibilidad sería ruido.
 */
export const CanvasTouchLoupe = ({
  screenX, screenY, modelX, modelY, lengthLabel, sceneId, canvasHeight,
}: CanvasTouchLoupeProps) => {
  /* Cerca del borde superior la lente se saldría del lienzo. Baja al otro lado
     del dedo, que en esa franja es la mitad que queda libre. */
  const needed = LENS_CLEARANCE + LENS_SIZE + 26;
  const placement = screenY - needed < 0 && screenY + needed <= canvasHeight ? 'below' : 'above';

  return (
    <div
      className="canvas-touch-loupe"
      style={{ left: `${screenX}px`, top: `${screenY}px` }}
      data-placement={placement}
      aria-hidden="true"
      data-canvas-chrome="touch-loupe"
    >
      <svg
        className="canvas-touch-loupe-lens"
        width={LENS_SIZE}
        height={LENS_SIZE}
        viewBox={`0 0 ${LENS_SIZE} ${LENS_SIZE}`}
        data-testid="canvas-touch-loupe-lens"
      >
        <defs>
          <clipPath id="canvas-touch-loupe-clip">
            <circle cx={CENTER} cy={CENTER} r={CENTER - 2} />
          </clipPath>
        </defs>
        <g clipPath="url(#canvas-touch-loupe-clip)">
          <rect className="canvas-touch-loupe-ground" x="0" y="0" width={LENS_SIZE} height={LENS_SIZE} />
          {/* El orden importa: primero se centra la lente, luego se amplía y
              por último se lleva el punto de contacto al origen. */}
          <g transform={`translate(${CENTER} ${CENTER}) scale(${LENS_ZOOM}) translate(${-screenX} ${-screenY})`}>
            <use href={`#${sceneId}`} />
          </g>
        </g>
        <circle className="canvas-touch-loupe-rim" cx={CENTER} cy={CENTER} r={CENTER - 2} />
        <path
          className="canvas-touch-loupe-crosshair"
          d={`M ${CENTER - 10} ${CENTER} H ${CENTER + 10} M ${CENTER} ${CENTER - 10} V ${CENTER + 10}`}
        />
      </svg>
      <span className="canvas-touch-loupe-reticle" />
      <span className="canvas-touch-loupe-coord">
        X {formatFixed(modelX, 2)} · Y {formatFixed(modelY, 2)} {lengthLabel}
      </span>
    </div>
  );
};
