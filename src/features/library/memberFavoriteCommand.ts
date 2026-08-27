import { projectCommandSnapshot, type ProjectCommand } from '../../commands/projectCommand';
import { findStandardMaterial } from '../../data/standardMaterials';
import { findStandardSection } from '../../data/standardSections';
import type { MemberModel, ProjectModel } from '../../types';
import type { PersonalFavorite } from './personalLibrary';

type StructuralFavorite = Exclude<PersonalFavorite, { kind: 'view' }>;

const materialChanges = (materialId: string) => {
  const material = findStandardMaterial(materialId);
  return material ? {
    materialId: material.id,
    properties: { E: material.elasticModulus, G: material.shearModulus, density: material.density },
  } : null;
};

const sectionChanges = (sectionId: string) => {
  const section = findStandardSection(sectionId);
  return section ? {
    sectionId: section.id,
    properties: { A: section.area, I: section.inertiaX },
  } : null;
};

export const isMemberFavoriteAvailable = (favorite: StructuralFavorite) => {
  if (favorite.kind === 'material') return Boolean(findStandardMaterial(favorite.materialId));
  if (favorite.kind === 'section') return Boolean(findStandardSection(favorite.sectionId));
  return Boolean(findStandardMaterial(favorite.materialId) && findStandardSection(favorite.sectionId));
};

export const buildMemberFavoriteCommand = (
  project: ProjectModel,
  member: MemberModel,
  favorite: PersonalFavorite,
): ProjectCommand | null => {
  if (favorite.kind === 'view') return null;
  if (favorite.kind === 'material') {
    const material = materialChanges(favorite.materialId);
    return material ? {
      kind: 'member.material.apply', description: `Aplicar favorito ${favorite.name} a ${member.id}`,
      memberId: member.id, ...material,
    } : null;
  }
  if (favorite.kind === 'section') {
    const section = sectionChanges(favorite.sectionId);
    return section ? {
      kind: 'member.section.apply', description: `Aplicar favorito ${favorite.name} a ${member.id}`,
      memberId: member.id, ...section,
    } : null;
  }
  const material = materialChanges(favorite.materialId);
  const section = sectionChanges(favorite.sectionId);
  if (!material || !section) return null;
  return {
    kind: 'selection.bulk.apply',
    description: `Aplicar favorito ${favorite.name} a ${member.id}`,
    entries: [{ memberIds: [member.id], changes: { material, section } }],
    nodeEntries: [], nodalLoadEntries: [], memberLoadEntries: [],
    sourceSnapshot: projectCommandSnapshot(project),
  };
};
