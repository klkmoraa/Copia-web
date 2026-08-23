/// <reference lib="webworker" />
import { handleStudiesEnvelope } from '../runtime/workerHandlers';
import type { StudiesWorkerPayload, WorkerRequestEnvelope } from '../runtime/workerProtocol';

self.onmessage = (event: MessageEvent<WorkerRequestEnvelope<'studies', StudiesWorkerPayload>>) => {
  self.postMessage(handleStudiesEnvelope(event.data));
};

export {};
