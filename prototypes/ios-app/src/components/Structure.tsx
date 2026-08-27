/*
 * Dibujo del modelo estructural. Es el mismo componente en las tres escalas
 * del prototipo — miniatura de 56px, ilustración de portada y lienzo del
 * workspace — porque un pórtico tiene que verse igual en la lista que dentro
 * del proyecto: si la miniatura miente, la lista deja de servir para elegir.
 *
 * Convenio: el mundo es (x hacia la derecha, y hacia arriba, metros) y la
 * pantalla invierte la Y una sola vez, en `P()`. Todo lo demás trabaja ya en
 * coordenadas de dibujo.
 */
import { Fragment, type ReactNode } from 'react'
import type { DiagramKind, MemberDiagram, Node as SNode, StructureModel } from '../lib/model'

export type Selection = { kind: 'node' | 'member'; id: string } | null

interface Props {
  model: StructureModel
  /** Transformación de encuadre aplicada sobre el viewBox (pan/zoom). */
  view?: { scale: number; tx: number; ty: number }
  grid?: boolean
  loads?: boolean
  labels?: boolean
  supports?: boolean
  selection?: Selection
  diagram?: { kind: DiagramKind; data: MemberDiagram[]; color: string } | null
  /** Grosor base del trazo, en px de pantalla. */
  weight?: number
  onPick?: (sel: Selection) => void
  className?: string
  ariaLabel?: string
  children?: ReactNode
  svgRef?: React.Ref<SVGSVGElement>
  onPointerDown?: React.PointerEventHandler<SVGSVGElement>
  onPointerMove?: React.PointerEventHandler<SVGSVGElement>
  onPointerUp?: React.PointerEventHandler<SVGSVGElement>
}

import { bounds, viewBoxOf } from './structureGeometry'

const P = (n: { x: number; y: number }) => ({ x: n.x, y: -n.y })

