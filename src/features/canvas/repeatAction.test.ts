import { describe, expect, it } from 'vitest';
import { createDefaultProject } from '../../data/defaultProject';
import { resolveRepeatRecipe } from './repeatAction';

describe('resolveRepeatRecipe', () => {
  it('recovers member properties without identity or topology', () => {
    const project = createDefaultProject();
    const member = project.members[0];
    const recipe = resolveRepeatRecipe(project, { kind: 'member', id: member.id });

    expect(recipe).toMatchObject({ kind: 'member', tool: 'member', template: { E: member.E, A: member.A, I: member.I, type: member.type } });
    expect(recipe && 'template' in recipe && recipe.template).not.toHaveProperty('id');
    expect(recipe && 'template' in recipe && recipe.template).not.toHaveProperty('i');
    expect(recipe && 'template' in recipe && recipe.template).not.toHaveProperty('j');
  });

  it('recovers load parameters but leaves the new destination to confirmation', () => {
    const project = createDefaultProject();
    const load = project.memberLoads[0];
    const recipe = resolveRepeatRecipe(project, { kind: 'memberLoad', id: load.id });

    expect(recipe).toMatchObject({ kind: 'memberLoad', tool: load.type === 'distributed' ? 'distributedLoad' : load.type === 'moment' ? 'moment' : 'pointLoad' });
    expect(recipe && 'template' in recipe && recipe.template).not.toHaveProperty('id');
    expect(recipe && 'template' in recipe && recipe.template).not.toHaveProperty('memberId');
  });

  it('excludes supports, multi-selection and missing objects', () => {
    const project = createDefaultProject();
    expect(resolveRepeatRecipe(project, null)).toBeNull();
    expect(resolveRepeatRecipe(project, { kind: 'multi', nodeIds: ['N1'], memberIds: [] })).toBeNull();
    expect(resolveRepeatRecipe(project, { kind: 'node', id: 'missing' })).toBeNull();
  });
});
