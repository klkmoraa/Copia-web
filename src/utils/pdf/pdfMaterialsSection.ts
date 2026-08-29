/**
 * What the structure is made of: the specification behind every `E`, `A` and `I` the solver used.
 *
 * «Modelo y acciones» lists those three numbers per member and stops, so a reader holding the
 * memoir could not tell an IPE 300 in S275 from a 30×50 concrete beam — the model stores
 * `materialId` and `sectionId`, and the catalogues carry the full sheet (standard, f_y, G, ν,
 * ρ, α; depth, width, web, flange, A, I_x, I_y, S_x, Z_x, r_x, linear weight), and none of it
 * reached the page. Forty members sharing one profile also repeated it forty times.
 *
 * The domain rule is the product's own, taken from `resolveSectionGeometry`: a real profile is
 * drawn only where the member declares an explicit catalogue identity. Two different sections
 * can share `A` and `I`, so inferring a commercial profile from those two numbers would be
 * inventing an identity the model does not hold. Anything else resolves to the equivalent
 * rectangle `h = √(12·I/A)`, and says so.
 *
 * The grouping, the quantities and the identity warnings all come from `buildStructuralBom`,
 * the same module the BOM export uses, so the memoir and the bill of materials can never
 * disagree about what this structure is made of.
 */
import { buildStructuralBom, type BomWarning, type StructuralBomRow } from '../../features/bom/structuralBom';
import { resolveSectionGeometry } from '../../features/inspector/sectionGeometry';
import { findStandardMaterial, type StandardMaterial } from '../../data/standardMaterials';
import { findStandardSection, type StandardSection } from '../../data/standardSections';
import { toDisplay, unitLabel } from '../../engine/units';
import { drawSectionShape, sectionShapeBox, type Rect } from './pdfScene';
import { drawFigureFrame } from './pdfChrome';
import { number, unitFor } from './pdfFormat';
import { pdfText } from './pdfGlyphs';
import { TYPE } from './pdfTheme';
import type { MemberModel, MemberPropertyOrigin, ProjectModel } from '../../types';
import type { PdfTableColumn } from './pdfBuilder';
import type { ReportContext } from './reportContext';

const NUMERIC: Pick<PdfTableColumn, 'align'> = { align: 'right' };

const ORIGIN_LABEL: Record<MemberPropertyOrigin, string> = {
  catalog: 'catálogo',
  custom: 'personalizada',
  imported: 'importada',
  legacy: 'heredada',
};

const CATEGORY_LABEL: Record<StandardMaterial['category'], string> = {
  STEEL: 'acero',
  CONCRETE: 'concreto',
  TIMBER: 'madera',
  ALUMINUM: 'aluminio',
};

const SHAPE_LABEL: Record<StandardSection['shapeType'], string> = {
  I: 'perfil doble T',
  C: 'perfil en U',
  L: 'angular',
  RECT: 'rectangular maciza',
  HSS_RECT: 'tubular rectangular',
  HSS_ROUND: 'tubular circular',
};

const WARNING_LABEL: Record<BomWarning, string> = {
  'explicit-catalog-identity-required': 'El miembro no declara identidad de catálogo: sus propiedades son las que se tecleó.',
  'catalog-entry-missing': 'El identificador declarado no existe en el catálogo de esta versión.',
  'catalog-quantity-properties-drifted': 'Las propiedades del miembro ya no coinciden con las del catálogo que dice usar.',
  'quantity-properties-unavailable': 'Faltan datos para calcular volumen, masa o peso propio de este grupo.',
};

/** `2.1e+8 MPa` — a catalogue figure in the project's own presentation units. */
const spec = (project: ProjectModel, value: number, quantity: Parameters<typeof toDisplay>[2]): string =>
  `${number(toDisplay(value, project.settings.units, quantity), 5)} ${unitLabel(project.settings.units, quantity)}`;

/** Section modulus and plastic modulus are volumes; there is no unit quantity for them. */
const volumeSpec = (project: ProjectModel, value: number): string => {
  const lengthFactor = toDisplay(1, project.settings.units, 'length');
  return `${number(value * lengthFactor ** 3, 5)} ${unitFor(project, 'length')}³`;
};

