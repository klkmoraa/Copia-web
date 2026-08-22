/**
 * Glifos del ciclo de trabajo (CRI-112).
 *
 * Tres viñetas técnicas —modelar, cargar, analizar— para la etapa 2, que era
 * la más árida de las tres: tres números pelados y tres líneas de texto
 * estiradas a lo ancho de la pantalla.
 *
 * Por qué son SVG escrito a mano y no geometría derivada como el pórtico: el
 * pórtico es un objeto con volumen y necesita proyección, sombreado por cara y
 * un filtro; esto son diagramas planos de dos trazos, y derivarlos costaría
 * más código que dibujarlos. Se quedan deliberadamente en la gramática técnica
 * —BASE plano, sin materia, sin filtro, sin volumen— porque representan el
 * trabajo de ingeniería, y ésa es exactamente la mitad del producto que no se
 * viste de arcilla.
 *
 * Coste: tres `<svg>` inline sin filtro ni `defs`. `WelcomeScreen` no es
 * `lazy` y vive en el chunk de entrada, así que el tamaño importa: no hay
 * imágenes, ni fuentes, ni dependencias nuevas.
 *
 * Decorativos a efectos de accesibilidad: todo lo que dicen está en el título
 * y el párrafo que acompañan a cada paso.
 */

import type { SVGProps } from 'react';

export type WorkCycleStage = 'model' | 'load' | 'analyze';

const SVG_PROPS: SVGProps<SVGSVGElement> = {
  className: 'welcome-cycle-glyph',
  viewBox: '0 0 120 56',
  role: 'presentation',
  'aria-hidden': true,
  focusable: false,
  xmlns: 'http://www.w3.org/2000/svg',
};

export const WorkCycleGlyph = ({ stage }: { stage: WorkCycleStage }) => {
  if (stage === 'model') {
    /* Nudos y una barra sobre la retícula: lo mínimo que define un modelo. */
    return (
      <svg {...SVG_PROPS}>
        <g className="welcome-cycle-grid">
          <path d="M0 44 H120 M0 30 H120 M0 16 H120" />
          <path d="M20 8 V52 M50 8 V52 M80 8 V52 M110 8 V52" />
        </g>
        <path className="welcome-cycle-member" d="M20 44 L50 16 L80 30" />
        <g className="welcome-cycle-node">
          <circle cx="20" cy="44" r="4" />
          <circle cx="50" cy="16" r="4" />
          <circle cx="80" cy="30" r="4" />
        </g>
      </svg>
    );
  }

  if (stage === 'load') {
    /* Carga distribuida sobre una barra apoyada. Las flechas usan el rol
       técnico de carga distribuida, no el color de marca. */
    return (
      <svg {...SVG_PROPS}>
        <path className="welcome-cycle-load-line" d="M12 12 H108" />
        <g className="welcome-cycle-load">
          <path d="M20 12 V30 M36 12 V30 M52 12 V30 M68 12 V30 M84 12 V30 M100 12 V30" />
        </g>
        <g className="welcome-cycle-load-head">
          <path d="M20 34 l-4 -6 h8 z M36 34 l-4 -6 h8 z M52 34 l-4 -6 h8 z M68 34 l-4 -6 h8 z M84 34 l-4 -6 h8 z M100 34 l-4 -6 h8 z" />
        </g>
        <path className="welcome-cycle-member" d="M12 38 H108" />
        <g className="welcome-cycle-support">
          <path d="M12 38 l-6 10 h12 z M108 38 l-6 10 h12 z" />
        </g>
      </svg>
    );
  }

  /* Diagrama de momento: área bajo la curva, el gesto que dice "resultado". */
  return (
    <svg {...SVG_PROPS}>
      <path className="welcome-cycle-axis" d="M10 28 H110" />
      <path
        className="welcome-cycle-diagram-area"
        d="M10 28 C34 4 46 4 60 14 C76 26 90 46 110 28 Z"
      />
      <path
        className="welcome-cycle-diagram"
        d="M10 28 C34 4 46 4 60 14 C76 26 90 46 110 28"
      />
    </svg>
  );
};
