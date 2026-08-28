import { describe, expect, it } from 'vitest';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { createHibbelerTributaryBeam } from '../data/defaultProject';
import { analyzeProject } from '../engine/solver';
import { createCalculationReport } from './calculationPdf';
import { inspectPdf } from './pdfImport';
import { createPortableBundle, readPortableBundle } from './portableBundle';
import {
  createPortablePayload,
  parsePortablePayload,
  serializePortablePayload,
  verifyPortablePayload,
} from './portablePayload';

const analyzedFixture = () => {
  const project = createHibbelerTributaryBeam();
  project.id = 'portable-test';
  const analysis = analyzeProject(project);
  expect(analysis.success).toBe(true);
  return { project, analysis };
};

describe('expediente portable structureCo', () => {
  it('firma y válida el snapshot exacto de proyecto y análisis', async () => {
    const { project, analysis } = analyzedFixture();
    const payload = await createPortablePayload(project, analysis, {
      generatedAt: '2026-07-12T12:00:00.000Z',
      scenarioName: 'Servicio',
    });

    expect(payload.project).toEqual(JSON.parse(JSON.stringify(project)));
    expect(payload.analysis).toEqual(JSON.parse(JSON.stringify(analysis)));
    expect(payload.metadata).toMatchObject({
      numericQuality: 'stable',
      analysisMode: 'first-order',
      pDeltaExperimental: false,
    });
    expect(payload.checksum.value).toMatch(/^[a-f0-9]{64}$/);
    expect(await verifyPortablePayload(payload)).toBe(true);
    await expect(parsePortablePayload(serializePortablePayload(payload))).resolves.toEqual(payload);

    const tampered = JSON.parse(serializePortablePayload(payload)) as typeof payload;
    tampered.project.name = 'Proyecto alterado';
    await expect(parsePortablePayload(JSON.stringify(tampered))).rejects.toThrow(/checksum/i);
  });

  it('genera un PDF legible con attachment reimportable y texto técnico', async () => {
    const { project } = analyzedFixture();
    project.memberLoads[0].end = 0.7;
    const analysis = analyzeProject(project);
    expect(analysis.success).toBe(true);
    const report = await createCalculationReport(project, analysis, {
      generatedAt: '2026-07-12T12:00:00.000Z',
      scenarioName: 'Servicio',
    });

    expect(new TextDecoder().decode(report.bytes.slice(0, 8))).toContain('%PDF');
    const inspection = await inspectPdf(report.bytes);
    expect(inspection.kind).toBe('native');
    expect(inspection.confidence).toBeGreaterThan(0.95);
    expect(inspection.payload?.project).toEqual(report.payload.project);
    expect(inspection.payload?.analysis).toEqual(report.payload.analysis);
    expect(inspection.text).toMatch(/Diagramas N, V y M/i);
    expect(inspection.text).toMatch(/Procedimiento y cálculos/i);
    expect(inspection.text).toMatch(/dominio x\/L=0\s*->\s*0\.7/i);
    expect(inspection.text).toMatch(/x=0 ft\s*->\s*7 ft/i);
    expect(inspection.text).toMatch(/longitud real cargada=7 ft/i);
    expect(inspection.text).toMatch(/longitud real cargada=/i);
    expect(inspection.text).toMatch(/cobertura=70%/i);
    expect(inspection.text).toMatch(/base=longitud real/i);
    expect(inspection.text).toMatch(/Factores del escenario\s+LC1=1/i);
    // `d_local` y `d_global` se componen ahora con subíndices reales, así que el guión
    // bajo es geometría y no un carácter que la extracción pueda ver.
    expect(inspection.text).toMatch(/d\s*local\s*=\s*T\s*d\s*global/i);
    expect(inspection.text).toMatch(/\[U_x, U_y, R_z\]/i);
    expect(inspection.text).toMatch(/Auditoría independiente de cargas/i);
    expect(inspection.text).toMatch(/Auditoría por trabajo virtual/i);
    // The per-member residuals are a table since AG-014, so the label is a column header
    // rather than a `nombre=valor` pair. The audit itself is unchanged.
    expect(inspection.text).toMatch(/Residuo mecánico\s+Residuo inicial\s+Residuo total/i);
    expect(inspection.text).toMatch(/residuo equilibrio f[ií]sico/i);
  }, 30_000);

  it('clasifica PDF digital externo y PDF sin texto sin inventar un modelo', async () => {
    const external = await PDFDocument.create();
    const externalPage = external.addPage();
    const font = await external.embedFont(StandardFonts.Helvetica);
    externalPage.drawText('External structural calculation with nodes, members, reactions, shear and bending moment results.', { x: 40, y: 700, size: 12, font });
    const externalInspection = await inspectPdf(await external.save());
    expect(externalInspection.kind).toBe('external');
    expect(externalInspection.payload).toBeUndefined();
    expect(externalInspection.text).toContain('External structural calculation');

    const scanned = await PDFDocument.create();
    scanned.addPage();
    const scannedInspection = await inspectPdf(await scanned.save());
    expect(scannedInspection.kind).toBe('scanned');
    expect(scannedInspection.payload).toBeUndefined();
    expect(scannedInspection.warnings.join(' ')).toMatch(/OCR/i);
  }, 30_000);

  it('crea y relee un paquete .structureco con manifest, datos y reporte', async () => {
    const { project, analysis } = analyzedFixture();
    Object.assign(project.members[0] as object, {
      materialId: 'steel-a992', materialOrigin: 'catalog',
      sectionId: 'ipe-300', sectionOrigin: 'catalog',
    });
    const bundle = await createPortableBundle(project, analysis, { generatedAt: '2026-07-12T12:00:00.000Z' });
    expect(bundle.filename).toMatch(/\.structureco$/);
    expect(Array.from(bundle.bytes.slice(0, 2))).toEqual([0x50, 0x4B]);

    const restored = await readPortableBundle(bundle.bytes);
    expect(restored.manifest.payloadChecksum).toBe(bundle.payload.checksum.value);
    expect(restored.payload.project).toEqual(bundle.payload.project);
    expect(restored.payload.project.members[0]).toMatchObject({
      materialId: 'steel-a992', materialOrigin: 'catalog',
      sectionId: 'ipe-300', sectionOrigin: 'catalog',
    });
    expect(restored.payload.analysis).toEqual(bundle.payload.analysis);
    expect(new TextDecoder().decode(restored.reportBytes.slice(0, 8))).toContain('%PDF');
  }, 30_000);
});
