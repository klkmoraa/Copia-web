export interface GeometryPoint {
  x: number;
  y: number;
}

export interface GeometryMember {
  id: string;
  i: string;
  j: string;
}

export interface SelectionGeometryFilter {
  nodes: boolean;
  members: boolean;
}

export interface BoxSelectionResult {
  mode: 'window' | 'crossing';
  nodeIds: string[];
  memberIds: string[];
}

interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

const boundsOf = (start: GeometryPoint, current: GeometryPoint): Bounds => ({
  minX: Math.min(start.x, current.x),
  maxX: Math.max(start.x, current.x),
  minY: Math.min(start.y, current.y),
  maxY: Math.max(start.y, current.y),
});

const inside = (point: GeometryPoint, bounds: Bounds) =>
  point.x >= bounds.minX && point.x <= bounds.maxX
  && point.y >= bounds.minY && point.y <= bounds.maxY;

const orientation = (a: GeometryPoint, b: GeometryPoint, c: GeometryPoint) =>
  (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);

const onSegment = (a: GeometryPoint, b: GeometryPoint, point: GeometryPoint) => {
  const tolerance = 1e-10 * Math.max(1, Math.abs(a.x), Math.abs(a.y), Math.abs(b.x), Math.abs(b.y));
  return Math.abs(orientation(a, b, point)) <= tolerance
    && point.x >= Math.min(a.x, b.x) - tolerance
    && point.x <= Math.max(a.x, b.x) + tolerance
    && point.y >= Math.min(a.y, b.y) - tolerance
    && point.y <= Math.max(a.y, b.y) + tolerance;
};

const segmentsIntersect = (a: GeometryPoint, b: GeometryPoint, c: GeometryPoint, d: GeometryPoint) => {
  const o1 = orientation(a, b, c);
  const o2 = orientation(a, b, d);
  const o3 = orientation(c, d, a);
  const o4 = orientation(c, d, b);
  if ((o1 > 0) !== (o2 > 0) && (o3 > 0) !== (o4 > 0)) return true;
  return onSegment(a, b, c) || onSegment(a, b, d) || onSegment(c, d, a) || onSegment(c, d, b);
};

export const segmentCrossesBounds = (a: GeometryPoint, b: GeometryPoint, bounds: Bounds) => {
  if (inside(a, bounds) || inside(b, bounds)) return true;
  const topLeft = { x: bounds.minX, y: bounds.maxY };
  const topRight = { x: bounds.maxX, y: bounds.maxY };
  const bottomRight = { x: bounds.maxX, y: bounds.minY };
  const bottomLeft = { x: bounds.minX, y: bounds.minY };
  return segmentsIntersect(a, b, topLeft, topRight)
    || segmentsIntersect(a, b, topRight, bottomRight)
    || segmentsIntersect(a, b, bottomRight, bottomLeft)
    || segmentsIntersect(a, b, bottomLeft, topLeft);
};

/**
 * CAD convention: dragging left-to-right selects only objects completely inside
 * the window; right-to-left selects every object crossed by the rectangle.
 */
export const selectGeometryByBox = (
  start: GeometryPoint,
  current: GeometryPoint,
  nodes: Array<GeometryPoint & { id: string }>,
  members: GeometryMember[],
  filter: SelectionGeometryFilter = { nodes: true, members: true },
): BoxSelectionResult => {
  const mode = current.x >= start.x ? 'window' : 'crossing';
  const bounds = boundsOf(start, current);
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const nodeIds = filter.nodes ? nodes.filter((node) => inside(node, bounds)).map((node) => node.id) : [];
  const memberIds = filter.members ? members.flatMap((member) => {
    const a = nodeMap.get(member.i);
    const b = nodeMap.get(member.j);
    if (!a || !b) return [];
    const selected = mode === 'window'
      ? inside(a, bounds) && inside(b, bounds)
      : segmentCrossesBounds(a, b, bounds);
    return selected ? [member.id] : [];
  }) : [];
  return { mode, nodeIds, memberIds };
};
