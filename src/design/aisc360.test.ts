import { describe, expect, it } from 'vitest';
import {
  evaluateAiscCompression,
  evaluateAiscFlexure,
  evaluateAiscShear,
  evaluateAiscTension,
  type AiscCheckInput,
} from './aisc360';

describe('AISC 360-16 Steel Design Module', () => {
  const baseInput: AiscCheckInput = {
    memberId: 'M1',
    materialId: 'steel-a992',
    sectionId: 'w8x31',
    combinationId: 'COMB-1',
    method: 'LRFD',
    length: 3.5, // 3.5 m
    effectiveLengthFactorK: 1.0,
    axialDemand: 0,
    momentDemand: 0,
    shearDemand: 0,
    yieldStrength: 345000, // 345 MPa in kN/m²
    elasticModulus: 200000000, // 200 GPa in kN/m²
    grossArea: 0.00589, // m²
    inertiaX: 0.0000458, // m⁴
    sectionModulusX: 0.000451, // m³
    plasticModulusX: 0.000498, // m³
    radiusOfGyrationX: 0.0881, // m
    depth: 0.203,
    webThickness: 0.0072,
  };

  it('evaluates tension yielding according to AISC Eq. D2-1', () => {
    const input: AiscCheckInput = {
      ...baseInput,
      axialDemand: 1000, // 1000 kN tension
    };

    const res = evaluateAiscTension(input);
    expect(res).not.toBeNull();
    // Pn = Fy * Ag = 345000 * 0.00589 = 2032.05 kN
    // phi * Pn = 0.90 * 2032.05 = 1828.845 kN
    // ratio = 1000 / 1828.845 ≈ 0.5468
    expect(res?.resistance.value).toBeCloseTo(1828.845, 1);
    expect(res?.ratio.value).toBeCloseTo(0.5468, 3);
    expect(res?.componentStatus).toBe('within-component');
  });

  it('evaluates column flexural buckling according to AISC Eq. E3-2 / E3-3', () => {
    const input: AiscCheckInput = {
      ...baseInput,
      axialDemand: -800, // 800 kN compression
    };

    const res = evaluateAiscCompression(input);
    expect(res).not.toBeNull();
    // KL/r = 1.0 * 3.5 / 0.0881 ≈ 39.73
    // Fe = pi^2 * 200000000 / (39.73^2) ≈ 1250645 kN/m²
    // Fy/Fe = 345000 / 1250645 = 0.2758 <= 2.25 -> Inelastic buckling Eq. E3-2
    // Fcr = 0.658^(0.2758) * 345000 ≈ 307372 kN/m²
    // Pn = 307372 * 0.00589 ≈ 1810.4 kN
    // phi * Pn = 0.90 * 1810.4 ≈ 1629.4 kN
    // ratio = 800 / 1629.4 ≈ 0.491
    expect(res?.ratio.value).toBeGreaterThan(0.40);
    expect(res?.ratio.value).toBeLessThan(0.60);
    expect(res?.componentStatus).toBe('within-component');
  });

  it('evaluates beam plastic flexural yielding according to AISC Eq. F2-1', () => {
    const input: AiscCheckInput = {
      ...baseInput,
      momentDemand: 120, // 120 kN-m
    };

    const res = evaluateAiscFlexure(input);
    expect(res).not.toBeNull();
    // Mp = Fy * Zx = 345000 * 0.000498 = 171.81 kN-m
    // phi_b * Mp = 0.90 * 171.81 = 154.629 kN-m
    // ratio = 120 / 154.629 ≈ 0.776
    expect(res?.resistance.value).toBeCloseTo(154.629, 1);
    expect(res?.ratio.value).toBeCloseTo(0.776, 2);
    expect(res?.componentStatus).toBe('within-component');
  });

  it('evaluates shear web yielding according to AISC Eq. G2-1', () => {
    const input: AiscCheckInput = {
      ...baseInput,
      shearDemand: 150, // 150 kN
    };

    const res = evaluateAiscShear(input);
    expect(res).not.toBeNull();
    // Aw = d * tw = 0.203 * 0.0072 = 0.0014616 m²
    // Vn = 0.6 * 345000 * 0.0014616 = 302.55 kN
    // phi * Vn = 0.90 * 302.55 = 272.29 kN
    // ratio = 150 / 272.29 ≈ 0.55
    expect(res?.resistance.value).toBeCloseTo(272.29, 1);
    expect(res?.ratio.value).toBeCloseTo(0.55, 2);
    expect(res?.componentStatus).toBe('within-component');
  });

  it('flags overstressed elements with ratio > 1.0 and outside-component', () => {
    const input: AiscCheckInput = {
      ...baseInput,
      momentDemand: 250, // 250 kN-m > capacity 154.6 kN-m
    };

    const res = evaluateAiscFlexure(input);
    expect(res?.componentStatus).toBe('outside-component');
    expect(res?.ratio.value).toBeGreaterThan(1.0);
  });
});
