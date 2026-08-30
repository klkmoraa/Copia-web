/*
 * Bottom sheet con tres topes (compact / medium / expanded), como el
 * UISheetPresentationController de iOS. Se arrastra desde el asa o desde la
 * cabecera; el cuerpo sólo desplaza cuando la hoja está en medium o expanded,
 * para que un gesto hacia abajo dentro de una lista no compita con el gesto
 * que cierra la hoja.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { X } from 'lucide-react'

export type Detent = 'compact' | 'medium' | 'expanded'

const FRACTION: Record<Detent, number> = { compact: 0.17, medium: 0.46, expanded: 0.92 }
const ORDER: Detent[] = ['compact', 'medium', 'expanded']

interface Props {
  detent: Detent
  onDetent: (d: Detent) => void
  title: ReactNode
  subtitle?: ReactNode
  onClose?: () => void
  trail?: ReactNode
  children: ReactNode
  /** Altura visible actual en px — la usa el workspace para no tapar el CTA. */
  onHeight?: (px: number) => void
  /** Topes disponibles; por defecto los tres. */
  allowed?: Detent[]
}

export function Sheet({ detent, onDetent, title, subtitle, onClose, trail, children, onHeight, allowed = ORDER }: Props) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [stage, setStage] = useState(0)
  const [drag, setDrag] = useState<number | null>(null)
  const start = useRef({ y: 0, base: 0 })
  /* Un arrastre termina en `click` (el navegador lo emite sobre el ancestro
     común de pointerdown/pointerup, y con captura ese ancestro es el asa).
     Sin esta marca, soltar la hoja arriba la mandaba de vuelta a compact:
     el snap la expandía y el click posterior la seguía ciclando. */
  const moved = useRef(false)

  useLayoutEffect(() => {
    const el = ref.current
    const parent = el?.parentElement
    if (!parent) return
    const measure = () => setStage(parent.clientHeight)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(parent)
    return () => ro.disconnect()
  }, [])

  const maxH = stage * FRACTION.expanded
  const heightOf = useCallback((d: Detent) => stage * FRACTION[d], [stage])
  const offsetOf = useCallback((d: Detent) => maxH - heightOf(d), [maxH, heightOf])

  useEffect(() => {
    if (stage > 0 && onHeight) onHeight(heightOf(detent))
  }, [detent, stage, heightOf, onHeight])

  const beginDrag = (e: React.PointerEvent) => {
    if (stage === 0) return
    // Un control dentro de la cabecera (cerrar, acciones) manda sobre el gesto.
    if ((e.target as HTMLElement).closest('button')) return
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    moved.current = false
    start.current = { y: e.clientY, base: offsetOf(detent) }
    setDrag(offsetOf(detent))
  }

  const moveDrag = (e: React.PointerEvent) => {
    if (drag === null) return
    if (Math.abs(e.clientY - start.current.y) > 6) moved.current = true
    const raw = start.current.base + (e.clientY - start.current.y)
    const min = offsetOf(allowed[allowed.length - 1])
    const max = offsetOf(allowed[0])
    // Resistencia elástica fuera del rango, como en iOS.
    const clamped = raw < min ? min + (raw - min) * 0.32 : raw > max ? max + (raw - max) * 0.32 : raw
    setDrag(clamped)
  }

  const endDrag = () => {
    if (drag === null) return
    const target = allowed.reduce((best, d) =>
      Math.abs(offsetOf(d) - drag) < Math.abs(offsetOf(best) - drag) ? d : best, allowed[0])
    setDrag(null)
    if (target !== detent) onDetent(target)
  }

  const offset = drag ?? offsetOf(detent)
  const scrollable = detent !== 'compact' && drag === null

  return (
    <div
      ref={ref}
      className={drag === null ? 'sheet sheet--animate' : 'sheet'}
      style={{ height: maxH || undefined, transform: `translate3d(0, ${offset}px, 0)` }}
      role="dialog"
      aria-modal="false"
    >
      <div
        className="sheet__grip"
        onPointerDown={beginDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClick={() => {
          if (moved.current) {
            moved.current = false
            return
          }
          const i = allowed.indexOf(detent)
          onDetent(allowed[(i + 1) % allowed.length])
        }}
        role="button"
        tabIndex={0}
        aria-label="Ajustar tamaño del panel"
        onKeyDown={(e) => {
          const i = allowed.indexOf(detent)
          if (e.key === 'ArrowUp' && i < allowed.length - 1) onDetent(allowed[i + 1])
          if (e.key === 'ArrowDown' && i > 0) onDetent(allowed[i - 1])
        }}
      />
      <div className="sheet__head" onPointerDown={beginDrag} onPointerMove={moveDrag} onPointerUp={endDrag}>
        <div style={{ flex: '1 1 auto', minWidth: 0 }}>
          <div className="sheet__title">{title}</div>
          {subtitle && <div style={{ fontSize: 'var(--t-caption)', color: 'var(--text-3)', marginTop: 2 }}>{subtitle}</div>}
        </div>
        {trail}
        {onClose && (
          <button className="sheet__close" onClick={onClose} aria-label="Cerrar panel">
            <X size={17} strokeWidth={2.6} />
          </button>
        )}
      </div>
      <div className={scrollable ? 'sheet__body' : 'sheet__body sheet__body--locked'}>{children}</div>
    </div>
  )
}
