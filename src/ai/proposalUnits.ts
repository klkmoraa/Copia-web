/**
 * Conversión de las unidades que una propuesta puede declarar a las unidades
 * base del motor.
 *
 * Esto **no** es `src/engine/units.ts`. Aquél convierte entre sistemas de
 * presentación elegidos por el usuario; éste traduce un nombre de unidad que
 * viene de fuera. Son dos problemas distintos y mezclarlos sería darle a un
 * texto externo la capacidad de elegir el sistema de la aplicación.
 *
 * La lista es cerrada por diseño. Una unidad que no esté aquí no se interpreta
 * «lo mejor posible»: se rechaza. Adivinar que `kg/cm2` quería decir algo es
 * exactamente la clase de amabilidad que convierte una propuesta ambigua en un
 * modelo mal cargado.
 */
import { translatePhase2, type Phase2TranslationKey } from '../i18n/phase2Catalogs';

/** Magnitudes que una propuesta puede tocar. Cada una acepta sólo sus unidades. */
export type ProposalQuantityKind = 'elasticModulus' | 'area' | 'inertia' | 'density';

export interface ProposalQuantity {
  value: number;
  unit: string;
}

/** Factor a unidades base: kN/m² para tensión, m² para área, m⁴ para inercia, kg/m³ para densidad. */
const FACTORS: Record<ProposalQuantityKind, Record<string, number>> = {
  // Base: kN/m². 1 MPa = 1000 kN/m².
  elasticModulus: {
    Pa: 1e-3,
    kPa: 1,
    MPa: 1e3,
    GPa: 1e6,
    psi: 6.894757293168361e-3,
    ksi: 6.894757293168361,
  },
  // Base: m².
  area: { m2: 1, cm2: 1e-4, mm2: 1e-6, in2: 6.4516e-4 },
  // Base: m⁴.
  inertia: { m4: 1, cm4: 1e-8, mm4: 1e-12, in4: 4.162314256e-7 },
  // Base: kg/m³.
  density: { 'kg/m3': 1, 'lb/ft3': 16.018463373960142 },
};

export const allowedUnits = (kind: ProposalQuantityKind): string[] => Object.keys(FACTORS[kind]);

export class ProposalUnitError extends Error {
  key: Phase2TranslationKey;
  params?: Record<string, string | number>;

  constructor(key: Phase2TranslationKey, params?: Record<string, string | number>) {
    super(translatePhase2('es', key, params));
    this.name = 'ProposalUnitError';
    this.key = key;
    this.params = params;
  }
}

/**
 * Convierte una cantidad declarada a unidades base.
 *
 * Rechaza —no corrige— la unidad que no pertenece a la magnitud. Una propuesta
 * que da el área en MPa no se ha equivocado de unidad: se ha equivocado de
 * campo, y aplicarla convertida sería escribir un número plausible en el sitio
 * equivocado.
 */
export const toBaseUnits = (quantity: ProposalQuantity, kind: ProposalQuantityKind): number => {
  const factor = FACTORS[kind][quantity.unit];
  if (factor === undefined) {
    throw new ProposalUnitError('proposal.error.unitNotAllowed', {
      unit: quantity.unit,
      kind,
      allowed: allowedUnits(kind).join(', '),
    });
  }
  if (!Number.isFinite(quantity.value)) {
    throw new ProposalUnitError('proposal.error.quantityNotFinite');
  }
  return quantity.value * factor;
};
