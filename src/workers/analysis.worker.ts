import {
  handleAnalysisWorkerRequest,
  type AnalysisWorkerRequest,
  type AnalysisWorkerResponse,
} from '../engine/analysisWorkerProtocol';
import { handleAnalysisEnvelope } from '../runtime/workerHandlers';
import type { AnalysisWorkerPayload, WorkerRequestEnvelope } from '../runtime/workerProtocol';

interface AnalysisWorkerScope {
  addEventListener(type: 'message', listener: (event: MessageEvent<AnalysisWorkerRequest | WorkerRequestEnvelope<'analysis', AnalysisWorkerPayload>>) => void): void;
  postMessage(message: AnalysisWorkerResponse | ReturnType<typeof handleAnalysisEnvelope>): void;
}

const workerScope = self as unknown as AnalysisWorkerScope;

workerScope.addEventListener('message', (event) => {
  workerScope.postMessage('protocolVersion' in event.data ? handleAnalysisEnvelope(event.data) : handleAnalysisWorkerRequest(event.data));
});
