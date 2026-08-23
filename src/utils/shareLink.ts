/**
 * Compartir un modelo dentro de un enlace, sin servidor.
 *
 * El modelo va comprimido en el **fragmento** de la URL. Que sea el fragmento y
 * no la query no es un detalle de estilo: lo que va detrás de `#` **no se envía
 * al servidor** en ninguna petición, no aparece en los registros de acceso ni en
 * la cabecera `Referer`. Un producto que se declara local-first no puede
 * compartir el modelo de un usuario poniéndolo en una ruta que su propio
 * alojamiento registra.
 *
 * ## El techo es obligatorio
 *
 * Los navegadores y sobre todo los clientes de correo y mensajería truncan URLs
 * largas, y una URL truncada no falla: **carga a medias o no carga**, sin decir
 * por qué. Por eso hay un techo y por eso, al pasarlo, esto devuelve una
 * negativa explicando que hay que usar el expediente `.structureco`, en vez de
 * un enlace que se romperá en el camino.
 */
import { deflateSync, inflateSync } from 'fflate';
import { normalizeProject } from '../data/migrate';
import type { ProjectModel } from '../types';

/**
 * Techo del fragmento en caracteres.
 *
 * 8 000 es conservador a propósito: Chrome admite mucho más, pero clientes de
 * correo y aplicaciones de mensajería cortan bastante antes, y quien comparte un
 * enlace no controla por dónde va a viajar.
 */
export const SHARE_LINK_LIMIT = 8000;

const PREFIX = 'm1:';

/** Base64 apto para URL: sin `+`, sin `/` y sin relleno que haya que escapar. */
const toBase64Url = (bytes: Uint8Array): string => {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromBase64Url = (text: string): Uint8Array => {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};

export type ShareEncoding =
  | { ok: true; fragment: string; characters: number }
  | { ok: false; reason: 'too-large'; characters: number; limit: number };

/** Comprime el modelo y devuelve el fragmento, o dice que no cabe. */
export const encodeProjectFragment = (project: ProjectModel): ShareEncoding => {
  const json = JSON.stringify(normalizeProject(project));
  const compressed = deflateSync(new TextEncoder().encode(json), { level: 9 });
  const fragment = `${PREFIX}${toBase64Url(compressed)}`;
  if (fragment.length > SHARE_LINK_LIMIT) {
    return { ok: false, reason: 'too-large', characters: fragment.length, limit: SHARE_LINK_LIMIT };
  }
  return { ok: true, fragment, characters: fragment.length };
};

export type ShareLinkResult =
  | { ok: true; url: string; characters: number }
  | { ok: false; reason: 'too-large'; characters: number; limit: number };

/** Enlace completo a partir de la dirección actual de la aplicación. */
export const buildShareLink = (project: ProjectModel, baseUrl: string): ShareLinkResult => {
  const encoded = encodeProjectFragment(project);
  if (!encoded.ok) return encoded;
  const url = new URL(baseUrl);
  url.hash = encoded.fragment;
  return { ok: true, url: url.toString(), characters: encoded.characters };
};

export type ShareDecoding =
  | { ok: true; project: ProjectModel }
  | { ok: false; reason: 'absent' | 'malformed' };

/**
 * Lee un modelo compartido del fragmento.
 *
 * Todo lo que llega por aquí es contenido de fuera, así que se valida su forma
 * antes de devolverlo: un fragmento manipulado no puede convertirse en un objeto
 * con la pinta de proyecto pero sin las colecciones que el resto del código da
 * por hechas. `normalizeProject` completa lo que falte de versiones antiguas;
 * lo que no se puede completar se rechaza.
 */
export const decodeProjectFragment = (fragment: string): ShareDecoding => {
  const body = fragment.startsWith('#') ? fragment.slice(1) : fragment;
  if (!body.startsWith(PREFIX)) return { ok: false, reason: 'absent' };
  try {
    const json = new TextDecoder().decode(inflateSync(fromBase64Url(body.slice(PREFIX.length))));
    const parsed: unknown = JSON.parse(json);
    if (!parsed || typeof parsed !== 'object') return { ok: false, reason: 'malformed' };
    const candidate = parsed as Partial<ProjectModel>;
    if (typeof candidate.id !== 'string' || !Array.isArray(candidate.nodes) || !Array.isArray(candidate.members)) {
      return { ok: false, reason: 'malformed' };
    }
    return { ok: true, project: normalizeProject(candidate as ProjectModel) };
  } catch {
    return { ok: false, reason: 'malformed' };
  }
};
