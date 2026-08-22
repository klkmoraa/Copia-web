import { useMemo } from 'react';
import type { MemberLoad, MemberModel, NodalLoad, NodeModel, ProjectModel, Selection } from '../../types';
import { formatFixed } from '../../utils/numberFormat';

export interface InspectorSelectionPreviewProps {
  project: ProjectModel;
  selection: Selection;
  label: string;
  caption: string;
}

const VIEW_WIDTH = 220;
const VIEW_HEIGHT = 96;
const PADDING = 16;
/** Longitud en píxeles de la flecha de la componente dominante. */
const ARROW = 26;

interface Framed {
  toScreen: (x: number, y: number) => { x: number; y: number };
}

/** Encuadre que mete `points` en el lienzo del preview conservando la proporción. */
const frameFor = (points: ReadonlyArray<{ x: number; y: number }>): Framed => {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = Math.max(maxX - minX, 1e-6);
  const spanY = Math.max(maxY - minY, 1e-6);
  const scale = Math.min((VIEW_WIDTH - PADDING * 2) / spanX, (VIEW_HEIGHT - PADDING * 2) / spanY);
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  return {
    toScreen: (x, y) => ({
      x: VIEW_WIDTH / 2 + (x - centerX) * scale,
      // Y del modelo hacia arriba, Y del SVG hacia abajo.
      y: VIEW_HEIGHT / 2 - (y - centerY) * scale,
    }),
  };
};

const supportGlyph = (node: NodeModel, point: { x: number; y: number }, focused: boolean) => {
  if (node.support.type === 'none') return null;
  const className = `preview-support${focused ? ' is-focus' : ''}`;
  if (node.support.type === 'fixed') {
    return <g className={className} data-support-type="fixed">
      <line x1={point.x - 11} y1={point.y + 6} x2={point.x + 11} y2={point.y + 6} />
      {[-8, -3, 2, 7].map((offset) => <line key={offset} x1={point.x + offset} y1={point.y + 6} x2={point.x + offset - 4} y2={point.y + 11} />)}
    </g>;
  }
  return <g className={className} data-support-type={node.support.type}>
    <polygon points={`${point.x},${point.y} ${point.x - 8},${point.y + 11} ${point.x + 8},${point.y + 11}`} />
    <line x1={point.x - 10} y1={point.y + 11} x2={point.x + 10} y2={point.y + 11} />
    {node.support.type === 'roller' ? <>
      <circle cx={point.x - 4} cy={point.y + 14} r="2.4" />
      <circle cx={point.x + 4} cy={point.y + 14} r="2.4" />
    </> : [-6, -1, 4].map((offset) => <line key={offset} x1={point.x + offset} y1={point.y + 11} x2={point.x + offset - 4} y2={point.y + 16} />)}
  </g>;
};

/**
 * Flecha que *termina* en `tip`, apuntando en la dirección de pantalla `(dx, dy)`.
 * La convención es la del lienzo: la carga llega al punto donde actúa, así que
 * la punta marca el punto de aplicación y la cola dice de dónde viene.
 */
const forceArrow = (tip: { x: number; y: number }, dx: number, dy: number, length: number, key?: string) => {
  const magnitude = Math.hypot(dx, dy);
  if (magnitude < 1e-12) return null;
  const ux = dx / magnitude;
  const uy = dy / magnitude;
  const tail = { x: tip.x - ux * length, y: tip.y - uy * length };
  // Cabeza dibujada a mano: un `marker` obligaría a declararlo en cada `<defs>`
  // del preview, y aquí sólo hay una flecha por carga.
  const wing = 4.2;
  const back = { x: tip.x - ux * 7, y: tip.y - uy * 7 };
  return <g key={key} className="preview-arrow">
    <line x1={tail.x} y1={tail.y} x2={tip.x} y2={tip.y} />
    <polygon points={`${tip.x},${tip.y} ${back.x - uy * wing},${back.y + ux * wing} ${back.x + uy * wing},${back.y - ux * wing}`} />
  </g>;
};

/** Arco con punta de flecha: el gesto de un momento. `ccw` sigue el signo del modelo. */
const momentGlyph = (center: { x: number; y: number }, ccw: boolean, radius: number) => {
  // En pantalla la Y crece hacia abajo, así que un momento antihorario del
  // modelo se dibuja con el barrido invertido respecto al de la geometría.
  const sweep = ccw ? 0 : 1;
  const start = { x: center.x - radius, y: center.y };
  const end = { x: center.x + radius * 0.72, y: center.y - radius * 0.7 };
  const tipDirection = ccw ? { x: 0.7, y: -0.72 } : { x: -0.7, y: -0.72 };
  return <g className="preview-moment">
    <path d={`M ${start.x} ${start.y} A ${radius} ${radius} 0 1 ${sweep} ${end.x} ${end.y}`} />
    <polygon points={`${end.x},${end.y} ${end.x - tipDirection.x * 7 - tipDirection.y * 4},${end.y - tipDirection.y * 7 + tipDirection.x * 4} ${end.x - tipDirection.x * 7 + tipDirection.y * 4},${end.y - tipDirection.y * 7 - tipDirection.x * 4}`} />
  </g>;
};

