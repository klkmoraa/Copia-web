/**
 * The application version, injected from `package.json` at build time.
 *
 * It used to be a string literal repeated in two places, and both had been left at
 * `0.7.0` while the package moved on. Every exported PDF, `.structureco` bundle and
 * portable payload therefore claimed to come from a release two versions old, which is
 * exactly the kind of provenance an engineering document must not get wrong.
 */
declare const __APP_VERSION__: string | undefined;

export const APP_VERSION: string = typeof __APP_VERSION__ === 'string' && __APP_VERSION__ !== ''
  ? __APP_VERSION__
  : '0.0.0-dev';
