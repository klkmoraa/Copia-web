/*
 * Modelo y datos simulados del prototipo.
 * No hay solver: los diagramas y las tablas se generan con formas cerradas
 * plausibles para un pórtico a dos aguas, deterministas y coherentes entre sí
 * (el máximo que muestra la tarjeta de resumen es el mismo que sale en la
 * tabla y el mismo que dibuja el diagrama). Suficiente para juzgar la
 * interfaz; nada de esto es un cálculo real.
 */

export type NodeId = string
export type MemberId = string

export interface Node {
  id: NodeId
  x: number // m
  y: number // m
  support?: 'pinned' | 'roller' | 'fixed'
}

export interface Member {
  id: MemberId
  from: NodeId
  to: NodeId
  section: string
  material: string
}

export interface PointLoad { id: string; kind: 'point'; node: NodeId; fy: number }
export interface MomentLoad { id: string; kind: 'moment'; node: NodeId; mz: number }
export interface DistLoad { id: string; kind: 'dist'; member: MemberId; q: number }
export type Load = PointLoad | MomentLoad | DistLoad

export interface StructureModel {
  nodes: Node[]
  members: Member[]
  loads: Load[]
}

export type ProjectStatus = 'calculated' | 'draft' | 'stale'

export interface Project {
  id: string
  name: string
  type: ProjectTypeId
  template: string
  units: UnitsId
  status: ProjectStatus
  updatedAt: string
  nodes: number
  members: number
  loadCases: number
  model: StructureModel
}

export type ProjectTypeId = 'frame' | 'truss' | 'beam' | 'bridge'
export type UnitsId = 'metric' | 'imperial'

export const PROJECT_TYPES: { id: ProjectTypeId; name: string; desc: string }[] = [
  { id: 'frame', name: 'Pórtico', desc: 'Marcos planos con nudos rígidos' },
  { id: 'truss', name: 'Celosía', desc: 'Barras articuladas, sólo axil' },
  { id: 'beam', name: 'Viga continua', desc: 'Un vano o varios apoyos' },
  { id: 'bridge', name: 'Puente', desc: 'Tramos con cargas móviles' },
]

export const UNIT_SYSTEMS: { id: UnitsId; name: string; detail: string }[] = [
  { id: 'metric', name: 'Métrico', detail: 'm · kN · kN·m' },
  { id: 'imperial', name: 'Imperial', detail: 'ft · kip · kip·ft' },
]

/* ------------------------------------------------------------------------ */
/* Geometrías                                                                */
/* ------------------------------------------------------------------------ */

export function gableFrame(span = 6, eaves = 4, ridge = 5.5): StructureModel {
  return {
    nodes: [
      { id: 'N1', x: 0, y: 0, support: 'pinned' },
      { id: 'N2', x: 0, y: eaves },
      { id: 'N3', x: span / 2, y: ridge },
      { id: 'N4', x: span, y: eaves },
      { id: 'N5', x: span, y: 0, support: 'roller' },
    ],
    members: [
      { id: 'M1', from: 'N1', to: 'N2', section: 'IPE 240', material: 'S275' },
      { id: 'M2', from: 'N2', to: 'N3', section: 'IPE 200', material: 'S275' },
      { id: 'M3', from: 'N3', to: 'N4', section: 'IPE 200', material: 'S275' },
      { id: 'M4', from: 'N4', to: 'N5', section: 'IPE 240', material: 'S275' },
    ],
    loads: [
      { id: 'L1', kind: 'dist', member: 'M2', q: 12.5 },
      { id: 'L2', kind: 'dist', member: 'M3', q: 12.5 },
      { id: 'L3', kind: 'point', node: 'N3', fy: -28 },
      { id: 'L4', kind: 'moment', node: 'N4', mz: 15 },
    ],
  }
}

