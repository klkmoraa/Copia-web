import { describe, expect, it } from 'vitest';
import {
  COMPACT_CEILING_PX,
  PHONE_CEILING_PX,
  SHELL_HYSTERESIS_BAND_PX,
  canvasBudgetClass,
  commitShellComposition,
  expandedBoundaryWidth,
  isToolRailCompact,
  resolveShellClass,
  resolveShellComposition,
  type ShellClass,
  type ShellComposition,
} from './shellComposition';

describe('resolutor de composición · fronteras', () => {
  it('reproduce la frontera Expanded↔Medium publicada por CRI-9 §12', () => {
    // Estos números NO están escritos en el resolutor: salen de CB-1..CB-4.
    // Si el modelo cambiara, esta tabla lo delataría.
    expect(expandedBoundaryWidth(720)).toBe(1130);
    expect(expandedBoundaryWidth(768)).toBe(1117);
    expect(expandedBoundaryWidth(800)).toBe(1109);
    expect(expandedBoundaryWidth(900)).toBe(1089);
    expect(expandedBoundaryWidth(1080)).toBe(1065);
    expect(expandedBoundaryWidth(1366)).toBe(1042);
  });

  it('mueve la frontera de Medium con la altura, en vez de fijarla a un breakpoint', () => {
    const short = expandedBoundaryWidth(768) as number;
    const tall = expandedBoundaryWidth(1366) as number;
    expect(tall).toBeLessThan(short);
    // El mismo ancho da clases distintas según la altura: eso es exactamente lo
    // que `@media (min-width: …)` no puede expresar.
    expect(resolveShellClass({ width: 1100, height: 768 })).toBe('M1');
    expect(resolveShellClass({ width: 1100, height: 1366 })).toBe('X2');
  });

  it('resuelve las tres clases sobre viewports reales', () => {
    const cases: ReadonlyArray<readonly [number, number, ShellClass]> = [
      [390, 844, 'K0'],
      [844, 390, 'K0'],
      [768, 1024, 'K0'],
      [900, 1000, 'K0'],
      [1024, 768, 'M1'],
      [1112, 834, 'X2'],
      [1280, 800, 'X2'],
      [1440, 900, 'X2'],
      [1920, 1080, 'X2'],
    ];
    for (const [width, height, expected] of cases) {
      expect(`${width}x${height}:${resolveShellClass({ width, height })}`).toBe(`${width}x${height}:${expected}`);
    }
  });

  it('deja Compact bajo el techo que styles.css todavía gobierna', () => {
    expect(resolveShellClass({ width: COMPACT_CEILING_PX, height: 800 })).toBe('K0');
    expect(resolveShellClass({ width: COMPACT_CEILING_PX + 1, height: 800 })).toBe('M1');
    // El presupuesto por sí solo pagaría Medium bastante antes; el techo existe
    // para que JS y CSS no discrepen mientras la composición Compact viva en
    // los bloques `@media (max-width:1023px)`.
    expect(canvasBudgetClass({ width: 900, height: 800 })).toBe('M1');
    expect(resolveShellClass({ width: 900, height: 800 })).toBe('K0');
  });

  it('marca el sub-umbral de teléfono sólo dentro de Compact', () => {
    expect(resolveShellComposition({ width: PHONE_CEILING_PX, height: 844 })).toEqual({ shellClass: 'K0', phone: true });
    expect(resolveShellComposition({ width: PHONE_CEILING_PX + 1, height: 844 })).toEqual({ shellClass: 'K0', phone: false });
    expect(resolveShellComposition({ width: 1280, height: 800 }).phone).toBe(false);
  });

  it('deriva la compacidad del riel de la clase, no de una preferencia', () => {
    expect(isToolRailCompact('X2')).toBe(false);
    expect(isToolRailCompact('M1')).toBe(true);
    expect(isToolRailCompact('K0')).toBe(true);
  });
});

