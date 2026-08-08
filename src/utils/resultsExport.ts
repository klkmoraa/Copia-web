import type { AnalysisResult, ProjectModel } from '../types';
import { toDisplay, unitLabel, type UnitQuantity } from '../engine/units';
import { summarizeAnalysisResults } from '../engine/resultSummary';
import { formatMachineNumber } from './numberFormat';

export interface ResultsCsvOptions {
  scenarioName?: string;
}

const HEADER = ['section', 'entity', 'id', 'quantity', 'extreme', 'position', 'value', 'unit', 'scenario', 'severity', 'message'] as const;

const csvCell = (value: string | number): string => {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

const csvNumber = (value: number): string => formatMachineNumber(value);

const row = (values: Array<string | number>): string => values.map(csvCell).join(',');

const display = (value: number, project: ProjectModel, quantity: UnitQuantity): string =>
  csvNumber(toDisplay(value, project.settings.units, quantity));

const safeFilename = (name: string): string => name
  .normalize('NFKD')
  .replace(/[^a-zA-Z0-9 _-]/g, '')
  .trim()
  .replace(/\s+/g, '-')
  .toLowerCase() || 'structureco-results';

/**
 * Builds one rectangular, machine-readable CSV. Internal values are converted
 * to the project's display unit system; numeric cells never use locale commas.
 */
export const buildResultsCsv = (
  project: ProjectModel,
  analysis: AnalysisResult,
  options: ResultsCsvOptions = {},
): string => {
  const scenario = options.scenarioName ?? '';
  const lengthUnit = unitLabel(project.settings.units, 'length');
  const forceUnit = unitLabel(project.settings.units, 'force');
  const momentUnit = unitLabel(project.settings.units, 'moment');
  const rows: string[] = [row([...HEADER])];

  for (const node of analysis.nodeResults) {
    const reactions: Array<[string, number, UnitQuantity]> = [
      ['Rx', node.rx, 'force'],
      ['Ry', node.ry, 'force'],
      ['Mz', node.rm, 'moment'],
    ];
    const displacements: Array<[string, number, UnitQuantity | 'rotation']> = [
      ['Ux', node.ux, 'length'],
      ['Uy', node.uy, 'length'],
      ['Rz', node.rz, 'rotation'],
    ];
    for (const [quantity, value, unitQuantity] of reactions) rows.push(row([
      'reaction', 'node', node.nodeId, quantity, '', '',
      display(value, project, unitQuantity), unitQuantity === 'moment' ? momentUnit : forceUnit,
      scenario, '', '',
    ]));
    for (const [quantity, value, unitQuantity] of displacements) rows.push(row([
      'displacement', 'node', node.nodeId, quantity, '', '',
      unitQuantity === 'rotation' ? csvNumber(value) : display(value, project, unitQuantity),
      unitQuantity === 'rotation' ? 'rad' : lengthUnit,
      scenario, '', '',
    ]));
  }

  const summary = summarizeAnalysisResults(analysis);
  for (const member of summary.members) {
    for (const quantity of ['axial', 'shear', 'moment'] as const) {
      const extrema = member.diagrams[quantity];
      const unitQuantity: UnitQuantity = quantity === 'moment' ? 'moment' : 'force';
      const unit = quantity === 'moment' ? momentUnit : forceUnit;
      for (const point of [extrema.minimum, extrema.maximum]) rows.push(row([
        'member_extreme', 'member', member.memberId, quantity, point.kind,
        display(point.x, project, 'length'), display(point.value, project, unitQuantity), unit,
        scenario, '', '',
      ]));
    }
    for (const quantity of ['u', 'v', 'theta'] as const) {
      const extrema = member.deformations[quantity];
      if (!extrema) continue;
      for (const point of [extrema.minimum, extrema.maximum]) rows.push(row([
        'deformation_extreme', 'member', member.memberId, quantity, point.kind,
        display(point.x, project, 'length'),
        quantity === 'theta' ? csvNumber(point.value) : display(point.value, project, 'length'),
        quantity === 'theta' ? 'rad' : lengthUnit,
        scenario, '', '',
      ]));
    }
  }

  for (const issue of analysis.issues) rows.push(row([
    'issue', issue.objectId ? 'object' : 'analysis', issue.objectId ?? '', '', '', '', '', '',
    scenario, issue.severity, `${issue.title}: ${issue.message}${issue.suggestedFix ? ` Solución: ${issue.suggestedFix}` : ''}`,
  ]));

  // BOM makes accented Spanish text open correctly in Excel without an import wizard.
  return `\uFEFF${rows.join('\r\n')}\r\n`;
};

export const resultsCsvFilename = (project: ProjectModel): string => `${safeFilename(project.name)}-resultados.csv`;

export const createResultsCsvBlob = (
  project: ProjectModel,
  analysis: AnalysisResult,
  options?: ResultsCsvOptions,
): Blob => new Blob([buildResultsCsv(project, analysis, options)], { type: 'text/csv;charset=utf-8' });

/** Browser-only convenience helper; the pure builder remains independently testable. */
export const downloadResultsCsv = (
  project: ProjectModel,
  analysis: AnalysisResult,
  options?: ResultsCsvOptions,
): void => {
  const url = URL.createObjectURL(createResultsCsvBlob(project, analysis, options));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = resultsCsvFilename(project);
  anchor.style.display = 'none';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
};
