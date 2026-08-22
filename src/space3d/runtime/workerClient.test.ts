import { describe, expect, it, vi } from 'vitest';
import { Space3DAnalysisCancelledError, Space3DWorkerClient } from './workerClient';
import { handleSpace3DWorkerRequest, type Space3DWorkerRequest, type Space3DWorkerResponse } from './protocol';
import { analyzeSpace3DProject } from '../engine/solver';
import { axialCantilever } from '../engine/fixtures';
import type { Space3DWorkerEvent, WorkerLike } from './workerClient';

class FakeWorker implements WorkerLike {
  static instances: FakeWorker[] = [];
  readonly posted: Space3DWorkerRequest[] = [];
  terminated = false;
  private listeners = new Map<string, Set<(event: Space3DWorkerEvent) => void>>();

  constructor() { FakeWorker.instances.push(this); }

  postMessage(message: Space3DWorkerRequest) { this.posted.push(message); }

  terminate() { this.terminated = true; }

  addEventListener(type: string, listener: (event: Space3DWorkerEvent) => void) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(listener);
  }

  removeEventListener(type: string, listener: (event: Space3DWorkerEvent) => void) {
    this.listeners.get(type)?.delete(listener);
  }

  /** Responde a una petición concreta como lo haría el worker real. */
  reply(index = this.posted.length - 1) {
    const request = this.posted[index];
    this.emit('message', { data: handleSpace3DWorkerRequest(request) });
  }

  replyWith(response: Space3DWorkerResponse) {
    this.emit('message', { data: response });
  }

  emit(type: string, event: Space3DWorkerEvent) {
    for (const listener of [...(this.listeners.get(type) ?? [])]) listener(event);
  }

  get listenerCount() {
    return [...this.listeners.values()].reduce((sum, set) => sum + set.size, 0);
  }
}

const newClient = () => {
  FakeWorker.instances = [];
  const client = new Space3DWorkerClient(() => new FakeWorker());
  return { client, workers: FakeWorker.instances };
};

describe('Space3DWorkerClient', () => {
  it('resuelve con el resultado del worker y reutiliza el mismo worker', async () => {
    const { client, workers } = newClient();
    const project = axialCantilever();

    const first = client.run(project, 'LC1');
    workers[0].reply();
    await expect(first).resolves.toEqual(analyzeSpace3DProject(project, 'LC1'));

    const second = client.run(project, 'LC1');
    workers[0].reply();
    await second;
    expect(workers).toHaveLength(1);
    expect(workers[0].posted.map((request) => request.requestId)).toEqual([1, 2]);
    client.dispose();
  });

  it('descarta respuestas con un requestId obsoleto', async () => {
    const { client, workers } = newClient();
    const project = axialCantilever();
    const pending = client.run(project, 'LC1');
    const stale = handleSpace3DWorkerRequest({ ...workers[0].posted[0], requestId: 0 });
    workers[0].replyWith(stale);

    let settled = false;
    void pending.then(() => { settled = true; }, () => { settled = true; });
    await Promise.resolve();
    expect(settled).toBe(false);

    workers[0].reply();
    await expect(pending).resolves.toMatchObject({ success: true });
    client.dispose();
  });

  it('cancela terminando el worker, rechaza la promesa y crea uno nuevo en la siguiente corrida', async () => {
    const { client, workers } = newClient();
    const project = axialCantilever();
    const pending = client.run(project, 'LC1');
    const rejection = expect(pending).rejects.toBeInstanceOf(Space3DAnalysisCancelledError);

    client.cancel();
    await rejection;
    expect(workers[0].terminated).toBe(true);
    expect(workers[0].listenerCount).toBe(0);

    const next = client.run(project, 'LC1');
    expect(workers).toHaveLength(2);
    workers[1].reply();
    await expect(next).resolves.toMatchObject({ success: true });
    client.dispose();
  });

  it('una nueva corrida reemplaza a la anterior y la cancela', async () => {
    const { client, workers } = newClient();
    const project = axialCantilever();
    const first = client.run(project, 'LC1');
    const firstRejection = expect(first).rejects.toBeInstanceOf(Space3DAnalysisCancelledError);
    const second = client.run(project, 'LC1');
    await firstRejection;
    workers[workers.length - 1].reply();
    await expect(second).resolves.toMatchObject({ success: true });
    client.dispose();
  });

  it('propaga un error de protocolo como rechazo con el código del worker', async () => {
    const { client, workers } = newClient();
    const pending = client.run(axialCantilever(), 'LC1');
    workers[0].replyWith({
      protocolVersion: 1, type: 'error', requestId: workers[0].posted[0].requestId,
      code: 'PROTOCOL_MISMATCH', message: 'versión incompatible',
    });
    await expect(pending).rejects.toThrow(/PROTOCOL_MISMATCH/);
    client.dispose();
  });

  it('rechaza si el worker emite un error de runtime', async () => {
    const { client, workers } = newClient();
    const pending = client.run(axialCantilever(), 'LC1');
    workers[0].emit('error', { message: 'boom' });
    await expect(pending).rejects.toThrow(/boom/);
    client.dispose();
  });

  it('dispose termina el worker, suelta los listeners y cancela lo pendiente', async () => {
    const { client, workers } = newClient();
    const pending = client.run(axialCantilever(), 'LC1');
    const rejection = expect(pending).rejects.toBeInstanceOf(Space3DAnalysisCancelledError);
    client.dispose();
    await rejection;
    expect(workers[0].terminated).toBe(true);
    expect(workers[0].listenerCount).toBe(0);
    expect(() => client.cancel()).not.toThrow();
  });

  it('no crea ningún worker hasta la primera corrida', () => {
    const factory = vi.fn(() => new FakeWorker());
    const client = new Space3DWorkerClient(factory);
    expect(factory).not.toHaveBeenCalled();
    client.dispose();
  });
});
