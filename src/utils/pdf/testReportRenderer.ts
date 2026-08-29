/**
 * The report renderer, wired up for the test run.
 *
 * The gates that matter most about this document — that every method writes its own arithmetic,
 * that a material sheet names the profile the model declares, that dropping a part does not open
 * a hole in the numbering — all work by reading the finished PDF back. They are only worth
 * anything if the PDF they read is the one the product makes, so the suite renders through the
 * same Python package and the same ReportLab the browser uses. Nothing is stubbed.
 *
 * What differs is only where the interpreter comes from: `scripts/report-renderer.mjs` boots it
 * from `node_modules` instead of from the app's assets. One boot per run, reused by every test
 * that asks for a report.
 *
 * Registered from `vite.config.ts`'s `test.setupFiles`, so no individual test has to know.
 */
import { setReportRenderer } from './reportlabRenderer';

setReportRenderer(async (documentJson) => {
  const { renderReportJson } = await import('../../../scripts/report-renderer.mjs');
  return renderReportJson(documentJson);
});
