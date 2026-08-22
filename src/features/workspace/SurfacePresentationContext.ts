import { createContext, type RefObject } from 'react';
import type { ShellClass } from './shellComposition';
import type {
  SurfaceActivity,
  SurfaceExtent,
  SurfaceId,
  SurfacePresentation,
} from './surfacePresentation';

export interface SurfacePresentationContextValue {
  shellClass: ShellClass;
  openSurface: (surface: SurfaceId, trigger?: HTMLElement | null) => void;
  closeSurface: (surface: SurfaceId) => void;
  toggleSurface: (surface: SurfaceId, trigger?: HTMLElement | null) => void;
  activateSurface: (surface: SurfaceId) => void;
  markSurfaceReady: (surface: SurfaceId, ready?: boolean) => void;
  setSurfaceExtent: (surface: SurfaceId, extent: SurfaceExtent) => void;
  stateFor: (surface: SurfaceId) => SurfaceActivity;
  presentationFor: (surface: SurfaceId) => SurfacePresentation;
  isRetained: (surface: SurfaceId) => boolean;
  surfaceRootRef: (surface: SurfaceId) => RefObject<HTMLElement | null>;
}

export const SurfacePresentationContext = createContext<SurfacePresentationContextValue | null>(null);
