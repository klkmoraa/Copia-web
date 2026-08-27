// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyProjectPatch, compileProjectCommand } from '../../commands/projectCommand';
import { createDefaultProject } from '../../data/defaultProject';
import { findStandardMaterial } from '../../data/standardMaterials';
import { findStandardSection } from '../../data/standardSections';
import { createFavorite, readPersonalLibrary, writePersonalLibrary } from './personalLibrary';
import { buildMemberFavoriteCommand } from './memberFavoriteCommand';
import { MemberFavoritesPanel } from './MemberFavoritesPanel';

const NOW = '2026-08-24T15:00:00.000Z';

beforeEach(() => localStorage.clear());
afterEach(cleanup);

const catalogMemberProject = () => {
  const project = createDefaultProject();
  const member = project.members[0];
  Object.assign(member, {
    materialId: 'steel-a36', materialOrigin: 'catalog',
    sectionId: 'w6x9', sectionOrigin: 'catalog',
  });
  return { project, member };
};

describe('member favorite command', () => {
  it('applies a pair through one reversible bulk command using explicit ids', () => {
    const { project, member } = catalogMemberProject();
    const favorite = createFavorite([], {
      kind: 'pair', name: 'A992 + IPE', materialId: 'steel-a992', sectionId: 'ipe-300', unitsAtSave: 'kN-m',
    }, 'fav-pair', NOW)[0];

    const command = buildMemberFavoriteCommand(project, member, favorite);
    expect(command).toMatchObject({ kind: 'selection.bulk.apply', entries: [{ memberIds: [member.id] }] });
    const compiled = compileProjectCommand(project, command!);
    const applied = applyProjectPatch(project, compiled.forward);
    const material = findStandardMaterial('steel-a992')!;
    const section = findStandardSection('ipe-300')!;
    expect(applied.members[0]).toMatchObject({
      materialId: material.id, materialOrigin: 'catalog', E: material.elasticModulus,
      sectionId: section.id, sectionOrigin: 'catalog', A: section.area, I: section.inertiaX,
    });
    expect(applyProjectPatch(applied, compiled.inverse)).toEqual(project);
  });

  it('refuses a retired catalog reference instead of inferring from numeric values', () => {
    const { project, member } = catalogMemberProject();
    const favorite = {
      kind: 'material', id: 'retired', name: 'Retirado', materialId: 'missing-material', unitsAtSave: 'kN-m', createdAt: NOW, updatedAt: NOW,
    } as const;
    expect(buildMemberFavoriteCommand(project, member, favorite)).toBeNull();
  });
});

describe('MemberFavoritesPanel', () => {
  it('does not mutate until Apply and saves only the explicit current identities', async () => {
    const { project, member } = catalogMemberProject();
    const favorite = createFavorite([], {
      kind: 'pair', name: 'Par reutilizable', materialId: 'steel-a992', sectionId: 'ipe-300', unitsAtSave: 'kN-m',
    }, 'fav-pair', NOW)[0];
    writePersonalLibrary(localStorage, [favorite]);
    const executeProjectCommand = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<MemberFavoritesPanel project={project} member={member} language="es" units="kN-m" executeProjectCommand={executeProjectCommand} />);

    expect(executeProjectCommand).not.toHaveBeenCalled();
    expect(screen.getByRole('option', { name: /Par reutilizable/ })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Aplicar favorito' }));
    expect(executeProjectCommand).toHaveBeenCalledOnce();
    expect(executeProjectCommand.mock.calls[0][0]).toMatchObject({ kind: 'selection.bulk.apply' });

    await user.type(screen.getByRole('textbox', { name: 'Nombre para guardar' }), 'Identidad actual');
    await user.click(screen.getByRole('button', { name: 'Guardar par' }));
    expect(readPersonalLibrary(localStorage).find((item) => item.name === 'Identidad actual')).toMatchObject({
      kind: 'pair', materialId: 'steel-a36', sectionId: 'w6x9',
    });
  });

  it('disables structural saves when the current member has no catalog identity', () => {
    const { project, member } = catalogMemberProject();
    delete member.materialId;
    delete member.sectionId;
    member.materialOrigin = 'custom';
    member.sectionOrigin = 'custom';
    render(<MemberFavoritesPanel project={project} member={member} language="en" units="kN-m" executeProjectCommand={vi.fn()} />);

    expect((screen.getByRole('button', { name: 'Save material' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Save section' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Save pair' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/catalog identities only/i)).toBeTruthy();
  });
});
