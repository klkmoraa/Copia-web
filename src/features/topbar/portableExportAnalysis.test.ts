import { describe, expect, it } from 'vitest';
import { createHibbelerStyleDiagramPractice } from '../../data/defaultProject';
import { analyzeForPortableExport } from './portableExportAnalysis';

describe('análisis para exportación portable', () => {
  it('respeta el modo P-Delta cuando no existe un resultado interactivo reutilizable', () => {
    const project = createHibbelerStyleDiagramPractice();
    project.settings.analysisMode = 'p-delta';

    const result = analyzeForPortableExport(project, null);

    expect(result.success).toBe(true);
    expect(result.pDelta).toMatchObject({ experimental: true, converged: true });
    expect(result.linearSolver).toMatchObject({ policy: 'dense', backend: 'dense-lu' });
  });
});
