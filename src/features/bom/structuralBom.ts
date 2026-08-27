import { findStandardMaterial } from '../../data/standardMaterials';
import { findStandardSection } from '../../data/standardSections';
import { formatMachineNumber } from '../../utils/numberFormat';
import type { MemberModel, MemberPropertyOrigin, ProjectModel } from '../../types';

const STANDARD_GRAVITY_M_S2 = 9.80665;
const QUANTITY_RELATIVE_TOLERANCE = 1e-9;

export type BomMemberType = Extract<MemberModel['type'], 'frame' | 'truss'>;
export type BomIdentityFilter = 'all' | 'catalog' | 'unresolved';
export type BomIdentityStatus = Exclude<BomIdentityFilter, 'all'>;
export type BomWarning =
  | 'explicit-catalog-identity-required'
  | 'catalog-entry-missing'
  | 'catalog-quantity-properties-drifted'
  | 'quantity-properties-unavailable';

export interface StructuralBomOptions {
  readonly memberTypes?: readonly BomMemberType[];
  readonly identity?: BomIdentityFilter;
}

export interface StructuralBomProvenance {
  readonly memberId: string;
  readonly nodeI: string;
  readonly nodeJ: string;
  readonly lengthM: number;
}

export interface StructuralBomRow {
  readonly rowId: string;
  readonly identityStatus: BomIdentityStatus;
  readonly memberType: BomMemberType;
  readonly materialId: string;
  readonly materialName: string;
  readonly materialOrigin: MemberPropertyOrigin;
  readonly sectionId: string;
  readonly sectionName: string;
  readonly sectionOrigin: MemberPropertyOrigin;
  readonly memberCount: number;
  readonly totalLengthM: number;
  readonly totalVolumeM3: number | null;
  readonly totalMassKg: number | null;
  readonly totalSelfWeightKn: number | null;
  readonly provenance: readonly StructuralBomProvenance[];
  readonly source: 'explicit-catalog-identities' | 'member-properties-unresolved';
  readonly warnings: readonly BomWarning[];
}

export interface StructuralBom {
  readonly schemaVersion: 1;
  readonly kind: 'structural-bom';
  readonly project: {
    readonly id: string;
    readonly name: string;
    readonly schemaVersion: number;
  };
  readonly basis: {
    readonly geometry: 'node-to-node-euclidean';
    readonly grouping: 'explicit-material-section-member-type';
    readonly allowancePercent: 0;
    readonly lengthUnit: 'm';
    readonly volumeUnit: 'm³';
    readonly massUnit: 'kg';
    readonly selfWeightUnit: 'kN';
  };
  readonly filters: {
    readonly memberTypes: readonly BomMemberType[];
    readonly identity: BomIdentityFilter;
  };
  readonly rows: readonly StructuralBomRow[];
  readonly excluded: readonly {
    readonly memberId: string;
    readonly reason: 'rigid-member' | 'invalid-geometry';
  }[];
  readonly totals: {
    readonly rowCount: number;
    readonly memberCount: number;
    readonly totalLengthM: number;
    readonly totalVolumeM3: number | null;
    readonly totalMassKg: number | null;
    readonly totalSelfWeightKn: number | null;
  };
}

interface MutableBomRow extends Omit<StructuralBomRow,
  'memberCount' | 'totalLengthM' | 'totalVolumeM3' | 'totalMassKg' | 'totalSelfWeightKn' | 'provenance'> {
  memberCount: number;
  totalLengthM: number;
  totalVolumeM3: number | null;
  totalMassKg: number | null;
  totalSelfWeightKn: number | null;
  provenance: StructuralBomProvenance[];
}

const lexical = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;

const nearlyEqual = (actual: number | undefined, expected: number): boolean => (
  typeof actual === 'number'
  && Number.isFinite(actual)
  && Math.abs(actual - expected) <= Math.max(1e-12, Math.abs(expected) * QUANTITY_RELATIVE_TOLERANCE)
);

const normalizeMemberTypes = (requested: readonly BomMemberType[] | undefined): readonly BomMemberType[] => {
  const wanted = new Set(requested ?? ['frame', 'truss']);
  return (['frame', 'truss'] as const).filter((candidate) => wanted.has(candidate));
};

const originOf = (origin: MemberPropertyOrigin | undefined): MemberPropertyOrigin => origin ?? 'legacy';

