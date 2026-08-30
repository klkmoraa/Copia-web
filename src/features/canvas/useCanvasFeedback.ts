import { useCallback, useEffect, useRef, useState } from 'react';

/** Lo que dura un aviso del lienzo en pantalla antes de retirarse solo. */
const FEEDBACK_MS = 2400;

/**
 * El aviso efímero del lienzo, extraído tal cual de `StructuralCanvas.tsx`.
 *
 * Es el `role="alert"` que aparece bajo el dibujo cuando algo se copia, se
 * pega, se repite o falla. No es estado del proyecto —no entra en el modelo ni
 * en el historial—, sólo una frase con temporizador.
 *
 * El temporizador se cancelaba en el `useEffect` de desmontaje que el
 * componente comparte con los `requestAnimationFrame` de la máquina de gestos.
 * Aquí viaja con su propio estado, que es donde se puede razonar sobre él: un
 * aviso nuevo cancela el anterior, y desmontar cancela el que quede.
 */
export const useCanvasFeedback = () => {
  const timerRef = useRef<number | null>(null);
  const [canvasFeedback, setCanvasFeedback] = useState('');

  const showCanvasFeedback = useCallback((message: string) => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    setCanvasFeedback(message);
    timerRef.current = window.setTimeout(() => {
      setCanvasFeedback('');
      timerRef.current = null;
    }, FEEDBACK_MS);
  }, []);

  useEffect(() => () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  return { canvasFeedback, showCanvasFeedback };
};
