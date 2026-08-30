/*
 * Chrome de la app: marca, barra de navegación con título grande colapsable,
 * tab bar, action sheet y toast. Todo lo que en iOS te da el sistema y aquí
 * hay que fabricar para que la pantalla no se sienta una página web.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronLeft } from 'lucide-react'

/* --- Marca ---------------------------------------------------------------- */
export function BrandMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 1254 1254"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <g transform="translate(0,1254) scale(0.1,-0.1)" fill="currentColor" stroke="none">
        <path d="M6084 10541 c-45 -15 -112 -45 -150 -66 -110 -61 -840 -489 -1449 -850 -308 -182 -747 -442 -975 -577 -737 -436 -703 -413 -777 -520 -79 -113 -85 -139 -95 -433 -13 -365 -3 -3561 11 -3642 13 -79 69 -191 124 -250 41 -44 176 -138 292 -203 67 -37 812 -469 1320 -765 344 -200 1028 -596 1413 -816 280 -161 305 -170 448 -177 124 -5 183 7 288 60 91 46 854 485 2106 1211 765 443 997 582 1062 634 91 73 167 198 191 311 17 82 17 3788 -1 3882 -19 103 -74 204 -156 285 -59 58 -112 94 -306 207 -129 75 -397 232 -595 349 -198 116 -578 338 -845 492 -267 154 -685 397 -930 540 -245 143 -481 277 -525 298 -100 46 -161 59 -278 59 -75 0 -107 -6 -173 -29z m270 -1641 c54 -8 94 -23 175 -67 277 -147 1869 -1074 1934 -1125 44 -35 48 -69 13 -101 -14 -12 -124 -77 -246 -145 -239 -133 -293 -153 -365 -134 -22 7 -170 89 -330 183 -688 406 -1063 624 -1115 648 -47 22 -69 26 -150 26 -96 0 -96 0 -196 -51 -129 -66 -965 -551 -1059 -614 -134 -90 -160 -161 -160 -425 1 -170 1 -171 32 -235 17 -36 40 -75 50 -86 33 -39 133 -98 813 -487 862 -492 1045 -598 1070 -619 25 -22 26 -69 3 -90 -22 -19 -305 -183 -416 -241 -74 -38 -89 -42 -152 -42 l-71 0 -314 181 c-173 99 -557 319 -852 489 -295 169 -568 331 -605 359 -75 56 -122 124 -151 216 -15 49 -17 112 -17 565 0 454 2 516 17 565 25 80 88 172 150 218 29 22 253 157 498 300 245 142 580 339 745 437 510 301 511 302 699 275z m76 -1499 c105 -59 791 -457 1110 -644 366 -214 549 -328 600 -373 65 -60 109 -149 121 -246 11 -101 11 -884 -1 -986 -15 -133 -65 -225 -163 -300 -29 -22 -209 -131 -402 -243 -192 -111 -492 -286 -665 -388 -614 -361 -645 -375 -790 -369 -119 4 -133 11 -880 445 -124 72 -461 264 -750 428 -289 163 -537 309 -552 323 -40 37 -36 65 15 100 70 48 382 230 439 257 35 16 71 25 105 25 49 0 71 -12 485 -249 238 -136 496 -285 573 -331 454 -270 481 -283 585 -283 53 0 90 6 127 21 29 12 185 98 345 190 161 93 347 200 413 237 193 109 367 221 414 266 24 23 54 65 67 93 23 48 24 62 24 250 0 126 -4 214 -12 240 -21 71 -121 160 -283 251 -77 43 -291 166 -475 273 -184 107 -522 303 -750 434 -228 132 -423 247 -432 255 -25 23 -23 70 5 94 22 20 298 181 432 253 64 34 76 37 135 34 57 -3 77 -10 160 -57z" />
      </g>
    </svg>
  )
}

export function Wordmark({ size = 26 }: { size?: number }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
      <BrandMark size={size} className="brand-mark" />
      <span
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: size * 0.78,
          fontWeight: 720,
          letterSpacing: '-0.03em',
        }}
      >
        Structure<span style={{ color: 'var(--accent)' }}>Co</span>
      </span>
    </span>
  )
}

