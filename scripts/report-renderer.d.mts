/**
 * Types for `scripts/report-renderer.mjs`, so the test setup that installs it typechecks.
 *
 * The script itself is plain JavaScript on purpose: it runs under bare `node` from QA scripts
 * and from an agent's shell, with no build step in the way.
 */
export declare const renderReportJson: (documentJson: string) => Promise<Uint8Array>;
export declare const renderReport: (document: unknown) => Promise<Uint8Array>;
