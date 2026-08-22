import { describe, expect, it } from 'vitest';
import { SPACE3D_PROTOCOL_VERSION, handleSpace3DWorkerRequest } from './protocol';
import { analyzeSpace3DProject } from '../engine/solver';
import { axialCantilever } from '../engine/fixtures';

describe('Space3D worker protocol', () => {
  it('devuelve el mismo resultado que la ruta pura', () => {
    const project = axialCantilever();
    const response = handleSpace3DWorkerRequest({
      protocolVersion: 1, type: 'run', requestId: 7, project, targetId: 'LC1',
    });
    expect(response).toEqual({
      protocolVersion: 1, type: 'success', requestId: 7,
      result: analyzeSpace3DProject(project, 'LC1'),
    });
    expect(structuredClone(response)).toEqual(response);
  });

  it('publica una versión de protocolo explícita', () => {
    expect(SPACE3D_PROTOCOL_VERSION).toBe(1);
  });

  it('rechaza una versión de protocolo distinta sin analizar', () => {
    const response = handleSpace3DWorkerRequest({
      protocolVersion: 2, type: 'run', requestId: 3, project: axialCantilever(), targetId: 'LC1',
    });
    expect(response).toEqual({
      protocolVersion: 1, type: 'error', requestId: 3, code: 'PROTOCOL_MISMATCH',
      message: 'El worker de Space 3D habla el protocolo 1 y recibió 2.',
    });
  });

  it('rechaza un sobre malformado sin lanzar', () => {
    expect(handleSpace3DWorkerRequest(null)).toMatchObject({ type: 'error', code: 'PROTOCOL_MISMATCH', requestId: 0 });
    expect(handleSpace3DWorkerRequest({ protocolVersion: 1, type: 'sing', requestId: 9 }))
      .toMatchObject({ type: 'error', code: 'UNSUPPORTED_REQUEST', requestId: 9 });
  });

  it('convierte un modelo inválido en un resultado fallido, no en una excepción', () => {
    const project = axialCantilever();
    const response = handleSpace3DWorkerRequest({
      protocolVersion: 1, type: 'run', requestId: 1, targetId: 'LC-ghost', project,
    });
    expect(response.type).toBe('success');
    expect(response.type === 'success' && response.result.success).toBe(false);
  });
});
