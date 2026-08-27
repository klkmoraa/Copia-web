import type { StructureModel } from '../models/types'

export function bounds(model: StructureModel) {
  if (model.nodes.length === 0) return { minX: 0, maxX: 6, minY: 0, maxY: 4 }
  const xs = model.nodes.map((n) => n.x)
  const ys = model.nodes.map((n) => n.y)
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) }
}

export function viewBoxOf(model: StructureModel, padRatio = 0.22) {
  const b = bounds(model)
  const w = Math.max(b.maxX - b.minX, 1)
  const h = Math.max(b.maxY - b.minY, 1)
  const pad = Math.max(w, h) * padRatio + 0.5
  return { x: b.minX - pad, y: -(b.maxY + pad), w: w + pad * 2, h: h + pad * 2 }
}
