import { describe, expect, it } from 'vitest';
import { createDefaultProject } from '../data/defaultProject';
import type { ProjectModel } from '../types';
import { analyzeProjectAuto } from './pDelta';
import { analyzeProject } from './solver';

/**
 * `analyzeProjectAuto` es el punto único de despacho de la aplicación: lo llaman
 * `ProjectContext` y el worker de análisis. Cuando pasó a enrutarse por el
 * conjunto activo, la pregunta que decidía si el cambio era seguro no era «¿los
 * cables funcionan?» sino «¿los modelos que NO tienen cables siguen dando
 * exactamente lo mismo?». Estas pruebas son esa pregunta.
 */
const withRestricted = (project: ProjectModel, behavior: 'tension-only' | 'compression-only'): ProjectModel => ({
  ...project,
  members: project.members.map((member, index) => index === 0 ? { ...member, axialBehavior: behavior } : member),
});

describe('despacho del análisis · invariancia', () => {
  it('un modelo sin barras de signo restringido da exactamente el resultado de siempre', () => {
    const project = createDefaultProject();
    const direct = analyzeProject(project);
    const dispatched = analyzeProjectAuto(project);
    expect(dispatched.displacements).toEqual(direct.displacements);
    expect(dispatched.nodeResults).toEqual(direct.nodeResults);
    expect(dispatched.memberResults).toEqual(direct.memberResults);
    expect(dispatched.equilibrium).toEqual(direct.equilibrium);
  });

  it('y no estrena campo: `activeSet` sigue sin existir donde no hay cables', () => {
    expect(analyzeProjectAuto(createDefaultProject()).activeSet).toBeUndefined();
  });

  it('respeta `includeEducationTrace` igual que antes', () => {
    const project = createDefaultProject();
    expect(analyzeProjectAuto(project, null, { includeEducationTrace: false }).educationTrace).toBeUndefined();
    expect(analyzeProjectAuto(project, null, { includeEducationTrace: true }).educationTrace).toBeTruthy();
  });
});

describe('despacho del análisis · con barras de signo restringido', () => {
  it('en primer orden sí aplica la restricción y lo publica', () => {
    /* La primera barra del pórtico por defecto es un montante, y bajo su propia
       carga trabaja a compresión. Declararla «sólo compresión» no cambia nada
       —sigue trabajando— y por eso el conjunto activo converge a la primera con
       la barra dentro: es el caso en el que la restricción se aplica y se
       cumple. */
    const result = analyzeProjectAuto(withRestricted(createDefaultProject(), 'compression-only'));
    expect(result.success).toBe(true);
    expect(result.activeSet).toBeDefined();
    expect(result.activeSet!.converged).toBe(true);
    expect(result.activeSet!.inactiveMemberIds).toEqual([]);
  });

  it('y cuando la restricción descuelga la barra, dice que el modelo no se sostiene', () => {
    /* La misma barra declarada «sólo tracción» se afloja, y sin ese montante el
       pórtico es un mecanismo. La respuesta correcta ahí no es un resultado
       peor: es decir que esa estructura no se sostiene. */
    const result = analyzeProjectAuto(withRestricted(createDefaultProject(), 'tension-only'));
    expect(result.success).toBe(false);
    expect(result.activeSet!.converged).toBe(false);
    expect(result.activeSet!.inactiveMemberIds).toEqual(['M1']);
    expect(result.activeSet!.reason).toContain('estable');
  });

  it('en P-Delta avisa de que la restricción no se aplicó, en vez de callarlo', () => {
    const project = withRestricted(createDefaultProject(), 'compression-only');
    project.settings.analysisMode = 'p-delta';
    const result = analyzeProjectAuto(project);
    expect(result.issues.map((issue) => issue.id)).toContain('pdelta-ignores-axial-behavior');
    // Y no finge haberlo hecho: no hay diagnóstico de conjunto activo.
    expect(result.activeSet).toBeUndefined();
  });

  it('P-Delta sin cables no inventa el aviso', () => {
    const project = createDefaultProject();
    project.settings.analysisMode = 'p-delta';
    const result = analyzeProjectAuto(project);
    expect(result.issues.map((issue) => issue.id)).not.toContain('pdelta-ignores-axial-behavior');
  });
});
