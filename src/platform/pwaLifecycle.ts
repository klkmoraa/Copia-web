export interface ServiceWorkerPort {
  state: string;
  postMessage(message: unknown): void;
  addEventListener(type: 'statechange', listener: () => void): void;
}

export interface ServiceWorkerRegistrationPort {
  installing: ServiceWorkerPort | null;
  waiting: ServiceWorkerPort | null;
  addEventListener(type: 'updatefound', listener: () => void): void;
}

export interface ServiceWorkerContainerPort {
  controller: object | null;
  register(scriptURL: string | URL, options?: RegistrationOptions): Promise<ServiceWorkerRegistrationPort>;
  addEventListener(type: 'controllerchange', listener: () => void): void;
}

export interface PwaUpdateController { applyUpdate(): void }

export const watchForPwaUpdates = async (
  container: ServiceWorkerContainerPort,
  onUpdateAvailable: (controller: PwaUpdateController) => void,
  onControllerChange: () => void = () => undefined,
): Promise<PwaUpdateController> => {
  const registration = await container.register('./sw.js', { scope: './' });
  let waiting = registration.waiting;
  const controller: PwaUpdateController = { applyUpdate: () => waiting?.postMessage({ type: 'SKIP_WAITING' }) };
  const publish = (worker: ServiceWorkerPort | null) => {
    if (!worker) return;
    waiting = worker;
    onUpdateAvailable(controller);
  };
  if (waiting) publish(waiting);
  registration.addEventListener('updatefound', () => {
    const installing = registration.installing;
    if (!installing) return;
    installing.addEventListener('statechange', () => {
      if (installing.state === 'installed' && container.controller) publish(installing);
    });
  });
  container.addEventListener('controllerchange', onControllerChange);
  return controller;
};
