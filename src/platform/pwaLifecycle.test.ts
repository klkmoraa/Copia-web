import { describe, expect, it, vi } from 'vitest';
import { watchForPwaUpdates, type ServiceWorkerContainerPort, type ServiceWorkerRegistrationPort, type ServiceWorkerPort } from './pwaLifecycle';

class FakeWorker implements ServiceWorkerPort {
  state = 'installed';
  postMessage = vi.fn();
  private listener: (() => void) | null = null;
  addEventListener(_type: 'statechange', listener: () => void) { this.listener = listener; }
  change(state: string) { this.state = state; this.listener?.(); }
}

class FakeRegistration implements ServiceWorkerRegistrationPort {
  installing: ServiceWorkerPort | null = null;
  waiting: ServiceWorkerPort | null = null;
  private listener: (() => void) | null = null;
  addEventListener(_type: 'updatefound', listener: () => void) { this.listener = listener; }
  updateFound(worker: ServiceWorkerPort) { this.installing = worker; this.listener?.(); }
}

class FakeContainer implements ServiceWorkerContainerPort {
  controller: object | null = {};
  private readonly registration: FakeRegistration;
  private listener: (() => void) | null = null;
  constructor(registration: FakeRegistration) { this.registration = registration; }
  async register() { return this.registration; }
  addEventListener(_type: 'controllerchange', listener: () => void) { this.listener = listener; }
  changeController() { this.listener?.(); }
}

describe('PWA update lifecycle', () => {
  it('surfaces an already waiting update and activates it only on request', async () => {
    const registration = new FakeRegistration();
    const waiting = new FakeWorker();
    registration.waiting = waiting;
    const available = vi.fn();
    const controller = await watchForPwaUpdates(new FakeContainer(registration), available);

    expect(available).toHaveBeenCalledTimes(1);
    controller.applyUpdate();
    expect(waiting.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
  });

  it('surfaces a newly installed worker when an older worker controls the page', async () => {
    const registration = new FakeRegistration();
    const container = new FakeContainer(registration);
    const available = vi.fn();
    await watchForPwaUpdates(container, available);
    const installing = new FakeWorker();
    installing.state = 'installing';

    registration.updateFound(installing);
    installing.change('installed');
    expect(available).toHaveBeenCalledTimes(1);
  });
});
