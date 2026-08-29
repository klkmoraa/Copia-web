/**
 * Every relation of the report, written out with this project's own numbers.
 *
 * The document used to state the method symbolically — `L = √(ΔX² + ΔY²)`, `dV/dx = q(x)`,
 * `EI y″(x) = M(x)` — and leave the reader to look the numbers up somewhere else, or to
 * trust that they existed. A reader checking a memoir does not want the identity; they want
 * the arithmetic that was actually performed: which two coordinates were subtracted, what
 * they multiplied, what came out.
 *
 * So this module produces *substituted* equations only. Each string it returns carries the
 * real operands and the real result, in the project's own presentation units, and nothing
 * is emitted when the operands are not available — an unsubstituted symbol is exactly what
 * this replaces, so it is never the fallback.
 *
 * Two rules hold everywhere here:
 *
 *  1. **The arithmetic printed has to close.** Numbers inside one product or sum are
 *     converted with a single coherent force–length pair (`dimensional`), never with the
 *     per-quantity display factors, because `E` in MPa times `A` in m² over `L` in m is not
 *     `EA/L` in any unit. Where the terms are reconstructed rather than read back from the
 *     engine (the equilibrium sums), the reconstruction is checked against the engine's own
 *     figure and dropped if it disagrees: a memoir must never show a sum that was invented
 *     here.
 *  2. **Numeric noise reads as zero.** Every figure collapses against the governing
 *     magnitude of its own family, the same policy the rest of the report follows.
 */
import { toDisplay, unitLabel } from '../../engine/units';
import { memberAxis } from '../../graphics/structureGeometry';
import { clearNumber, number } from './pdfFormat';
import type { ReportContext } from './reportContext';
import type {
  DiagramQuantity,
  DiagramSegment,
  MemberLoad,
  MemberResult,
  ProjectModel,
} from '../../types';

/** A caption and the substituted relations that belong under it. */
export interface SubstitutionBlock {
  /** Which member, node or load the arithmetic below belongs to. */
  readonly caption?: string;
  readonly equations: readonly string[];
}

/** Members and loads developed in full before the section falls back to a pointer. */
const DETAIL_LIMIT = 3;

