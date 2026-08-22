/**
 * Entrada aislada del Web Worker de Space 3D.
 *
 * Sólo reenvía al handler puro del protocolo: toda la lógica vive en
 * `protocol.ts` para que la ruta en worker y la ruta en hilo sean el mismo
 * código y las pruebas no necesiten un Worker real.
 */
import { handleSpace3DWorkerRequest, type Space3DWorkerResponse } from './protocol';

interface Space3DWorkerScope {
  addEventListener(type: 'message', listener: (event: MessageEvent<unknown>) => void): void;
  postMessage(message: Space3DWorkerResponse): void;
}

const workerScope = self as unknown as Space3DWorkerScope;

workerScope.addEventListener('message', (event) => {
  workerScope.postMessage(handleSpace3DWorkerRequest(event.data));
});
