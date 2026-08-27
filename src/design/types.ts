/**
 * Resultado de diseño normativo, deliberadamente separado de AnalysisResult.
 *
 * El motor publica acciones y calidad numérica. Este contrato sólo puede leer
 * esa salida y producir una evaluación versionada; nunca se persiste dentro del
 * proyecto ni vuelve a entrar al solver.
 */

export type DesignComponentStatus = 'within-component' | 'outside-component';
export type DesignConclusionStatus = 'incomplete';

export interface DesignVariable {
  readonly symbol: string;
  readonly label: string;
  readonly value: number;
  readonly unit: 'kN' | 'kN/m²' | 'm²' | '1';
  readonly source: string;
}

export interface DesignResult {
  readonly schemaVersion: 1;
  readonly kind: 'design-result';
  readonly module: {
    readonly id: string;
    readonly version: string;
  };
  readonly standard: {
    readonly title: string;
    readonly jurisdiction: string;
    readonly edition: string;
    readonly publicationDate: string;
    readonly reviewedAt: string;
    readonly sourceUrl: string;
    readonly sourceSha256: string;
    readonly pdfPage: number;
    readonly printedPage: number;
  };
  readonly generatedFrom: {
    readonly kind: 'analysis-result';
    readonly combinationId: string;
    readonly memberResultId: string;
    readonly demandSelector: 'positive-axial-envelope';
  };
  readonly subject: {
    readonly memberId: string;
    readonly materialId: string;
    readonly sectionId: string;
  };
  readonly check: {
    readonly id: string;
    readonly title: string;
    readonly clause: string;
    readonly equation: string;
    readonly inequality: string;
  };
  readonly substitutions: readonly DesignVariable[];
  readonly demand: DesignVariable;
  readonly resistance: DesignVariable;
  readonly ratio: {
    readonly symbol: 'Pu/Rt,y';
    readonly value: number;
    readonly unit: '1';
  };
  readonly componentStatus: DesignComponentStatus;
  readonly status: DesignConclusionStatus;
  readonly assumptions: readonly string[];
  readonly limitations: readonly string[];
  readonly missingChecks: readonly string[];
}
