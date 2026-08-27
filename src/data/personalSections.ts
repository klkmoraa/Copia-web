export const PERSONAL_SECTIONS_STORAGE_KEY = 'structureCo.personal-sections.v1';
export const PERSONAL_SECTIONS_SCHEMA_VERSION = 1 as const;
export const SECTION_FORMULA_VERSION = 'section-properties-v1' as const;

const MIN_DIMENSION = 0.001;
const MAX_DIMENSION = 10;

export type ParametricSectionDefinition =
  | { readonly family: 'rectangle'; readonly width: number; readonly depth: number }
  | { readonly family: 'circle'; readonly diameter: number }
  | { readonly family: 'symmetric-i'; readonly width: number; readonly depth: number; readonly webThickness: number; readonly flangeThickness: number }
  | { readonly family: 'rectangular-box'; readonly width: number; readonly depth: number; readonly thickness: number };

export interface ParametricSectionProperties {
  readonly area: number;
  readonly inertiaX: number;
  readonly inertiaY: number;
  readonly sectionModulusX: number;
  readonly sectionModulusY: number;
  readonly radiusX: number;
  readonly radiusY: number;
}

export interface PersonalParametricSection {
  readonly kind: 'personal-parametric-section';
  readonly id: string;
  readonly revision: number;
  readonly name: string;
  readonly formulaVersion: typeof SECTION_FORMULA_VERSION;
  readonly definition: ParametricSectionDefinition;
  readonly properties: ParametricSectionProperties;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface PersonalSectionDraft {
  readonly name: string;
  readonly definition: ParametricSectionDefinition;
}

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const isIsoDate = (value: unknown): value is string => typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Date.parse(value));
const normalizeName = (raw: string) => {
  const name = raw.trim().replace(/\s+/g, ' ');
  if (!name) throw new Error('La sección necesita un nombre.');
  if (name.length > 80) throw new Error('El nombre de la sección no puede superar 80 caracteres.');
  return name;
};
const nameKey = (name: string) => normalizeName(name).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();

