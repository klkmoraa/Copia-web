import {
  createRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type PropsWithChildren,
  type RefObject,
} from 'react';
import { SurfacePresentationContext, type SurfacePresentationContextValue } from './SurfacePresentationContext';
import type { ShellClass } from './shellComposition';
import {
  activateSurfaceIntent,
  BROKER_SURFACE_IDS,
  closeSurfaceIntent,
  createSurfaceBrokerState,
  isModalPresentation,
  openSurfaceIntent,
  resolveSurfaceActivity,
  setSurfaceExtent as setSurfaceExtentIntent,
  type SurfaceBrokerState,
  type SurfaceExtent,
  type SurfaceId,
} from './surfacePresentation';

type BrokerAction =
  | { type: 'open'; surface: SurfaceId }
  | { type: 'close'; surface: SurfaceId }
  | { type: 'activate'; surface: SurfaceId }
  | { type: 'extent'; shellClass: ShellClass; surface: SurfaceId; extent: SurfaceExtent };

const brokerReducer = (state: SurfaceBrokerState, action: BrokerAction): SurfaceBrokerState => {
  switch (action.type) {
    case 'open': return openSurfaceIntent(state, action.surface);
    case 'close': return closeSurfaceIntent(state, action.surface);
    case 'activate': return activateSurfaceIntent(state, action.surface);
    case 'extent': return setSurfaceExtentIntent(state, action.shellClass, action.surface, action.extent);
  }
};

const semanticFocusKey = (element: HTMLElement): string | null => (
  element.dataset.surfaceFocusKey ?? element.id ?? null
);

const findSemanticEquivalent = (root: HTMLElement, key: string | null): HTMLElement | null => {
  if (key) {
    const candidates = root.querySelectorAll<HTMLElement>('[data-surface-focus-key], [id]');
    for (const candidate of candidates) {
      if (semanticFocusKey(candidate) === key) return candidate;
    }
  }
  return root.querySelector<HTMLElement>([
    '[autofocus]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    'a[href]',
    '[tabindex]:not([tabindex="-1"])',
  ].join(', ')) ?? root;
};

export interface SurfacePresentationProviderProps extends PropsWithChildren {
  shellClass: ShellClass;
  initialOpen?: readonly SurfaceId[];
  backgroundRef: RefObject<HTMLElement | null>;
}