const catalogResolution = (member: MemberModel): {
  status: BomIdentityStatus;
  warning?: BomWarning;
  material: ReturnType<typeof findStandardMaterial>;
  section: ReturnType<typeof findStandardSection>;
} => {
  const material = member.materialId ? findStandardMaterial(member.materialId) : undefined;
  const section = member.sectionId ? findStandardSection(member.sectionId) : undefined;
  const explicitCatalog = member.materialOrigin === 'catalog'
    && member.sectionOrigin === 'catalog'
    && Boolean(member.materialId)
    && Boolean(member.sectionId);
  if (!explicitCatalog) return { status: 'unresolved', warning: 'explicit-catalog-identity-required', material, section };
  if (!material || !section) return { status: 'unresolved', warning: 'catalog-entry-missing', material, section };
  if (!nearlyEqual(member.A, section.area) || !nearlyEqual(member.density, material.density)) {
    return { status: 'unresolved', warning: 'catalog-quantity-properties-drifted', material, section };
  }
  return { status: 'catalog', material, section };
};

const memberQuantities = (member: MemberModel, lengthM: number): {
  volumeM3: number | null;
  massKg: number | null;
  selfWeightKn: number | null;
} => {
  if (!Number.isFinite(member.A) || member.A <= 0) {
    return { volumeM3: null, massKg: null, selfWeightKn: null };
  }
  const volumeM3 = member.A * lengthM;
  if (!Number.isFinite(member.density) || (member.density ?? 0) <= 0) {
    return { volumeM3, massKg: null, selfWeightKn: null };
  }
  const massKg = volumeM3 * member.density!;
  return { volumeM3, massKg, selfWeightKn: massKg * STANDARD_GRAVITY_M_S2 / 1000 };
};

const appendQuantity = (current: number | null, next: number | null): number | null => (
  current === null || next === null ? null : current + next
);

const sumComplete = (rows: readonly StructuralBomRow[], key: 'totalVolumeM3' | 'totalMassKg' | 'totalSelfWeightKn'): number | null => (
  rows.some((row) => row[key] === null)
    ? null
    : rows.reduce((sum, row) => sum + (row[key] ?? 0), 0)
);

/**
 * Pure geometric takeoff. It never writes to the project and deliberately does
 * not infer a material/section identity from matching numerical properties.
 */
export const buildStructuralBom = (
  project: ProjectModel,
  options: StructuralBomOptions = {},
): StructuralBom => {
  const memberTypes = normalizeMemberTypes(options.memberTypes);
  const identity = options.identity ?? 'all';
  const wantedTypes = new Set(memberTypes);
  const nodes = new Map(project.nodes.map((node) => [node.id, node]));
  const grouped = new Map<string, MutableBomRow>();
  const excluded: StructuralBom['excluded'][number][] = [];

  for (const member of [...project.members].sort((left, right) => lexical(left.id, right.id))) {
    if (member.type === 'rigid') {
      excluded.push({ memberId: member.id, reason: 'rigid-member' });
      continue;
    }
    if (!wantedTypes.has(member.type)) continue;
    const nodeI = nodes.get(member.i);
    const nodeJ = nodes.get(member.j);
    const lengthM = nodeI && nodeJ ? Math.hypot(nodeJ.x - nodeI.x, nodeJ.y - nodeI.y) : Number.NaN;
    if (!Number.isFinite(lengthM) || lengthM <= 0) {
      excluded.push({ memberId: member.id, reason: 'invalid-geometry' });
      continue;
    }

    const resolution = catalogResolution(member);
    if (identity !== 'all' && resolution.status !== identity) continue;
    const rowId = resolution.status === 'catalog'
      ? `catalog:${member.type}:${member.materialId}:${member.sectionId}`
      : `member:${member.id}`;
    const quantities = memberQuantities(member, lengthM);
    const warnings = [resolution.warning, quantities.massKg === null ? 'quantity-properties-unavailable' : undefined]
      .filter((warning): warning is BomWarning => Boolean(warning));
    const provenance = { memberId: member.id, nodeI: member.i, nodeJ: member.j, lengthM };
    const current = grouped.get(rowId);

    if (current) {
      current.memberCount += 1;
      current.totalLengthM += lengthM;
      current.totalVolumeM3 = appendQuantity(current.totalVolumeM3, quantities.volumeM3);
      current.totalMassKg = appendQuantity(current.totalMassKg, quantities.massKg);
      current.totalSelfWeightKn = appendQuantity(current.totalSelfWeightKn, quantities.selfWeightKn);
      current.provenance.push(provenance);
      continue;
    }

    grouped.set(rowId, {
      rowId,
      identityStatus: resolution.status,
      memberType: member.type,
      materialId: member.materialId ?? '',
      materialName: resolution.material?.name ?? member.materialId ?? '',
      materialOrigin: originOf(member.materialOrigin),
      sectionId: member.sectionId ?? '',
      sectionName: resolution.section?.name ?? member.sectionId ?? '',
      sectionOrigin: originOf(member.sectionOrigin),
      memberCount: 1,
      totalLengthM: lengthM,
      totalVolumeM3: quantities.volumeM3,
      totalMassKg: quantities.massKg,
      totalSelfWeightKn: quantities.selfWeightKn,
      provenance: [provenance],
      source: resolution.status === 'catalog' ? 'explicit-catalog-identities' : 'member-properties-unresolved',
      warnings,
    });
  }

  const rows = [...grouped.values()]
    .sort((left, right) => lexical(left.rowId, right.rowId))
    .map((row): StructuralBomRow => ({
      ...row,
      provenance: [...row.provenance].sort((left, right) => lexical(left.memberId, right.memberId)),
      warnings: [...new Set(row.warnings)],
    }));

  return {
    schemaVersion: 1,
    kind: 'structural-bom',
    project: { id: project.id, name: project.name, schemaVersion: project.schemaVersion },
    basis: {
      geometry: 'node-to-node-euclidean',
      grouping: 'explicit-material-section-member-type',
      allowancePercent: 0,
      lengthUnit: 'm', volumeUnit: 'm³', massUnit: 'kg', selfWeightUnit: 'kN',
    },
    filters: { memberTypes, identity },
    rows,
    excluded: excluded.sort((left, right) => lexical(left.memberId, right.memberId)),
    totals: {
      rowCount: rows.length,
      memberCount: rows.reduce((sum, row) => sum + row.memberCount, 0),
      totalLengthM: rows.reduce((sum, row) => sum + row.totalLengthM, 0),
      totalVolumeM3: sumComplete(rows, 'totalVolumeM3'),
      totalMassKg: sumComplete(rows, 'totalMassKg'),
      totalSelfWeightKn: sumComplete(rows, 'totalSelfWeightKn'),
    },
  };
};