const dimension = (value: unknown, path: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${path} debe ser un número finito.`);
  if (value < MIN_DIMENSION || value > MAX_DIMENSION) throw new Error(`${path} debe estar entre ${MIN_DIMENSION} m y ${MAX_DIMENSION} m.`);
  return value;
};

const normalizeDefinition = (value: unknown): ParametricSectionDefinition => {
  if (!isRecord(value)) throw new Error('definition debe ser un objeto.');
  if (value.family === 'rectangle') return {
    family: value.family,
    width: dimension(value.width, 'definition.width'),
    depth: dimension(value.depth, 'definition.depth'),
  };
  if (value.family === 'circle') return {
    family: value.family,
    diameter: dimension(value.diameter, 'definition.diameter'),
  };
  if (value.family === 'symmetric-i') {
    const width = dimension(value.width, 'definition.width');
    const depth = dimension(value.depth, 'definition.depth');
    const webThickness = dimension(value.webThickness, 'definition.webThickness');
    const flangeThickness = dimension(value.flangeThickness, 'definition.flangeThickness');
    if (webThickness >= width) throw new Error('definition.webThickness debe ser menor que el ancho total.');
    if (2 * flangeThickness >= depth) throw new Error('definition.flangeThickness debe dejar un alma de altura positiva.');
    return { family: value.family, width, depth, webThickness, flangeThickness };
  }
  if (value.family === 'rectangular-box') {
    const width = dimension(value.width, 'definition.width');
    const depth = dimension(value.depth, 'definition.depth');
    const thickness = dimension(value.thickness, 'definition.thickness');
    if (2 * thickness >= Math.min(width, depth)) throw new Error('definition.thickness debe dejar un hueco interior positivo.');
    return { family: value.family, width, depth, thickness };
  }
  throw new Error('definition.family no está soportada.');
};

const propertiesFrom = (area: number, inertiaX: number, inertiaY: number, depth: number, width: number): ParametricSectionProperties => ({
  area,
  inertiaX,
  inertiaY,
  sectionModulusX: inertiaX / (depth / 2),
  sectionModulusY: inertiaY / (width / 2),
  radiusX: Math.sqrt(inertiaX / area),
  radiusY: Math.sqrt(inertiaY / area),
});

export const calculateParametricSection = (raw: ParametricSectionDefinition): ParametricSectionProperties => {
  const definition = normalizeDefinition(raw);
  if (definition.family === 'rectangle') {
    const { width, depth } = definition;
    return propertiesFrom(width * depth, width * depth ** 3 / 12, depth * width ** 3 / 12, depth, width);
  }
  if (definition.family === 'circle') {
    const { diameter } = definition;
    const area = Math.PI * diameter ** 2 / 4;
    const inertia = Math.PI * diameter ** 4 / 64;
    return propertiesFrom(area, inertia, inertia, diameter, diameter);
  }
  if (definition.family === 'symmetric-i') {
    const { width, depth, webThickness, flangeThickness } = definition;
    const webDepth = depth - 2 * flangeThickness;
    const area = 2 * width * flangeThickness + webDepth * webThickness;
    const inertiaX = (width * depth ** 3 - (width - webThickness) * webDepth ** 3) / 12;
    const inertiaY = 2 * flangeThickness * width ** 3 / 12 + webDepth * webThickness ** 3 / 12;
    return propertiesFrom(area, inertiaX, inertiaY, depth, width);
  }
  const { width, depth, thickness } = definition;
  const innerWidth = width - 2 * thickness;
  const innerDepth = depth - 2 * thickness;
  const area = width * depth - innerWidth * innerDepth;
  const inertiaX = (width * depth ** 3 - innerWidth * innerDepth ** 3) / 12;
  const inertiaY = (depth * width ** 3 - innerDepth * innerWidth ** 3) / 12;
  return propertiesFrom(area, inertiaX, inertiaY, depth, width);
};

const assertIdentity = (library: readonly PersonalParametricSection[], id: string, exceptId?: string) => {
  if (!id.trim() || library.some((section) => section.id === id && section.id !== exceptId)) {
    throw new Error('El identificador de la sección debe ser único y no vacío.');
  }
};
const assertUniqueName = (library: readonly PersonalParametricSection[], name: string, exceptId?: string) => {
  if (library.some((section) => section.id !== exceptId && nameKey(section.name) === nameKey(name))) {
    throw new Error('Ya existe una sección personal con ese nombre.');
  }
};

export const createPersonalSection = (
  library: readonly PersonalParametricSection[],
  draft: PersonalSectionDraft,
  id = `personal-section:${crypto.randomUUID()}`,
  now = new Date().toISOString(),
): PersonalParametricSection[] => {
  if (!isIsoDate(now)) throw new Error('Fecha de sección inválida.');
  const name = normalizeName(draft.name);
  assertIdentity(library, id);
  assertUniqueName(library, name);
  const definition = normalizeDefinition(draft.definition);
  return [...library, {
    kind: 'personal-parametric-section', id, revision: 1, name,
    formulaVersion: SECTION_FORMULA_VERSION, definition,
    properties: calculateParametricSection(definition), createdAt: now, updatedAt: now,
  }];
};

export const updatePersonalSection = (
  library: readonly PersonalParametricSection[],
  id: string,
  draft: PersonalSectionDraft,
  now = new Date().toISOString(),
): PersonalParametricSection[] => {
  const source = library.find((section) => section.id === id);
  if (!source) throw new Error(`No existe la sección ${id}.`);
  if (!isIsoDate(now)) throw new Error('Fecha de sección inválida.');
  const name = normalizeName(draft.name);
  assertUniqueName(library, name, id);
  const definition = normalizeDefinition(draft.definition);
  return library.map((section) => section.id === id ? {
    ...section, revision: section.revision + 1, name, definition,
    properties: calculateParametricSection(definition), updatedAt: now,
  } : section);
};

export const duplicatePersonalSection = (
  library: readonly PersonalParametricSection[],
  sourceId: string,
  name: string,
  id = `personal-section:${crypto.randomUUID()}`,
  now = new Date().toISOString(),
): PersonalParametricSection[] => {
  const source = library.find((section) => section.id === sourceId);
  if (!source) throw new Error(`No existe la sección ${sourceId}.`);
  return createPersonalSection(library, { name, definition: source.definition }, id, now);
};

export const deletePersonalSection = (library: readonly PersonalParametricSection[], id: string) =>
  library.filter((section) => section.id !== id);

export const uniquePersonalSectionName = (library: readonly PersonalParametricSection[], rawBase: string) => {
  const base = normalizeName(rawBase);
  let candidate = base;
  let index = 2;
  while (library.some((section) => nameKey(section.name) === nameKey(candidate))) candidate = `${base} ${index++}`;
  return candidate;
};

const closeEnough = (actual: number, expected: number) => Math.abs(actual - expected) <= 1e-12 * Math.max(1, Math.abs(expected));
const decodeProperties = (value: unknown, expected: ParametricSectionProperties): ParametricSectionProperties => {
  if (!isRecord(value)) throw new Error('properties debe ser un objeto.');
  for (const [key, expectedValue] of Object.entries(expected) as Array<[keyof ParametricSectionProperties, number]>) {
    const actual = value[key];
    if (typeof actual !== 'number' || !Number.isFinite(actual) || !closeEnough(actual, expectedValue)) {
      throw new Error(`properties.${key} no coincide con ${SECTION_FORMULA_VERSION}.`);
    }
  }
  return expected;
};

const decodeSection = (value: unknown): PersonalParametricSection => {
  if (!isRecord(value) || value.kind !== 'personal-parametric-section') throw new Error('Sección personal inválida.');
  if (typeof value.id !== 'string' || !value.id.trim()) throw new Error('Identificador de sección inválido.');
  if (!Number.isInteger(value.revision) || (value.revision as number) < 1) throw new Error('Revisión de sección inválida.');
  if (value.formulaVersion !== SECTION_FORMULA_VERSION) throw new Error('Versión de fórmulas no soportada.');
  if (!isIsoDate(value.createdAt) || !isIsoDate(value.updatedAt)) throw new Error('Fecha de sección inválida.');
  const definition = normalizeDefinition(value.definition);
  const expected = calculateParametricSection(definition);
  return {
    kind: value.kind,
    id: value.id,
    revision: value.revision as number,
    name: normalizeName(String(value.name ?? '')),
    formulaVersion: value.formulaVersion,
    definition,
    properties: decodeProperties(value.properties, expected),
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
};

export const encodePersonalSections = (sections: readonly PersonalParametricSection[]): string =>
  JSON.stringify({ schemaVersion: PERSONAL_SECTIONS_SCHEMA_VERSION, sections }, null, 2);

export const decodePersonalSections = (serialized: string): PersonalParametricSection[] => {
  const payload = JSON.parse(serialized) as unknown;
  if (!isRecord(payload) || payload.schemaVersion !== PERSONAL_SECTIONS_SCHEMA_VERSION || !Array.isArray(payload.sections)) {
    throw new Error('Expediente de secciones no soportado.');
  }
  const sections = payload.sections.map(decodeSection);
  const ids = new Set<string>();
  const names = new Set<string>();
  for (const section of sections) {
    if (ids.has(section.id)) throw new Error('El expediente contiene un identificador de sección repetido.');
    if (names.has(nameKey(section.name))) throw new Error('El expediente contiene un nombre de sección repetido.');
    ids.add(section.id);
    names.add(nameKey(section.name));
  }
  return sections;
};

export const importPersonalSections = (
  current: readonly PersonalParametricSection[],
  serialized: string,
): PersonalParametricSection[] => {
  const imported = decodePersonalSections(serialized);
  for (const section of imported) {
    assertIdentity(current, section.id);
    assertUniqueName(current, section.name);
  }
  return [...current, ...imported];
};

export const readPersonalSections = (storage: Storage): PersonalParametricSection[] => {
  try {
    const serialized = storage.getItem(PERSONAL_SECTIONS_STORAGE_KEY);
    return serialized ? decodePersonalSections(serialized) : [];
  } catch {
    return [];
  }
};

export const writePersonalSections = (storage: Storage, sections: readonly PersonalParametricSection[]) => {
  try {
    storage.setItem(PERSONAL_SECTIONS_STORAGE_KEY, encodePersonalSections(sections));
    return { ok: true as const };
  } catch {
    return { ok: false as const, reason: 'storage-unavailable' as const };
  }
};