function warehouseFrame(): StructureModel {
  const m = gableFrame(9, 5, 6.8)
  m.loads = [
    { id: 'L1', kind: 'dist', member: 'M2', q: 9.4 },
    { id: 'L2', kind: 'dist', member: 'M3', q: 9.4 },
    { id: 'L3', kind: 'point', node: 'N2', fy: -12 },
  ]
  return m
}

function bridgeSpan(): StructureModel {
  const nodes: Node[] = []
  const members: Member[] = []
  for (let i = 0; i < 5; i++) nodes.push({ id: `N${i + 1}`, x: i * 3, y: 0, support: i === 0 ? 'pinned' : i === 4 ? 'roller' : undefined })
  for (let i = 0; i < 4; i++) nodes.push({ id: `N${i + 6}`, x: i * 3 + 1.5, y: 2.4 })
  for (let i = 0; i < 4; i++) members.push({ id: `M${i + 1}`, from: `N${i + 1}`, to: `N${i + 2}`, section: 'HEB 300', material: 'S355' })
  for (let i = 0; i < 4; i++) {
    members.push({ id: `M${i + 5}`, from: `N${i + 1}`, to: `N${i + 6}`, section: 'CHS 168', material: 'S355' })
    members.push({ id: `M${i + 9}`, from: `N${i + 6}`, to: `N${i + 2}`, section: 'CHS 168', material: 'S355' })
  }
  return { nodes, members, loads: [{ id: 'L1', kind: 'dist', member: 'M2', q: 22 }, { id: 'L2', kind: 'point', node: 'N3', fy: -85 }] }
}

function simpleBeam(): StructureModel {
  return {
    nodes: [
      { id: 'N1', x: 0, y: 0, support: 'pinned' },
      { id: 'N2', x: 4, y: 0 },
      { id: 'N3', x: 8, y: 0, support: 'roller' },
    ],
    members: [
      { id: 'M1', from: 'N1', to: 'N2', section: 'IPE 300', material: 'S275' },
      { id: 'M2', from: 'N2', to: 'N3', section: 'IPE 300', material: 'S275' },
    ],
    loads: [
      { id: 'L1', kind: 'dist', member: 'M1', q: 18 },
      { id: 'L2', kind: 'dist', member: 'M2', q: 18 },
    ],
  }
}

export interface Template {
  id: string
  name: string
  detail: string
  type: ProjectTypeId
  recommended?: boolean
  build: () => StructureModel
}

export const TEMPLATES: Template[] = [
  { id: 'gable', name: 'Pórtico a dos aguas', detail: '6 × 5 m · cargas y combinaciones base', type: 'frame', recommended: true, build: () => gableFrame() },
  { id: 'warehouse', name: 'Nave industrial', detail: '9 × 6,8 m · marco tipo', type: 'frame', build: warehouseFrame },
  { id: 'beam', name: 'Viga continua', detail: '2 vanos de 4 m', type: 'beam', build: simpleBeam },
  { id: 'bridge', name: 'Tramo de puente', detail: 'Celosía Warren de 12 m', type: 'bridge', build: bridgeSpan },
  { id: 'blank', name: 'Lienzo en blanco', detail: 'Empieza sin geometría', type: 'frame', build: () => ({ nodes: [], members: [], loads: [] }) },
]

/* ------------------------------------------------------------------------ */
/* Proyectos simulados                                                       */
/* ------------------------------------------------------------------------ */

export const USER = {
  name: 'Carlos Mendoza',
  first: 'Carlos',
  initials: 'CM',
  email: 'carlos.mendoza@structureco.com',
  plan: 'Cuenta Pro',
  since: 'Miembro desde abril 2024',
}

