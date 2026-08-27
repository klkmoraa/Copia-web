import { STRUCTURAL_ASSET_REGISTRY } from '../registry';
import { isThreeStructuralAssetId, type ThreeStructuralAssetId } from '../threeStructuralRender';

export const STUDIO_PRESET_STORAGE_KEY = 'structureCo.structural-asset-presets.v1';
export const STUDIO_PRESET_SCHEMA_VERSION = 1 as const;

export type StudioMaterial = 'factory' | 'concrete' | 'steel' | 'timber' | 'technical';
export type StudioCamera = 'isometric' | 'front' | 'side' | 'top';
export type StudioDetail = 'hero' | 'card' | 'compact';
export type StudioPreviewTheme = 'light' | 'dark';

export interface StudioParameters {
  assetId: ThreeStructuralAssetId;
  widthScale: number;
  heightScale: number;
  depthScale: number;
  material: StudioMaterial;
  camera: StudioCamera;
  detail: StudioDetail;
  previewTheme: StudioPreviewTheme;
}

export interface FactoryStudioPreset {
  readonly kind: 'factory';
  readonly id: string;
  readonly assetId: ThreeStructuralAssetId;
  readonly name: string;
  readonly parameters: Readonly<StudioParameters>;
}

export interface PersonalStudioPreset {
  readonly kind: 'personal';
  readonly id: string;
  readonly name: string;
  readonly factoryAssetId: ThreeStructuralAssetId;
  readonly parameters: StudioParameters;
}

const materials: readonly StudioMaterial[] = ['factory', 'concrete', 'steel', 'timber', 'technical'];
const cameras: readonly StudioCamera[] = ['isometric', 'front', 'side', 'top'];
const details: readonly StudioDetail[] = ['hero', 'card', 'compact'];
const themes: readonly StudioPreviewTheme[] = ['light', 'dark'];
const firstAssetId = STRUCTURAL_ASSET_REGISTRY[0].id as ThreeStructuralAssetId;
const includes = <T extends string>(values: readonly T[], value: unknown): value is T => typeof value === 'string' && values.includes(value as T);

const normalizeScale = (value: unknown) => {
  const numeric = typeof value === 'number' && Number.isFinite(value) ? value : 1;
  const clamped = Math.min(1.4, Math.max(.75, numeric));
  return Math.round((Math.round((clamped - .75) / .05) * .05 + .75) * 100) / 100;
};

export const createFactoryStudioParameters = (assetId: string): StudioParameters => ({
  assetId: isThreeStructuralAssetId(assetId) ? assetId : firstAssetId,
  widthScale: 1,
  heightScale: 1,
  depthScale: 1,
  material: 'factory',
  camera: 'isometric',
  detail: 'hero',
  previewTheme: 'light',
});

export const normalizeStudioParameters = (input: Partial<StudioParameters> & { assetId?: string }): StudioParameters => {
  const assetId = input.assetId;
  return {
    assetId: isThreeStructuralAssetId(assetId ?? '') ? assetId as ThreeStructuralAssetId : firstAssetId,
    widthScale: normalizeScale(input.widthScale),
    heightScale: normalizeScale(input.heightScale),
    depthScale: normalizeScale(input.depthScale),
    material: includes(materials, input.material) ? input.material : 'factory',
    camera: includes(cameras, input.camera) ? input.camera : 'isometric',
    detail: includes(details, input.detail) ? input.detail : 'hero',
    previewTheme: includes(themes, input.previewTheme) ? input.previewTheme : 'light',
  };
};

const freezeFactory = (assetId: ThreeStructuralAssetId, name: string): FactoryStudioPreset => Object.freeze({
  kind: 'factory' as const,
  id: `factory:${assetId}`,
  assetId,
  name,
  parameters: Object.freeze(createFactoryStudioParameters(assetId)),
});

export const FACTORY_STUDIO_PRESETS: readonly FactoryStudioPreset[] = Object.freeze(
  STRUCTURAL_ASSET_REGISTRY.map((asset) => freezeFactory(asset.id as ThreeStructuralAssetId, asset.label)),
);

const normalizeName = (name: string) => {
  const normalized = name.trim();
  if (!normalized) throw new Error('El preset necesita un nombre.');
  return normalized;
};

const assertUniqueName = (library: readonly PersonalStudioPreset[], name: string, exceptId?: string) => {
  const key = name.toLocaleLowerCase();
  if (library.some((preset) => preset.id !== exceptId && preset.name.toLocaleLowerCase() === key)) {
    throw new Error('El nombre debe ser único.');
  }
};

const assertUsableId = (library: readonly PersonalStudioPreset[], id: string) => {
  if (!id.trim() || library.some((preset) => preset.id === id)) throw new Error('El identificador del diseño debe ser único y no vacío.');
};