describe('resolutor de composición · histéresis (T-INV-5)', () => {
  const at = (previous: ShellComposition | null, width: number, height = 768) =>
    commitShellComposition(previous, { width, height });

  it('cruza el techo de Compact EXACTO en 1023/1024, sin banda', () => {
    // El techo es un puente con `@media (max-width:1023px)`, no una frontera
    // calculada. Una banda encima lo rompería: el CSS conmuta en 1023/1024 y la
    // clase se quedaría hasta 24 px por detrás.
    for (const previous of [null, { shellClass: 'K0', phone: true }, { shellClass: 'K0', phone: false }, { shellClass: 'M1', phone: false }, { shellClass: 'X2', phone: false }] as const) {
      expect(at(previous, 1024).shellClass).toBe('M1');
      expect(at(previous, 1023).shellClass).toBe('K0');
    }
  });

  it('no deja ningún ancho de 1000–1050 donde el CSS y la clase puedan discrepar', () => {
    // `styles.css` es Compact si y sólo si `width <= 1023`. La clase tiene que
    // decir exactamente lo mismo, venga de donde venga y en cualquier altura.
    const previousStates = [
      null,
      { shellClass: 'K0', phone: true },
      { shellClass: 'K0', phone: false },
      { shellClass: 'M1', phone: false },
      { shellClass: 'X2', phone: false },
    ] as const;
    for (let width = 1000; width <= 1050; width += 1) {
      for (const height of [390, 768, 900, 1366]) {
        for (const previous of previousStates) {
          const cssExpectsCompact = width <= 1023;
          const shellClass = commitShellComposition(previous, { width, height }).shellClass;
          expect(`${width}x${height}/${previous?.shellClass ?? 'none'}:${shellClass === 'K0'}`)
            .toBe(`${width}x${height}/${previous?.shellClass ?? 'none'}:${cssExpectsCompact}`);
        }
      }
    }
  });

  it('no cambia de clase dentro de la banda de 24 px', () => {
    const boundary = expandedBoundaryWidth(768) as number;
    const half = SHELL_HYSTERESIS_BAND_PX / 2;
    const medium: ShellComposition = { shellClass: 'M1', phone: false };
    const expanded: ShellComposition = { shellClass: 'X2', phone: false };

    // Subiendo: cruzar la frontera no basta hasta media banda más allá.
    expect(at(medium, boundary).shellClass).toBe('M1');
    expect(at(medium, boundary + half - 1).shellClass).toBe('M1');
    expect(at(medium, boundary + half).shellClass).toBe('X2');

    // Bajando: simétrico. Entre ambos disparos hay 24 px de zona muerta.
    expect(at(expanded, boundary - 1).shellClass).toBe('X2');
    expect(at(expanded, boundary - half).shellClass).toBe('X2');
    expect(at(expanded, boundary - half - 1).shellClass).toBe('M1');
    expect((boundary + half) - (boundary - half - 1) - 1).toBe(SHELL_HYSTERESIS_BAND_PX);
  });

  it('barre 900→1300→900 sin una sola oscilación', () => {
    let composition: ShellComposition = resolveShellComposition({ width: 900, height: 768 });
    const transitions: string[] = [];
    const sweep = (from: number, to: number) => {
      const step = from < to ? 1 : -1;
      for (let width = from; width !== to + step; width += step) {
        const next = at(composition, width);
        if (next.shellClass !== composition.shellClass) transitions.push(`${composition.shellClass}→${next.shellClass}@${width}`);
        composition = next;
      }
    };
    sweep(900, 1300);
    sweep(1300, 900);

    // Cuatro recomposiciones y ninguna repetida: subida K0→M1→X2 y bajada
    // X2→M1→K0. Una oscilación aparecería como el mismo par de clases yendo y
    // viniendo varias veces dentro del mismo tramo.
    //
    // El techo de Compact se cruza exacto (1024 subiendo, 1023 bajando) y sólo
    // la frontera calculada lleva banda: 1129 subiendo contra 1104 bajando, que
    // son los 24 px de zona muerta alrededor de los 1117 px de X2 a esta altura.
    expect(transitions).toEqual([
      'K0→M1@1024',
      'M1→X2@1129',
      'X2→M1@1104',
      'M1→K0@1023',
    ]);
    expect(composition.shellClass).toBe('K0');
  });

  it('conserva la identidad del objeto cuando nada cambia, para no emitir de más', () => {
    const previous: ShellComposition = { shellClass: 'X2', phone: false };
    expect(at(previous, 1440, 900)).toBe(previous);
    // Y también dentro de la banda, donde el valor crudo sí difiere.
    const boundary = expandedBoundaryWidth(768) as number;
    expect(at(previous, boundary - 1)).toBe(previous);
  });

  it('no retiene una clase que la banda ya no alcanza (salto, no arrastre)', () => {
    // 1440→1024 de una vez. Retener X2 dejaría el shell en Expanded a 1024 px,
    // que es justo el acantilado que este slice viene a eliminar.
    const expanded: ShellComposition = { shellClass: 'X2', phone: false };
    expect(at(expanded, 1024).shellClass).toBe('M1');
    // Y el caso simétrico: un salto desde Compact hasta muy dentro de Expanded.
    const compact: ShellComposition = { shellClass: 'K0', phone: true };
    expect(at(compact, 1600, 900).shellClass).toBe('X2');
    // Un salto que aterriza dentro de la banda calculada tampoco puede retener
    // una clase que allí ya no existe: a 1128 px la banda es X2/M1, no K0.
    expect(at(compact, 1128, 768).shellClass).toBe('X2');
  });

  it('commitea de inmediato cuando el cambio está lejos de la frontera (rotación)', () => {
    const portrait: ShellComposition = { shellClass: 'K0', phone: true };
    // 390×844 → 844×390: sigue siendo Compact, pero deja de ser teléfono.
    expect(at(portrait, 844, 390)).toEqual({ shellClass: 'K0', phone: false });
    // Una tablet que rota cruza la frontera de Medium por la altura.
    const landscape: ShellComposition = { shellClass: 'M1', phone: false };
    expect(at(landscape, 1366, 1024).shellClass).toBe('X2');
  });
});

