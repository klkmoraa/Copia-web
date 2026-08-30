import { describe, expect, it } from 'vitest';
import type { SupportDefinition } from '../../types';
import {
  SUPPORT_ENTRIES,
  activeSpringKeys,
  applySupportPreset,
  countSupportReactions,
  describeSupportDof,
  entriesOfFamily,
  findSupportEntry,
  hasCustomRollerAngle,
  isSpringEntryActive,
  matchSupportEntry,
  previewSupportOf,
  springNormalDisagrees,
  type SupportEntry,
} from './supportCatalog';

const entry = (id: string): SupportEntry => {
  const found = findSupportEntry(id);
  if (!found) throw new Error(`entrada desconocida: ${id}`);
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
    const declared = new Set(SUPPORT_ENTRIES.map((item) => item.type).filter(Boolean));
    expect([...declared].sort()).toEqual(['custom', 'fixed', 'none', 'pin', 'roller']);
  });

  /**
   * LA OTRA MITAD DE LA HONESTIDAD. Una entrada que este motor no puede aplicar
   * tiene que declararlo en el dato, no en el CSS: `kind: 'unavailable'` es lo
   * que cualquier superficie consulta para no ofrecerla. Si alguien le pusiera
   * un `type` para «que funcione», esta prueba lo caza.
   */
  it('ninguna entrada no disponible puede escribir en el modelo', () => {
    for (const item of SUPPORT_ENTRIES.filter((candidate) => candidate.kind === 'unavailable')) {
      expect(item.type, item.id).toBeUndefined();
      expect(item.restraints, item.id).toBeUndefined();
      expect(item.springKeys, item.id).toBeUndefined();
      expect(item.unavailableKey, item.id).toBeTruthy();
      expect(applySupportPreset({ type: 'pin' }, item)).toEqual({ type: 'pin' });
    }
  });

  it('reparte las entradas en las cinco familias, sin repetir identificadores', () => {
    const ids = SUPPORT_ENTRIES.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(entriesOfFamily('basic').map((item) => item.id)).toEqual([
      'free', 'pin', 'roller-ground', 'roller-wall', 'roller-incline', 'fixed',
    ]);
    expect(entriesOfFamily('guided').map((item) => item.id)).toEqual([
      'guide-horizontal', 'guide-vertical', 'custom',
    ]);
    expect(entriesOfFamily('elastic')).toHaveLength(5);
    expect(entriesOfFamily('connection').map((item) => item.id)).toEqual(['internal-hinge', 'semi-rigid']);
  });

  /** Las conexiones se enseñan, pero no son apoyos al terreno y no escriben uno. */
  it('las conexiones no declaran ningún tipo de apoyo', () => {
    for (const item of entriesOfFamily('connection')) expect(item.type, item.id).toBeUndefined();
  });
});

