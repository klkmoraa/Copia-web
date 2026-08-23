import type {
  AxleTrainEnvelope,
  ConcentratedAxleTrain,
  InfluenceLine,
  InfluenceTarget,
} from '../engine/influence';
import type { BucklingResult } from '../engine/buckling';
import type { NumericCertificate } from '../engine/certificate';
import type { ModalResult } from '../engine/modal';
import type { ProjectModel } from '../types';

export const WORKER_PROTOCOL_VERSION = 1 as const;
export type WorkerDomain = 'analysis' | 'scenarios' | 'influence' | 'studies';

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

/**
 * Estudios opcionales sobre un modelo ya resuelto: pandeo, modos de vibración y
 * certificado numérico.
 *
 * Comparten dominio porque desde fuera son la misma cosa —lecturas caras que se
 * piden, no que se calculan siempre— y porque tres dominios habrían sido tres
 * archivos de worker repitiendo este mismo sobre. La carga útil va discriminada
 * por `kind`, así que el manejador no puede confundir uno con otro ni el
 * llamador recibir el resultado de un estudio que no pidió.
 */
export type StudyKind = 'buckling' | 'modal' | 'certificate';

export interface StudiesWorkerPayload {
  kind: StudyKind;
  project: ProjectModel;
  combinationId?: string | null;
  /** Cuántos modos calcular. Sólo lo leen `buckling` y `modal`. */
  modes?: number;
}

/** Resultado del estudio, etiquetado con su `kind` para que el llamador lo estreche sin adivinar. */
export type StudiesWorkerResult =
  | { kind: 'buckling'; result: BucklingResult }
  | { kind: 'modal'; result: ModalResult }
  | { kind: 'certificate'; result: NumericCertificate };