/** `0.35` → `0.35 L`; un intervalo se rotula con sus dos extremos. */
const stationLabel = (start: number, end: number) => (Math.abs(end - start) < 1e-9
  ? `${formatFixed(start, 2)} L`
  : `${formatFixed(start, 2)}–${formatFixed(end, 2)} L`);

/** Componentes no nulas de una carga nodal, en el orden en que se leen. */
const nodalComponents = (load: NodalLoad) => [
  ['Fx', load.fx],
  ['Fy', load.fy],
  ['Mz', load.mz],
].filter(([, value]) => Math.abs(value as number) > 1e-12) as Array<[string, number]>;

/**
 * Miniatura del objeto seleccionado.
 *
 * El inspector describe el objeto con números; esto responde la otra mitad de la
 * pregunta — *cuál* es y cómo está puesto — sin obligar a volver al lienzo, que
 * es justo lo que cuesta en móvil, donde el panel tapa el dibujo. Se dibuja el
 * objeto y su vecindad inmediata: la barra con sus dos nudos y apoyos, el nudo
 * con las barras que llegan, la carga sobre su portador.
 *
 * Y la carga *misma*. Antes seleccionar una carga mostraba sólo su portador —
 * la misma imagen para una puntual, una distribuida y un momento, que es
 * exactamente la distinción que hacía falta ver. Ahora cada tipo trae su propio
 * gesto: dirección y componentes de la nodal, banda del intervalo cargado en la
 * distribuida, arco del momento, y la estación normalizada donde el modelo la
 * coloca. Todo sale de los datos que ya tiene el proyecto; no se estima nada.
 */