describe('resolutor de composición · contratos protegidos', () => {
  it('T-INV-4 · el teclado virtual no cambia la clase en Compact', () => {
    // El teclado sólo puede encoger la altura. En Compact la clase se decide por
    // ancho, así que ninguna altura la mueve.
    const widths = [320, 390, 700, 768, 900, COMPACT_CEILING_PX];
    for (const width of widths) {
      const before = resolveShellComposition({ width, height: 844 });
      const withKeyboard = resolveShellComposition({ width, height: 320 });
      expect(`${width}:${withKeyboard.shellClass}`).toBe(`${width}:${before.shellClass}`);
      expect(`${width}:${withKeyboard.phone}`).toBe(`${width}:${before.phone}`);
    }
  });

  it('canvas-first · ninguna clase concede menos lienzo que la anterior', () => {
    // Las composiciones están ordenadas por riqueza de dock: X2 gasta más
    // chrome lateral que M1, y M1 más que K0. Que el resolutor elija siempre la
    // más rica QUE CB PERMITE es lo que impide que una clase recorte lienzo por
    // debajo de su suelo.
    for (let width = 1024; width <= 2560; width += 37) {
      for (const height of [720, 768, 900, 1080]) {
        const shellClass = resolveShellClass({ width, height });
        if (shellClass !== 'X2') continue;
        // Si X2 cabe, el presupuesto lo confirma; nunca se elige por ancho.
        expect(canvasBudgetClass({ width, height })).toBe('X2');
      }
    }
  });

  it('es una función pura: mismo viewport, misma salida, sin tocar el DOM', () => {
    const first = resolveShellComposition({ width: 1280, height: 800 });
    const second = resolveShellComposition({ width: 1280, height: 800 });
    expect(first).toEqual(second);
    expect(resolveShellClass({ width: 0, height: 0 })).toBe('K0');
    expect(resolveShellClass({ width: -10, height: -10 })).toBe('K0');
  });
});
