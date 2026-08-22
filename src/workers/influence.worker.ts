/// <reference lib="webworker" />
import { handleInfluenceEnvelope } from '../runtime/workerHandlers';
import type { InfluenceWorkerPayload, WorkerRequestEnvelope } from '../runtime/workerProtocol';

self.onmessage = (event: MessageEvent<WorkerRequestEnvelope<'influence', InfluenceWorkerPayload>>) => {
  self.postMessage(handleInfluenceEnvelope(event.data));
};

export {};