export const PROJECTS: Project[] = [
  {
    id: 'p1', name: 'Pórtico a dos aguas 6 × 5', type: 'frame', template: 'Pórtico a dos aguas',
    units: 'metric', status: 'calculated', updatedAt: 'Hoy, 9:21', nodes: 5, members: 4, loadCases: 4,
    model: gableFrame(),
  },
  {
    id: 'p2', name: 'Nave industrial — Marco A', type: 'frame', template: 'Nave industrial',
    units: 'metric', status: 'calculated', updatedAt: 'Ayer, 16:15', nodes: 5, members: 4, loadCases: 3,
    model: warehouseFrame(),
  },
  {
    id: 'p3', name: 'Puente vehicular — Tramo 2', type: 'bridge', template: 'Tramo de puente',
    units: 'metric', status: 'draft', updatedAt: '21 may, 11:02', nodes: 9, members: 12, loadCases: 2,
    model: bridgeSpan(),
  },
  {
    id: 'p4', name: 'Viga continua — Forjado P3', type: 'beam', template: 'Viga continua',
    units: 'metric', status: 'stale', updatedAt: '14 may, 18:40', nodes: 3, members: 2, loadCases: 2,
    model: simpleBeam(),
  },
  {
    id: 'p5', name: 'Cubierta taller — Celosía', type: 'truss', template: 'Tramo de puente',
    units: 'metric', status: 'calculated', updatedAt: '2 may, 10:12', nodes: 9, members: 12, loadCases: 5,
    model: bridgeSpan(),
  },
]

export const STATUS_LABEL: Record<ProjectStatus, string> = {
  calculated: 'Calculado',
  draft: 'En progreso',
  stale: 'Resultados desfasados',
}

export const STATUS_COLOR: Record<ProjectStatus, string> = {
  calculated: 'var(--success)',
  draft: 'var(--info)',
  stale: 'var(--warning)',
}

/* ------------------------------------------------------------------------ */
/* "Resultados"                                                              */
/* ------------------------------------------------------------------------ */

export type DiagramKind = 'moment' | 'shear' | 'axial' | 'deformed'

export interface MemberDiagram {
  member: MemberId
  /** 11 ordenadas normalizadas a [-1, 1] a lo largo de la barra. */
  values: number[]
  /** Valor máximo absoluto con signo, en unidades de la magnitud. */
  peak: number
}

export interface AnalysisResults {
  ok: boolean
  ran: string
  maxMoment: { value: number; where: string }
  maxShear: { value: number; where: string }
  maxAxial: { value: number; where: string }
  maxDisp: { value: number; where: string }
  utilisation: number
  reactions: { node: NodeId; fx: number; fy: number; mz: number | null }[]
  memberForces: { member: MemberId; n: number; v: number; m: number; ratio: number }[]
  displacements: { node: NodeId; dx: number; dy: number; rz: number }[]
  diagrams: Record<DiagramKind, MemberDiagram[]>
}

const SAMPLES = 11

function shape(fn: (t: number) => number): number[] {
  return Array.from({ length: SAMPLES }, (_, i) => fn(i / (SAMPLES - 1)))
}

/** Semilla determinista por id, para que dos proyectos no den lo mismo. */
function seed(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 997
  return 0.82 + (h % 40) / 100
}