describe('aplicar un preset', () => {
  it('conserva la rigidez al cambiar de tipo, porque es del nodo y no del tipo', () => {
    const current: SupportDefinition = { type: 'pin', spring: { kx: 120 } };
    expect(applySupportPreset(current, entry('fixed'))).toEqual({ type: 'fixed', spring: { kx: 120 } });
  });

  /**
   * LA TRAMPA QUE ESTO EVITA. `angleDeg` significa dos cosas: en un rodillo es
   * la normal que el solver restringe; en un articulado o un empotramiento sólo
   * gira el dibujo. Heredarlo de uno a otro convertiría en silencio una
   * decisión de presentación en una restricción física — y al revés.
   */
  it('no deja que un giro de presentación se convierta en una normal física', () => {
    const rotatedFixed: SupportDefinition = { type: 'fixed', angleDeg: 30 };
    expect(applySupportPreset(rotatedFixed, entry('roller-incline')).angleDeg).toBe(45);
    /* Y la tarjeta de rodillo sin ángulo propio tampoco lo hereda de ahí. */
    const plainRoller = { ...entry('roller-ground'), angleDeg: undefined };
    expect(applySupportPreset(rotatedFixed, plainRoller).angleDeg).toBe(90);
  });

  it('un rodillo sí hereda el ángulo trabajado de otro rodillo', () => {
    const worked: SupportDefinition = { type: 'roller', angleDeg: 37.125 };
    const plainRoller = { ...entry('roller-ground'), angleDeg: undefined };
    expect(applySupportPreset(worked, plainRoller).angleDeg).toBe(37.125);
  });

  it('el giro de presentación sobrevive entre articulado y empotramiento', () => {
    const rotatedPin: SupportDefinition = { type: 'pin', angleDeg: 180 };
    expect(applySupportPreset(rotatedPin, entry('fixed'))).toEqual({ type: 'fixed', angleDeg: 180, spring: undefined });
    /* Pero no se arrastra a un tipo que no lo dibuja. */
    expect(applySupportPreset(rotatedPin, entry('free')).angleDeg).toBeUndefined();
  });

  it('los presets de rodillo escriben su ángulo y nada más', () => {
    const current: SupportDefinition = { type: 'roller', angleDeg: 90 };
    expect(applySupportPreset(current, entry('roller-wall'))).toEqual({ type: 'roller', angleDeg: 0, spring: undefined });
  });

  /**
   * Una guía es el apoyo guiado clásico: además de la traslación perpendicular
   * impide el giro. Restringir sólo la traslación volvería a ser un rodillo, y
   * la tarjeta no añadiría nada.
   */
  it('las guías restringen también el giro, y siguen siendo personalizado', () => {
    const horizontal = applySupportPreset({ type: 'pin' }, entry('guide-horizontal'));
    expect(horizontal).toEqual({ type: 'custom', restrainX: false, restrainY: true, restrainR: true, spring: undefined });
    const vertical = applySupportPreset({ type: 'pin' }, entry('guide-vertical'));
    expect(vertical).toMatchObject({ restrainX: true, restrainY: false, restrainR: true });
  });

  it('reconstruye las restricciones al llegar desde otro tipo, sin banderas huérfanas', () => {
    const guided: SupportDefinition = { type: 'custom', restrainX: true, restrainY: true, restrainR: true };
    const asRoller = applySupportPreset(guided, entry('roller-ground'));
    expect(asRoller.restrainX).toBeUndefined();
    expect(applySupportPreset(asRoller, entry('custom'))).toEqual({
      type: 'custom', restrainX: false, restrainY: false, restrainR: false, spring: undefined,
    });
  });

  it('pulsar la tarjeta del tipo que ya tienes no borra las casillas marcadas', () => {
    const guided: SupportDefinition = { type: 'custom', restrainX: false, restrainY: true, restrainR: false };
    expect(applySupportPreset(guided, entry('custom')).restrainY).toBe(true);
  });

  it('no arrastra un asentamiento que el apoyo nuevo dejaría de restringir', () => {
    const settled: SupportDefinition = { type: 'fixed', prescribed: { rz: 0.01 } };
    expect(applySupportPreset(settled, entry('pin')).prescribed).toBeUndefined();
  });

  it('una entrada elástica o avanzada no toca la condición de borde', () => {
    const current: SupportDefinition = { type: 'roller', angleDeg: 45 };
    expect(applySupportPreset(current, entry('spring-y'))).toBe(current);
    expect(applySupportPreset(current, entry('settlement'))).toBe(current);
  });
});

