/*
 * Mesa de trabajo. Pantalla dedicada, a pantalla completa: se presenta al
 * abrir o crear un proyecto y no vive dentro de la tab bar.
 *
 * Anatomía, de arriba abajo: barra de identidad, lienzo (el protagonista),
 * hoja inferior con tres topes (inspector o resultados) y dock de
 * herramientas. Nada más. El detalle largo — tablas de reacciones,
 * esfuerzos y desplazamientos — no se comprime en la hoja: se abre en su
 * propia pantalla, que es donde una tabla de 12 filas × 5 columnas se lee.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity, ArrowLeft, Check, ChevronRight, CircleDot, Crosshair, Expand,
  Grid3x3, Layers, MinusCircle, Minus, MoreHorizontal, Move, Plus, Ruler, Scissors,
  Share, Spline, Table2, Trash2, TrendingUp, Waves, Weight, Zap,
} from 'lucide-react'
import { Sheet, type Detent } from '../components/Sheet'
import { StructureView, type Selection } from '../components/Structure'
import { viewBoxOf } from '../components/structureGeometry'
import { ActionSheet, type ActionItem } from '../components/Chrome'
import {
  analyse, DIAGRAM_META, fmt, STATUS_COLOR, STATUS_LABEL,
  type AnalysisResults, type DiagramKind, type DistLoad, type MomentLoad,
  type PointLoad, type Project, type StructureModel,
} from '../lib/model'

type Tool = 'select' | 'node' | 'member' | 'support' | 'load' | 'more'
type Mode = 'model' | 'results'

/* Los glifos de barra, apoyo y carga son propios: los equivalentes genéricos
   (un guion, una barra inclinada, una pesa) no dicen nada en una app de
   cálculo, y el dock es donde más se mira. */
function Glyph({ d, extra }: { d: string; extra?: React.ReactNode }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
      {extra}
    </svg>
  )
}

const TOOLS: { id: Tool; label: string; icon: React.ReactNode }[] = [
  { id: 'select', label: 'Selección', icon: <Crosshair size={19} strokeWidth={2} /> },
  { id: 'node', label: 'Nudos', icon: <CircleDot size={19} strokeWidth={2} /> },
  {
    id: 'member',
    label: 'Barras',
    icon: <Glyph d="M6.5 17.5 17.5 6.5" extra={<><circle cx="5" cy="19" r="2.4" /><circle cx="19" cy="5" r="2.4" /></>} />,
  },
  {
    id: 'support',
    label: 'Apoyos',
    icon: <Glyph d="M12 5 5.5 15h13L12 5Z M3.5 18h17 M5 21.5 7 18 M9 21.5 11 18 M13 21.5 15 18 M17 21.5 19 18" />,
  },
  {
    id: 'load',
    label: 'Cargas',
    icon: <Glyph d="M4 4h16 M8 4v10 M12 4v13 M16 4v10 M8 14l-1.6-2.6M8 14l1.6-2.6 M12 17l-1.6-2.6M12 17l1.6-2.6 M16 14l-1.6-2.6M16 14l1.6-2.6" />,
  },
  { id: 'more', label: 'Más', icon: <MoreHorizontal size={19} strokeWidth={2.2} /> },
]

const TOOL_HINT: Record<Tool, string> = {
  select: 'Toca un nudo o una barra',
  node: 'Toca para colocar un nudo',
  member: 'Une dos nudos',
  support: 'Toca un nudo y cambia su apoyo',
  load: 'Toca dónde aplicar la carga',
  more: 'Herramientas avanzadas',
}

interface Props {
  project: Project
  gridOn: boolean
  decimals: number
  onClose: () => void
  onToast: (msg: string) => void
}