export const InspectorSelectionPreview = ({ project, selection, label, caption }: InspectorSelectionPreviewProps) => {
  const scene = useMemo(() => {
    if (!selection || selection.kind === 'multi') return null;
    const nodes = new Map(project.nodes.map((node) => [node.id, node]));

    const memberScene = (member: MemberModel, highlighted: boolean) => {
      const start = nodes.get(member.i);
      const end = nodes.get(member.j);
      return start && end ? { member, start, end, highlighted } : null;
    };

    if (selection.kind === 'member' || selection.kind === 'memberLoad') {
      const memberLoad: MemberLoad | null = selection.kind === 'memberLoad'
        ? project.memberLoads.find((load) => load.id === selection.id) ?? null
        : null;
      const memberId = selection.kind === 'member' ? selection.id : memberLoad?.memberId;
      const member = project.members.find((candidate) => candidate.id === memberId);
      const entry = member ? memberScene(member, true) : null;
      return entry
        ? { members: [entry], nodes: [entry.start, entry.end], focusNodeId: null, memberLoad, nodalLoad: null }
        : null;
    }

    const nodalLoad: NodalLoad | null = selection.kind === 'nodalLoad'
      ? project.nodalLoads.find((load) => load.id === selection.id) ?? null
      : null;
    const nodeId = selection.kind === 'node' ? selection.id : nodalLoad?.nodeId;
    const node = nodeId ? nodes.get(nodeId) : undefined;
    if (!node) return null;
    const attached = project.members
      .filter((member) => member.i === node.id || member.j === node.id)
      .map((member) => memberScene(member, false))
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
    const involved = new Map<string, NodeModel>([[node.id, node]]);
    for (const entry of attached) {
      involved.set(entry.start.id, entry.start);
      involved.set(entry.end.id, entry.end);
    }
    return { members: attached, nodes: [...involved.values()], focusNodeId: node.id, memberLoad: null, nodalLoad };
  }, [project, selection]);

  if (!scene || scene.nodes.length === 0) return null;
  const frame = frameFor(scene.nodes);

  const renderNodalLoad = () => {
    const load = scene.nodalLoad;
    if (!load) return null;
    const node = scene.nodes.find((candidate) => candidate.id === load.nodeId);
    if (!node) return null;
    const point = frame.toScreen(node.x, node.y);
    const components = nodalComponents(load);
    const hasForce = Math.abs(load.fx) > 1e-12 || Math.abs(load.fy) > 1e-12;
    return <g className="preview-load" data-load-kind="nodal">
      {/* La resultante manda la dirección; Y del modelo sube, la de pantalla baja. */}
      {hasForce ? forceArrow(point, load.fx, -load.fy, ARROW) : null}
      {Math.abs(load.mz) > 1e-12 ? momentGlyph(point, load.mz > 0, 13) : null}
      {components.length ? <text className="preview-load-label" x={VIEW_WIDTH / 2} y={VIEW_HEIGHT - 4} textAnchor="middle">
        {components.map(([name]) => name).join(' · ')}
      </text> : null}
    </g>;
  };

  const renderMemberLoad = () => {
    const load = scene.memberLoad;
    const entry = scene.members[0];
    if (!load || !entry) return null;
    const a = frame.toScreen(entry.start.x, entry.start.y);
    const b = frame.toScreen(entry.end.x, entry.end.y);
    const spanX = b.x - a.x;
    const spanY = b.y - a.y;
    const length = Math.hypot(spanX, spanY);
    if (length < 1e-9) return null;
    const along = (ratio: number) => ({ x: a.x + spanX * ratio, y: a.y + spanY * ratio });
    // Normal de pantalla del eje: el lado desde el que "cae" la carga.
    const nx = spanY / length;
    const ny = -spanX / length;
    const offset = 16;

    if (load.type === 'point') {
      const ratio = Math.min(1, Math.max(0, load.position ?? load.start));
      const tip = along(ratio);
      // Sin componentes declaradas la puntual se dibuja según la normal del eje:
      // es lo único que el modelo determina sin inventar una dirección.
      const dx = load.px ?? 0;
      const dy = load.py ?? 0;
      const useComponents = Math.abs(dx) > 1e-12 || Math.abs(dy) > 1e-12;
      return <g className="preview-load" data-load-kind="point">
        {forceArrow(tip, useComponents ? dx : -nx, useComponents ? -dy : -ny, ARROW)}
        <text className="preview-load-label" x={VIEW_WIDTH / 2} y={VIEW_HEIGHT - 4} textAnchor="middle">x {stationLabel(ratio, ratio)}</text>
      </g>;
    }

    if (load.type === 'moment') {
      const ratio = Math.min(1, Math.max(0, load.position ?? load.start));
      const point = along(ratio);
      return <g className="preview-load" data-load-kind="moment">
        {momentGlyph(point, (load.moment ?? 0) >= 0, 12)}
        <text className="preview-load-label" x={VIEW_WIDTH / 2} y={VIEW_HEIGHT - 4} textAnchor="middle">x {stationLabel(ratio, ratio)}</text>
      </g>;
    }

    const start = Math.min(1, Math.max(0, Math.min(load.start, load.end)));
    const end = Math.min(1, Math.max(0, Math.max(load.start, load.end)));
    // La banda crece desde el eje hacia +n con una altura proporcional a q en
    // cada extremo: una trapezoidal se distingue de una uniforme sin leer un
    // solo número, y el intervalo cargado se ve en su sitio sobre la barra.
    const peak = Math.max(Math.abs(load.qyStart ?? 0), Math.abs(load.qyEnd ?? 0), Math.abs(load.qxStart ?? 0), Math.abs(load.qxEnd ?? 0));
    const heightFor = (value: number | undefined) => (peak > 0 ? 5 + 13 * (Math.abs(value ?? 0) / peak) : 13);
    const hStart = heightFor(load.qyStart ?? load.qxStart);
    const hEnd = heightFor(load.qyEnd ?? load.qxEnd);
    const lift = (ratio: number, distance: number) => {
      const base = along(ratio);
      return { x: base.x + nx * distance, y: base.y + ny * distance };
    };
    const baseFrom = lift(start, offset);
    const baseTo = lift(end, offset);
    const topFrom = lift(start, offset + hStart);
    const topTo = lift(end, offset + hEnd);
    const ticks = [0, 0.5, 1].map((fraction) => {
      const ratio = start + (end - start) * fraction;
      const height = hStart + (hEnd - hStart) * fraction;
      return forceArrow(lift(ratio, 4), -nx, -ny, offset - 4 + height, `tick-${fraction}`);
    });
    return <g className="preview-load" data-load-kind="distributed">
      <path
        className="preview-load-band"
        d={`M ${baseFrom.x} ${baseFrom.y} L ${topFrom.x} ${topFrom.y} L ${topTo.x} ${topTo.y} L ${baseTo.x} ${baseTo.y} Z`}
      />
      {ticks}
      <text className="preview-load-label" x={VIEW_WIDTH / 2} y={VIEW_HEIGHT - 4} textAnchor="middle">{stationLabel(start, end)}</text>
    </g>;
  };

  return <figure className="inspector-selection-preview" aria-label={label}>
    <svg viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`} role="img" aria-label={label}>
      <g className="preview-members">
        {scene.members.map(({ member, start, end, highlighted }) => {
          const a = frame.toScreen(start.x, start.y);
          const b = frame.toScreen(end.x, end.y);
          return <line key={member.id} className={highlighted ? 'is-focus' : ''} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
        })}
      </g>
      <g className="preview-nodes">
        {scene.nodes.map((node) => {
          const point = frame.toScreen(node.x, node.y);
          const focused = scene.focusNodeId === node.id;
          return <g key={node.id}>
            {supportGlyph(node, point, focused)}
            <circle className={focused ? 'is-focus' : ''} cx={point.x} cy={point.y} r={focused ? 5 : 3.4} />
          </g>;
        })}
      </g>
      {renderNodalLoad()}
      {renderMemberLoad()}
    </svg>
    <figcaption>{caption}</figcaption>
  </figure>;
};
