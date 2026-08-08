import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { DiagramQuantity } from '../types';

export type ClassroomRevealState = 'hidden' | 'predicting' | 'revealed';
export type ClassroomPredictionSign = 'positive' | 'negative' | 'zero' | 'changes';
export type ClassroomPredictions = Record<string, Partial<Record<DiagramQuantity, number>>>;
export type ClassroomSignPredictions = Record<string, Partial<Record<DiagramQuantity, ClassroomPredictionSign>>>;

interface ClassroomSessionState {
  projectId: string;
  revealState: ClassroomRevealState;
  predictions: ClassroomPredictions;
  signPredictions: ClassroomSignPredictions;
  conclusion: string;
  analysisRequested: boolean;
}

export interface ClassroomSessionContextValue {
  revealState: ClassroomRevealState;
  predictions: ClassroomPredictions;
  signPredictions: ClassroomSignPredictions;
  conclusion: string;
  resultsVisible: boolean;
  hasPredictions: boolean;
  analysisRequested: boolean;
  setRevealState: (state: ClassroomRevealState) => void;
  hideResults: () => void;
  startPredicting: () => void;
  revealResults: () => void;
  markAnalysisRequested: () => void;
  setPrediction: (memberId: string, quantity: DiagramQuantity, value: number | null) => void;
  setSignPrediction: (memberId: string, quantity: DiagramQuantity, sign: ClassroomPredictionSign | null) => void;
  setConclusion: (value: string) => void;
  clearPredictions: () => void;
}

const ClassroomSessionContext = createContext<ClassroomSessionContextValue | null>(null);
const CLASSROOM_SESSION_STORAGE_PREFIX = 'structureCo.classroom.session.v1:';
const quantities: DiagramQuantity[] = ['axial', 'shear', 'moment'];
const signs: ClassroomPredictionSign[] = ['positive', 'negative', 'zero', 'changes'];

const emptySession = (projectId: string, revealState: ClassroomRevealState): ClassroomSessionState => ({
  projectId,
  revealState,
  predictions: {},
  signPredictions: {},
  conclusion: '',
  analysisRequested: false,
});

const sanitizePredictions = (value: unknown): ClassroomPredictions => {
  if (!value || typeof value !== 'object') return {};
  const result: ClassroomPredictions = {};
  for (const [memberId, rawMember] of Object.entries(value)) {
    if (!memberId.trim() || !rawMember || typeof rawMember !== 'object') continue;
    const member: Partial<Record<DiagramQuantity, number>> = {};
    for (const quantity of quantities) {
      const candidate = (rawMember as Record<string, unknown>)[quantity];
      if (typeof candidate === 'number' && Number.isFinite(candidate)) member[quantity] = candidate;
    }
    if (Object.keys(member).length) result[memberId] = member;
  }
  return result;
};

const sanitizeSigns = (value: unknown): ClassroomSignPredictions => {
  if (!value || typeof value !== 'object') return {};
  const result: ClassroomSignPredictions = {};
  for (const [memberId, rawMember] of Object.entries(value)) {
    if (!memberId.trim() || !rawMember || typeof rawMember !== 'object') continue;
    const member: Partial<Record<DiagramQuantity, ClassroomPredictionSign>> = {};
    for (const quantity of quantities) {
      const candidate = (rawMember as Record<string, unknown>)[quantity];
      if (typeof candidate === 'string' && signs.includes(candidate as ClassroomPredictionSign)) member[quantity] = candidate as ClassroomPredictionSign;
    }
    if (Object.keys(member).length) result[memberId] = member;
  }
  return result;
};

const readSession = (projectId: string, fallbackRevealState: ClassroomRevealState): ClassroomSessionState => {
  if (typeof window === 'undefined') return emptySession(projectId, fallbackRevealState);
  try {
    const raw = window.localStorage.getItem(`${CLASSROOM_SESSION_STORAGE_PREFIX}${projectId}`);
    if (!raw) return emptySession(projectId, fallbackRevealState);
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const revealState = parsed.revealState === 'hidden' || parsed.revealState === 'predicting' || parsed.revealState === 'revealed'
      ? parsed.revealState
      : fallbackRevealState;
    return {
      projectId,
      revealState,
      predictions: sanitizePredictions(parsed.predictions),
      signPredictions: sanitizeSigns(parsed.signPredictions),
      conclusion: typeof parsed.conclusion === 'string' ? parsed.conclusion.slice(0, 2000) : '',
      analysisRequested: parsed.analysisRequested === true,
    };
  } catch {
    return emptySession(projectId, fallbackRevealState);
  }
};

const updateNestedPrediction = <T,>(
  current: Record<string, Partial<Record<DiagramQuantity, T>>>,
  memberId: string,
  quantity: DiagramQuantity,
  value: T | null,
) => {
  const memberPrediction = current[memberId] ?? {};
  if (value === null) {
    if (memberPrediction[quantity] === undefined) return current;
    const nextMember = { ...memberPrediction };
    delete nextMember[quantity];
    const next = { ...current };
    if (Object.keys(nextMember).length) next[memberId] = nextMember;
    else delete next[memberId];
    return next;
  }
  if (memberPrediction[quantity] === value) return current;
  return { ...current, [memberId]: { ...memberPrediction, [quantity]: value } };
};

