interface BrandMarkProps {
  size?: number;
  title?: string;
  className?: string;
}

/**
 * La marca: un pórtico de dos montantes, dintel y terreno, con los dos nudos
 * dibujados como el lienzo los dibuja —círculo relleno del fondo con canto de
 * color—. Es la primera estructura que resuelve cualquiera que abra esta app.
 *
 * Va en `currentColor` a propósito: la marca no tiene un color propio que
 * defender, hereda el de donde se apoye. En la barra superior eso la deja en
 * el azul de acción; dentro de un botón relleno, en blanco; en la memoria de
 * cálculo impresa, en negro.
 *
 * El trazo se declara en unidades del viewBox y no en píxeles porque el mismo
 * componente se pide a 20px en la barra y a 96px en la bienvenida: un
 * `stroke-width` fijo engordaría en el pequeño y desaparecería en el grande.
 */
export const BrandMark = ({ size = 32, title, className }: BrandMarkProps) => (
  <svg
    className={className}
    width={size}
    height={size}
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    preserveAspectRatio="xMidYMid meet"
    role={title ? 'img' : undefined}
    aria-hidden={title ? undefined : true}
  >
    {title ? <title>{title}</title> : null}
    <g stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 10h16" />
      <path d="M10 10v12" />
      <path d="M22 10v12" />
    </g>
    {/* El terreno es más fino y más callado: sostiene, no compite. */}
    <path d="M5.5 24.5h21" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.55" />
    <g>
      <circle cx="10" cy="10" r="2.6" fill="currentColor" />
      <circle cx="22" cy="10" r="2.6" fill="currentColor" />
    </g>
  </svg>
);