export function analyse(project: Project): AnalysisResults {
  const k = seed(project.id)
  const { members, nodes } = project.model
  const isColumn = (m: Member) => {
    const a = nodes.find((n) => n.id === m.from)!
    const b = nodes.find((n) => n.id === m.to)!
    return Math.abs(b.x - a.x) < 0.4
  }

  const moment: MemberDiagram[] = []
  const shear: MemberDiagram[] = []
  const axial: MemberDiagram[] = []
  const deformed: MemberDiagram[] = []

  members.forEach((m, i) => {
    const col = isColumn(m)
    const sign = i % 2 === 0 ? 1 : -1
    if (col) {
      // Columna: momento lineal desde la base, cortante constante, axil constante.
      moment.push({ member: m.id, values: shape((t) => -0.2 + 1.0 * t), peak: 34.8 * k * sign })
      shear.push({ member: m.id, values: shape(() => 0.62 * sign), peak: 12.4 * k * sign })
      axial.push({ member: m.id, values: shape(() => -0.85), peak: -46.2 * k })
      deformed.push({ member: m.id, values: shape((t) => 0.9 * t * t * (3 - 2 * t) * 0.5 * sign), peak: 8.1 * k })
    } else {
      // Dintel con carga repartida: parábola con momentos de extremo.
      moment.push({
        member: m.id,
        values: shape((t) => -0.55 + 2.9 * t * (1 - t) + 0.1 * t),
        peak: 41.6 * k,
      })
      shear.push({ member: m.id, values: shape((t) => (1 - 2 * t) * 0.94 * sign), peak: 24.9 * k * sign })
      axial.push({ member: m.id, values: shape(() => -0.55), peak: -29.8 * k })
      deformed.push({ member: m.id, values: shape((t) => -Math.sin(Math.PI * t) * 0.95), peak: 11.6 * k })
    }
  })

  const memberForces = members.map((m, i) => {
    const col = isColumn(m)
    const base = col ? 1 : 1.18
    const n = -(38 + i * 3.6) * k
    const v = (col ? 12.4 : 24.9) * k * (i % 2 === 0 ? 1 : -1)
    const mm = (col ? 34.8 : 41.6) * k * base
    return { member: m.id, n: r(n), v: r(v), m: r(mm), ratio: r(Math.min(0.94, (0.44 + i * 0.07) * k), 2) }
  })

  const supported = nodes.filter((n) => n.support)
  const reactions = supported.map((n, i) => ({
    node: n.id,
    fx: r((i === 0 ? 9.4 : -9.4) * k),
    fy: r((i === 0 ? 62.8 : 58.4) * k),
    mz: n.support === 'fixed' ? r(18.2 * k) : null,
  }))

  const displacements = nodes.map((n, i) => ({
    node: n.id,
    dx: n.support ? 0 : r((1.2 + i * 0.8) * k, 2),
    dy: n.support === 'roller' || n.support ? 0 : r(-(3.1 + i * 2.4) * k, 2),
    rz: n.support === 'pinned' || !n.support ? r((0.42 - i * 0.06) * k, 3) : 0,
  }))

  const worstMember = memberForces.reduce((a, b) => (Math.abs(b.m) > Math.abs(a.m) ? b : a))
  const worstShear = memberForces.reduce((a, b) => (Math.abs(b.v) > Math.abs(a.v) ? b : a))
  const worstAxial = memberForces.reduce((a, b) => (Math.abs(b.n) > Math.abs(a.n) ? b : a))
  const worstDisp = displacements.reduce((a, b) => (Math.abs(b.dy) > Math.abs(a.dy) ? b : a))
  const utilisation = memberForces.reduce((a, b) => Math.max(a, b.ratio), 0)

  return {
    ok: utilisation < 1,
    ran: 'hace un momento',
    maxMoment: { value: worstMember.m, where: worstMember.member },
    maxShear: { value: worstShear.v, where: worstShear.member },
    maxAxial: { value: worstAxial.n, where: worstAxial.member },
    maxDisp: { value: worstDisp.dy, where: worstDisp.node },
    utilisation,
    reactions,
    memberForces,
    displacements,
    diagrams: { moment, shear, axial, deformed },
  }
}

function r(v: number, d = 1): number {
  const f = 10 ** d
  return Math.round(v * f) / f
}

export const DIAGRAM_META: Record<DiagramKind, { label: string; short: string; unit: string; color: string }> = {
  moment: { label: 'Momento', short: 'M', unit: 'kN·m', color: 'var(--moment)' },
  shear: { label: 'Cortante', short: 'V', unit: 'kN', color: 'var(--shear)' },
  axial: { label: 'Axil', short: 'N', unit: 'kN', color: 'var(--axial)' },
  deformed: { label: 'Deformada', short: 'δ', unit: 'mm', color: 'var(--deformed)' },
}

export function fmt(v: number, d = 1): string {
  return v.toLocaleString('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d })
}
