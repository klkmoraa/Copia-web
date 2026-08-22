import { describe, expect, it } from 'vitest';
import { createDefaultProject } from '../data/defaultProject';
import { analyzeProjectScenarios } from '../engine/envelope';
import { analyzeAxleTrain, buildInfluenceLine } from '../engine/influence';
import {
  WORKER_PROTOCOL_VERSION,
  type InfluenceWorkerPayload,
  type WorkerRequestEnvelope,
} from './workerProtocol';
import {
  handleInfluenceEnvelope,
  handleScenarioEnvelope,
} from './workerHandlers';

describe('worker protocol v1', () => {
  it('returns the same scenario result as the main-thread fallback handler', () => {
    const project = createDefaultProject();
    const request: WorkerRequestEnvelope<'scenarios', { project: typeof project }> = {
      protocolVersion: WORKER_PROTOCOL_VERSION, type: 'run', domain: 'scenarios', requestId: 7, payload: { project },
    };
    const response = handleScenarioEnvelope(request);
    expect(response).toEqual({
      protocolVersion: 1, type: 'success', domain: 'scenarios', requestId: 7,
      result: analyzeProjectScenarios(project),
    });
  });

  it('returns the same influence result as the main-thread fallback handler', () => {
    const project = createDefaultProject();
    const payload: InfluenceWorkerPayload = {
      project,
      input: { pathMemberIds: [project.members[0].id], target: { memberId: project.members[0].id, x: 0.5, quantity: 'M' } },
    };
    const request: WorkerRequestEnvelope<'influence', InfluenceWorkerPayload> = {
      protocolVersion: 1, type: 'run', domain: 'influence', requestId: 11, payload,
    };
    const response = handleInfluenceEnvelope(request);
    const line = buildInfluenceLine(project, payload.input.pathMemberIds, payload.input.target);
    expect(response).toEqual({
      protocolVersion: 1, type: 'success', domain: 'influence', requestId: 11,
      result: { line, axleTrain: payload.input.train ? analyzeAxleTrain(line, payload.input.train) : null },
    });
  });

  it('fails closed on a protocol mismatch without invoking a domain handler', () => {
    const project = createDefaultProject();
    const response = handleScenarioEnvelope({
      protocolVersion: 99 as 1, type: 'run', domain: 'scenarios', requestId: 4, payload: { project },
    });
    expect(response).toEqual({
      protocolVersion: 1, type: 'error', domain: 'scenarios', requestId: 4,
      error: { code: 'PROTOCOL_MISMATCH', message: 'Versión de protocolo de worker no compatible.' },
    });
  });
});
