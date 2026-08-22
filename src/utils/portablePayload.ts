import type { AnalysisResult, ProjectModel } from '../types';
import { APP_VERSION } from '../appVersion';
import { resolveNumericQualityState } from '../engine/reliability';
import {
  PORTABLE_FORMAT_VERSION,
  type PortableProvenance,
  type PortableReportMetadata,
  type StructureCoPortablePayload,
} from './portableTypes';

export interface PortablePayloadOptions {
  appVersion?: string;
  scenarioName?: string;
  generatedAt?: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map((entry) => canonicalize(entry ?? null));
  if (!isRecord(value)) return value;
  const entries = Object.entries(value)
    .filter(([, entry]) => entry !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => [key, canonicalize(entry)]);
  return Object.fromEntries(entries);
};

export const canonicalStringify = (value: unknown): string => JSON.stringify(canonicalize(value));

const sha256Hex = async (text: string): Promise<string> => {
  if (!globalThis.crypto?.subtle) throw new Error('Este navegador no ofrece SHA-256 para verificar el expediente.');
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
};

const countLoads = (project: ProjectModel): number =>
  project.nodalLoads.length
  + project.memberLoads.length
  + (project.prescribedDisplacements?.length ?? 0)
  + (project.memberInitialEffects?.length ?? 0);

/** Match the bytes JSON can actually preserve (drops undefined and normalizes -0). */
const jsonSnapshot = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const payloadDataForChecksum = (
  metadata: PortableReportMetadata,
  provenance: PortableProvenance,
  project: ProjectModel,
  analysis: AnalysisResult,
) => ({
  format: 'structureco-portable' as const,
  formatVersion: PORTABLE_FORMAT_VERSION,
  metadata,
  provenance,
  project,
  analysis,
});

export const createPortablePayload = async (
  project: ProjectModel,
  analysis: AnalysisResult,
  options: PortablePayloadOptions = {},
): Promise<StructureCoPortablePayload> => {
  const projectSnapshot = jsonSnapshot(project);
  const analysisSnapshot = jsonSnapshot(analysis);
  const metadata: PortableReportMetadata = {
    projectName: project.name,
    ...(options.scenarioName ? { scenarioName: options.scenarioName } : {}),
    units: project.settings.units,
    nodeCount: project.nodes.length,
    memberCount: project.members.length,
    loadCount: countLoads(project),
    analysisSuccess: analysis.success,
    numericQuality: resolveNumericQualityState(analysis),
    analysisMode: project.settings.analysisMode ?? 'first-order',
    pDeltaExperimental: analysis.pDelta?.experimental === true,
  };
  const provenance: PortableProvenance = {
    generatedBy: 'structureCo',
    source: 'native-export',
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    appVersion: options.appVersion ?? APP_VERSION,
    projectSchemaVersion: project.schemaVersion,
    analysisIncluded: true,
  };
  const data = payloadDataForChecksum(metadata, provenance, projectSnapshot, analysisSnapshot);
  return {
    ...data,
    checksum: { algorithm: 'SHA-256', value: await sha256Hex(canonicalStringify(data)) },
  };
};

export const serializePortablePayload = (payload: StructureCoPortablePayload, pretty = false): string =>
  JSON.stringify(payload, null, pretty ? 2 : undefined);

const assertPayloadShape: (value: unknown) => asserts value is StructureCoPortablePayload = (value) => {
  if (!isRecord(value)
    || value.format !== 'structureco-portable'
    || value.formatVersion !== PORTABLE_FORMAT_VERSION
    || !isRecord(value.metadata)
    || !isRecord(value.provenance)
    || !isRecord(value.project)
    || !isRecord(value.analysis)
    || !isRecord(value.checksum)
    || value.checksum.algorithm !== 'SHA-256'
    || typeof value.checksum.value !== 'string') {
    throw new Error('El adjunto no es un expediente structureCo compatible.');
  }
};

export const verifyPortablePayload = async (payload: StructureCoPortablePayload): Promise<boolean> => {
  const data = payloadDataForChecksum(payload.metadata, payload.provenance, payload.project, payload.analysis);
  const expected = await sha256Hex(canonicalStringify(data));
  return expected === payload.checksum.value.toLowerCase();
};

export const parsePortablePayload = async (
  input: string | Uint8Array,
): Promise<StructureCoPortablePayload> => {
  let parsed: unknown;
  try {
    const text = typeof input === 'string' ? input : new TextDecoder().decode(input);
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw new Error('El adjunto structureCo no contiene JSON válido.');
  }
  assertPayloadShape(parsed);
  if (!await verifyPortablePayload(parsed)) {
    throw new Error('El expediente fue modificado o está dañado: el checksum no coincide.');
  }
  return parsed;
};
