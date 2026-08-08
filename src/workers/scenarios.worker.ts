/// <reference lib="webworker" />
import { analyzeProjectScenarios } from '../engine/envelope';
import type { ProjectModel } from '../types';

interface ScenarioRequest { requestId: number; project: ProjectModel }

self.onmessage = (event: MessageEvent<ScenarioRequest>) => {
  try {
    self.postMessage({ requestId: event.data.requestId, scenarios: analyzeProjectScenarios(event.data.project) });
  } catch (error) {
    self.postMessage({ requestId: event.data.requestId, error: error instanceof Error ? error.message : 'No se pudieron comparar los escenarios.' });
  }
};

export {};