export function Workspace({ project, gridOn, decimals, onClose, onToast }: Props) {
  const [model, setModel] = useState<StructureModel>(project.model)
  const [tool, setTool] = useState<Tool>('select')
  const [selection, setSelection] = useState<Selection>(null)
  const [detent, setDetent] = useState<Detent>('medium')
  const [sheetH, setSheetH] = useState(0)
  const [mode, setMode] = useState<Mode>('model')
  const [results, setResults] = useState<AnalysisResults | null>(project.status === 'calculated' ? analyse(project) : null)
  const [running, setRunning] = useState(0)
  const [diagram, setDiagram] = useState<DiagramKind | null>(null)
  const [menu, setMenu] = useState<ActionItem[] | null>(null)
  const [tables, setTables] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const [view, setView] = useState({ scale: 1, tx: 0, ty: 0 })

  const svgRef = useRef<SVGSVGElement | null>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const gesture = useRef<{ moved: boolean; lastX: number; lastY: number; dist: number }>({
    moved: false, lastX: 0, lastY: 0, dist: 0,
  })

  const vb = useMemo(() => viewBoxOf(model), [model])

  /* --- Conversión px → unidades del viewBox -------------------------------- */
  const unitsPerPx = useCallback(() => {
    const el = svgRef.current
    if (!el) return 1
    const r = el.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) return 1
    return r.width / r.height > vb.w / vb.h ? vb.h / r.height : vb.w / r.width
  }, [vb])

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const pts = [...pointers.current.values()]
    gesture.current.moved = false
    gesture.current.lastX = e.clientX
    gesture.current.lastY = e.clientY
    if (pts.length === 2) gesture.current.dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
  }

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const pts = [...pointers.current.values()]
    const k = unitsPerPx()

    if (pts.length >= 2) {
      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
      const prev = gesture.current.dist || d
      const factor = d / prev
      gesture.current.dist = d
      gesture.current.moved = true
      setView((v) => {
        const next = Math.min(6, Math.max(0.45, v.scale * factor))
        // Zoom anclado al punto medio de los dos dedos.
        const el = svgRef.current!.getBoundingClientRect()
        const mx = vb.x + ((pts[0].x + pts[1].x) / 2 - el.left) * k
        const my = vb.y + ((pts[0].y + pts[1].y) / 2 - el.top) * k
        const ratio = next / v.scale
        return { scale: next, tx: mx - (mx - v.tx) * ratio, ty: my - (my - v.ty) * ratio }
      })
      return
    }

    const dx = e.clientX - gesture.current.lastX
    const dy = e.clientY - gesture.current.lastY
    if (Math.hypot(dx, dy) > 0.5) {
      if (Math.abs(e.clientX - gesture.current.lastX) > 4 || Math.abs(e.clientY - gesture.current.lastY) > 4) {
        gesture.current.moved = true
      }
      gesture.current.lastX = e.clientX
      gesture.current.lastY = e.clientY
      setView((v) => ({ ...v, tx: v.tx + dx * k, ty: v.ty + dy * k }))
    }
  }

  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) gesture.current.dist = 0
  }

  const zoomBy = (factor: number) => {
    setView((v) => {
      const next = Math.min(6, Math.max(0.45, v.scale * factor))
      const cx = vb.x + vb.w / 2
      const cy = vb.y + vb.h / 2
      const ratio = next / v.scale
      return { scale: next, tx: cx - (cx - v.tx) * ratio, ty: cy - (cy - v.ty) * ratio }
    })
  }

  /* --- Selección ------------------------------------------------------------ */
  const pick = (sel: Selection) => {
    if (gesture.current.moved) return
    if (!sel) return
    if (tool === 'support' && sel.kind === 'node') {
      setModel((m) => ({
        ...m,
        nodes: m.nodes.map((n) =>
          n.id === sel.id
            ? { ...n, support: n.support === 'pinned' ? 'roller' : n.support === 'roller' ? 'fixed' : n.support === 'fixed' ? undefined : 'pinned' }
            : n,
        ),
      }))
      onToast(`Apoyo actualizado en ${sel.id}`)
      markStale()
      return
    }
    setSelection(sel)
    setMode('model')
    setDetent((d) => (d === 'compact' ? 'medium' : d))
  }

  const markStale = () => {
    if (results) {
      setResults(null)
      setDiagram(null)
      setMode('model')
    }
  }

  /* --- Análisis simulado ---------------------------------------------------- */
  const analyseNow = () => {
    if (running > 0) return
    setSelection(null)
    setRunning(0.02)
    const started = performance.now()
    const tick = () => {
      const p = Math.min(1, (performance.now() - started) / 1150)
      setRunning(p)
      if (p < 1) requestAnimationFrame(tick)
      else {
        const r = analyse(project)
        setResults(r)
        setRunning(0)
        setMode('results')
        setDiagram('moment')
        setDetent('medium')
        onToast('Análisis completado · 4 combinaciones')
      }
    }
    requestAnimationFrame(tick)
  }

  useEffect(() => {
    setHint(TOOL_HINT[tool])
    const t = setTimeout(() => setHint(null), 2600)
    return () => clearTimeout(t)
  }, [tool])

  const sheetOpen = mode === 'results' ? results !== null : selection !== null
  const ctaBottom = (sheetOpen ? sheetH : 0) + 16

  const active = diagram && results ? { kind: diagram, data: results.diagrams[diagram], color: DIAGRAM_META[diagram].color } : null

  if (tables && results) {
    return <ResultsTables results={results} decimals={decimals} onBack={() => setTables(false)} onToast={onToast} />
  }

  return (
    <div className="ws">
      <div className="ws__top">
        <div className="ws__toprow">
          <button className="navbtn" onClick={onClose} aria-label="Cerrar proyecto" style={{ marginInlineStart: -8, paddingInline: 4 }}>
            <ArrowLeft size={23} strokeWidth={2.3} />
          </button>
          <div className="ws__id">
            <div className="ws__name">{project.name}</div>
            <div className="ws__state">
              <i className="dot" style={{ background: results ? STATUS_COLOR.calculated : STATUS_COLOR.draft }} />
              {results ? STATUS_LABEL.calculated : 'Modelando'}
              <span style={{ opacity: 0.5 }}>·</span>
              {model.nodes.length} nudos · {model.members.length} barras
            </div>
          </div>
          <button
            className="navbtn navbtn--glass"
            aria-label="Encuadrar modelo"
            onClick={() => { setView({ scale: 1, tx: 0, ty: 0 }); onToast('Modelo encuadrado') }}
          >
            <Expand size={17} strokeWidth={2.2} />
          </button>
          <button
            className="navbtn navbtn--glass"
            aria-label="Más acciones"
            onClick={() =>
              setMenu([
                { label: 'Renombrar proyecto', icon: <Ruler size={19} strokeWidth={2} />, onPress: () => onToast('Renombrar — no implementado') },
                { label: 'Duplicar', icon: <Layers size={19} strokeWidth={2} />, onPress: () => onToast('Proyecto duplicado') },
                { label: 'Exportar informe PDF', icon: <Share size={19} strokeWidth={2} />, onPress: () => onToast('Informe generado (simulado)') },
                { label: 'Volver a modelar', icon: <Move size={19} strokeWidth={2} />, onPress: () => { setMode('model'); setDiagram(null) } },
                { label: 'Eliminar proyecto', icon: <Trash2 size={19} strokeWidth={2} />, danger: true, onPress: onClose },
              ])
            }
          >
            <MoreHorizontal size={18} strokeWidth={2.3} />
          </button>
        </div>

        {results && (
          <div style={{ paddingBottom: 'var(--s2)' }}>
            <div className="segmented" role="tablist" aria-label="Vista del proyecto">
              <button
                role="tab" className="segmented__item" aria-selected={mode === 'model'}
                onClick={() => { setMode('model'); setDiagram(null) }}
              >
                Modelo
              </button>
              <button
                role="tab" className="segmented__item" aria-selected={mode === 'results'}
                onClick={() => { setMode('results'); setSelection(null); setDiagram((d) => d ?? 'moment'); setDetent('medium') }}
              >
                Resultados
              </button>
            </div>
          </div>
        )}

        {running > 0 && (
          <div className="progress" style={{ marginBottom: 6 }}>
            <div className="progress__bar" style={{ width: `${running * 100}%` }} />
          </div>
        )}
      </div>

      <div className="ws__stage">
        <StructureView
          svgRef={svgRef}
          className="ws__canvas"
          model={model}
          view={view}
          grid={gridOn}
          loads={mode === 'model'}
          labels
          selection={selection}
          diagram={active}
          weight={2.4}
          onPick={pick}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          ariaLabel={`Modelo de ${project.name}`}
        />

        <div className="ws__banner">
          {mode === 'results' && active ? (
            <>
              <i className="dot" style={{ background: DIAGRAM_META[active.kind].color }} />
              <b>{DIAGRAM_META[active.kind].label}</b>
              <span style={{ opacity: 0.7 }}>ELU 1</span>
            </>
          ) : (
            <>
              <Grid3x3 size={13} strokeWidth={2.4} />
              <b>{TOOLS.find((t) => t.id === tool)!.label}</b>
              {hint
                ? <span key={tool} className="ws__hinttext">{hint}</span>
                : <span style={{ opacity: 0.7 }}>{Math.round(view.scale * 100)}%</span>}
            </>
          )}
        </div>

        <div className="ws__zoom">
          <button onClick={() => zoomBy(1.25)} aria-label="Acercar"><Plus size={19} strokeWidth={2.3} /></button>
          <button onClick={() => zoomBy(0.8)} aria-label="Alejar"><Minus size={19} strokeWidth={2.3} /></button>
        </div>

        {/* En resultados no hay CTA flotante: la hoja ya es la acción, y un
            botón encima de ella sólo tapaba el modelo. */}
        {mode === 'model' && (
          <div className="ws__cta" style={{ bottom: ctaBottom }}>
            <button className="fab" style={{ position: 'static' }} onClick={analyseNow} disabled={running > 0}>
              {running > 0 ? <Activity size={20} strokeWidth={2.3} /> : <Zap size={20} strokeWidth={2.3} />}
              {running > 0 ? 'Analizando…' : 'Analizar'}
            </button>
          </div>
        )}

        {mode === 'results' && results && (
          <ResultsSheet
            results={results}
            decimals={decimals}
            detent={detent}
            onDetent={setDetent}
            diagram={diagram}
            onDiagram={setDiagram}
            onHeight={setSheetH}
            onTables={() => setTables(true)}
            onClose={() => { setMode('model'); setDiagram(null) }}
          />
        )}

        {mode === 'model' && selection && (
          <Inspector
            model={model}
            selection={selection}
            detent={detent}
            onDetent={setDetent}
            onHeight={setSheetH}
            onClose={() => setSelection(null)}
            onChange={(next) => { setModel(next); markStale() }}
            onToast={onToast}
          />
        )}
      </div>

      <div className="dock" role="toolbar" aria-label="Herramientas de modelado">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            className="dock__item"
            aria-pressed={tool === t.id}
            onClick={() => {
              if (t.id === 'more') {
                setMenu([
                  { label: 'Acotar', icon: <Ruler size={19} strokeWidth={2} />, onPress: () => onToast('Acotación activada') },
                  { label: 'Articulación', icon: <CircleDot size={19} strokeWidth={2} />, onPress: () => onToast('Articulación activada') },
                  { label: 'Corte', icon: <Scissors size={19} strokeWidth={2} />, onPress: () => onToast('Corte activado') },
                  { label: 'Combinaciones de carga', icon: <Layers size={19} strokeWidth={2} />, onPress: () => onToast('4 combinaciones definidas') },
                  { label: 'Capas y visibilidad', icon: <Grid3x3 size={19} strokeWidth={2} />, onPress: () => onToast('Capas — no implementado') },
                ])
                return
              }
              setTool(t.id)
              if (t.id !== 'select') setSelection(null)
            }}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {menu && <ActionSheet items={menu} onClose={() => setMenu(null)} />}
    </div>
  )
}

