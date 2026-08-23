import { describe, expect, it } from 'vitest';
import { createDefaultProject } from '../data/defaultProject';
import { analyzeBuckling } from '../engine/buckling';
import { certifyResult } from '../engine/certificate';
import { analyzeModal } from '../engine/modal';
import { analyzeProjectScenarios } from '../engine/envelope';
import { analyzeAxleTrain, buildInfluenceLine } from '../engine/influence';
import {
  WORKER_PROTOCOL_VERSION,
  type InfluenceWorkerPayload,
  type StudiesWorkerPayload,
  type WorkerRequestEnvelope,
} from './workerProtocol';
import {
  handleInfluenceEnvelope,
  handleScenarioEnvelope,
  handleStudiesEnvelope,
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

/**
 * Los tres estudios opcionales comparten dominio, y eso obliga a que el sobre
 * no pueda confundirlos: cada respuesta llega etiquetada con el `kind` que se
 * pidió, y el resultado tiene que coincidir con el de la ruta directa.
 */
describe('dominio «studies»', () => {
  const envelope = (payload: StudiesWorkerPayload, requestId = 3): WorkerRequestEnvelope<'studies', StudiesWorkerPayload> =>
    ({ protocolVersion: WORKER_PROTOCOL_VERSION, type: 'run', domain: 'studies', requestId, payload });

  it('devuelve el certificado que devolvería la ruta directa', () => {
    const project = createDefaultProject();
    const response = handleStudiesEnvelope(envelope({ kind: 'certificate', project }));
    expect(response.type).toBe('success');
    if (response.type !== 'success') return;
    expect(response.result.kind).toBe('certificate');
    if (response.result.kind !== 'certificate') return;
    expect(response.result.result).toEqual(certifyResult(project, null));
  });

  it('devuelve el pandeo que devolvería la ruta directa, con los modos pedidos', () => {
    const project = createDefaultProject();
    const response = handleStudiesEnvelope(envelope({ kind: 'buckling', project, modes: 2 }));
    expect(response.type).toBe('success');
    if (response.type !== 'success' || response.result.kind !== 'buckling') return;
    expect(response.result.result).toEqual(analyzeBuckling(project, null, { modes: 2 }));
  });

  it('devuelve los modos de vibración que devolvería la ruta directa', () => {
    const project = createDefaultProject();
    const response = handleStudiesEnvelope(envelope({ kind: 'modal', project, modes: 2 }));
    expect(response.type).toBe('success');
    if (response.type !== 'success' || response.result.kind !== 'modal') return;
    expect(response.result.result).toEqual(analyzeModal(project, { modes: 2 }));
  });

  it('etiqueta la respuesta con el estudio pedido y no con otro', () => {
    const project = createDefaultProject();
    for (const kind of ['buckling', 'modal', 'certificate'] as const) {
      const response = handleStudiesEnvelope(envelope({ kind, project, modes: 1 }));
      expect(response.type).toBe('success');
      if (response.type === 'success') expect(response.result.kind).toBe(kind);
    }
  });

  it('resuelve la combinación por su id, que es lo único que viaja por el sobre', () => {
    const project = createDefaultProject();
    // Un id que no está en el proyecto no puede colar una combinación inventada:
    // se resuelve a `null`, igual que el dominio `analysis`.
    const response = handleStudiesEnvelope(envelope({ kind: 'certificate', project, combinationId: 'no-existe' }));
    expect(response.type).toBe('success');
    if (response.type !== 'success' || response.result.kind !== 'certificate') return;
    expect(response.result.result).toEqual(certifyResult(project, null));
  });

  it('rechaza un sobre de otro dominio en vez de calcular algo', () => {
    const project = createDefaultProject();
    const wrong = { ...envelope({ kind: 'modal', project }), domain: 'scenarios' } as unknown as WorkerRequestEnvelope<'studies', StudiesWorkerPayload>;
    const response = handleStudiesEnvelope(wrong);
    expect(response.type).toBe('error');
    if (response.type === 'error') expect(response.error.code).toBe('PROTOCOL_MISMATCH');
  });

  it('rechaza una versión de protocolo distinta', () => {
    const project = createDefaultProject();
    const stale = { ...envelope({ kind: 'modal', project }), protocolVersion: 99 } as unknown as WorkerRequestEnvelope<'studies', StudiesWorkerPayload>;
    const response = handleStudiesEnvelope(stale);
    expect(response.type).toBe('error');
    if (response.type === 'error') expect(response.error.code).toBe('PROTOCOL_MISMATCH');
  });
});