export function StructureView({
  model,
  view = { scale: 1, tx: 0, ty: 0 },
  grid = false,
  loads = false,
  labels = false,
  supports = true,
  selection = null,
  diagram = null,
  weight = 2,
  onPick,
  className,
  ariaLabel,
  children,
  svgRef,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: Props) {
  const vb = viewBoxOf(model)
  const span = Math.max(vb.w, vb.h)
  const node = (id: string) => model.nodes.find((n) => n.id === id)!
  const s = view.scale
  /** Tamaños que deben mantenerse constantes en pantalla pese al zoom. */
  const u = span / 100 / s
  const font = u * 3.2
  const gridStep = span > 18 ? 2 : 1
  /* Las etiquetas se empujan hacia fuera del modelo: pegadas al elemento
     chocaban entre sí y con las cargas (N3 encima de "12,5 kN/m"). El centro
     geométrico da la dirección de escape sin necesidad de resolver colisiones. */
  const b = bounds(model)
  const centre = { x: (b.minX + b.maxX) / 2, y: -(b.minY + b.maxY) / 2 }
  const outward = (p: { x: number; y: number }) => {
    const dx = p.x - centre.x
    const dy = p.y - centre.y
    const d = Math.hypot(dx, dy)
    return d < 1e-6 ? { x: 0, y: -1 } : { x: dx / d, y: dy / d }
  }
  const anchorOf = (dx: number): 'start' | 'middle' | 'end' => (dx > 0.3 ? 'start' : 'end')

  return (
    <svg
      ref={svgRef}
      className={className}
      viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={ariaLabel ?? 'Modelo estructural'}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {grid && (
        <g opacity={0.9}>
          <GridLines vb={vb} step={gridStep} view={view} />
        </g>
      )}

      <g transform={`translate(${view.tx} ${view.ty}) scale(${s})`}>
        {/* Diagrama, debajo del modelo: el dibujo manda, el resultado acompaña. */}
        {diagram && (
          <g opacity={0.92}>
            {diagram.data.map((d) => {
              const m = model.members.find((mm) => mm.id === d.member)
              if (!m) return null
              return (
                <DiagramBand
                  key={d.member}
                  a={P(node(m.from))}
                  b={P(node(m.to))}
                  values={d.values}
                  amp={span * 0.075}
                  color={diagram.color}
                  weight={weight / s}
                />
              )
            })}
          </g>
        )}

        {loads && (
          <g>
            {model.loads.map((l) => {
              if (l.kind === 'dist') {
                const m = model.members.find((mm) => mm.id === l.member)
                if (!m) return null
                const pa = P(node(m.from))
                const pb = P(node(m.to))
                /* La etiqueta se coloca hacia el extremo más alejado del centro
                   del modelo: en el extremo interior chocaría con la cumbrera. */
                const at = Math.abs(pa.x - centre.x) >= Math.abs(pb.x - centre.x) ? 0.28 : 0.72
                return <DistArrows key={l.id} a={pa} b={pb} u={u} at={at} label={`${l.q} kN/m`} font={font} />
              }
              if (l.kind === 'point') {
                return <PointArrow key={l.id} p={P(node(l.node))} u={u} label={`${Math.abs(l.fy)} kN`} font={font} />
              }
              return <MomentArc key={l.id} p={P(node(l.node))} u={u} />
            })}
          </g>
        )}

        {/* Barras */}
        <g>
          {model.members.map((m) => {
            const a = P(node(m.from))
            const b = P(node(m.to))
            const on = selection?.kind === 'member' && selection.id === m.id
            return (
              <Fragment key={m.id}>
                <line
                  x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                  stroke={on ? 'var(--selection)' : 'var(--member)'}
                  strokeWidth={(on ? weight + 1.6 : weight) / s}
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
                {onPick && (
                  <line
                    x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                    stroke="transparent"
                    strokeWidth={u * 9}
                    strokeLinecap="round"
                    style={{ cursor: 'pointer' }}
                    onPointerUp={(e) => { e.stopPropagation(); onPick({ kind: 'member', id: m.id }) }}
                  />
                )}
                {labels && (() => {
                  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
                  const o = outward(mid)
                  return (
                    <text
                      x={mid.x + o.x * u * 5}
                      y={mid.y + o.y * u * 5 + u * 1.1}
                      fontSize={font}
                      fill="var(--text-3)"
                      fontWeight={600}
                      textAnchor={anchorOf(o.x)}
                    >
                      {m.id}
                    </text>
                  )
                })()}
              </Fragment>
            )
          })}
        </g>

        {supports && (
          <g>
            {model.nodes.filter((n) => n.support).map((n) => (
              <Support key={n.id} n={n} u={u} />
            ))}
          </g>
        )}

        {/* Nudos */}
        <g>
          {model.nodes.map((n) => {
            const p = P(n)
            const on = selection?.kind === 'node' && selection.id === n.id
            return (
              <Fragment key={n.id}>
                {on && <circle cx={p.x} cy={p.y} r={u * 6} fill="var(--selection)" opacity={0.16} />}
                <circle
                  cx={p.x} cy={p.y} r={u * 2.6}
                  fill="var(--node-fill)"
                  stroke={on ? 'var(--selection)' : 'var(--member)'}
                  strokeWidth={(on ? weight + 1 : weight) / s}
                  vectorEffect="non-scaling-stroke"
                />
                {onPick && (
                  <circle
                    cx={p.x} cy={p.y} r={u * 7}
                    fill="transparent"
                    style={{ cursor: 'pointer' }}
                    onPointerUp={(e) => { e.stopPropagation(); onPick({ kind: 'node', id: n.id }) }}
                  />
                )}
                {labels && (() => {
                  const o = outward(p)
                  const bias = Math.abs(o.x) < 0.3 ? -1 : Math.sign(o.x)
                  return (
                    <text
                      x={p.x + bias * u * 5.8}
                      y={p.y + o.y * u * 5.4 + u * 1.1}
                      fontSize={font}
                      fill="var(--text-3)"
                      fontWeight={600}
                      textAnchor={bias > 0 ? 'start' : 'end'}
                    >
                      {n.id}
                    </text>
                  )
                })()}
              </Fragment>
            )
          })}
        </g>
        {children}
      </g>
    </svg>
  )
}

/*
 * La retícula se dibuja en coordenadas de pantalla (así el paso no se deforma
 * al hacer zoom) y se extiende una pantalla entera más allá del viewBox por
 * cada lado: un `<svg>` no recorta a su viewBox, sólo a su caja, así que ese
 * excedente es justo lo que rellena las bandas laterales cuando la relación
 * de aspecto del teléfono no coincide con la del modelo — en apaisado, sin
 * esto, el lienzo aparecía con dos franjas vacías.
 */
function GridLines({ vb, step, view }: { vb: { x: number; y: number; w: number; h: number }; step: number; view: { scale: number; tx: number; ty: number } }) {
  const lines: ReactNode[] = []
  const s = view.scale
  const overscan = 1
  const left = vb.x - vb.w * overscan
  const top = vb.y - vb.h * overscan
  const width = vb.w * (1 + overscan * 2)
  const height = vb.h * (1 + overscan * 2)
  const x0 = Math.floor((left - view.tx) / (step * s)) * step * s + view.tx
  const y0 = Math.floor((top - view.ty) / (step * s)) * step * s + view.ty
  const nx = Math.ceil(width / (step * s)) + 1
  const ny = Math.ceil(height / (step * s)) + 1
  for (let i = 0; i <= nx; i++) {
    const x = x0 + i * step * s
    lines.push(<line key={`v${i}`} x1={x} y1={top} x2={x} y2={top + height} stroke="var(--grid)" strokeWidth={1} vectorEffect="non-scaling-stroke" />)
  }
  for (let i = 0; i <= ny; i++) {
    const y = y0 + i * step * s
    lines.push(<line key={`h${i}`} x1={left} y1={y} x2={left + width} y2={y} stroke="var(--grid)" strokeWidth={1} vectorEffect="non-scaling-stroke" />)
  }
  return <>{lines}</>
}

/*
 * El glifo de apoyo se dibuja en unidades de `u` — que ya incorpora el zoom —
 * y NO usa `vector-effect`: ese atributo no se hereda desde un `<g>`, así que
 * ponerlo ahí dejaba los trazos en unidades de mundo (1,7 m de grosor) y el
 * apoyo se convertía en una mancha. Aquí el grosor es `u * 0,5`, que es
 * constante en pantalla por construcción.
 */
function Support({ n, u }: { n: SNode; u: number }) {
  const p = P(n)
  const w = u * 4.4
  const h = u * 4.6
  const ink = 'var(--member)'
  const sw = u * 0.55

  const ground = (y: number) => (
    <g stroke={ink} strokeWidth={sw} strokeLinecap="round">
      <line x1={p.x - w * 1.35} y1={y} x2={p.x + w * 1.35} y2={y} />
      {[-1.5, -0.9, -0.3, 0.3, 0.9, 1.5].map((k, i) => (
        <line
          key={i}
          x1={p.x + k * w * 0.78}
          y1={y + u * 2.1}
          x2={p.x + k * w * 0.78 + u * 1.5}
          y2={y}
        />
      ))}
    </g>
  )

  if (n.support === 'fixed') {
    return (
      <g>
        <rect x={p.x - w * 1.25} y={p.y - u * 0.5} width={w * 2.5} height={u * 1.2} fill={ink} rx={u * 0.4} />
        {ground(p.y + u * 0.7)}
      </g>
    )
  }

  return (
    <g>
      <path
        d={`M ${p.x} ${p.y} L ${p.x - w} ${p.y + h} L ${p.x + w} ${p.y + h} Z`}
        fill="none" stroke={ink} strokeWidth={sw} strokeLinejoin="round"
      />
      {n.support === 'roller' ? (
        <>
          <g fill="none" stroke={ink} strokeWidth={sw}>
            <circle cx={p.x - w * 0.48} cy={p.y + h + u * 1.15} r={u} />
            <circle cx={p.x + w * 0.48} cy={p.y + h + u * 1.15} r={u} />
          </g>
          {ground(p.y + h + u * 2.3)}
        </>
      ) : (
        ground(p.y + h)
      )}
    </g>
  )
}

function DistArrows({ a, b, u, at, label, font }: { a: { x: number; y: number }; b: { x: number; y: number }; u: number; at: number; label: string; font: number }) {
  const n = 6
  const off = u * 9
  const pts = Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
  })
  const top = pts.map((p) => ({ x: p.x, y: p.y - off }))
  const c = 'var(--distributed)'
  return (
    <g stroke={c} fill={c} strokeWidth={u * 0.5} strokeLinecap="round">
      <polyline points={top.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" />
      {pts.map((p, i) => (
        <g key={i}>
          <line x1={top[i].x} y1={top[i].y} x2={p.x} y2={p.y - u * 1.4} />
          <path d={`M ${p.x} ${p.y - u * 0.2} l ${-u * 1.1} ${-u * 2} l ${u * 2.2} 0 Z`} stroke="none" />
        </g>
      ))}
      <text
        x={top[0].x + (top[n].x - top[0].x) * at}
        y={top[0].y + (top[n].y - top[0].y) * at - u * 2.2}
        fontSize={font} fill={c} stroke="none" fontWeight={600} textAnchor="middle"
      >
        {label}
      </text>
    </g>
  )
}