/* ========================================================================== */
/* Inspector                                                                   */
/* ========================================================================== */

function Inspector({
  model, selection, detent, onDetent, onHeight, onClose, onChange, onToast,
}: {
  model: StructureModel
  selection: NonNullable<Selection>
  detent: Detent
  onDetent: (d: Detent) => void
  onHeight: (px: number) => void
  onClose: () => void
  onChange: (m: StructureModel) => void
  onToast: (m: string) => void
}) {
  if (selection.kind === 'node') {
    const node = model.nodes.find((n) => n.id === selection.id)
    if (!node) return null
    const loads = model.loads.filter(
      (l): l is PointLoad | MomentLoad => l.kind !== 'dist' && l.node === node.id,
    )
    const move = (axis: 'x' | 'y', delta: number) =>
      onChange({ ...model, nodes: model.nodes.map((n) => (n.id === node.id ? { ...n, [axis]: Math.round((n[axis] + delta) * 10) / 10 } : n)) })

    return (
      <Sheet
        detent={detent} onDetent={onDetent} onHeight={onHeight} onClose={onClose}
        title={`Nudo ${node.id}`}
        subtitle={`x ${fmt(node.x)} m · y ${fmt(node.y)} m${node.support ? ` · ${supportName(node.support)}` : ''}`}
      >
        <div className="kv">
          <Cell k="COORDENADA X" v={`${fmt(node.x, 2)}`} unit="m" />
          <Cell k="COORDENADA Y" v={`${fmt(node.y, 2)}`} unit="m" />
          <Cell k="APOYO" v={node.support ? supportName(node.support) : 'Libre'} />
          <Cell k="BARRAS" v={String(model.members.filter((m) => m.from === node.id || m.to === node.id).length)} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s2)' }}>
          <div className="group__label" style={{ padding: 0 }}>POSICIÓN</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--s2)' }}>
            <div className="stepper">
              <button onClick={() => move('x', -0.5)} aria-label="Reducir X"><Minus size={17} strokeWidth={2.6} /></button>
              <span className="stepper__val">{fmt(node.x)} m</span>
              <button onClick={() => move('x', 0.5)} aria-label="Aumentar X"><Plus size={17} strokeWidth={2.6} /></button>
            </div>
            <div className="stepper">
              <button onClick={() => move('y', -0.5)} aria-label="Reducir Y"><Minus size={17} strokeWidth={2.6} /></button>
              <span className="stepper__val">{fmt(node.y)} m</span>
              <button onClick={() => move('y', 0.5)} aria-label="Aumentar Y"><Plus size={17} strokeWidth={2.6} /></button>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s2)' }}>
          <div className="group__label" style={{ padding: 0 }}>APOYO</div>
          <div className="segmented" role="tablist" aria-label="Tipo de apoyo">
            {(['none', 'pinned', 'roller', 'fixed'] as const).map((s) => (
              <button
                key={s}
                role="tab"
                className="segmented__item"
                aria-selected={(node.support ?? 'none') === s}
                onClick={() =>
                  onChange({
                    ...model,
                    nodes: model.nodes.map((n) => (n.id === node.id ? { ...n, support: s === 'none' ? undefined : s } : n)),
                  })
                }
              >
                {s === 'none' ? 'Libre' : supportName(s)}
              </button>
            ))}
          </div>
        </div>

        {loads.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s2)' }}>
            <div className="group__label" style={{ padding: 0 }}>CARGAS EN EL NUDO</div>
            <div className="group">
              {loads.map((l) => (
                <div className="row" key={l.id}>
                  <span className="row__icon" style={{ color: 'var(--load)' }}><Weight size={16} strokeWidth={2.2} /></span>
                  <span className="row__body">
                    <span className="row__title">{l.kind === 'point' ? 'Carga puntual' : 'Momento aplicado'}</span>
                    <span className="row__sub">{l.kind === 'point' ? `${fmt(Math.abs(l.fy))} kN ↓` : `${fmt(l.mz)} kN·m`}</span>
                  </span>
                  <ChevronRight size={18} strokeWidth={2.2} className="row__chev" />
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="actions">
          <button className="action" onClick={() => onToast('Modo mover activado')}><Move size={19} strokeWidth={2} />Mover</button>
          <button className="action" onClick={() => onToast('Añadir carga en ' + node.id)}><Weight size={19} strokeWidth={2} />Carga</button>
          <button className="action" onClick={() => onToast('Articulación en ' + node.id)}><CircleDot size={19} strokeWidth={2} />Articular</button>
          <button
            className="action action--danger"
            onClick={() => {
              onChange({
                nodes: model.nodes.filter((n) => n.id !== node.id),
                members: model.members.filter((m) => m.from !== node.id && m.to !== node.id),
                loads: model.loads.filter((l) => !('node' in l) || l.node !== node.id),
              })
              onToast(`Nudo ${node.id} eliminado`)
              onClose()
            }}
          >
            <Trash2 size={19} strokeWidth={2} />Eliminar
          </button>
        </div>
      </Sheet>
    )
  }

  const member = model.members.find((m) => m.id === selection.id)
  if (!member) return null
  const a = model.nodes.find((n) => n.id === member.from)!
  const b = model.nodes.find((n) => n.id === member.to)!
  const len = Math.hypot(b.x - a.x, b.y - a.y)
  const angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI
  const loads = model.loads.filter((l): l is DistLoad => l.kind === 'dist' && l.member === member.id)

  return (
    <Sheet
      detent={detent} onDetent={onDetent} onHeight={onHeight} onClose={onClose}
      title={`Barra ${member.id}`}
      subtitle={`${member.from} → ${member.to} · ${fmt(len, 2)} m · ${member.section}`}
    >
      <div className="kv">
        <Cell k="LONGITUD" v={fmt(len, 2)} unit="m" />
        <Cell k="INCLINACIÓN" v={fmt(angle, 1)} unit="°" />
        <Cell k="SECCIÓN" v={member.section} />
        <Cell k="MATERIAL" v={member.material} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s2)' }}>
        <div className="group__label" style={{ padding: 0 }}>SECCIÓN</div>
        <div className="group">
          {['IPE 200', 'IPE 240', 'HEB 300'].map((s) => (
            <button
              key={s}
              className="row"
              onClick={() =>
                onChange({ ...model, members: model.members.map((m) => (m.id === member.id ? { ...m, section: s } : m)) })
              }
            >
              <span className="row__icon"><Spline size={16} strokeWidth={2.2} /></span>
              <span className="row__body"><span className="row__title">{s}</span></span>
              {member.section === s && <Check size={19} strokeWidth={2.6} style={{ color: 'var(--accent)' }} />}
            </button>
          ))}
        </div>
      </div>

      {loads.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s2)' }}>
          <div className="group__label" style={{ padding: 0 }}>CARGAS EN LA BARRA</div>
          <div className="group">
            {loads.map((l) => (
              <div className="row" key={l.id}>
                <span className="row__icon" style={{ color: 'var(--distributed)' }}><Waves size={16} strokeWidth={2.2} /></span>
                <span className="row__body">
                  <span className="row__title">Carga repartida</span>
                  <span className="row__sub">{'q' in l ? `${fmt(l.q)} kN/m` : ''} · uniforme</span>
                </span>
                <ChevronRight size={18} strokeWidth={2.2} className="row__chev" />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="actions">
        <button className="action" onClick={() => onToast('Añadir carga en ' + member.id)}><Weight size={19} strokeWidth={2} />Carga</button>
        <button className="action" onClick={() => onToast('Extremo articulado')}><MinusCircle size={19} strokeWidth={2} />Articular</button>
        <button className="action" onClick={() => onToast('Barra dividida en 2')}><Scissors size={19} strokeWidth={2} />Dividir</button>
        <button
          className="action action--danger"
          onClick={() => {
            onChange({ ...model, members: model.members.filter((m) => m.id !== member.id) })
            onToast(`Barra ${member.id} eliminada`)
            onClose()
          }}
        >
          <Trash2 size={19} strokeWidth={2} />Eliminar
        </button>
      </div>
    </Sheet>
  )
}

function Cell({ k, v, unit }: { k: string; v: string; unit?: string }) {
  return (
    <div className="kv__cell">
      <span className="kv__k">{k}</span>
      <span className="kv__v">{v}{unit && <small> {unit}</small>}</span>
    </div>
  )
}

function supportName(s: 'pinned' | 'roller' | 'fixed') {
  return s === 'pinned' ? 'Fijo' : s === 'roller' ? 'Móvil' : 'Empotrado'
}

/* ========================================================================== */
/* Resultados: resumen primero, detalle después                                */
/* ========================================================================== */

function ResultsSheet({
  results, decimals, detent, onDetent, diagram, onDiagram, onHeight, onTables, onClose,
}: {
  results: AnalysisResults
  decimals: number
  detent: Detent
  onDetent: (d: Detent) => void
  diagram: DiagramKind | null
  onDiagram: (d: DiagramKind | null) => void
  onHeight: (px: number) => void
  onTables: () => void
  onClose: () => void
}) {
  const pct = Math.round(results.utilisation * 100)
  return (
    <Sheet
      detent={detent} onDetent={onDetent} onHeight={onHeight} onClose={onClose}
      title="Resultados"
      subtitle={`Combinación ELU 1 · ${results.ran}`}
    >
      <div className="verdict">
        <span className="verdict__icon"><Check size={20} strokeWidth={3} /></span>
        <span style={{ flex: '1 1 auto', minWidth: 0 }}>
          <span className="verdict__t">Estructura verificada</span>
          <span className="verdict__s">Aprovechamiento máximo {pct}% · sin barras fuera de norma</span>
        </span>
      </div>

      <div className="metrics">
        <Metric kind="moment" value={results.maxMoment.value} where={results.maxMoment.where} d={decimals} />
        <Metric kind="shear" value={results.maxShear.value} where={results.maxShear.where} d={decimals} />
        <Metric kind="axial" value={results.maxAxial.value} where={results.maxAxial.where} d={decimals} />
        <Metric kind="deformed" value={results.maxDisp.value} where={results.maxDisp.where} d={decimals} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s2)' }}>
        <div className="group__label" style={{ padding: 0 }}>DIAGRAMA SOBRE EL MODELO</div>
        <div className="diagrams" role="group" aria-label="Diagrama visible">
          {(Object.keys(DIAGRAM_META) as DiagramKind[]).map((k) => (
            <button
              key={k}
              className="diagram"
              aria-pressed={diagram === k}
              onClick={() => onDiagram(diagram === k ? null : k)}
            >
              <i className="dot" style={{ background: DIAGRAM_META[k].color }} />
              {DIAGRAM_META[k].label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s2)' }}>
        <div className="group__label" style={{ padding: 0 }}>REACCIONES EN APOYOS</div>
        <div className="group">
          {results.reactions.map((r) => (
            <div className="row" key={r.node}>
              <span className="row__icon" style={{ color: 'var(--reaction)' }}><TrendingUp size={16} strokeWidth={2.2} /></span>
              <span className="row__body">
                <span className="row__title">Nudo {r.node}</span>
                <span className="row__sub" style={{ fontFamily: 'var(--font-mono)' }}>
                  Fx {fmt(r.fx, decimals)} · Fy {fmt(r.fy, decimals)} kN{r.mz !== null ? ` · Mz ${fmt(r.mz, decimals)}` : ''}
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>

      <button className="btn btn--secondary btn--block" onClick={onTables}>
        <Table2 size={19} strokeWidth={2.1} />
        Ver tablas completas
      </button>
    </Sheet>
  )
}

function Metric({ kind, value, where, d }: { kind: DiagramKind; value: number; where: string; d: number }) {
  const meta = DIAGRAM_META[kind]
  return (
    <div className="metric" style={{ ['--metric-color' as string]: meta.color }}>
      <span className="metric__k">
        <i className="dot" style={{ background: meta.color }} />
        {meta.short} máx
      </span>
      <span className="metric__v">
        {fmt(Math.abs(value), d)}<small>{meta.unit}</small>
      </span>
      <span className="metric__where">en {where}</span>
    </div>
  )
}

/* ========================================================================== */
/* Tablas completas — pantalla dedicada                                        */
/* ========================================================================== */

type TableTab = 'reactions' | 'forces' | 'displacements'

function ResultsTables({
  results, decimals, onBack, onToast,
}: { results: AnalysisResults; decimals: number; onBack: () => void; onToast: (m: string) => void }) {
  const [tab, setTab] = useState<TableTab>('forces')

  return (
    <div className="layer">
      <div className="navbar navbar--stuck">
        <div className="navbar__row">
          <div className="navbar__lead">
            <button className="navbtn navbtn--back" onClick={onBack} aria-label="Volver al proyecto">
              <ArrowLeft size={22} strokeWidth={2.3} />
              <span>Proyecto</span>
            </button>
          </div>
          <div className="navbar__center" style={{ opacity: 1, transform: 'none' }}>Resultados</div>
          <div className="navbar__trail">
            <button className="navbtn navbtn--glass" aria-label="Exportar" onClick={() => onToast('Exportado a CSV (simulado)')}>
              <Share size={17} strokeWidth={2.2} />
            </button>
          </div>
        </div>
        <div style={{ paddingBottom: 'var(--s3)' }}>
          <div className="segmented" role="tablist" aria-label="Tabla de resultados">
            {([['forces', 'Esfuerzos'], ['reactions', 'Reacciones'], ['displacements', 'Desplazam.']] as const).map(([id, label]) => (
              <button key={id} role="tab" className="segmented__item" aria-selected={tab === id} onClick={() => setTab(id)}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="scroll">
        <div className="page" style={{ paddingTop: 'var(--s4)' }}>
          <div className="note">
            <Check size={17} strokeWidth={2.2} />
            <span>Combinación <b>ELU 1</b> · valores máximos por elemento. Desliza la tabla horizontalmente para ver todas las columnas.</span>
          </div>

          <div className="table__wrap">
            {tab === 'forces' && (
              <table className="table">
                <thead>
                  <tr><th>Barra</th><th>N (kN)</th><th>V (kN)</th><th>M (kN·m)</th><th>Aprov.</th></tr>
                </thead>
                <tbody>
                  {results.memberForces.map((m) => (
                    <tr key={m.member}>
                      <td>{m.member}</td>
                      <td>{fmt(m.n, decimals)}</td>
                      <td>{fmt(m.v, decimals)}</td>
                      <td>{fmt(m.m, decimals)}</td>
                      <td style={{ color: m.ratio > 0.85 ? 'var(--warning)' : 'var(--success)' }}>{Math.round(m.ratio * 100)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {tab === 'reactions' && (
              <table className="table">
                <thead>
                  <tr><th>Nudo</th><th>Fx (kN)</th><th>Fy (kN)</th><th>Mz (kN·m)</th></tr>
                </thead>
                <tbody>
                  {results.reactions.map((r) => (
                    <tr key={r.node}>
                      <td>{r.node}</td>
                      <td>{fmt(r.fx, decimals)}</td>
                      <td>{fmt(r.fy, decimals)}</td>
                      <td>{r.mz === null ? '—' : fmt(r.mz, decimals)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {tab === 'displacements' && (
              <table className="table">
                <thead>
                  <tr><th>Nudo</th><th>dx (mm)</th><th>dy (mm)</th><th>rz (mrad)</th></tr>
                </thead>
                <tbody>
                  {results.displacements.map((d) => (
                    <tr key={d.node}>
                      <td>{d.node}</td>
                      <td>{fmt(d.dx, 2)}</td>
                      <td>{fmt(d.dy, 2)}</td>
                      <td>{fmt(d.rz, 3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="metrics">
            <Metric kind="moment" value={results.maxMoment.value} where={results.maxMoment.where} d={decimals} />
            <Metric kind="shear" value={results.maxShear.value} where={results.maxShear.where} d={decimals} />
          </div>

          <button className="btn btn--secondary btn--block" onClick={() => onToast('Informe PDF generado (simulado)')}>
            <Share size={19} strokeWidth={2.1} />
            Exportar informe
          </button>
        </div>
      </div>
    </div>
  )
}
