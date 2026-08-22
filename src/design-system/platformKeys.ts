/**
 * Cómo se ESCRIBE un atajo, según la plataforma que lo lee.
 *
 * El producto imita a una app del ecosistema Apple y le decía «Ctrl» a todo el
 * mundo. No había detección de plataforma en ningún sitio de `src`, y convivían
 * tres convenciones para lo mismo: `'Ctrl Z'` en el registro de comandos,
 * `'Ctrl/Cmd+C'` en la barra contextual —que enseña las dos plataformas a la
 * vez, que es lo peor de los dos mundos— y `<kbd>Ctrl K</kbd>` escrito a mano
 * tres veces en el riel de herramientas.
 *
 * Los MANEJADORES nunca fueron el problema: los seis sitios que atienden un
 * atajo ya aceptan `ctrlKey || metaKey`. Lo que faltaba era decirlo bien.
 *
 * Un atajo se declara con la tecla lógica `mod`, que es «⌘ en Apple, Ctrl en el
 * resto», igual que la resuelven las propias APIs del sistema. Nada de esto
 * cambia qué teclas funcionan: es presentación.
 */

export type ModifierKey = 'mod' | 'alt' | 'shift' | 'ctrl';

const APPLE_SYMBOLS: Record<ModifierKey, string> = {
  mod: '⌘',
  alt: '⌥',
  shift: '⇧',
  ctrl: '⌃',
};

const PORTABLE_NAMES: Record<ModifierKey, string> = {
  mod: 'Ctrl',
  alt: 'Alt',
  shift: 'Shift',
  ctrl: 'Ctrl',
};

/**
 * `userAgentData.platform` es la lectura moderna y no está congelada por
 * compatibilidad; `navigator.platform` es el respaldo. Las dos pueden faltar
 * —jsdom, SSR, un navegador que las recorte— y en ese caso se responde la
 * convención portátil, que es la que nadie lee mal: un usuario de Mac que vea
 * «Ctrl» entiende que se refiere a su tecla de comando, pero uno de Windows que
 * vea «⌘» no tiene con qué traducirlo.
 */
export const isApplePlatform = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  const platform = (navigator as Navigator & { userAgentData?: { platform?: string } })
    .userAgentData?.platform ?? navigator.platform ?? '';
  return /mac|iphone|ipad|ipod/i.test(platform);
};

/** El símbolo o el nombre de un modificador en la plataforma que está leyendo. */
export const modifierLabel = (key: ModifierKey, apple = isApplePlatform()): string => (
  apple ? APPLE_SYMBOLS[key] : PORTABLE_NAMES[key]
);

/**
 * Escribe un atajo declarado como `mod+K`, `mod+shift+Z` o `Delete`.
 *
 * En Apple los modificadores se pegan a la tecla —`⌘K`, no `⌘ + K`—, que es
 * como los escribe el sistema en sus propios menús. Fuera se separan con un
 * espacio fino, sin `+`, que es la forma que ya usaba este producto (`Ctrl Z`).
 */
export const formatShortcut = (declaration: string, apple = isApplePlatform()): string => {
  const parts = declaration.split('+').map((part) => part.trim()).filter(Boolean);
  const modifiers: string[] = [];
  const keys: string[] = [];
  for (const part of parts) {
    const lower = part.toLowerCase();
    if (lower === 'mod' || lower === 'alt' || lower === 'shift' || lower === 'ctrl') {
      modifiers.push(modifierLabel(lower, apple));
    } else {
      keys.push(part.length === 1 ? part.toUpperCase() : part);
    }
  }
  const key = keys.join(' ');
  if (!modifiers.length) return key;
  return apple ? `${modifiers.join('')}${key}` : `${[...modifiers, key].join(' ')}`;
};

/**
 * La forma de `aria-keyshortcuts`, que NO es la visible: la especificación pide
 * nombres de tecla del DOM separados por `+`, nunca símbolos. Un lector de
 * pantalla que reciba `⌘K` no tiene forma de anunciarlo.
 */
export const ariaKeyShortcut = (declaration: string, apple = isApplePlatform()): string => (
  declaration
    .split('+')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const lower = part.toLowerCase();
      if (lower === 'mod') return apple ? 'Meta' : 'Control';
      if (lower === 'ctrl') return 'Control';
      if (lower === 'alt') return 'Alt';
      if (lower === 'shift') return 'Shift';
      return part.length === 1 ? part.toUpperCase() : part;
    })
    .join('+')
);
