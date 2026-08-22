import type { AnalysisResult, NumericQualityState, ProjectModel, UnitSystemId } from '../types';

export const STRUCTURECO_PAYLOAD_FILENAME = 'structureco-payload.json';
export const STRUCTURECO_PAYLOAD_MIME = 'application/vnd.structureco.project+json';
export const STRUCTURECO_BUNDLE_MIME = 'application/vnd.structureco.bundle+zip';
export const PORTABLE_FORMAT_VERSION = 1 as const;

export interface PortableReportMetadata {
  projectName: string;
  scenarioName?: string;
  units: UnitSystemId;
  nodeCount: number;
  memberCount: number;
  loadCount: number;
  analysisSuccess: boolean;
  numericQuality: NumericQualityState;
  analysisMode: 'first-order' | 'p-delta';
  pDeltaExperimental: boolean;
}

export interface PortableProvenance {
  generatedBy: 'structureCo';
  source: 'native-export';
  generatedAt: string;
  appVersion: string;
  projectSchemaVersion: number;
  analysisIncluded: true;
}

export interface PortableChecksum {
  algorithm: 'SHA-256';
  value: string;
}

/** Exact, machine-readable project snapshot embedded in a human PDF. */
export interface StructureCoPortablePayload {
  format: 'structureco-portable';
  formatVersion: typeof PORTABLE_FORMAT_VERSION;
  metadata: PortableReportMetadata;
  provenance: PortableProvenance;
  project: ProjectModel;
  analysis: AnalysisResult;
  checksum: PortableChecksum;
}

export type PdfImportKind = 'native' | 'external' | 'scanned';

export interface PdfInspection {
  kind: PdfImportKind;
  confidence: number;
  pageCount: number;
  text: string;
  textByPage: string[];
  payload?: StructureCoPortablePayload;
  attachmentName?: string;
  warnings: string[];
  summary: {
    title: string;
    nodeCount?: number;
    memberCount?: number;
    loadCount?: number;
  };
}

export interface PortableBundleManifest {
  format: 'structureco-bundle';
  formatVersion: typeof PORTABLE_FORMAT_VERSION;
  createdAt: string;
  appVersion: string;
  projectName: string;
  payloadChecksum: string;
  files: {
    payload: 'portable/payload.json';
    project: 'project.json';
    analysis: 'analysis/result.json';
    report: 'report/calculation-report.pdf';
  };
}

