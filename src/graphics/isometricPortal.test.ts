import { describe, expect, it } from 'vitest';
import { buildPortal, projectIso, DEFAULT_PORTAL, type Face, type Point2 } from './isometricPortal';

describe('projectIso', () => {
  it('sends the world origin to the projection origin', () => {
    expect(projectIso({ x: 0, y: 0, z: 0 })).toEqual({ x: 0, y: 0 });
  });

  it('mirrors x and z horizontally, so the two are distinguishable', () => {
    const a = projectIso({ x: 1, y: 0, z: 0 });
    const b = projectIso({ x: 0, y: 0, z: 1 });
    expect(a.x).toBeCloseTo(-b.x, 6);
    expect(a.y).toBeCloseTo(b.y, 6);
  });

  it('sends height straight up the screen', () => {
    const ground = projectIso({ x: 0, y: 0, z: 0 });
    const up = projectIso({ x: 0, y: 10, z: 0 });
    expect(up.x).toBeCloseTo(ground.x, 6);
    expect(up.y).toBeLessThan(ground.y);
  });
});

describe('buildPortal', () => {
  const faces = buildPortal();

  it('emits faces for every material of the portal', () => {
    const materials = new Set(faces.map((f) => f.material));
    expect(materials).toEqual(new Set(['column', 'beam', 'base', 'capital']));
  });

  it('splits the lintel into the requested number of modules', () => {
    const beams = faces.filter((f) => f.material === 'beam');
    const modules = new Set(beams.map((f) => f.id.split(':')[1]));
    expect(modules.size).toBe(DEFAULT_PORTAL.beamModules);
  });

  it('returns faces sorted back to front so painting them in order is correct', () => {
    const depths = faces.map((f) => f.depth);
    expect(depths).toEqual([...depths].sort((a, b) => a - b));
  });

  it('gives every face a closed polygon of at least three points', () => {
    for (const face of faces) expect(face.points.length).toBeGreaterThanOrEqual(3);
  });

  it('shades top faces brighter than side faces, from a single light', () => {
    const brightest = (material: Face['material'], kind: string) => {
      const face = faces.find((f) => f.material === material && f.id.endsWith(kind));
      if (!face) throw new Error(`missing ${material} ${kind}`);
      return face.shade;
    };
    expect(brightest('beam', 'top')).toBeGreaterThan(brightest('beam', 'right'));
    expect(brightest('column', 'left')).toBeGreaterThan(brightest('column', 'right'));
  });

  it('keeps shade inside the unit interval so materials can interpolate on it', () => {
    for (const face of faces) {
      expect(face.shade).toBeGreaterThanOrEqual(0);
      expect(face.shade).toBeLessThanOrEqual(1);
    }
  });

  it('is parametric: a wider span moves the right column right', () => {
    const rightOf = (fs: Face[]) => Math.max(...fs.flatMap((f) => f.points.map((p) => p.x)));
    expect(rightOf(buildPortal({ ...DEFAULT_PORTAL, span: DEFAULT_PORTAL.span * 1.5 })))
      .toBeGreaterThan(rightOf(faces));
  });

  it('is deterministic', () => {
    expect(buildPortal()).toEqual(buildPortal());
  });
});

describe('buildPortal face geometry integrity', () => {
  const faces = buildPortal();

  /** Area con signo (shoelace). El signo codifica el sentido de giro en pantalla. */
  const shoelace = (pts: Point2[]) => {
    let sum = 0;
    for (let i = 0; i < pts.length; i += 1) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      sum += a.x * b.y - b.x * a.y;
    }
    return sum;
  };

  const pointInPolygon = (p: Point2, poly: Point2[]) => {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
      const a = poly[i];
      const b = poly[j];
      const crosses = a.y > p.y !== b.y > p.y &&
        p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x;
      if (crosses) inside = !inside;
    }
    return inside;
  };

  /** Envolvente convexa (monotone chain). La silueta de una caja isométrica es
   *  siempre convexa, así que sirve como referencia exacta de "dentro/fuera". */
  const convexHull = (points: Point2[]): Point2[] => {
    const pts = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
    const cross = (o: Point2, a: Point2, b: Point2) =>
      (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    const half = (list: Point2[]) => {
      const hull: Point2[] = [];
      for (const p of list) {
        while (hull.length >= 2 && cross(hull[hull.length - 2], hull[hull.length - 1], p) <= 0) hull.pop();
        hull.push(p);
      }
      hull.pop();
      return hull;
    };
    return half(pts).concat(half([...pts].reverse()));
  };

  /** Agrupa las caras por caja: `${id}:top`/`:left`/:`right` -> `${id}`. */
  const boxGroups = () => {
    const groups = new Map<string, Face[]>();
    for (const f of faces) {
      const boxId = f.id.split(':').slice(0, -1).join(':');
      if (!groups.has(boxId)) groups.set(boxId, []);
      groups.get(boxId)!.push(f);
    }
    return groups;
  };

  it('winds all three faces of every box the same way on screen', () => {
    for (const [boxId, group] of boxGroups()) {
      const signs = group.map((f) => Math.sign(shoelace(f.points)));
      expect(new Set(signs).size, `${boxId}: signos ${signs.join(',')}`).toBe(1);
    }
  });

  it('covers every box silhouette exactly once, without gaps or overlap', () => {
    for (const [boxId, group] of boxGroups()) {
      const allPoints = group.flatMap((f) => f.points);
      const hull = convexHull(allPoints);
      const minX = Math.min(...allPoints.map((p) => p.x));
      const maxX = Math.max(...allPoints.map((p) => p.x));
      const minY = Math.min(...allPoints.map((p) => p.y));
      const maxY = Math.max(...allPoints.map((p) => p.y));

      const steps = 30;
      let sampled = 0;
      let uncovered = 0;
      let overlapped = 0;
      for (let ix = 0; ix <= steps; ix += 1) {
        for (let iy = 0; iy <= steps; iy += 1) {
          const p = {
            x: minX + ((maxX - minX) * ix) / steps,
            y: minY + ((maxY - minY) * iy) / steps,
          };
          if (!pointInPolygon(p, hull)) continue;
          sampled += 1;
          const hits = group.filter((f) => pointInPolygon(p, f.points)).length;
          if (hits === 0) uncovered += 1;
          if (hits >= 2) overlapped += 1;
        }
      }

      expect(sampled, `${boxId}: muestreo vacío`).toBeGreaterThan(0);
      expect(uncovered / sampled, `${boxId}: fracción sin cubrir`).toBeLessThan(0.05);
      expect(overlapped / sampled, `${boxId}: fracción solapada`).toBeLessThan(0.05);
    }
  });
});