/** Materials actually assigned in this model, in catalogue order, each one once. */
const usedMaterials = (project: ProjectModel): StandardMaterial[] => {
  const seen = new Map<string, StandardMaterial>();
  for (const member of project.members) {
    if (member.materialOrigin !== 'catalog' || !member.materialId) continue;
    const material = findStandardMaterial(member.materialId);
    if (material && !seen.has(material.id)) seen.set(material.id, material);
  }
  return [...seen.values()];
};

/** Sections actually assigned in this model, each one once, with the members that carry it. */
const usedSections = (project: ProjectModel): { section: StandardSection; memberIds: string[] }[] => {
  const seen = new Map<string, { section: StandardSection; memberIds: string[] }>();
  for (const member of project.members) {
    if (member.sectionOrigin !== 'catalog' || !member.sectionId) continue;
    const section = findStandardSection(member.sectionId);
    if (!section) continue;
    const entry = seen.get(section.id);
    if (entry) entry.memberIds.push(member.id);
    else seen.set(section.id, { section, memberIds: [member.id] });
  }
  return [...seen.values()];
};

const catalogName = (
  id: string | undefined,
  origin: MemberPropertyOrigin | undefined,
  lookup: (id: string) => { name: string } | undefined,
): string => {
  if (origin === 'catalog' && id) {
    const found = lookup(id);
    if (found) return found.name;
    // A declared id the catalogue does not know is reported as declared, never as "custom":
    // hiding it would turn a broken reference into an ordinary hand-typed section.
    return `${id} (no está en el catálogo)`;
  }
  return ORIGIN_LABEL[origin ?? 'custom'];
};

/**
 * The profile drawn to scale, with its two governing dimensions cotted.
 *
 * The dimension lines are drawn from the same box the shape was fitted into, so the arrows and
 * the outline can never drift apart.
 */
const drawDimensionedSection = (
  context: ReportContext,
  rect: Rect,
  member: Pick<MemberModel, 'A' | 'I' | 'sectionId' | 'sectionOrigin'>,
): void => {
  const { layout, project } = context;
  const { palette, fonts } = layout;
  const page = layout.page;
  const geometry = resolveSectionGeometry({
    area: member.A, inertia: member.I, sectionId: member.sectionId, sectionOrigin: member.sectionOrigin,
  });
  // Room on the right and above for the two dimension lines.
  const plot = { x: rect.x + 14, y: rect.y + 16, width: rect.width - 52, height: rect.height - 34 };
  drawSectionShape(layout, plot, geometry, palette.inkSoft);
  const box = sectionShapeBox(plot, geometry);

  const dimension = (text: string, from: { x: number; y: number }, to: { x: number; y: number }, at: { x: number; y: number }) => {
    page.drawLine({ start: from, end: to, thickness: 0.4, color: palette.inkFaint });
    page.drawText(pdfText(text), { x: at.x, y: at.y, size: TYPE.micro, font: fonts.regular, color: palette.inkSoft });
  };
  const lengthUnit = unitFor(project, 'sectionDimension');
  const width = `b = ${number(toDisplay(geometry.width, project.settings.units, 'sectionDimension'), 4)} ${lengthUnit}`;
  const depth = `h = ${number(toDisplay(geometry.depth, project.settings.units, 'sectionDimension'), 4)} ${lengthUnit}`;
  dimension(width,
    { x: box.x, y: box.y + box.height + 6 }, { x: box.x + box.width, y: box.y + box.height + 6 },
    { x: box.x, y: box.y + box.height + 9 });
  dimension(depth,
    { x: box.x + box.width + 6, y: box.y }, { x: box.x + box.width + 6, y: box.y + box.height },
    { x: box.x + box.width + 9, y: box.y + box.height / 2 });
};

