import { useCallback, useLayoutEffect, useRef } from 'react';

/**
 * Canvas geometry is memoised and must keep its event props stable while the
 * transient edit ghost advances every animation frame. The ref is synchronised
 * before paint, so events always dispatch to the latest canvas state without
 * making both heavyweight geometry layers render for a preview-only update.
 */
export const useStableCanvasEvent = <Args extends unknown[], Result>(callback: (...args: Args) => Result) => {
  const callbackRef = useRef(callback);
  useLayoutEffect(() => { callbackRef.current = callback; }, [callback]);
  return useCallback((...args: Args) => callbackRef.current(...args), []);
};