export const createPersonalPreset = (
  library: readonly PersonalStudioPreset[],
  factoryAssetId: string,
  name: string,
  id = `personal:${crypto.randomUUID()}`,
) => {
  const normalizedName = normalizeName(name);
  assertUniqueName(library, normalizedName);
  assertUsableId(library, id);
  if (!isThreeStructuralAssetId(factoryAssetId)) throw new Error('Activo estructural inválido.');
  return [...library, { kind: 'personal' as const, id, name: normalizedName, factoryAssetId, parameters: createFactoryStudioParameters(factoryAssetId) }];
};

export const updatePersonalPreset = (library: readonly PersonalStudioPreset[], id: string, patch: Partial<StudioParameters>) =>
  library.map((preset) => preset.id === id ? { ...preset, parameters: normalizeStudioParameters({ ...preset.parameters, ...patch }) } : preset);

export const renamePersonalPreset = (library: readonly PersonalStudioPreset[], id: string, name: string) => {
  const normalizedName = normalizeName(name);
  assertUniqueName(library, normalizedName, id);
  return library.map((preset) => preset.id === id ? { ...preset, name: normalizedName } : preset);
};

export const duplicatePersonalPreset = (library: readonly PersonalStudioPreset[], id: string, name: string, duplicateId = `personal:${crypto.randomUUID()}`) => {
  const source = library.find((preset) => preset.id === id);
  if (!source) return [...library];
  const normalizedName = normalizeName(name);
  assertUniqueName(library, normalizedName);
  assertUsableId(library, duplicateId);
  return [...library, { ...source, id: duplicateId, name: normalizedName, parameters: { ...source.parameters } }];
};

export const deletePersonalPreset = (library: readonly PersonalStudioPreset[], id: string) => library.filter((preset) => preset.id !== id);

export const restorePersonalPreset = (library: readonly PersonalStudioPreset[], id: string) => library.map((preset) => preset.id === id
  ? { ...preset, parameters: createFactoryStudioParameters(preset.factoryAssetId) }
  : preset);

const decodePreset = (raw: unknown): PersonalStudioPreset => {
  if (!raw || typeof raw !== 'object') throw new Error('Preset inválido');
  const value = raw as Record<string, unknown>;
  if (typeof value.id !== 'string' || !value.id.trim() || typeof value.name !== 'string' || !isThreeStructuralAssetId(String(value.factoryAssetId))) throw new Error('Preset inválido');
  if (!value.parameters || typeof value.parameters !== 'object') throw new Error('Parámetros inválidos');
  const parameters = value.parameters as Record<string, unknown>;
  if (!isThreeStructuralAssetId(String(parameters.assetId)) || ![parameters.widthScale, parameters.heightScale, parameters.depthScale].every((item) => typeof item === 'number')) throw new Error('Parámetros inválidos');
  if (!includes(materials, parameters.material) || !includes(cameras, parameters.camera) || !includes(details, parameters.detail) || !includes(themes, parameters.previewTheme)) throw new Error('Parámetros inválidos');
  return {
    kind: 'personal', id: value.id, name: normalizeName(value.name), factoryAssetId: value.factoryAssetId as ThreeStructuralAssetId,
    parameters: normalizeStudioParameters(parameters as unknown as StudioParameters),
  };
};

export const readPersonalPresetLibrary = (storage: Storage): PersonalStudioPreset[] => {
  try {
    const serialized = storage.getItem(STUDIO_PRESET_STORAGE_KEY);
    if (!serialized) return [];
    const raw = JSON.parse(serialized) as unknown;
    if (!raw || typeof raw !== 'object') return [];
    const payload = raw as { schemaVersion?: unknown; presets?: unknown };
    if (payload.schemaVersion !== undefined && payload.schemaVersion !== STUDIO_PRESET_SCHEMA_VERSION) return [];
    if (!Array.isArray(payload.presets)) return [];
    const decoded = payload.presets.map(decodePreset);
    const names = new Set(decoded.map((preset) => preset.name.toLocaleLowerCase()));
    const ids = new Set(decoded.map((preset) => preset.id));
    return names.size === decoded.length && ids.size === decoded.length ? decoded : [];
  } catch {
    return [];
  }
};

export const writePersonalPresetLibrary = (storage: Storage, library: readonly PersonalStudioPreset[]) => {
  try {
    storage.setItem(STUDIO_PRESET_STORAGE_KEY, JSON.stringify({ schemaVersion: STUDIO_PRESET_SCHEMA_VERSION, presets: library }));
    return { ok: true as const };
  } catch {
    return { ok: false as const, reason: 'storage-unavailable' as const };
  }
};