describe('reconocer la entrada activa', () => {
  it('reconoce los tres rodillos por su ángulo', () => {
    expect(matchSupportEntry({ type: 'roller', angleDeg: 90 }).id).toBe('roller-ground');
    expect(matchSupportEntry({ type: 'roller', angleDeg: 0 }).id).toBe('roller-wall');
    expect(matchSupportEntry({ type: 'roller', angleDeg: 45 }).id).toBe('roller-incline');
  });

  it('un rodillo sin ángulo explícito ya es el de suelo, como para el solver', () => {
    expect(matchSupportEntry({ type: 'roller' }).id).toBe('roller-ground');
    expect(hasCustomRollerAngle({ type: 'roller' })).toBe(false);
  });

  /** Un ángulo propio cae en «inclinado», que es la tarjeta que lo admite. */
  it('un ángulo propio se reconoce como inclinado y se declara como propio', () => {
    expect(matchSupportEntry({ type: 'roller', angleDeg: 37.125 }).id).toBe('roller-incline');
    expect(hasCustomRollerAngle({ type: 'roller', angleDeg: 37.125 })).toBe(true);
    expect(hasCustomRollerAngle({ type: 'pin', angleDeg: 37 })).toBe(false);
  });

  it('reconoce las guías por sus casillas exactas y cae en personalizado si no', () => {
    expect(matchSupportEntry({ type: 'custom', restrainY: true, restrainR: true }).id).toBe('guide-horizontal');
    expect(matchSupportEntry({ type: 'custom', restrainX: true, restrainR: true }).id).toBe('guide-vertical');
    /* Sin el giro restringido ya no es una guía: es un rodillo escrito a mano. */
    expect(matchSupportEntry({ type: 'custom', restrainY: true }).id).toBe('custom');
    expect(matchSupportEntry({ type: 'custom' }).id).toBe('custom');
  });

  it('siempre encuentra la tarjeta base del tipo', () => {
    expect(matchSupportEntry({ type: 'fixed' }).id).toBe('fixed');
    expect(matchSupportEntry({ type: 'none' }).id).toBe('free');
  });
});

describe('grados de libertad declarados', () => {
  /**
   * Estas filas son la copia legible de `assembleKinematicConstraints`. Si el
   * solver cambiara qué ecuación monta para un tipo, esta prueba y aquel código
   * dejarían de decir lo mismo, y eso es exactamente lo que se quiere que salte.
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

  /** La biblioteca dibuja fichas de tarjetas que nadie ha pulsado todavía. */
  it('la vista previa de una tarjeta describe la tarjeta, no el nudo', () => {
    expect(dofOf(previewSupportOf(entry('guide-vertical'))!)).toBe('ux:R uy:L rz:R');
    expect(dofOf(previewSupportOf(entry('roller-wall'))!)).toBe('normal:R tangent:L rz:L');
    /* «Personalizado» y todo lo que no es una condición de borde completa no
       tienen ficha: no hay un apoyo que enseñar. */
    expect(previewSupportOf(entry('custom'))).toBeNull();
    expect(previewSupportOf(entry('spring-x'))).toBeNull();
    expect(previewSupportOf(entry('friction'))).toBeNull();
  });
});

describe('la capa elástica', () => {
  it('sólo lista las rigideces con valor: un cero guardado no es un resorte', () => {
    expect(activeSpringKeys({ type: 'pin' })).toEqual([]);
    expect(activeSpringKeys({ type: 'pin', spring: { kx: 0, ky: 500 } })).toEqual(['ky']);
    expect(activeSpringKeys({ type: 'roller', spring: { kx: 1, ky: 2, kr: 3, kNormal: 4 } }))
      .toEqual(['kx', 'ky', 'kr', 'kNormal']);
  });

  it('marca activa la tarjeta del resorte que tiene valor', () => {
    const support: SupportDefinition = { type: 'pin', spring: { ky: 900 } };
    expect(isSpringEntryActive(support, entry('spring-y'))).toBe(true);
    expect(isSpringEntryActive(support, entry('spring-x'))).toBe(false);
    /* Con una sola rigidez, la tarjeta que describe el estado es la suelta, no
       la combinada: si no, las dos se encenderían y ninguna diría la verdad. */
    expect(isSpringEntryActive(support, entry('spring-combined'))).toBe(false);
    expect(isSpringEntryActive({ type: 'pin', spring: { kx: 1, ky: 2 } }, entry('spring-combined'))).toBe(true);
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