function PointArrow({ p, u, label, font }: { p: { x: number; y: number }; u: number; label: string; font: number }) {
  const c = 'var(--load)'
  const len = u * 13
  return (
    <g stroke={c} fill={c} strokeWidth={u * 0.7} strokeLinecap="round">
      <line x1={p.x} y1={p.y - len} x2={p.x} y2={p.y - u * 2.6} />
      <path d={`M ${p.x} ${p.y - u * 1.2} l ${-u * 1.5} ${-u * 2.6} l ${u * 3} 0 Z`} stroke="none" />
      <text x={p.x + u * 2.2} y={p.y - len - u * 1} fontSize={font} fill={c} stroke="none" fontWeight={600}>
        {label}
      </text>
    </g>
  )
}

function MomentArc({ p, u }: { p: { x: number; y: number }; u: number }) {
  const r = u * 4.4
  const c = 'var(--moment)'
  return (
    <g stroke={c} fill={c} strokeWidth={u * 0.7}>
      <path d={`M ${p.x - r} ${p.y} A ${r} ${r} 0 1 1 ${p.x + r * 0.2} ${p.y + r * 0.98}`} fill="none" strokeLinecap="round" />
      <path d={`M ${p.x + r * 0.2} ${p.y + r * 1.2} l ${-u * 1.4} ${-u * 2.4} l ${u * 2.8} 0 Z`} stroke="none" />
    </g>
  )
}

function DiagramBand({
  a, b, values, amp, color, weight,
}: { a: { x: number; y: number }; b: { x: number; y: number }; values: number[]; amp: number; color: string; weight: number }) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy) || 1
  const ux = dx / len
  const uy = dy / len
  const nx = -uy
  const ny = ux
  const pts = values.map((v, i) => {
    const t = i / (values.length - 1)
    const bx = a.x + dx * t
    const by = a.y + dy * t
    return { x: bx + nx * v * amp, y: by + ny * v * amp }
  })
  const outline = pts.map((p) => `${p.x},${p.y}`).join(' ')
  const area = `${a.x},${a.y} ${outline} ${b.x},${b.y}`
  return (
    <g>
      <polygon points={area} fill={color} opacity={0.16} />
      <polyline points={outline} fill="none" stroke={color} strokeWidth={weight} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </g>
  )
}
