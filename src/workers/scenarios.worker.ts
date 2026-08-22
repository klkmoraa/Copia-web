/// <reference lib="webworker" />
import { handleScenarioEnvelope } from '../runtime/workerHandlers';
import type { WorkerRequestEnvelope } from '../runtime/workerProtocol';
import type { ProjectModel } from '../types';

self.onmessage = (event: MessageEvent<WorkerRequestEnvelope<'scenarios', { project: ProjectModel }>>) => {
  self.postMessage(handleScenarioEnvelope(event.data));
};

export {};
