import { createElement, type ComponentPropsWithoutRef, type ElementType, type ReactElement, type Ref } from 'react';

/**
 * Niveles de elevación clay.
 *
 * `flat` no aplica volumen y es el nivel de las zonas técnicas densas —tablas
 * de resultados, filas del inspector, el lienzo—: darles relieve a cada una
 * convierte una rejilla de datos en un montón de fichas y se lee peor.
 * `inset` recibe controles y bandejas. `raised` es la tarjeta normal.
 * `floating` es la elevación de lo que se despega del plano: popovers y
 * menús. `sheet` nace de un borde y `modal` interrumpe el plano con velo.
 */
export type SurfaceLevel = 'flat' | 'inset' | 'raised' | 'floating' | 'sheet' | 'modal';

export type SurfaceTag = 'div' | 'section' | 'article' | 'aside' | 'button' | 'header' | 'nav';

type SurfaceOwnProps<Tag extends SurfaceTag> = {
  level?: SurfaceLevel;
  /** Invierte la iluminación. El estilo vive en CSS; aquí sólo se expone el estado. */
  pressed?: boolean;
  as?: Tag;
  /**
   * Acceso al elemento, como en el resto de la librería (`Button`, `Field`,
   * `Select`). Una superficie flotante que se abre tiene que poder recibir el
   * foco al montarse, y eso lo decide quien la abre, no el envoltorio de CSS.
   */
  ref?: Ref<HTMLElement>;
};

export type SurfaceProps<Tag extends SurfaceTag = 'div'> = SurfaceOwnProps<Tag>
  & Omit<ComponentPropsWithoutRef<Tag>, keyof SurfaceOwnProps<Tag>>;

/**
 * Envoltorio de elevación clay. Es CSS tras una API tipada: no gestiona estado
 * ni conoce el dominio, y por eso puede vivir en la librería sin cruzar la
 * frontera que `dependencyBoundary.test.ts` protege.
 */
export const Surface = <Tag extends SurfaceTag = 'div'>({
  level = 'raised',
  pressed = false,
  as,
  className = '',
  children,
  ref,
  ...rest
}: SurfaceProps<Tag>): ReactElement => {
  const SurfaceElement: ElementType = as ?? 'div';

  return createElement(
    SurfaceElement,
    {
      ref,
      className: `sc-surface${className ? ` ${className}` : ''}`,
      'data-level': level,
      'data-pressed': pressed ? 'true' : undefined,
      ...rest,
    },
    children,
  );
};
