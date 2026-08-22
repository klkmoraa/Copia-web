import type {
  AxleTrainEnvelope,
  ConcentratedAxleTrain,
  InfluenceLine,
  InfluenceTarget,
} from '../engine/influence';
import type { ProjectModel } from '../types';

export const WORKER_PROTOCOL_VERSION = 1 as const;
export type WorkerDomain = 'analysis' | 'scenarios' | 'influence';

export interface WorkerRequestEnvelope<Domain extends WorkerDomain, Payload> {
  protocolVersion: typeof WORKER_PROTOCOL_VERSION;
  type: 'run';
  domain: Domain;
  requestId: number;
  payload: Payload;
}

export interface WorkerSuccessEnvelope<Domain extends WorkerDomain, Result> {
  protocolVersion: typeof WORKER_PROTOCOL_VERSION;
  type: 'success';
  domain: Domain;
  requestId: number;
  result: Result;
}

export interface WorkerErrorEnvelope<Domain extends WorkerDomain> {
  protocolVersion: typeof WORKER_PROTOCOL_VERSION;
  type: 'error';
  domain: Domain;
  requestId: number;
  error: { code: 'DOMAIN_ERROR' | 'PROTOCOL_MISMATCH'; message: string };
}

export type WorkerResponseEnvelope<Domain extends WorkerDomain, Result> =
  | WorkerSuccessEnvelope<Domain, Result>
  | WorkerErrorEnvelope<Domain>;

export interface AnalysisWorkerPayload {
  project: ProjectModel;
  combinationId?: string | null;
  includeEducationTrace?: boolean;
}

export interface InfluenceAnalysisInput {
  pathMemberIds: readonly string[];
  target: InfluenceTarget;
  startNodeId?: string;
  train?: ConcentratedAxleTrain | null;
}

export interface InfluenceWorkerPayload { project: ProjectModel; input: InfluenceAnalysisInput }
export interface InfluenceWorkerResult { line: InfluenceLine; axleTrain: AxleTrainEnvelope | null }