/* --- Avatar --------------------------------------------------------------- */
export function Avatar({ initials, small, ping }: { initials: string; small?: boolean; ping?: boolean }) {
  return (
    <span className={small ? 'avatar avatar--sm' : 'avatar'} aria-hidden="true">
      {initials}
      {ping && <i className="avatar__ping" />}
    </span>
  )
}

/* --- Pantalla con nav bar -------------------------------------------------- */
interface ScreenProps {
  title: string
  largeTitle?: boolean
  back?: { label: string; onPress: () => void }
  lead?: ReactNode
  trail?: ReactNode
  children: ReactNode
  footer?: ReactNode
  scrollRef?: React.Ref<HTMLDivElement>
}

export function Screen({ title, largeTitle = true, back, lead, trail, children, footer, scrollRef }: ScreenProps) {
  const [stuck, setStuck] = useState(!largeTitle)
  const innerRef = useRef<HTMLDivElement | null>(null)

  return (
    <>
      <div className={stuck ? 'navbar navbar--stuck' : 'navbar'}>
        <div className="navbar__row">
          <div className="navbar__lead">
            {back && (
              <button className="navbtn navbtn--back" onClick={back.onPress} aria-label={`Volver a ${back.label}`}>
                <ChevronLeft size={26} strokeWidth={2.4} />
                <span>{back.label}</span>
              </button>
            )}
            {lead}
          </div>
          <div className="navbar__center">{title}</div>
          <div className="navbar__trail">{trail}</div>
        </div>
        {largeTitle && <h1 className="navbar__large">{title}</h1>}
      </div>
      <div
        className="scroll"
        ref={(el) => {
          innerRef.current = el
          if (typeof scrollRef === 'function') scrollRef(el)
          else if (scrollRef) (scrollRef as React.RefObject<HTMLDivElement | null>).current = el
        }}
        onScroll={(e) => {
          if (!largeTitle) return
          const next = e.currentTarget.scrollTop > 12
          setStuck((prev) => (prev === next ? prev : next))
        }}
      >
        {children}
      </div>
      {footer}
    </>
  )
}

/* --- Tab bar --------------------------------------------------------------- */
export interface TabDef { id: string; label: string; icon: ReactNode }

export function TabBar({ tabs, active, onSelect }: { tabs: TabDef[]; active: string; onSelect: (id: string) => void }) {
  return (
    <nav className="tabbar" role="tablist" aria-label="Secciones">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          className="tabbar__item"
          aria-selected={active === t.id}
          onClick={() => onSelect(t.id)}
        >
          <span className="tabbar__glyph">{t.icon}</span>
          {t.label}
        </button>
      ))}
    </nav>
  )
}

/* --- Action sheet ---------------------------------------------------------- */
export interface ActionItem { label: string; icon?: ReactNode; danger?: boolean; onPress: () => void }

export function ActionSheet({
  title, items, onClose,
}: { title?: string; items: ActionItem[]; onClose: () => void }) {
  return (
    <div className="popup" role="dialog" aria-modal="true" aria-label={title ?? 'Acciones'}>
      <div className="dim anim-fade-in" onClick={onClose} />
      <div style={{ position: 'relative', zIndex: 2 }}>
        <div className="popup__panel">
          {title && <div className="popup__title">{title}</div>}
          {items.map((it) => (
            <button
              key={it.label}
              className={it.danger ? 'popup__item popup__item--danger' : 'popup__item'}
              onClick={() => { it.onPress(); onClose() }}
            >
              {it.icon}
              {it.label}
            </button>
          ))}
        </div>
        <button className="popup__cancel" onClick={onClose}>Cancelar</button>
      </div>
    </div>
  )
}

/* --- Toast ----------------------------------------------------------------- */
export function Toast({ message, icon, onDone }: { message: string; icon?: ReactNode; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2400)
    return () => clearTimeout(t)
  }, [message, onDone])
  return (
    <div className="toast" role="status">
      {icon}
      {message}
    </div>
  )
}