export const SurfacePresentationProvider = ({
  shellClass,
  initialOpen = [],
  backgroundRef,
  children,
}: SurfacePresentationProviderProps) => {
  const [state, dispatch] = useReducer(brokerReducer, initialOpen, createSurfaceBrokerState);
  const stateRef = useRef(state);
  stateRef.current = state;
  const [readiness, setReadiness] = useState<Partial<Record<SurfaceId, boolean>>>({});
  const activity = useMemo(() => resolveSurfaceActivity(shellClass, state), [shellClass, state]);
  const activityRef = useRef(activity);
  activityRef.current = activity;
  const returnFocusRefs = useRef(new Map<SurfaceId, HTMLElement>());
  const semanticFocusRefs = useRef(new Map<SurfaceId, string | null>());
  const lastFocusedSurfaceRef = useRef<SurfaceId | null>(null);
  const roots = useRef(Object.fromEntries(
    BROKER_SURFACE_IDS.map((surface) => [surface, createRef<HTMLElement>()]),
  ) as Record<SurfaceId, RefObject<HTMLElement | null>>);
  const previousShellClass = useRef(shellClass);

  const openSurface = useCallback((surface: SurfaceId, trigger?: HTMLElement | null) => {
    const candidate = trigger ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    if (candidate && candidate !== document.body) returnFocusRefs.current.set(surface, candidate);
    dispatch({ type: 'open', surface });
  }, []);

  const closeSurface = useCallback((surface: SurfaceId) => {
    const returnTarget = returnFocusRefs.current.get(surface);
    const nextState = closeSurfaceIntent(stateRef.current, surface);
    const nextActivity = resolveSurfaceActivity(shellClass, nextState);
    const resumedSurface = BROKER_SURFACE_IDS.find((candidate) => nextActivity[candidate].status === 'active');
    dispatch({ type: 'close', surface });
    setReadiness((current) => ({ ...current, [surface]: false }));
    window.requestAnimationFrame(() => {
      if (returnTarget?.isConnected) {
        returnTarget.focus();
        return;
      }
      if (!resumedSurface) return;
      const root = roots.current[resumedSurface].current
        ?? document.querySelector<HTMLElement>(`[data-workspace-surface="${resumedSurface}"]`);
      const equivalent = root && findSemanticEquivalent(root, semanticFocusRefs.current.get(resumedSurface) ?? null);
      equivalent?.focus();
    });
  }, [shellClass]);

  const toggleSurface = useCallback((surface: SurfaceId, trigger?: HTMLElement | null) => {
    if (activityRef.current[surface].open) closeSurface(surface);
    else openSurface(surface, trigger);
  }, [closeSurface, openSurface]);

  const activateSurface = useCallback((surface: SurfaceId) => dispatch({ type: 'activate', surface }), []);
  const markSurfaceReady = useCallback((surface: SurfaceId, ready = true) => {
    setReadiness((current) => current[surface] === ready ? current : { ...current, [surface]: ready });
  }, []);
  const setSurfaceExtent = useCallback((surface: SurfaceId, extent: SurfaceExtent) => {
    dispatch({ type: 'extent', shellClass, surface, extent });
  }, [shellClass]);

  useEffect(() => {
    const onFocusIn = (event: FocusEvent) => {
      if (!(event.target instanceof HTMLElement)) return;
      const root = event.target.closest<HTMLElement>('[data-workspace-surface]');
      const surface = root?.dataset.workspaceSurface as SurfaceId | undefined;
      if (!surface || !BROKER_SURFACE_IDS.includes(surface)) return;
      semanticFocusRefs.current.set(surface, semanticFocusKey(event.target));
      lastFocusedSurfaceRef.current = surface;
    };
    document.addEventListener('focusin', onFocusIn);
    return () => document.removeEventListener('focusin', onFocusIn);
  }, []);

  useLayoutEffect(() => {
    if (previousShellClass.current === shellClass) return;
    previousShellClass.current = shellClass;
    const focusedSurface = lastFocusedSurfaceRef.current;
    if (!focusedSurface || activity[focusedSurface].status !== 'active') return;
    const handle = window.requestAnimationFrame(() => {
      const root = roots.current[focusedSurface].current
        ?? document.querySelector<HTMLElement>(`[data-workspace-surface="${focusedSurface}"]`);
      const target = root && findSemanticEquivalent(root, semanticFocusRefs.current.get(focusedSurface) ?? null);
      target?.focus();
    });
    return () => window.cancelAnimationFrame(handle);
  }, [activity, shellClass]);

  // A `peek`ed surface stays `active` in the broker — it is still open, still
  // retained, still the one drawer/fullscreen allowed at a time — but it no
  // longer traps focus, so the background must stop being `inert` the moment
  // it degrades, not only when it fully closes.
  const activeModal = BROKER_SURFACE_IDS.find((surface) => (
    activity[surface].status === 'active'
    && activity[surface].extent !== 'peek'
    && isModalPresentation(activity[surface].presentation)
    && readiness[surface]
  ));

  useLayoutEffect(() => {
    if (!activeModal) return undefined;
    const background = backgroundRef.current;
    if (!background) return undefined;
    const previousInert = background.inert;
    const previousAriaHidden = background.getAttribute('aria-hidden');
    background.inert = true;
    background.setAttribute('aria-hidden', 'true');
    return () => {
      background.inert = previousInert;
      if (previousAriaHidden === null) background.removeAttribute('aria-hidden');
      else background.setAttribute('aria-hidden', previousAriaHidden);
    };
  }, [activeModal, backgroundRef]);

  const context = useMemo<SurfacePresentationContextValue>(() => ({
    shellClass,
    openSurface,
    closeSurface,
    toggleSurface,
    activateSurface,
    markSurfaceReady,
    setSurfaceExtent,
    stateFor: (surface) => activity[surface],
    presentationFor: (surface) => activity[surface].presentation,
    isRetained: (surface) => activity[surface].open,
    surfaceRootRef: (surface) => roots.current[surface],
  }), [
    activateSurface,
    activity,
    closeSurface,
    markSurfaceReady,
    openSurface,
    setSurfaceExtent,
    shellClass,
    toggleSurface,
  ]);

  return <SurfacePresentationContext.Provider value={context}>{children}</SurfacePresentationContext.Provider>;
};
