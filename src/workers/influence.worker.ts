/// <reference lib="webworker" />
import {
  analyzeAxleTrain,
  buildInfluenceLine,
  type ConcentratedAxleTrain,
  type InfluenceTarget,
} from '../engine/influence';
import type { ProjectModel } from '../types';

interface InfluenceWorkerRequest {
  type: 'analyze-influence';
  requestId: number;
  project: ProjectModel;
  input: {
    pathMemberIds: readonly string[];
    target: InfluenceTarget;
    startNodeId?: string;
    train?: ConcentratedAxleTrain | null;
  };
}

self.onmessage = (event: MessageEvent<InfluenceWorkerRequest>) => {
  const { requestId, project, input } = event.data;
  try {
    const line = buildInfluenceLine(project, input.pathMemberIds, input.target, input.startNodeId);
    const axleTrain = input.train ? analyzeAxleTrain(line, input.train) : null;
    self.postMessage({
      type: 'influence-result',
      requestId,
      result: { line, axleTrain },
    });
  } catch (error) {
    self.postMessage({
      type: 'influence-error',
      requestId,
      message: error instanceof Error ? error.message : 'No se pudo calcular la línea de influencia.',
    });
  }
};

export {};
