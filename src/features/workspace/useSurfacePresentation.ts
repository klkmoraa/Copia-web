import { useContext } from 'react';
import { SurfacePresentationContext } from './SurfacePresentationContext';

export const useSurfacePresentation = () => {
  const context = useContext(SurfacePresentationContext);
  if (!context) throw new Error('useSurfacePresentation debe usarse dentro de SurfacePresentationProvider.');
  return context;
};
