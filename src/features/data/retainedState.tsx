import { createContext, useCallback, useContext, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';

/**
 * Estado que sobrevive a una suspensión de la superficie.
 *
 * EL PROBLEMA QUE RESUELVE, exactamente. `ModalSurface` desmonta a sus hijos
 * cuando se cierra —`AnimatePresence` los saca del árbol—, así que cualquier
 * `useState` que viva DENTRO del cajón se pierde al suspender la superficie.
 * Mientras cada superficie densa montaba su propio `Drawer`, sus borradores
 * vivían en el componente que envolvía ese cajón y por eso sobrevivían sin que
 * nadie lo escribiera en ninguna parte: era una propiedad accidental de dónde
 * estaba declarado el `useState`.
 *
 * Al unificar el cromo, los cuerpos pasaron a estar dentro del cajón y esa
 * propiedad accidental se habría perdido en silencio —un borrador sin aplicar
 * desaparecería al abrir cualquier capa por encima en Compact—. Esto la vuelve
 * explícita: `DataSurface` monta el almacén POR ENCIMA del cajón, así que lo
 * que se guarde aquí sigue vivo mientras la superficie esté retenida, y muere
 * con ella al cerrarse de verdad. Que es justo el contrato de CRI-102.
 */
const RetainedStateContext = createContext<Map<string, unknown> | null>(null);

export const RetainedStateProvider = ({ children }: { children: ReactNode }) => {
  const store = useRef<Map<string, unknown>>(undefined as unknown as Map<string, unknown>);
  store.current ??= new Map<string, unknown>();
  return <RetainedStateContext.Provider value={store.current}>{children}</RetainedStateContext.Provider>;
};

/**
 * `useState` cuyo valor se guarda en el almacén retenido.
 *
 * Sin proveedor se comporta como un `useState` normal, para que un componente
 * se pueda montar suelto en una prueba o en el laboratorio sin exigir cromo.
 */
export const useRetainedState = <T,>(key: string, initial: T): [T, Dispatch<SetStateAction<T>>] => {
  const store = useContext(RetainedStateContext);
  const [value, setValue] = useState<T>(() => (store?.has(key) ? store.get(key) as T : initial));
  const commit = useCallback<Dispatch<SetStateAction<T>>>((next) => {
    setValue((current) => {
      const resolved = typeof next === 'function' ? (next as (previous: T) => T)(current) : next;
      store?.set(key, resolved);
      return resolved;
    });
  }, [key, store]);
  return [value, commit];
};
