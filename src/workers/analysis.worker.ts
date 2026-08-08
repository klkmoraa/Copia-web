import {
  handleAnalysisWorkerRequest,
  type AnalysisWorkerRequest,
  type AnalysisWorkerResponse,
} from '../engine/analysisWorkerProtocol';

interface AnalysisWorkerScope {
  addEventListener(type: 'message', listener: (event: MessageEvent<AnalysisWorkerRequest>) => void): void;
  postMessage(message: AnalysisWorkerResponse): void;
}

const workerScope = self as unknown as AnalysisWorkerScope;

workerScope.addEventListener('message', (event) => {
  workerScope.postMessage(handleAnalysisWorkerRequest(event.data));
});