const SUPERSCRIPT: Readonly<Record<string, string>> = { 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶' };

/**
 * Value in the presentation system's *coherent* force–length pair.
 *
 * `toDisplay(value, units, 'elasticModulus')` answers in MPa or ksi, which is right for a
 * property sheet and wrong inside `EA/L`: the product would no longer be the force per unit
 * length it claims. Composing the conversion from the force and length factors instead keeps
 * every operand of one expression in the same system, so the multiplication the reader
 * repeats on a calculator gives the printed result.
 */
export const dimensionalValue = (project: ProjectModel, value: number, forcePower: number, lengthPower: number): number => {
  const force = toDisplay(1, project.settings.units, 'force');
  const length = toDisplay(1, project.settings.units, 'length');
  return value * force ** forcePower * length ** lengthPower;
};

const withPower = (label: string, exponent: number): string =>
  exponent === 1 ? label : `${label}${SUPERSCRIPT[String(exponent)] ?? `^${exponent}`}`;

/** `kN`, `kN/m`, `kN·m²`, `kip/ft²` — the unit of a force^a · length^b quantity. */
export const dimensionalUnit = (project: ProjectModel, forcePower: number, lengthPower: number): string => {
  const force = unitLabel(project.settings.units, 'force');
  const length = unitLabel(project.settings.units, 'length');
  const numerators: string[] = [];
  const denominators: string[] = [];
  if (forcePower > 0) numerators.push(withPower(force, forcePower));
  else if (forcePower < 0) denominators.push(withPower(force, -forcePower));
  if (lengthPower > 0) numerators.push(withPower(length, lengthPower));
  else if (lengthPower < 0) denominators.push(withPower(length, -lengthPower));
  const head = numerators.join('·') || '1';
  return denominators.length ? `${head}/${denominators.join('·')}` : head;
};

/** Presentation figure of a force^a · length^b quantity, collapsed against its own family. */
export const dimensionalFigure = (project: ProjectModel, value: number, forcePower: number, lengthPower: number, reference = value): string =>
  clearNumber(
    dimensionalValue(project, value, forcePower, lengthPower),
    Math.max(1, Math.abs(dimensionalValue(project, reference, forcePower, lengthPower))),
    6,
  );

/** Local alias: the substitution builders below call it on nearly every line. */
const dim = dimensionalFigure;

/** Wraps a negative operand so `a · −b` never reads as a subtraction. */
const operand = (text: string): string => text.startsWith('−') || text.startsWith('-') ? `(${text})` : text;

/** `12.5 - 4.2 + 0.75`: a chain of signed terms written the way it is added up. */
export const signedSum = (terms: readonly string[]): string => {
  if (!terms.length) return '0';
  return terms.reduce((accumulated, value, index) => {
    if (index === 0) return value;
    const negative = value.startsWith('−') || value.startsWith('-');
    return `${accumulated} ${negative ? '-' : '+'} ${negative ? value.slice(1) : value}`;
  }, '');
};

/** Scenario multiplier behind a load, or `undefined` when its case is not in this scenario. */
const caseFactor = (context: ReportContext, caseId: string): number | undefined => {
  const factor = context.scenarioFactors[caseId];
  return factor === undefined || factor === 0 ? undefined : factor;
};

const activeMemberLoads = (context: ReportContext): MemberLoad[] =>
  context.project.memberLoads.filter((load) => caseFactor(context, load.caseId) !== undefined);

/** Largest absolute value of a family, so `clearNumber` has something to collapse against. */
const scaleOf = (values: readonly number[]): number => Math.max(1e-12, ...values.map((value) => Math.abs(value)));

/**
 * End-force and displacement vectors mix two dimensions in six slots, so each component is
 * converted by its own pair: translations are lengths, rotations are radians; forces are
 * forces, the third and sixth are moments.
 */
const mixedVector = (
  project: ProjectModel,
  values: readonly number[],
  translational: readonly [number, number],
  rotational: readonly [number, number],
): string => {
  const reference = scaleOf(values);
  return `[${values.map((value, index) => {
    const [forcePower, lengthPower] = index % 3 === 2 ? rotational : translational;
    return dim(project, value, forcePower, lengthPower, reference);
  }).join(', ')}]ᵀ`;
};

// ---------------------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------------------

const geometryBlocks = (context: ReportContext): SubstitutionBlock[] => {
  const { project, index } = context;
  const lengthUnit = unitLabel(project.settings.units, 'length');
  const blocks: SubstitutionBlock[] = [];
  for (const member of project.members.slice(0, DETAIL_LIMIT)) {
    const ni = index.node(member.i);
    const nj = index.node(member.j);
    if (!ni || !nj) continue;
    const axis = memberAxis(member, ni, nj);
    const reference = Math.max(Math.abs(axis.dx), Math.abs(axis.dy), axis.length);
    const dx = dim(project, axis.dx, 0, 1, reference);
    const dy = dim(project, axis.dy, 0, 1, reference);
    const length = dim(project, axis.length, 0, 1, reference);
    const xi = dim(project, ni.x, 0, 1, reference);
    const xj = dim(project, nj.x, 0, 1, reference);
    const yi = dim(project, ni.y, 0, 1, reference);
    const yj = dim(project, nj.y, 0, 1, reference);
    blocks.push({
      caption: `Miembro ${member.id}: de ${member.i} (${xi}, ${yi}) a ${member.j} (${xj}, ${yj}) ${lengthUnit}`,
      equations: [
        `ΔX = ${xj} − ${xi} = ${dx} ${lengthUnit}`,
        `ΔY = ${yj} − ${yi} = ${dy} ${lengthUnit}`,
        `L = √(${operand(dx)}² + ${operand(dy)}²) = ${length} ${lengthUnit}`,
        `c = ${dx}/${length} = ${number(axis.c, 6)}`,
        `s = ${dy}/${length} = ${number(axis.s, 6)}`,
      ],
    });
  }
  return blocks;
};

// ---------------------------------------------------------------------------------------
// Supports
// ---------------------------------------------------------------------------------------

const RESTRAINED_COMPONENTS: Readonly<Record<string, readonly string[]>> = {
  fixed: ['U_x', 'U_y', 'R_z'],
  pin: ['U_x', 'U_y'],
  roller: ['U_n'],
};

const supportBlocks = (context: ReportContext): SubstitutionBlock[] => {
  const { project } = context;
  const blocks: SubstitutionBlock[] = [];
  const equations: string[] = [];
  for (const node of project.nodes) {
    const support = node.support;
    const components = support.type === 'custom'
      ? [
        ...(support.restrainX ? ['U_x'] : []),
        ...(support.restrainY ? ['U_y'] : []),
        ...(support.restrainR ? ['R_z'] : []),
      ]
      : [...(RESTRAINED_COMPONENTS[support.type] ?? [])];
    for (const component of components) equations.push(`${component}(${node.id}) = 0`);
    const spring = support.spring;
    if (spring) {
      const translational = dimensionalUnit(project, 1, -1);
      if (spring.kx) equations.push(`K_x(${node.id}) = ${dim(project, spring.kx, 1, -1)} ${translational}`);
      if (spring.ky) equations.push(`K_y(${node.id}) = ${dim(project, spring.ky, 1, -1)} ${translational}`);
      if (spring.kr) equations.push(`K_r(${node.id}) = ${dim(project, spring.kr, 1, 1)} ${dimensionalUnit(project, 1, 1)}/rad`);
      if (spring.kNormal) {
        // `K_s = k n nᵀ` with the direction the user actually declared, multiplied out: the
        // four entries below are the matrix that was assembled, not the rule that produces it.
        const radians = ((spring.angleDeg ?? 90) * Math.PI) / 180;
        const nx = Math.cos(radians);
        const ny = Math.sin(radians);
        const k = spring.kNormal;
        equations.push(
          `K_s(${node.id}) = ${dim(project, k, 1, -1)} · [${number(nx, 6)}, ${number(ny, 6)}]ᵀ[${number(nx, 6)}, ${number(ny, 6)}]`
          + ` = [${dim(project, k * nx * nx, 1, -1, k)}, ${dim(project, k * nx * ny, 1, -1, k)};`
          + ` ${dim(project, k * nx * ny, 1, -1, k)}, ${dim(project, k * ny * ny, 1, -1, k)}] ${translational}`,
        );
      }
    }
  }
  if (!equations.length) return blocks;
  blocks.push({
    caption: equations.length === 1
      ? '1 condición impuesta sobre los grados de libertad'
      : `${equations.length} condiciones impuestas sobre los grados de libertad`,
    equations: equations.slice(0, 12),
  });
  return blocks;
};

// ---------------------------------------------------------------------------------------
// Loads
// ---------------------------------------------------------------------------------------

/** Local intensity of a distributed load at one end, with the rotation written out. */
const localIntensity = (
  context: ReportContext,
  load: MemberLoad,
  c: number,
  s: number,
  factor: number,
  end: 'Start' | 'End',
): { equations: string[]; qy: number } => {
  const { project } = context;
  const qX = (end === 'Start' ? load.qxStart : load.qxEnd ?? load.qxStart) ?? 0;
  const qY = (end === 'Start' ? load.qyStart : load.qyEnd ?? load.qyStart) ?? 0;
  const global = load.coordinateSystem === 'global';
  const qx = factor * (global ? c * qX + s * qY : qX);
  const qy = factor * (global ? -s * qX + c * qY : qY);
  const unit = dimensionalUnit(project, 1, -1);
  const reference = Math.max(Math.abs(qx), Math.abs(qy), Math.abs(qX), Math.abs(qY));
  const equations: string[] = [];
  if (global && (Math.abs(qX) > 0 || Math.abs(s) > 1e-12)) {
    equations.push(
      `qᵧ(${end === 'Start' ? 'a' : 'b'}) = ${number(factor, 4)}(−${number(s, 6)} · ${operand(dim(project, qX, 1, -1, reference))}`
      + ` + ${number(c, 6)} · ${operand(dim(project, qY, 1, -1, reference))}) = ${dim(project, qy, 1, -1, reference)} ${unit}`,
    );
  } else if (factor !== 1) {
    equations.push(
      `qᵧ(${end === 'Start' ? 'a' : 'b'}) = ${number(factor, 4)} · ${operand(dim(project, qY, 1, -1, reference))} = ${dim(project, qy, 1, -1, reference)} ${unit}`,
    );
  }
  return { equations, qy };
};

const loadBlocks = (context: ReportContext): SubstitutionBlock[] => {
  const { project, index } = context;
  const lengthUnit = unitLabel(project.settings.units, 'length');
  const forceUnit = unitLabel(project.settings.units, 'force');
  const distributedUnit = dimensionalUnit(project, 1, -1);
  const blocks: SubstitutionBlock[] = [];

  for (const load of activeMemberLoads(context).slice(0, DETAIL_LIMIT)) {
    const factor = caseFactor(context, load.caseId) ?? 1;
    const member = index.member(load.memberId);
    const ni = member && index.node(member.i);
    const nj = member && index.node(member.j);
    if (!member || !ni || !nj) continue;
    const axis = memberAxis(member, ni, nj);
    const span = axis.flexibleLength;
    const equations: string[] = [];

    if (load.type === 'distributed') {
      const start = Math.min(load.start, load.end);
      const end = Math.max(load.start, load.end);
      const a = start * span;
      const b = end * span;
      const first = localIntensity(context, load, axis.c, axis.s, factor, 'Start');
      const second = localIntensity(context, load, axis.c, axis.s, factor, 'End');
      equations.push(...first.equations, ...second.equations);
      if (load.lengthBasis !== 'real') {
        const projection = load.lengthBasis === 'horizontal' ? Math.abs(axis.c) : Math.abs(axis.s);
        const declared = first.qy / (projection || 1);
        equations.push(
          `q_real = q_${load.lengthBasis === 'horizontal' ? 'horizontal' : 'vertical'} · |${load.lengthBasis === 'horizontal' ? 'c' : 's'}|`
          + ` = ${operand(dim(project, declared, 1, -1))} · ${number(projection, 6)} = ${dim(project, first.qy, 1, -1)} ${distributedUnit}`,
        );
      }
      const lengthReference = Math.max(span, 1e-9);
      equations.push(
        `a = ${number(start, 6)} · ${dim(project, span, 0, 1, lengthReference)} = ${dim(project, a, 0, 1, lengthReference)} ${lengthUnit}`,
        `b = ${number(end, 6)} · ${dim(project, span, 0, 1, lengthReference)} = ${dim(project, b, 0, 1, lengthReference)} ${lengthUnit}`,
      );
      const resultant = 0.5 * (first.qy + second.qy) * (b - a);
      equations.push(
        `W = ½(${operand(dim(project, first.qy, 1, -1))} + ${operand(dim(project, second.qy, 1, -1))})`
        + `(${dim(project, b, 0, 1, lengthReference)} − ${dim(project, a, 0, 1, lengthReference)}) = ${dim(project, resultant, 1, 0)} ${forceUnit}`,
      );
    } else if (load.type === 'point') {
      const position = Math.min(1, Math.max(0, load.position ?? 0.5));
      const px = factor * (load.px ?? 0);
      const py = factor * (load.py ?? 0);
      const reference = Math.max(Math.abs(px), Math.abs(py));
      equations.push(
        `x = ${number(position, 6)} · ${dim(project, span, 0, 1)} = ${dim(project, position * span, 0, 1)} ${lengthUnit}`,
        `[Pₓ, Pᵧ] = ${number(factor, 4)} · [${dim(project, (load.px ?? 0), 1, 0, reference)}, ${dim(project, (load.py ?? 0), 1, 0, reference)}]`
        + ` = [${dim(project, px, 1, 0, reference)}, ${dim(project, py, 1, 0, reference)}] ${forceUnit}`,
      );
    } else {
      const position = Math.min(1, Math.max(0, load.position ?? 0.5));
      const moment = factor * (load.moment ?? 0);
      equations.push(
        `x = ${number(position, 6)} · ${dim(project, span, 0, 1)} = ${dim(project, position * span, 0, 1)} ${lengthUnit}`,
        `M = ${number(factor, 4)} · ${operand(dim(project, load.moment ?? 0, 1, 1))} = ${dim(project, moment, 1, 1)} ${dimensionalUnit(project, 1, 1)}`,
      );
    }
    if (equations.length) {
      blocks.push({ caption: `Carga ${load.id} sobre ${load.memberId} (caso ${load.caseId}, factor ${number(factor, 4)})`, equations });
    }
  }

  const nodalLoads = project.nodalLoads.filter((load) => caseFactor(context, load.caseId) !== undefined);
  if (nodalLoads.length) {
    const reference = scaleOf(nodalLoads.flatMap((load) => [load.fx, load.fy]));
    blocks.push({
      caption: nodalLoads.length === 1
        ? 'Acción nodal, ya multiplicada por su factor de escenario'
        : `${nodalLoads.length} acciones nodales, ya multiplicadas por su factor de escenario`,
      equations: nodalLoads.slice(0, 6).map((load) => {
        const factor = caseFactor(context, load.caseId) ?? 1;
        return `F(${load.nodeId}) = ${number(factor, 4)} · [${dim(project, load.fx, 1, 0, reference)}, ${dim(project, load.fy, 1, 0, reference)}, ${dim(project, load.mz, 1, 1)}]ᵀ`
          + ` = [${dim(project, factor * load.fx, 1, 0, reference)}, ${dim(project, factor * load.fy, 1, 0, reference)}, ${dim(project, factor * load.mz, 1, 1)}]ᵀ`;
      }),
    });
  }
  return blocks;
};

// ---------------------------------------------------------------------------------------
// Consistent nodal vectors
// ---------------------------------------------------------------------------------------

const equivalentLoadBlocks = (context: ReportContext): SubstitutionBlock[] => {
  const { project, analysis, index } = context;
  const trace = analysis.educationTrace;
  const blocks: SubstitutionBlock[] = [];
  const loadedMembers = [...new Set(activeMemberLoads(context).map((load) => load.memberId))];

  for (const memberId of loadedMembers.slice(0, DETAIL_LIMIT)) {
    const member = index.member(memberId);
    const ni = member && index.node(member.i);
    const nj = member && index.node(member.j);
    if (!member || !ni || !nj) continue;
    const axis = memberAxis(member, ni, nj);
    const equations: string[] = [];

    // The textbook closed form is only the closed form when the load really is one full-span
    // uniform transversal action; anything else is integrated, and the integral's own result
    // is what gets printed instead of a formula that would not apply.
    const loads = activeMemberLoads(context).filter((load) => load.memberId === memberId);
    const uniform = loads.length === 1 && loads[0].type === 'distributed'
      && Math.min(loads[0].start, loads[0].end) === 0 && Math.max(loads[0].start, loads[0].end) === 1
      && (loads[0].qyStart ?? 0) === (loads[0].qyEnd ?? loads[0].qyStart ?? 0)
      ? loads[0]
      : undefined;
    if (uniform) {
      const factor = caseFactor(context, uniform.caseId) ?? 1;
      const { qy } = localIntensity(context, uniform, axis.c, axis.s, factor, 'Start');
      const span = axis.flexibleLength;
      equations.push(
        `qL/2 = ${operand(dim(project, qy, 1, -1))} · ${dim(project, span, 0, 1)} / 2 = ${dim(project, qy * span / 2, 1, 0)} ${unitLabel(project.settings.units, 'force')}`,
        `qL²/12 = ${operand(dim(project, qy, 1, -1))} · ${dim(project, span, 0, 1)}² / 12 = ${dim(project, qy * span * span / 12, 1, 1)} ${dimensionalUnit(project, 1, 1)}`,
      );
    }
    const element = trace?.elements.find((entry) => entry.memberId === memberId);
    if (element) {
      equations.push(
        `fₑˡ(${memberId}) = ${mixedVector(project, element.localEquivalentLoadOriginal, [1, 0], [1, 1])}`,
      );
      if (element.releasedLocalDofs.length) {
        equations.push(`f̄ₐ(${memberId}) = ${mixedVector(project, element.localEquivalentLoadEffective, [1, 0], [1, 1])}`);
      }
    }
    if (equations.length) blocks.push({ caption: `Miembro ${memberId}`, equations });
  }
  return blocks;
};

// ---------------------------------------------------------------------------------------
// Element stiffness
// ---------------------------------------------------------------------------------------

const stiffnessBlocks = (context: ReportContext): SubstitutionBlock[] => {
  const { project, index } = context;
  const blocks: SubstitutionBlock[] = [];
  for (const member of project.members.filter((entry) => entry.type !== 'rigid').slice(0, DETAIL_LIMIT)) {
    const ni = index.node(member.i);
    const nj = index.node(member.j);
    if (!ni || !nj) continue;
    const axis = memberAxis(member, ni, nj);
    const L = axis.flexibleLength;
    if (!(L > 0)) continue;
    const E = member.E;
    const A = member.A;
    const I = member.I ?? 0;
    const Etext = dim(project, E, 1, -2);
    const Atext = dim(project, A, 0, 2);
    const Itext = dim(project, I, 0, 4);
    const Ltext = dim(project, L, 0, 1);
    const equations: string[] = [
      `EA/L = ${Etext} · ${Atext} / ${Ltext} = ${dim(project, E * A / L, 1, -1)} ${dimensionalUnit(project, 1, -1)}`,
    ];
    if (member.type !== 'truss' && I > 0) {
      equations.push(
        `12EI/L³ = 12 · ${Etext} · ${Itext} / ${Ltext}³ = ${dim(project, 12 * E * I / L ** 3, 1, -1)} ${dimensionalUnit(project, 1, -1)}`,
        `6EI/L² = 6 · ${Etext} · ${Itext} / ${Ltext}² = ${dim(project, 6 * E * I / L ** 2, 1, 0)} ${unitLabel(project.settings.units, 'force')}`,
        `4EI/L = 4 · ${Etext} · ${Itext} / ${Ltext} = ${dim(project, 4 * E * I / L, 1, 1)} ${dimensionalUnit(project, 1, 1)}`,
        `2EI/L = 2 · ${Etext} · ${Itext} / ${Ltext} = ${dim(project, 2 * E * I / L, 1, 1)} ${dimensionalUnit(project, 1, 1)}`,
      );
    }
    blocks.push({
      caption: `Miembro ${member.id}: E = ${Etext} ${dimensionalUnit(project, 1, -2)}, `
        + `A = ${Atext} ${dimensionalUnit(project, 0, 2)}, I = ${Itext} ${dimensionalUnit(project, 0, 4)}, `
        + `L = ${Ltext} ${unitLabel(project.settings.units, 'length')}`,
      equations,
    });
  }
  return blocks;
};

// ---------------------------------------------------------------------------------------
// Transformation and assembly
// ---------------------------------------------------------------------------------------

const transformBlocks = (context: ReportContext): SubstitutionBlock[] => {
  const { project, analysis, index } = context;
  const blocks: SubstitutionBlock[] = [];
  for (const member of project.members.filter((entry) => entry.type !== 'rigid').slice(0, DETAIL_LIMIT)) {
    const ni = index.node(member.i);
    const nj = index.node(member.j);
    if (!ni || !nj) continue;
    const axis = memberAxis(member, ni, nj);
    const c = number(axis.c, 6);
    const s = number(axis.s, 6);
    blocks.push({
      caption: `Miembro ${member.id}: bloque de rotación con c = ${c} y s = ${s}`,
      equations: [`T(${member.id}) = [${c}, ${s}, 0; ${operand(`−${s}`)}, ${c}, 0; 0, 0, 1]`],
    });
  }
  const trace = analysis.educationTrace;
  if (trace) {
    const labels = trace.dofs.map((dof) => dof.label);
    const values = trace.assembly.load;
    blocks.push({
      caption: `Vector global de acciones F, ensamblado sobre ${values.length} grados de libertad`
        + `${values.length > 9 ? ' (se listan los 9 primeros)' : ''}: ${labels.slice(0, 9).join(', ')}`,
      equations: [`F = ${mixedVector(project, values.slice(0, 9), [1, 0], [1, 1])}`],
    });
  }
  return blocks;
};

// ---------------------------------------------------------------------------------------
// Solution
// ---------------------------------------------------------------------------------------

const solutionBlocks = (context: ReportContext): SubstitutionBlock[] => {
  const { project, analysis } = context;
  const blocks: SubstitutionBlock[] = [];
  const displacementScale = scaleOf(analysis.nodeResults.flatMap((node) => [node.ux, node.uy]));
  const free = analysis.nodeResults.filter((node) => Math.abs(node.ux) + Math.abs(node.uy) + Math.abs(node.rz) > 0);
  if (free.length) {
    blocks.push({
      caption: 'Desplazamientos resueltos (traslaciones en unidades de longitud, giro en rad)',
      equations: free.slice(0, 6).map((node) => `U(${node.nodeId}) = [${dim(project, node.ux, 0, 1, displacementScale)}, `
        + `${dim(project, node.uy, 0, 1, displacementScale)}, ${number(node.rz, 6)}]ᵀ`),
    });
  }
  const supported = analysis.nodeResults.filter((node) => Math.abs(node.rx) + Math.abs(node.ry) + Math.abs(node.rm) > 0);
  if (supported.length) {
    const reactionScale = scaleOf(supported.flatMap((node) => [node.rx, node.ry]));
    blocks.push({
      caption: 'Reacciones obtenidas del multiplicador de cada restricción',
      equations: supported.slice(0, 6).map((node) => `R(${node.nodeId}) = [${dim(project, node.rx, 1, 0, reactionScale)}, `
        + `${dim(project, node.ry, 1, 0, reactionScale)}, ${dim(project, node.rm, 1, 1)}]ᵀ`),
    });
  }
  return blocks;
};

// ---------------------------------------------------------------------------------------
// Member recovery
// ---------------------------------------------------------------------------------------

const memberBlocks = (context: ReportContext, memberId: string): SubstitutionBlock[] => {
  const { project, analysis, index } = context;
  const result = index.memberResult(memberId);
  if (!result) return [];
  const element = analysis.educationTrace?.elements.find((entry) => entry.memberId === memberId);
  const equations: string[] = [];
  if (result.localDisplacements.length) {
    equations.push(`dₑˡ = ${mixedVector(project, result.localDisplacements, [0, 1], [0, 0])}`);
  }
  if (element) {
    equations.push(`fₑˡ = ${mixedVector(project, element.localEquivalentLoadEffective, [1, 0], [1, 1])}`);
  }
  if (result.localEndForces.length) {
    equations.push(`qₑˡ = kₑˡ dₑˡ − fₑˡ = ${mixedVector(project, result.localEndForces, [1, 0], [1, 1])}`);
  }
  if (!equations.length) return [];
  const units = `${unitLabel(project.settings.units, 'force')} y ${dimensionalUnit(project, 1, 1)}`;
  return [{ caption: `Miembro ${memberId}: vectores locales completos (${units}; el giro va en rad)`, equations }];
};

// ---------------------------------------------------------------------------------------
// Diagrams
// ---------------------------------------------------------------------------------------

const polynomialAt = (coefficients: readonly number[], s: number): number =>
  coefficients.reduce((total, coefficient, power) => total + coefficient * s ** power, 0);

/** Numeric development of one segment: the functions, their slope and the located extreme. */
const segmentEquations = (
  context: ReportContext,
  segment: DiagramSegment,
  quantities: readonly DiagramQuantity[],
): string[] => {
  const { project } = context;
  const lengthUnit = unitLabel(project.settings.units, 'length');
  const equations: string[] = [];
  const shear = segment.shear;
  const moment = segment.moment;
  for (const quantity of quantities) {
    const coefficients = quantity === 'axial' ? segment.axial : quantity === 'shear' ? shear : moment;
    const symbol = quantity === 'axial' ? 'N' : quantity === 'shear' ? 'V' : 'M';
    const forcePower = 1;
    const lengthPower = quantity === 'moment' ? 1 : 0;
    const reference = scaleOf(coefficients);
    const terms = coefficients
      .map((coefficient, power) => ({ coefficient, power }))
      .filter((entry) => Math.abs(entry.coefficient) > reference * 1e-10)
      .map(({ coefficient, power }) => {
        const magnitude = dim(project, coefficient, forcePower, lengthPower - power, reference);
        return power === 0 ? magnitude : power === 1 ? `${magnitude} s` : `${magnitude} s${SUPERSCRIPT[String(power)] ?? `^${power}`}`;
      });
    const span = segment.x1 - segment.x0;
    const atEnd = polynomialAt(coefficients, span);
    equations.push(
      `${symbol}(s) = ${terms.length ? signedSum(terms) : '0'}`
      + `   →   ${symbol}(0) = ${dim(project, coefficients[0] ?? 0, forcePower, lengthPower, reference)}, `
      + `${symbol}(${dim(project, span, 0, 1)}) = ${dim(project, atEnd, forcePower, lengthPower, reference)} `
      + `${quantity === 'moment' ? dimensionalUnit(project, 1, 1) : unitLabel(project.settings.units, 'force')}`,
    );
  }
  // Where the shear crosses zero the moment is stationary, and that station is a number the
  // reader can check: it is the quotient printed here, not a rule about quotients.
  const [v0, v1] = [shear[0] ?? 0, shear[1] ?? 0];
  if (Math.abs(v1) > scaleOf(shear) * 1e-10) {
    const station = -v0 / v1;
    if (station > 0 && station < segment.x1 - segment.x0) {
      equations.push(
        `V = 0 → s = ${operand(dim(project, -v0, 1, 0))}/${operand(dim(project, v1, 1, -1))} = ${dim(project, station, 0, 1)} ${lengthUnit}`
        + `   →   M = ${dim(project, polynomialAt(moment, station), 1, 1)} ${dimensionalUnit(project, 1, 1)}`,
      );
    }
  }
  return equations;
};

const diagramBlocks = (context: ReportContext, quantities: readonly DiagramQuantity[] = ['axial', 'shear', 'moment']): SubstitutionBlock[] => {
  const { project, analysis } = context;
  const lengthUnit = unitLabel(project.settings.units, 'length');
  const blocks: SubstitutionBlock[] = [];
  for (const result of analysis.memberResults.slice(0, DETAIL_LIMIT)) {
    for (const [segmentIndex, segment] of result.diagramSegments.slice(0, 2).entries()) {
      const equations = segmentEquations(context, segment, quantities);
      if (!equations.length) continue;
      blocks.push({
        caption: `Miembro ${result.memberId}, tramo ${segmentIndex + 1}: s = 0 en x = ${dim(project, segment.x0, 0, 1)} ${lengthUnit},`
          + ` hasta x = ${dim(project, segment.x1, 0, 1)} ${lengthUnit}`,
        equations,
      });
    }
    const jumps = result.diagramJumps.slice(0, 2);
    if (jumps.length) {
      const scale = scaleOf(jumps.flatMap((jump) => [jump.axialDelta, jump.shearDelta, jump.momentDelta]));
      blocks.push({
        caption: `Miembro ${result.memberId}: saltos en el diagrama, con el valor real de la acción que los produce`,
        equations: jumps.map((jump) => `x = ${dim(project, jump.x, 0, 1)} ${lengthUnit}: `
          + `ΔN = ${dim(project, jump.axialDelta, 1, 0, scale)}, ΔV = ${dim(project, jump.shearDelta, 1, 0, scale)} ${unitLabel(project.settings.units, 'force')}, `
          + `ΔM = ${dim(project, jump.momentDelta, 1, 1)} ${dimensionalUnit(project, 1, 1)}`),
      });
    }
  }
  return blocks;
};

// ---------------------------------------------------------------------------------------
// Deformation
// ---------------------------------------------------------------------------------------

const deformationBlocks = (context: ReportContext): SubstitutionBlock[] => {
  const { project, analysis, index } = context;
  const blocks: SubstitutionBlock[] = [];
  const lengthUnit = unitLabel(project.settings.units, 'length');
  for (const result of analysis.memberResults.slice(0, DETAIL_LIMIT)) {
    const member = index.member(result.memberId);
    if (!member) continue;
    const EI = member.E * (member.I ?? 0);
    const EA = member.E * member.A;
    const segment = result.diagramSegments[0];
    const equations: string[] = [];
    if (segment && EI > 0) {
      const moment = segment.moment[0] ?? 0;
      equations.push(
        `dθ/dx (x = ${dim(project, segment.x0, 0, 1)}) = M/EI = ${operand(dim(project, moment, 1, 1))}/${dim(project, EI, 1, 2)} = ${number(moment / EI, 6)} rad/${lengthUnit}`,
      );
    }
    if (segment && EA > 0) {
      const axial = segment.axial[0] ?? 0;
      equations.push(
        `du/dx (x = ${dim(project, segment.x0, 0, 1)}) = N/EA = ${operand(dim(project, axial, 1, 0))}/${dim(project, EA, 1, 0)} = ${number(axial / EA, 6)}`,
      );
    }
    const extreme = result.deformationCriticalPoints
      .filter((point) => point.quantity === 'v')
      .reduce<{ x: number; value: number } | undefined>(
        (best, point) => !best || Math.abs(point.value) > Math.abs(best.value) ? { x: point.x, value: point.value } : best,
        undefined,
      );
    if (extreme) {
      equations.push(`v_max(${result.memberId}) = ${dim(project, extreme.value, 0, 1)} ${lengthUnit} en x = ${dim(project, extreme.x, 0, 1)} ${lengthUnit}`);
    }
    if (equations.length) blocks.push({ caption: `Miembro ${result.memberId}`, equations });
  }
  return blocks;
};

// ---------------------------------------------------------------------------------------
// Equilibrium
// ---------------------------------------------------------------------------------------

export interface EquilibriumSum {
  /** `ΣF_x`, `ΣF_y`, `ΣM_O`. */
  readonly symbol: string;
  /** The sum written out with every term, or just the closing value when it cannot be. */
  readonly equation: string;
  /** Closing value alone, for the cover's result chip. */
  readonly result: string;
  readonly unit: string;
}

/**
 * The three global sums, term by term.
 *
 * Each expansion is rebuilt here from the applied resultants and the solved reactions, and
 * then checked against the figure the engine itself published. A reconstruction that does
 * not reproduce the engine's own sum is not printed as an expansion: the report would be
 * showing arithmetic nobody performed. In that case the closing value still appears, alone.
 */
export const equilibriumSums = (context: ReportContext, maxTerms = 13): EquilibriumSum[] => {
  const { project, analysis } = context;
  const audit = analysis.loadAudit;
  const forceUnit = unitLabel(project.settings.units, 'force');
  const momentUnit = dimensionalUnit(project, 1, 1);
  const reference = audit
    ? Math.max(Math.abs(audit.source.fx), Math.abs(audit.source.fy), 1)
    : scaleOf(analysis.nodeResults.flatMap((node) => [node.rx, node.ry]));
  const momentReference = Math.max(Math.abs(audit?.source.mz ?? 0), Math.abs(analysis.equilibrium.sumM), 1);
  const origin = analysis.equilibrium.referencePoint ?? audit?.referencePoint ?? { x: 0, y: 0 };
  const supported = analysis.nodeResults.filter((node) => Math.abs(node.rx) + Math.abs(node.ry) + Math.abs(node.rm) > 0);
  const nodeOf = (nodeId: string) => context.index.node(nodeId);

  const build = (
    symbol: string,
    engineValue: number,
    appliedValue: number | undefined,
    reactionTerm: (node: typeof supported[number]) => number,
    forcePower: number,
    lengthPower: number,
    scale: number,
    unit: string,
  ): EquilibriumSum => {
    const closing = clearNumber(dimensionalValue(project, engineValue, forcePower, lengthPower), Math.max(1, Math.abs(dimensionalValue(project, scale, forcePower, lengthPower))), 6);
    const result = `${closing} ${unit}`;
    if (appliedValue === undefined) return { symbol, equation: `${symbol} = ${result}`, result, unit };
    const reactions = supported.map(reactionTerm);
    // Past a handful of supports the expansion stops being readable, so the reactions
    // collapse into their own single term. The sum printed is still the sum performed —
    // one fewer intermediate step, never a different arithmetic.
    const terms = reactions.length + 1 > maxTerms
      ? [appliedValue, reactions.reduce((sum, value) => sum + value, 0)]
      : [appliedValue, ...reactions];
    const total = terms.reduce((sum, value) => sum + value, 0);
    // Tolerance is relative to the actions that produced the sum: an expansion agreeing to
    // one part in 1e-8 of the load is the same sum, written differently.
    if (Math.abs(total - engineValue) > 1e-8 * Math.max(1, Math.abs(scale))) {
      return { symbol, equation: `${symbol} = ${result}`, result, unit };
    }
    const written = signedSum(terms.map((value) => dim(project, value, forcePower, lengthPower, scale)));
    return { symbol, equation: `${symbol} = ${written} = ${result}`, result, unit };
  };

  return [
    build('ΣF_x', analysis.equilibrium.sumFx, audit?.source.fx, (node) => node.rx, 1, 0, reference, forceUnit),
    build('ΣF_y', analysis.equilibrium.sumFy, audit?.source.fy, (node) => node.ry, 1, 0, reference, forceUnit),
    build(
      'ΣM_O',
      analysis.equilibrium.sumM,
      audit?.source.mz,
      (node) => {
        const model = nodeOf(node.nodeId);
        if (!model) return Number.NaN;
        return node.rm + node.ry * (model.x - origin.x) - node.rx * (model.y - origin.y);
      },
      1,
      1,
      momentReference,
      momentUnit,
    ),
  ];
};

const verificationBlocks = (context: ReportContext): SubstitutionBlock[] => {
  const { analysis } = context;
  const sums = equilibriumSums(context);
  const blocks: SubstitutionBlock[] = [{
    caption: analysis.equilibrium.referenceNodeId
      ? `Sumas globales; los momentos se toman en el nodo ${analysis.equilibrium.referenceNodeId}`
      : 'Sumas globales de las acciones aplicadas y las reacciones obtenidas',
    equations: sums.map((sum) => sum.equation),
  }];
  const audit = analysis.loadAudit;
  if (audit) {
    const scale = Math.max(Math.abs(audit.source.fx), Math.abs(audit.source.fy), 1);
    blocks.push({
      caption: 'Auditoría de cargas: la misma resultante por la ruta de origen y por la de ensamblaje',
      equations: [
        `Δ = ${dim(context.project, audit.assembled.fy, 1, 0, scale)} − ${operand(dim(context.project, audit.source.fy, 1, 0, scale))}`
        + ` = ${dim(context.project, audit.difference.fy, 1, 0, scale)} ${unitLabel(context.project.settings.units, 'force')}`,
        `r = ${number(audit.normalizedResidual, 4)}`,
      ],
    });
  }
  return blocks;
};

// ---------------------------------------------------------------------------------------
// Free bodies: what the truss methods actually add up
// ---------------------------------------------------------------------------------------

/**
 * True when two figures are the same number written two ways, relative to the magnitudes
 * involved. Every worked relation in the method sections is gated on this: a memoir must not
 * print an equality that its own numbers do not satisfy.
 */
export const agrees = (left: number, right: number, scale = 1): boolean =>
  Math.abs(left - right) <= 1e-6 * Math.max(1, Math.abs(scale));

/** One bar crossing the boundary of a free body, and the end of it that stays inside. */
export interface SeveredBar {
  readonly memberId: string;
  /** Node of the bar that belongs to the retained portion. */
  readonly nodeId: string;
  /** Axial force, tension positive. */
  readonly force: number;
}

/**
 * The equilibrium of a retained portion of a truss, written out term by term.
 *
 * This is the arithmetic the Method of Joints and the Method of Sections actually perform:
 * each bar force multiplied by its own direction cosine, plus the reactions and applied loads
 * of the retained nodes, adding up to zero. Each of the three sums is printed only if it
 * really closes on this analysis's numbers, and the whole development is skipped when the
 * model carries member loads, whose distributed contribution this helper does not integrate.
 */
export const freeBodyEquations = (
  context: ReportContext,
  keptNodeIds: readonly string[],
  bars: readonly SeveredBar[],
): string[] => {
  const { project, analysis, index } = context;
  if (activeMemberLoads(context).length) return [];
  const origin = index.node(keptNodeIds[0]);
  if (!origin) return [];

  interface Term { fx: number; fy: number; x: number; y: number; text: string }
  const terms: Term[] = [];
  const scaleOfForces: number[] = [];

  for (const bar of bars) {
    const member = index.member(bar.memberId);
    const here = index.node(bar.nodeId);
    if (!member || !here) return [];
    const farId = member.i === bar.nodeId ? member.j : member.i;
    const far = index.node(farId);
    if (!far) return [];
    const axis = memberAxis(member, here, far);
    // `memberAxis` measures from i to j; a bar retained by its j end pulls the other way.
    const sign = member.i === bar.nodeId ? 1 : -1;
    const cx = sign * axis.c;
    const cy = sign * axis.s;
    terms.push({
      fx: bar.force * cx,
      fy: bar.force * cy,
      x: here.x,
      y: here.y,
      text: `${bar.memberId}`,
    });
    scaleOfForces.push(bar.force);
  }
  for (const nodeId of keptNodeIds) {
    const node = index.node(nodeId);
    const result = analysis.nodeResults.find((entry) => entry.nodeId === nodeId);
    if (!node) return [];
    const loads = project.nodalLoads.filter((load) => load.nodeId === nodeId && caseFactor(context, load.caseId) !== undefined);
    const fx = (result?.rx ?? 0) + loads.reduce((sum, load) => sum + (caseFactor(context, load.caseId) ?? 1) * load.fx, 0);
    const fy = (result?.ry ?? 0) + loads.reduce((sum, load) => sum + (caseFactor(context, load.caseId) ?? 1) * load.fy, 0);
    if (Math.abs(fx) + Math.abs(fy) === 0) continue;
    terms.push({ fx, fy, x: node.x, y: node.y, text: nodeId });
    scaleOfForces.push(fx, fy);
  }
  if (!terms.length) return [];
  const scale = scaleOf(scaleOfForces);
  const forceUnit = unitLabel(project.settings.units, 'force');

  const barTerm = (term: Term, component: 'fx' | 'fy'): string => {
    const bar = bars.find((entry) => entry.memberId === term.text);
    if (!bar) return dim(project, term[component], 1, 0, scale);
    const cosine = bar.force === 0 ? 0 : term[component] / bar.force;
    return `(${dim(project, bar.force, 1, 0, scale)})(${number(cosine, 6)})`;
  };

  const equations: string[] = [];
  for (const [component, symbol] of [['fx', 'ΣF_x'], ['fy', 'ΣF_y']] as const) {
    const total = terms.reduce((sum, term) => sum + term[component], 0);
    if (!agrees(total, 0, scale)) continue;
    const written = signedSum(terms
      .filter((term) => Math.abs(term[component]) > 0)
      .map((term) => barTerm(term, component)));
    if (!written || written === '0') continue;
    equations.push(`${symbol} = ${written} = 0 ${forceUnit}`);
  }
  // A single joint carries every force at the same point, so its moment sum is trivially zero
  // and printing it would add a row of noughts, not a check.
  if (keptNodeIds.length > 1) {
    const momentScale = Math.max(1, scale * Math.max(1, ...terms.map((term) => Math.hypot(term.x - origin.x, term.y - origin.y))));
    const moments = terms.map((term) => (term.x - origin.x) * term.fy - (term.y - origin.y) * term.fx);
    const total = moments.reduce((sum, value) => sum + value, 0);
    if (agrees(total, 0, momentScale)) {
      const written = signedSum(terms
        .map((term, position) => ({ term, moment: moments[position] }))
        .filter((entry) => Math.abs(entry.moment) > 0)
        .map(({ term }) => `(${dim(project, term.x - origin.x, 0, 1)})(${dim(project, term.fy, 1, 0, scale)})`
          + ` − (${dim(project, term.y - origin.y, 0, 1)})(${dim(project, term.fx, 1, 0, scale)})`));
      if (written && written !== '0') {
        equations.push(`ΣM(${origin.id}) = ${written} = 0 ${dimensionalUnit(project, 1, 1)}`);
      }
    }
  }
  return equations;
};

// ---------------------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------------------

/**
 * Substituted equations for one explanation step, or an empty list when this project has
 * nothing to substitute into it. An empty list means the section prints no equation at all,
 * which is the point: the generic statement it replaced said nothing about this structure.
 */
export const stepSubstitutions = (context: ReportContext, stepId: string): SubstitutionBlock[] => {
  if (stepId.startsWith('member-')) return memberBlocks(context, stepId.slice('member-'.length));
  switch (stepId) {
    case 'geometry': return geometryBlocks(context);
    case 'supports': return supportBlocks(context);
    case 'loads': return loadBlocks(context);
    case 'equivalent-loads': return equivalentLoadBlocks(context);
    case 'stiffness': return stiffnessBlocks(context);
    case 'transform': return transformBlocks(context);
    case 'solution': return solutionBlocks(context);
    case 'diagrams': return diagramBlocks(context);
    case 'deformation': return deformationBlocks(context);
    case 'verification': return verificationBlocks(context);
    default: return [];
  }
};

/** First substituted relation of a step, for surfaces with room for exactly one. */
export const leadSubstitution = (context: ReportContext, stepId: string): string | undefined =>
  stepSubstitutions(context, stepId).flatMap((block) => block.equations)[0];

/** Dimensions of a diagram quantity as force^a · length^b. */
const quantityDimension = (quantity: DiagramQuantity): readonly [number, number] => quantity === 'moment' ? [1, 1] : [1, 0];

/**
 * The slope of a diagram, evaluated rather than stated: `dV/ds = −12 kN/m` is this member's
 * own load, not the differential relation that would produce it on any member.
 */
export const quantitySlopeEquation = (
  context: ReportContext,
  quantity: DiagramQuantity,
  result: MemberResult,
): string | undefined => {
  const segment = result.diagramSegments[0];
  if (!segment) return undefined;
  const { project } = context;
  const coefficients = quantity === 'axial' ? segment.axial : quantity === 'shear' ? segment.shear : segment.moment;
  const symbol = quantity === 'axial' ? 'N' : quantity === 'shear' ? 'V' : 'M';
  const [forcePower, lengthPower] = quantityDimension(quantity);
  const slope = coefficients[1] ?? 0;
  const curvature = coefficients[2] ?? 0;
  const reference = scaleOf(coefficients);
  const linear = `${dim(project, slope, forcePower, lengthPower - 1, reference)} ${dimensionalUnit(project, forcePower, lengthPower - 1)}`;
  if (Math.abs(curvature) <= reference * 1e-10) return `d${symbol}/ds = ${linear}`;
  const second = dim(project, curvature, forcePower, lengthPower - 2, reference);
  const negative = second.startsWith('−') || second.startsWith('-');
  return `d${symbol}/ds = ${linear} ${negative ? '-' : '+'} 2 · ${negative ? second.slice(1) : second} s`;
};

/**
 * How this member's diagram was actually built: the value it starts from, the slope it
 * follows and where it closes or crosses zero — each one a figure from this analysis.
 */
export const quantityConstructionSteps = (
  context: ReportContext,
  quantity: DiagramQuantity,
  result: MemberResult,
): string[] => {
  const segment = result.diagramSegments[0];
  if (!segment) return [];
  const { project } = context;
  const coefficients = quantity === 'axial' ? segment.axial : quantity === 'shear' ? segment.shear : segment.moment;
  const symbol = quantity === 'axial' ? 'N' : quantity === 'shear' ? 'V' : 'M';
  const [forcePower, lengthPower] = quantityDimension(quantity);
  const unit = dimensionalUnit(project, forcePower, lengthPower);
  const lengthUnit = unitLabel(project.settings.units, 'length');
  const reference = scaleOf(coefficients);
  const span = segment.x1 - segment.x0;
  const steps = [
    `Se parte de ${symbol}(0) = ${dim(project, coefficients[0] ?? 0, forcePower, lengthPower, reference)} ${unit}.`,
    `Se avanza con ${quantitySlopeEquation(context, quantity, result) ?? ''}.`,
    `Cierra en ${symbol}(${dim(project, span, 0, 1)} ${lengthUnit}) = ${dim(project, polynomialAt(coefficients, span), forcePower, lengthPower, reference)} ${unit}.`,
  ];
  const [v0, v1] = [segment.shear[0] ?? 0, segment.shear[1] ?? 0];
  if (quantity === 'moment' && Math.abs(v1) > scaleOf(segment.shear) * 1e-10) {
    const station = -v0 / v1;
    if (station > 0 && station < span) {
      steps[2] = `V = 0 en s = ${dim(project, station, 0, 1)} ${lengthUnit}, donde M = ${dim(project, polynomialAt(segment.moment, station), 1, 1)} ${unit}.`;
    }
  }
  return steps;
};