export const drawMaterialsPart = (context: ReportContext): void => {
  const { layout, project } = context;
  const bom = buildStructuralBom(project);
  const materials = usedMaterials(project);
  const sections = usedSections(project);

  layout.part(
    'Materiales y secciones',
    'La especificación detrás de cada E, A e I: qué material, qué perfil y cuántos miembros lo llevan.',
  );

  const massUnit = 'kg';
  layout.metrics([
    { label: 'Miembros', value: String(bom.totals.memberCount), detail: `${bom.totals.rowCount} combinaciones distintas` },
    { label: 'Longitud total', value: `${number(toDisplay(bom.totals.totalLengthM, project.settings.units, 'length'), 5)} ${unitFor(project, 'length')}` },
    {
      label: 'Masa total',
      value: bom.totals.totalMassKg === null ? 'n/d' : `${number(bom.totals.totalMassKg, 5)} ${massUnit}`,
      detail: bom.totals.totalMassKg === null ? 'faltan propiedades' : undefined,
    },
    {
      label: 'Peso propio',
      value: bom.totals.totalSelfWeightKn === null ? 'n/d' : `${number(toDisplay(bom.totals.totalSelfWeightKn, project.settings.units, 'force'), 5)} ${unitFor(project, 'force')}`,
      detail: 'sólo si se cargó',
    },
  ]);

  layout.heading('Materiales empleados');
  if (!materials.length) {
    layout.note(
      'Ningún miembro declara un material de catálogo: el modelo lleva sólo los valores numéricos '
      + 'que se introdujeron, y no hay ficha normativa que reportar.',
    );
  } else {
    for (const material of materials) {
      layout.heading(`${material.name} · ${CATEGORY_LABEL[material.category]}`, 2);
      // A table with a typeset symbol column, not `keyValues`: that primitive draws prose, so
      // ν, γ, ρ, α and f_y came out as `nu`, `gamma`, `rho`, `alpha` and a literal underscore.
      layout.table(
        [
          { header: 'Propiedad', flex: 2 },
          { header: 'Símbolo', width: 54, math: true },
          { header: 'Valor', ...NUMERIC },
        ],
        [
          ['Módulo de elasticidad', 'E', spec(project, material.elasticModulus, 'elasticModulus')],
          ['Módulo de cortante', 'G', spec(project, material.shearModulus, 'elasticModulus')],
          ['Coeficiente de Poisson', 'ν', number(material.poissonRatio, 4)],
          ['Límite de fluencia', 'f_y', spec(project, material.yieldStrength, 'elasticModulus')],
          ['Peso específico', 'γ', `${number(toDisplay(material.unitWeight, project.settings.units, 'force'), 5)} ${unitFor(project, 'force')}/${unitFor(project, 'length')}³`],
          ['Densidad', 'ρ', `${number(material.density, 5)} kg/m³`],
          ['Dilatación térmica', 'α', `${number(material.thermalExpansion, 4)} 1/°C`],
          ['Identificador de catálogo', '', material.id],
        ],
        { size: 7.6 },
      );
    }
    layout.note(
      'f_y se reporta como dato del material. Este documento no aplica ninguna norma de diseño: '
      + 'no hay comprobación de resistencia aquí, sólo la solicitación que el análisis obtuvo.',
    );
    if (bom.totals.totalMassKg === null) {
      layout.note(
        'La masa y el peso propio quedan sin calcular porque algún miembro no lleva densidad '
        + 'propia: asignar un material del catálogo no la copia al miembro, y este documento no '
        + 'la sustituye por la de la ficha para no reportar una masa que el modelo no tiene.',
      );
    }
  }

  layout.heading('Secciones empleadas');
  if (!sections.length) {
    layout.note(
      'Ningún miembro declara una sección de catálogo. La forma real sólo se dibuja con una '
      + 'identidad explícita: dos secciones distintas pueden compartir A e I, así que deducir un '
      + 'perfil comercial a partir de esos dos números sería inventar una identidad que el modelo '
      + 'no guarda. Las propiedades numéricas de cada miembro están en «Modelo y acciones».',
    );
  } else {
    layout.text(
      'Cada perfil aparece una sola vez, dibujado a escala y acotado, con los miembros que lo '
      + 'llevan. Las propiedades son las del catálogo, en las unidades de presentación del proyecto.',
    );
    for (const { section, memberIds } of sections) {
      const member = project.members.find((entry) => entry.id === memberIds[0]);
      if (!member) continue;
      layout.heading(`${section.name} — ${SHAPE_LABEL[section.shapeType]} (${section.standard})`, 2);
      layout.figure(
        118,
        (rect) => {
          drawFigureFrame(layout, rect);
          drawDimensionedSection(context, rect, member);
        },
        `${section.name}: sección a escala, acotada en ${unitFor(project, 'sectionDimension')}; la línea de trazos es el eje neutro.`,
      );
      layout.table(
        [
          { header: 'Propiedad', flex: 1.6 },
          { header: 'Símbolo', width: 44, math: true },
          { header: 'Valor', ...NUMERIC },
          { header: 'Propiedad', flex: 1.6 },
          { header: 'Símbolo', width: 44, math: true },
          { header: 'Valor', ...NUMERIC },
        ],
        [
          ['Área', 'A', spec(project, section.area, 'area'), 'Inercia fuerte', 'I_x', spec(project, section.inertiaX, 'inertia')],
          ['Inercia débil', 'I_y', spec(project, section.inertiaY, 'inertia'), 'Módulo elástico', 'S_x', volumeSpec(project, section.sectionModulusX)],
          ['Módulo plástico', 'Z_x', volumeSpec(project, section.plasticModulusX), 'Radio de giro', 'r_x', spec(project, section.radiusOfGyrationX, 'sectionDimension')],
          ['Canto', 'h', spec(project, section.depth, 'sectionDimension'), 'Ancho', 'b', spec(project, section.width, 'sectionDimension')],
          ['Espesor de alma', 't_w', spec(project, section.webThickness, 'sectionDimension'), 'Espesor de ala', 't_f', spec(project, section.flangeThickness, 'sectionDimension')],
          [
            'Peso lineal', 'w',
            `${number(toDisplay(section.linearWeight, project.settings.units, 'force'), 5)} ${unitFor(project, 'force')}/${unitFor(project, 'length')}`,
            'Miembros que la llevan', '', String(memberIds.length),
          ],
        ],
        { size: 7.2 },
      );
      layout.note(`Asignada a: ${memberIds.join(', ')}.`);
      layout.gap();
    }
  }

  layout.heading('Asignación por miembro');
  layout.table(
    [
      { header: 'Miembro', width: 62 },
      { header: 'Tipo', width: 52 },
      { header: 'Material', flex: 2 },
      { header: 'Origen', width: 74 },
      { header: 'Sección', flex: 1.6 },
      { header: 'Origen', width: 74 },
    ],
    project.members.map((member) => [
      member.id,
      member.type,
      catalogName(member.materialId, member.materialOrigin, findStandardMaterial),
      ORIGIN_LABEL[member.materialOrigin ?? 'custom'],
      catalogName(member.sectionId, member.sectionOrigin, findStandardSection),
      ORIGIN_LABEL[member.sectionOrigin ?? 'custom'],
    ]),
    { size: 7.2 },
  );

  layout.heading('Cantidades por combinación de material y sección');
  if (!bom.rows.length) {
    layout.note('Ningún miembro entra en el cómputo: el modelo sólo tiene barras rígidas o geometría inválida.');
  } else {
    layout.table(
      [
        { header: 'Material', flex: 2 },
        { header: 'Sección', flex: 1.6 },
        { header: 'Tipo', width: 46 },
        { header: 'Nº', width: 34, ...NUMERIC },
        { header: `Longitud (${unitFor(project, 'length')})`, ...NUMERIC },
        { header: 'Masa (kg)', ...NUMERIC },
      ],
      bom.rows.map((row: StructuralBomRow) => [
        row.materialName,
        row.sectionName,
        row.memberType,
        String(row.memberCount),
        number(toDisplay(row.totalLengthM, project.settings.units, 'length'), 5),
        row.totalMassKg === null ? 'n/d' : number(row.totalMassKg, 5),
      ]),
      { size: 7.4 },
    );
  }

  // An identity that does not resolve is declared rather than hidden: a memoir that silently
  // reported a drifted profile as if it were the catalogue's would be worse than one that says
  // it cannot vouch for it.
  const warnings = [...new Set(bom.rows.flatMap((row) => row.warnings))];
  if (warnings.length) {
    layout.heading('Avisos de identidad');
    for (const warning of warnings) {
      layout.callout('warn', warning, WARNING_LABEL[warning]);
    }
  }
  if (bom.excluded.length) {
    layout.note(
      `Fuera del cómputo: ${bom.excluded.map((entry) => `${entry.memberId} (${entry.reason === 'rigid-member' ? 'barra rígida' : 'geometría inválida'})`).join(', ')}.`,
    );
  }
};
