import { describe, expect, it } from 'vitest';
import type { SupportDefinition } from '../../types';
import {
  SUPPORT_BASE_PRESETS,
  SUPPORT_DIRECTION_PRESETS,
  SUPPORT_GUIDE_PRESETS,
  activeSpringKeys,
  applySupportPreset,
  countSupportReactions,
  describeSupportDof,
  matchBasePreset,
  matchDirectionPreset,
  matchGuidePreset,
  springNormalDisagrees,
  type SupportPreset,
} from './supportCatalog';

const presetById = (id: string): SupportPreset => {
  const found = [...SUPPORT_BASE_PRESETS, ...SUPPORT_DIRECTION_PRESETS, ...SUPPORT_GUIDE_PRESETS]
    .find((preset) => preset.id === id);
  if (!found) throw new Error(`preset desconocido: ${id}`);
  return found;
};

const dofOf = (support: SupportDefinition) => describeSupportDof(support)
  .map((row) => `${row.id}:${row.restrained ? 'R' : 'L'}`)
  .join(' ');

describe('catálogo de apoyos', () => {
  /**
   * EL GATE QUE IMPIDE INVENTAR UN APOYO. La ganancia del selector es que
   * enseña más opciones sin ampliar el modelo: en cuanto una tarjeta escribiera
   * un `type` que el solver no monta, el prototipo pasaría a prometer física
   * inexistente. Esta prueba es lo que lo impide.
   */
  it('no declara ningún tipo fuera de los cinco que existen', () => {
    const declared = new Set([...SUPPORT_BASE_PRESETS, ...SUPPORT_DIRECTION_PRESETS, ...SUPPORT_GUIDE_PRESETS]
      .map((preset) => preset.type));
    expect([...declared].sort()).toEqual(['custom', 'fixed', 'none', 'pin', 'roller']);
  });

  it('cubre los cinco tipos con una tarjeta base cada uno, sin repetir', () => {
    expect(SUPPORT_BASE_PRESETS.map((preset) => preset.type)).toEqual(['none', 'pin', 'roller', 'fixed', 'custom']);
  });

  it('mantiene identificadores únicos en las tres capas', () => {
    const ids = [...SUPPORT_BASE_PRESETS, ...SUPPORT_DIRECTION_PRESETS, ...SUPPORT_GUIDE_PRESETS].map((preset) => preset.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('aplicar un preset', () => {
  it('conserva la rigidez al cambiar de tipo, porque es del nodo y no del tipo', () => {
    const current: SupportDefinition = { type: 'pin', spring: { kx: 120 } };
    expect(applySupportPreset(current, presetById('fixed'))).toEqual({ type: 'fixed', spring: { kx: 120 } });
  });

  it('hereda el ángulo trabajado al volver a rodillo', () => {
    const current: SupportDefinition = { type: 'roller', angleDeg: 37.125 };
    const asPin = applySupportPreset(current, presetById('pin'));
    expect(asPin.angleDeg).toBeUndefined();
    /* Desde un tipo sin ángulo, el rodillo cae en su valor por omisión. */
    expect(applySupportPreset(asPin, presetById('roller')).angleDeg).toBe(90);
    expect(applySupportPreset(current, presetById('roller')).angleDeg).toBe(37.125);
  });

  it('los presets de dirección escriben su ángulo y nada más', () => {
    const current: SupportDefinition = { type: 'roller', angleDeg: 90 };
    expect(applySupportPreset(current, presetById('roller-wall'))).toEqual({ type: 'roller', angleDeg: 0, spring: undefined });
    expect(applySupportPreset(current, presetById('roller-incline')).angleDeg).toBe(45);
  });

  it('las guías son personalizado con una sola casilla, no un tipo nuevo', () => {
    const horizontal = applySupportPreset({ type: 'pin' }, presetById('guide-horizontal'));
    expect(horizontal).toEqual({ type: 'custom', restrainX: false, restrainY: true, restrainR: false, spring: undefined });
    const vertical = applySupportPreset({ type: 'pin' }, presetById('guide-vertical'));
    expect(vertical.restrainX).toBe(true);
    expect(vertical.restrainY).toBe(false);
  });

  it('reconstruye las restricciones al llegar desde otro tipo, sin banderas huérfanas', () => {
    const guided: SupportDefinition = { type: 'custom', restrainX: true, restrainY: true, restrainR: true };
    const asRoller = applySupportPreset(guided, presetById('roller'));
    expect(asRoller.restrainX).toBeUndefined();
    expect(applySupportPreset(asRoller, presetById('custom'))).toEqual({
      type: 'custom', restrainX: false, restrainY: false, restrainR: false, spring: undefined,
    });
  });

  it('pulsar la tarjeta del tipo que ya tienes no borra las casillas marcadas', () => {
    const guided: SupportDefinition = { type: 'custom', restrainX: false, restrainY: true, restrainR: false };
    expect(applySupportPreset(guided, presetById('custom')).restrainY).toBe(true);
  });

  it('no arrastra un asentamiento que el apoyo nuevo dejaría de restringir', () => {
    const settled: SupportDefinition = { type: 'fixed', prescribed: { rz: 0.01 } };
    expect(applySupportPreset(settled, presetById('pin')).prescribed).toBeUndefined();
  });
});

describe('reconocer el preset activo', () => {
  it('siempre encuentra la tarjeta base del tipo', () => {
    expect(matchBasePreset({ type: 'fixed' }).id).toBe('fixed');
    expect(matchBasePreset({ type: 'none' }).id).toBe('free');
  });

  it('reconoce suelo, muro e inclinado por su ángulo', () => {
    expect(matchDirectionPreset({ type: 'roller', angleDeg: 90 })?.id).toBe('roller-ground');
    expect(matchDirectionPreset({ type: 'roller', angleDeg: 0 })?.id).toBe('roller-wall');
    expect(matchDirectionPreset({ type: 'roller', angleDeg: 45 })?.id).toBe('roller-incline');
  });

  it('un rodillo sin ángulo explícito ya es el preset de suelo, como para el solver', () => {
    expect(matchDirectionPreset({ type: 'roller' })?.id).toBe('roller-ground');
  });

  it('un ángulo propio no se fuerza dentro de ningún preset', () => {
    expect(matchDirectionPreset({ type: 'roller', angleDeg: 37.125 })).toBeNull();
    expect(matchDirectionPreset({ type: 'pin', angleDeg: 90 })).toBeNull();
  });

  it('reconoce las guías por sus casillas exactas', () => {
    expect(matchGuidePreset({ type: 'custom', restrainY: true })?.id).toBe('guide-horizontal');
    expect(matchGuidePreset({ type: 'custom', restrainX: true })?.id).toBe('guide-vertical');
    expect(matchGuidePreset({ type: 'custom', restrainX: true, restrainY: true })).toBeNull();
    expect(matchGuidePreset({ type: 'custom' })).toBeNull();
  });
});

describe('grados de libertad declarados', () => {
  /**
   * Estas cinco filas son la copia legible de `assembleKinematicConstraints`.
   * Si el solver cambiara qué ecuación monta para un tipo, esta prueba y aquel
   * código dejarían de decir lo mismo, y eso es exactamente lo que se quiere
   * que salte.
   */
  it('describe lo mismo que el solver restringe', () => {
    expect(dofOf({ type: 'none' })).toBe('ux:L uy:L rz:L');
    expect(dofOf({ type: 'pin' })).toBe('ux:R uy:R rz:L');
    expect(dofOf({ type: 'fixed' })).toBe('ux:R uy:R rz:R');
    expect(dofOf({ type: 'custom', restrainY: true })).toBe('ux:L uy:R rz:L');
  });

  it('un rodillo se lee en su normal, no en Ux y Uy', () => {
    expect(dofOf({ type: 'roller', angleDeg: 45 })).toBe('normal:R tangent:L rz:L');
  });

  it('cuenta las ecuaciones de apoyo que aporta el nodo', () => {
    expect(countSupportReactions({ type: 'none' })).toBe(0);
    expect(countSupportReactions({ type: 'roller' })).toBe(1);
    expect(countSupportReactions({ type: 'pin' })).toBe(2);
    expect(countSupportReactions({ type: 'fixed' })).toBe(3);
    expect(countSupportReactions({ type: 'custom', restrainX: true, restrainR: true })).toBe(2);
  });
});

describe('la capa elástica', () => {
  it('sólo lista las rigideces con valor: un cero guardado no es un resorte', () => {
    expect(activeSpringKeys({ type: 'pin' })).toEqual([]);
    expect(activeSpringKeys({ type: 'pin', spring: { kx: 0, ky: 500 } })).toEqual(['ky']);
    expect(activeSpringKeys({ type: 'roller', spring: { kx: 1, ky: 2, kr: 3, kNormal: 4 } }))
      .toEqual(['kx', 'ky', 'kr', 'kNormal']);
  });

  /**
   * `spring.angleDeg` y `support.angleDeg` son campos distintos y el solver usa
   * cada uno por su lado. Un rodillo tumbado con un resorte normal que se quedó
   * en los 90° por omisión no es un error del modelo, pero tampoco es lo que
   * nadie quiso escribir: por eso se avisa.
   */
  it('avisa cuando el resorte normal y la normal del rodillo apuntan a sitios distintos', () => {
    expect(springNormalDisagrees({ type: 'roller', angleDeg: 30, spring: { kNormal: 800 } })).toBe(true);
    expect(springNormalDisagrees({ type: 'roller', angleDeg: 30, spring: { kNormal: 800, angleDeg: 30 } })).toBe(false);
    expect(springNormalDisagrees({ type: 'roller', spring: { kNormal: 800 } })).toBe(false);
  });

  it('no avisa donde el resorte normal no tiene con qué discrepar', () => {
    expect(springNormalDisagrees({ type: 'pin', spring: { kNormal: 800 } })).toBe(false);
    expect(springNormalDisagrees({ type: 'roller', angleDeg: 30, spring: { kx: 800 } })).toBe(false);
  });
});
