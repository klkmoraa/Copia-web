import { describe, expect, it } from 'vitest';
import {
  evaluateEurocodeCompression,
  evaluateEurocodeFlexure,
  evaluateEurocodeShear,
  evaluateEurocodeTension,
  type EurocodeCheckInput,
} from './eurocode3';

describe('Eurocode 3 (EN 1993-1-1) Design Module', () => {
  const baseInput: EurocodeCheckInput = {
    memberId: 'EC1',
    materialId: 'steel-s275',
    sectionId: 'ipe-240',
    combinationId: 'ULS-1',
    length: 4.0, // 4 m
    axialDemand: 0,
    momentDemand: 0,
    shearDemand: 0,
    yieldStrength: 275000, // 275 MPa in kN/m²
    elasticModulus: 210000000, // 210 GPa in kN/m²
    grossArea: 0.00391, // m²
    inertiaX: 0.0000389, // m⁴
    sectionModulusX: 0.000324, // m³
    plasticModulusX: 0.000367, // m³
    radiusOfGyrationX: 0.0997, // m
    depth: 0.24,
    webThickness: 0.0062,
    gammaM0: 1.0,
    gammaM1: 1.0,
  };

  it('evaluates tension resistance according to EN 1993-1-1 §6.2.3', () => {
    const input: EurocodeCheckInput = {
      ...baseInput,
      axialDemand: 500, // 500 kN tension
    };

    const res = evaluateEurocodeTension(input);
    expect(res).not.toBeNull();
    // Nt,Rd = (A * fy) / gamma_M0 = (0.00391 * 275000) / 1.0 = 1075.25 kN
    // ratio = 500 / 1075.25 ≈ 0.465
    expect(res?.resistance.value).toBeCloseTo(1075.25, 1);
    expect(res?.ratio.value).toBeCloseTo(0.465, 3);
    expect(res?.componentStatus).toBe('within-component');
  });

  it('evaluates flexural buckling resistance according to EN 1993-1-1 §6.3.1', () => {
    const input: EurocodeCheckInput = {
      ...baseInput,
      axialDemand: -400, // 400 kN compression
    };

    const res = evaluateEurocodeCompression(input);
    expect(res).not.toBeNull();
    expect(res?.ratio.value).toBeGreaterThan(0.3);
    expect(res?.ratio.value).toBeLessThan(1.0);
    expect(res?.componentStatus).toBe('within-component');
  });

  it('evaluates plastic bending resistance according to EN 1993-1-1 §6.2.5', () => {
    const input: EurocodeCheckInput = {
      ...baseInput,
      momentDemand: 65, // 65 kN-m
    };

    const res = evaluateEurocodeFlexure(input);
    expect(res).not.toBeNull();
    // Mpl,Rd = (Wpl * fy) / gamma_M0 = (0.000367 * 275000) / 1.0 = 100.925 kN-m
    // ratio = 65 / 100.925 ≈ 0.644
    expect(res?.resistance.value).toBeCloseTo(100.925, 1);
    expect(res?.ratio.value).toBeCloseTo(0.644, 3);
    expect(res?.componentStatus).toBe('within-component');
  });

  it('evaluates shear plastic resistance according to EN 1993-1-1 §6.2.6', () => {
    const input: EurocodeCheckInput = {
      ...baseInput,
      shearDemand: 100, // 100 kN
    };

    const res = evaluateEurocodeShear(input);
    expect(res).not.toBeNull();
    // Av = d * tw = 0.24 * 0.0062 = 0.001488 m²
    // Vpl,Rd = (0.001488 * 275000 / sqrt(3)) / 1.0 ≈ 236.25 kN
    // ratio = 100 / 236.25 ≈ 0.423
    expect(res?.resistance.value).toBeCloseTo(236.25, 1);
    expect(res?.ratio.value).toBeCloseTo(0.423, 2);
    expect(res?.componentStatus).toBe('within-component');
  });
});