export interface ClassroomSessionProviderProps {
  projectId: string;
  children: ReactNode;
  initialRevealState?: ClassroomRevealState;
  analysisAvailable?: boolean;
}

export const ClassroomSessionProvider = ({
  projectId,
  children,
  initialRevealState = 'hidden',
  analysisAvailable = false,
}: ClassroomSessionProviderProps) => {
  const [session, setSession] = useState<ClassroomSessionState>(() => readSession(projectId, initialRevealState));
  const previousAnalysisAvailableRef = useRef(analysisAvailable);

  useEffect(() => {
    if (session.projectId !== projectId) setSession(readSession(projectId, initialRevealState));
  }, [initialRevealState, projectId, session.projectId]);

  useEffect(() => {
    if (session.projectId !== projectId || typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(`${CLASSROOM_SESSION_STORAGE_PREFIX}${projectId}`, JSON.stringify({
        revealState: session.revealState,
        predictions: session.predictions,
        signPredictions: session.signPredictions,
        conclusion: session.conclusion,
        analysisRequested: session.analysisRequested,
      }));
    } catch {
      // Classroom progress is helpful UI state; project persistence remains the source of truth.
    }
  }, [projectId, session]);

  useEffect(() => {
    if (previousAnalysisAvailableRef.current && !analysisAvailable) {
      setSession((current) => ({
        ...current,
        revealState: 'hidden',
        predictions: {},
        signPredictions: {},
        conclusion: '',
        analysisRequested: false,
      }));
    }
    previousAnalysisAvailableRef.current = analysisAvailable;
  }, [analysisAvailable]);

  const setRevealState = useCallback((revealState: ClassroomRevealState) => setSession((current) => ({ ...current, revealState })), []);
  const hideResults = useCallback(() => setRevealState('hidden'), [setRevealState]);
  const startPredicting = useCallback(() => setSession((current) => ({ ...current, revealState: 'predicting', analysisRequested: false, conclusion: '' })), []);
  const revealResults = useCallback(() => setRevealState('revealed'), [setRevealState]);
  const markAnalysisRequested = useCallback(() => setSession((current) => ({ ...current, analysisRequested: true, revealState: 'hidden' })), []);
  const clearPredictions = useCallback(() => setSession((current) => ({ ...current, predictions: {}, signPredictions: {}, analysisRequested: false, revealState: 'hidden', conclusion: '' })), []);
  const setPrediction = useCallback((memberId: string, quantity: DiagramQuantity, value: number | null) => {
    if (!memberId.trim()) return;
    const nextValue = value !== null && Number.isFinite(value) ? value : null;
    setSession((current) => {
      const predictions = updateNestedPrediction(current.predictions, memberId, quantity, nextValue);
      return predictions === current.predictions ? current : { ...current, predictions, analysisRequested: false, revealState: 'predicting', conclusion: '' };
    });
  }, []);
  const setSignPrediction = useCallback((memberId: string, quantity: DiagramQuantity, sign: ClassroomPredictionSign | null) => {
    if (!memberId.trim()) return;
    setSession((current) => {
      const signPredictions = updateNestedPrediction(current.signPredictions, memberId, quantity, sign);
      return signPredictions === current.signPredictions ? current : { ...current, signPredictions, analysisRequested: false, revealState: 'predicting', conclusion: '' };
    });
  }, []);
  const setConclusion = useCallback((conclusion: string) => setSession((current) => ({ ...current, conclusion: conclusion.slice(0, 2000) })), []);
  const hasPredictions = useMemo(() => Object.keys(session.predictions).length > 0 || Object.keys(session.signPredictions).length > 0, [session.predictions, session.signPredictions]);

  const value = useMemo<ClassroomSessionContextValue>(() => ({
    revealState: session.revealState,
    predictions: session.predictions,
    signPredictions: session.signPredictions,
    conclusion: session.conclusion,
    resultsVisible: session.revealState === 'revealed',
    hasPredictions,
    analysisRequested: session.analysisRequested,
    setRevealState,
    hideResults,
    startPredicting,
    revealResults,
    markAnalysisRequested,
    setPrediction,
    setSignPrediction,
    setConclusion,
    clearPredictions,
  }), [clearPredictions, hasPredictions, hideResults, markAnalysisRequested, revealResults, session, setConclusion, setPrediction, setRevealState, setSignPrediction, startPredicting]);

  return <ClassroomSessionContext.Provider value={value}>{children}</ClassroomSessionContext.Provider>;
};

// oxlint-disable-next-line react/only-export-components
export const useClassroomSession = () => {
  const context = useContext(ClassroomSessionContext);
  if (!context) throw new Error('useClassroomSession debe utilizarse dentro de ClassroomSessionProvider.');
  return context;
};
