import { findStandardSection, type SectionShapeType, type StandardSection } from '../../data/standardSections';
import type { MemberPropertyOrigin } from '../../types';

/**
 * Geometría dibujable de una sección transversal.
 *
 * Regla del dominio: la forma real sólo se dibuja cuando existe una identidad
 * explícita de catálogo. En cualquier otro origen se devuelve la rectangular
 * equivalente h = √(12·I/A), que es la única forma que A e I determinan sin
 * inventar una identidad. Dos secciones distintas pueden compartir A e I, así
 * que deducir el perfil a partir de esos números sería una identidad falsa.
 *
 * Este módulo es puro: no depende de React ni del store, y lo comparten el
 * visor del Inspector y la vista previa de la edición múltiple.
 */

export interface SectionGeometryInput {
  /** Área bruta (m²) tal como la tiene el modelo. */
  area: number;
  /** Inercia fuerte (m⁴). */
  inertia: number;
  sectionId?: string;
  sectionOrigin?: MemberPropertyOrigin;
}

export interface SectionGeometry {
  /** Sección del catálogo cuando la identidad es explícita; `null` si es equivalente. */
  section: StandardSection | null;
  shapeType: SectionShapeType;
  depth: number; // m
  width: number; // m
  flange: number; // m
  web: number; // m
  /** Módulo elástico W (m³): del catálogo si existe, si no I / (h/2). */
  modulus: number;
}

export const resolveSectionGeometry = ({
  area,
  inertia,
  sectionId,
  sectionOrigin,
}: SectionGeometryInput): SectionGeometry => {
  const section: StandardSection | null = sectionOrigin === 'catalog' && sectionId
    ? findStandardSection(sectionId) ?? null
    : null;
  const safeArea = area > 0 ? area : 0.01;
  const safeInertia = inertia > 0 ? inertia : 1e-5;
  const depth = section?.depth ?? Math.sqrt((12 * safeInertia) / safeArea);
  const width = section?.width ?? safeArea / (depth > 0 ? depth : 1);
  return {
    section,
    shapeType: (section?.shapeType ?? 'RECT') as SectionShapeType,
    depth: depth > 0 ? depth : 0.3,
    width: width > 0 ? width : 0.2,
    flange: section?.flangeThickness ?? depth * 0.1,
    web: section?.webThickness ?? width * 0.1,
    modulus: section?.sectionModulusX ?? (depth > 0 ? safeInertia / (depth / 2) : 0),
  };
};

export interface SectionShapeBox {
  width: number;
  height: number;
  padding: number;
}

export interface SectionShapeLayout {
  left: number;
  right: number;
  top: number;
  bottom: number;
  cx: number;
  cy: number;
  pxWidth: number;
  pxHeight: number;
  pxWeb: number;
  pxFlange: number;
}

/** Encaja la sección en el lienzo SVG conservando su proporción real. */
export const sectionShapeLayout = (
  geometry: Pick<SectionGeometry, 'depth' | 'width' | 'web' | 'flange'>,
  box: SectionShapeBox,
): SectionShapeLayout => {
  const drawWidth = box.width - box.padding * 2;
  const drawHeight = box.height - box.padding * 2;
  const scale = Math.min(
    drawWidth / Math.max(geometry.width, 0.01),
    drawHeight / Math.max(geometry.depth, 0.01),
  ) * 0.9;
  const pxWidth = geometry.width * scale;
  const pxHeight = geometry.depth * scale;
  const cx = box.width / 2;
  const cy = box.height / 2;
  return {
    left: cx - pxWidth / 2,
    right: cx + pxWidth / 2,
    top: cy - pxHeight / 2,
    bottom: cy + pxHeight / 2,
    cx,
    cy,
    pxWidth,
    pxHeight,
    pxWeb: Math.max(geometry.web * scale, 3),
    pxFlange: Math.max(geometry.flange * scale, 3),
  };
};
