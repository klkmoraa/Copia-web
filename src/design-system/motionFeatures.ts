/**
 * Animation feature bundle, isolated so the bundler can split it out of the entry chunk.
 *
 * `motion`'s full `motion.*` components ship every feature — gestures, layout projection,
 * drag — inside whatever chunk imports them. Importing them from `WelcomeScreen` (which the
 * entry chunk needs for first paint) pushed ~47 kB gzip into the initial download.
 *
 * The app instead uses the lightweight `m.*` components plus this feature set loaded
 * asynchronously by `LazyMotion`, so animation capability arrives after first paint rather
 * than blocking it. `domMax` (not `domAnimation`) is required because the toast stack and
 * the welcome template grid animate their `layout`.
 */
export { domMax as default } from 'motion/react';