const CSV_HEADER = [
  'schema_version', 'row_id', 'identity_status', 'member_type',
  'material_id', 'material_name', 'material_origin',
  'section_id', 'section_name', 'section_origin',
  'member_count', 'total_length_m', 'total_volume_m3', 'total_mass_kg', 'total_self_weight_kn',
  'member_ids', 'provenance', 'source', 'warnings',
] as const;

const csvCell = (value: string | number): string => {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

const csvRow = (values: readonly (string | number)[]): string => values.map(csvCell).join(',');

export const buildStructuralBomCsv = (bom: StructuralBom): string => {
  const rows = [csvRow(CSV_HEADER)];
  for (const item of bom.rows) rows.push(csvRow([
    bom.schemaVersion,
    item.rowId,
    item.identityStatus,
    item.memberType,
    item.materialId,
    item.materialName,
    item.materialOrigin,
    item.sectionId,
    item.sectionName,
    item.sectionOrigin,
    item.memberCount,
    formatMachineNumber(item.totalLengthM),
    formatMachineNumber(item.totalVolumeM3),
    formatMachineNumber(item.totalMassKg),
    formatMachineNumber(item.totalSelfWeightKn),
    item.provenance.map((source) => source.memberId).join('|'),
    item.provenance.map((source) => `${source.memberId}:${source.nodeI}-${source.nodeJ}:${formatMachineNumber(source.lengthM)}`).join('|'),
    item.source,
    item.warnings.join('|'),
  ]));
  return `\uFEFF${rows.join('\r\n')}\r\n`;
};

const safeFilename = (name: string): string => name
  .normalize('NFKD')
  .replace(/[^a-zA-Z0-9 _-]/g, '')
  .trim()
  .replace(/\s+/g, '-')
  .toLowerCase() || 'structureco';

export const structuralBomCsvFilename = (project: Pick<ProjectModel, 'name'>): string => (
  `${safeFilename(project.name)}-bom-estructural.csv`
);

export const createStructuralBomCsvBlob = (bom: StructuralBom): Blob => (
  new Blob([buildStructuralBomCsv(bom)], { type: 'text/csv;charset=utf-8' })
);

export const downloadStructuralBomCsv = (project: Pick<ProjectModel, 'name'>, bom: StructuralBom): void => {
  const url = URL.createObjectURL(createStructuralBomCsvBlob(bom));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = structuralBomCsvFilename(project);
  anchor.style.display = 'none';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
};
