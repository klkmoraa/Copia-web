import { describe, expect, it } from 'vitest';
import { hermiteShapeFunctions, modeShapePoints, modeShapeScaleFor } from './modeShapePath';

const QUIET = { ux: 0, uy: 0, rz: 0 };
const A = { x: 0, y: 0 };
const B = { x: 4, y: 0 };
/** Barra inclinada, para comprobar que nada depende de que sea horizontal. */
const C = { x: 3, y: 4 };

describe('funciones de forma', () => {
  it('valen lo que tienen que valer en los extremos', () => {
    // En t=0 sólo vive el nudo i; en t=1 sólo el j. Si esto se rompe, la barra
    // deformada deja de tocar sus propios nudos.
    expect(hermiteShapeFunctions(0)).toEqual({ N1: 1, N2: 0, N3: 0, N4: 0 });
    const end = hermiteShapeFunctions(1);
    expect(end.N1).toBeCloseTo(0, 12);
    expect(end.N2).toBeCloseTo(0, 12);
    expect(end.N3).toBeCloseTo(1, 12);
    expect(end.N4).toBeCloseTo(0, 12);
  });

  it('las dos de traslación reparten la unidad en todo el tramo', () => {
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      const { N1, N3 } = hermiteShapeFunctions(t);
      expect(N1 + N3).toBeCloseTo(1, 12);
    }
  });
});

describe('forma de un modo', () => {
  it('sin desplazamiento devuelve la barra recta', () => {
    const points = modeShapePoints(A, B, QUIET, QUIET, { samples: 5 });
    expect(points).toHaveLength(5);
    points.forEach((point, index) => {
      expect(point.x).toBeCloseTo(index, 12);
      expect(point.y).toBeCloseTo(0, 12);
    });
  });

  it('una traslación igual en los dos nudos desplaza la barra entera, sin curvarla', () => {
    const move = { ux: 2, uy: -1, rz: 0 };
    for (const [start, end] of [[A, B], [A, C]] as const) {
      const points = modeShapePoints(start, end, move, move, { samples: 7 });
      points.forEach((point, index) => {
        const t = index / 6;
        expect(point.x).toBeCloseTo(start.x + t * (end.x - start.x) + 2, 10);
        expect(point.y).toBeCloseTo(start.y + t * (end.y - start.y) - 1, 10);
      });
    }
  });

  it('giros iguales en los dos extremos dan la S, con cero en el centro', () => {
    const points = modeShapePoints(A, B, { ...QUIET, rz: 0.01 }, { ...QUIET, rz: 0.01 }, { samples: 5 });
    // v(t) = L·θ·t(1−t)(1−2t): se anula en el centro y cambia de signo.
    expect(points[2].y).toBeCloseTo(0, 12);
    expect(Math.sign(points[1].y)).toBe(-Math.sign(points[3].y));
    expect(points[1].y).not.toBeCloseTo(0, 6);
  });

  it('giros opuestos dan una panza simétrica, máxima en el centro', () => {
    const points = modeShapePoints(A, B, { ...QUIET, rz: 0.01 }, { ...QUIET, rz: -0.01 }, { samples: 5 });
    expect(Math.abs(points[2].y)).toBeGreaterThan(Math.abs(points[1].y));
    expect(points[1].y).toBeCloseTo(points[3].y, 12);
  });

  it('el giro escala con la longitud de la barra', () => {
    /* Sin la longitud dentro de N2 y N4, una barra de 4 m y otra de 8 m se
       dibujarían con la misma flecha para el mismo giro, y el modo de una
       estructura de vanos desiguales saldría deformado. */
    const shortBar = modeShapePoints(A, B, { ...QUIET, rz: 0.01 }, { ...QUIET, rz: -0.01 }, { samples: 3 });
    const longBar = modeShapePoints(A, { x: 8, y: 0 }, { ...QUIET, rz: 0.01 }, { ...QUIET, rz: -0.01 }, { samples: 3 });
    expect(Math.abs(longBar[1].y)).toBeCloseTo(2 * Math.abs(shortBar[1].y), 10);
  });

  it('la barra deformada sigue tocando sus dos nudos', () => {
    const points = modeShapePoints(A, C, { ux: 1, uy: 0, rz: 0.02 }, { ux: 0, uy: 1, rz: -0.02 }, { samples: 9 });
    expect(points[0].x).toBeCloseTo(A.x + 1, 10);
    expect(points[0].y).toBeCloseTo(A.y, 10);
    expect(points[8].x).toBeCloseTo(C.x, 10);
    expect(points[8].y).toBeCloseTo(C.y + 1, 10);
  });

  it('la escala multiplica el desplazamiento y no la geometría', () => {
    const dof = { ux: 1, uy: 0, rz: 0.01 };
    const single = modeShapePoints(A, B, dof, QUIET, { samples: 5, scale: 1 });
    const double = modeShapePoints(A, B, dof, QUIET, { samples: 5, scale: 2 });
    double.forEach((point, index) => {
      const base = { x: index, y: 0 };
      expect(point.x - base.x).toBeCloseTo(2 * (single[index].x - base.x), 10);
      expect(point.y - base.y).toBeCloseTo(2 * (single[index].y - base.y), 10);
    });
  });

  it('con escala cero devuelve la barra sin deformar, que es la respuesta correcta', () => {
    const points = modeShapePoints(A, C, { ux: 5, uy: 5, rz: 1 }, { ux: -5, uy: 2, rz: -1 }, { samples: 4, scale: 0 });
    points.forEach((point, index) => {
      const t = index / 3;
      expect(point.x).toBeCloseTo(t * C.x, 12);
      expect(point.y).toBeCloseTo(t * C.y, 12);
    });
  });

  it('una barra de longitud cero no revienta: devuelve sus dos extremos', () => {
    expect(modeShapePoints(A, A, QUIET, QUIET)).toEqual([A, A]);
  });
});

describe('amplitud del dibujo', () => {
  it('sale del tamaño del modelo, no de una constante', () => {
    const small = modeShapeScaleFor({ minX: 0, minY: 0, maxX: 6, maxY: 0 });
    const large = modeShapeScaleFor({ minX: 0, minY: 0, maxX: 60, maxY: 0 });
    expect(large).toBeCloseTo(10 * small, 10);
  });

  it('un modelo sin extensión sigue teniendo una amplitud utilizable', () => {
    expect(modeShapeScaleFor({ minX: 2, minY: 2, maxX: 2, maxY: 2 })).toBe(1);
  });
});
