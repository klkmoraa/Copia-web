import {
  BadgeCheck, Bell, ChevronRight, CircleHelp, Cloud, Fingerprint, Grid3x3, Info,
  KeyRound, LogOut, Moon, Ruler, Smartphone, Star, Sun, SunMoon, Trash2, UserRound,
} from 'lucide-react'
import { Avatar, BrandMark, Screen } from '../components/Chrome'
import { USER } from '../lib/model'

export type ThemeMode = 'light' | 'dark' | 'system'

export interface Prefs {
  theme: ThemeMode
  grid: boolean
  sync: boolean
  haptics: boolean
  units: 'metric' | 'imperial'
  decimals: number
  notifications: boolean
}

interface Props {
  prefs: Prefs
  setPrefs: (p: Partial<Prefs>) => void
  onPush: (route: string) => void
  onLogout: () => void
}

const THEMES: { id: ThemeMode; label: string; icon: React.ReactNode }[] = [
  { id: 'light', label: 'Claro', icon: <Sun size={15} strokeWidth={2.2} /> },
  { id: 'dark', label: 'Oscuro', icon: <Moon size={15} strokeWidth={2.2} /> },
  { id: 'system', label: 'Sistema', icon: <SunMoon size={15} strokeWidth={2.2} /> },
]

export function Account({ prefs, setPrefs, onPush, onLogout }: Props) {
  return (
    <Screen
      title="Cuenta"
      trail={
        <button className="navbtn navbtn--glass" onClick={() => onPush('account.about')} aria-label="Acerca de la app">
          <Info size={18} strokeWidth={2.1} />
        </button>
      }
    >
      <div className="page">
        <button className="card pressable" onClick={() => onPush('account.profile')} style={{ padding: 'var(--s4)', display: 'flex', alignItems: 'center', gap: 'var(--s4)', textAlign: 'start' }}>
          <Avatar initials={USER.initials} ping />
          <span style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ fontSize: 'var(--t-title3)', fontWeight: 700, letterSpacing: '-0.022em', fontFamily: 'var(--font-display)' }}>
              {USER.name}
            </span>
            <span style={{ fontSize: 'var(--t-footnote)', color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {USER.email}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
              <span className="chip chip--accent"><BadgeCheck size={13} strokeWidth={2.4} />{USER.plan}</span>
              <span style={{ fontSize: 'var(--t-caption2)', color: 'var(--text-3)', whiteSpace: 'nowrap' }}>
                Desde abr. 2024
              </span>
            </span>
          </span>
          <ChevronRight size={20} strokeWidth={2.2} className="row__chev" />
        </button>

        <section className="section">
          <div className="group__label">APARIENCIA</div>
          <div className="group" style={{ padding: 'var(--s3)' }}>
            <div className="segmented" role="tablist" aria-label="Tema de la app">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  role="tab"
                  className="segmented__item"
                  aria-selected={prefs.theme === t.id}
                  onClick={() => setPrefs({ theme: t.id })}
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                >
                  {t.icon}
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="section">
          <div className="group__label">PREFERENCIAS</div>
          <div className="group">
            <button className="row" onClick={() => onPush('account.units')}>
              <span className="row__icon row__icon--accent"><Ruler size={17} strokeWidth={2.1} /></span>
              <span className="row__body">
                <span className="row__title">Unidades y formato</span>
                <span className="row__sub">Sistema, precisión y decimales</span>
              </span>
              <span className="row__value">{prefs.units === 'metric' ? 'kN, m' : 'kip, ft'}</span>
              <ChevronRight size={19} strokeWidth={2.2} className="row__chev" />
            </button>

            <div className="row">
              <span className="row__icon"><Grid3x3 size={17} strokeWidth={2.1} /></span>
              <span className="row__body">
                <span className="row__title">Cuadrícula de trabajo</span>
                <span className="row__sub">Retícula y ajuste magnético</span>
              </span>
              <Toggle on={prefs.grid} onChange={(v) => setPrefs({ grid: v })} label="Cuadrícula de trabajo" />
            </div>

            <div className="row">
              <span className="row__icon"><Cloud size={17} strokeWidth={2.1} /></span>
              <span className="row__body">
                <span className="row__title">Sincronización</span>
                <span className="row__sub">Respalda y sincroniza tus proyectos</span>
              </span>
              <Toggle on={prefs.sync} onChange={(v) => setPrefs({ sync: v })} label="Sincronización" />
            </div>

            <div className="row">
              <span className="row__icon"><Bell size={17} strokeWidth={2.1} /></span>
              <span className="row__body">
                <span className="row__title">Notificaciones</span>
                <span className="row__sub">Avisos de cálculo terminado</span>
              </span>
              <Toggle on={prefs.notifications} onChange={(v) => setPrefs({ notifications: v })} label="Notificaciones" />
            </div>
          </div>
        </section>

        <section className="section">
          <div className="group__label">CUENTA</div>
          <div className="group">
            <button className="row" onClick={() => onPush('account.security')}>
              <span className="row__icon"><KeyRound size={17} strokeWidth={2.1} /></span>
              <span className="row__body">
                <span className="row__title">Seguridad</span>
                <span className="row__sub">Contraseña, Face ID y sesiones</span>
              </span>
              <ChevronRight size={19} strokeWidth={2.2} className="row__chev" />
            </button>
            <button className="row" onClick={() => onPush('account.security')}>
              <span className="row__icon"><Smartphone size={17} strokeWidth={2.1} /></span>
              <span className="row__body">
                <span className="row__title">Dispositivos</span>
                <span className="row__sub">Administra tus sesiones activas</span>
              </span>
              <span className="row__value">2 activos</span>
              <ChevronRight size={19} strokeWidth={2.2} className="row__chev" />
            </button>
          </div>
        </section>

        <section className="section">
          <div className="group__label">ACERCA DE STRUCTURECO</div>
          <div className="group">
            <button className="row" onClick={() => onPush('account.about')}>
              <span className="row__icon"><Info size={17} strokeWidth={2.1} /></span>
              <span className="row__body">
                <span className="row__title">Acerca de la app</span>
                <span className="row__sub">Versión 0.8.2 · Prototipo iOS</span>
              </span>
              <ChevronRight size={19} strokeWidth={2.2} className="row__chev" />
            </button>
            <button className="row" onClick={() => onPush('account.about')}>
              <span className="row__icon"><CircleHelp size={17} strokeWidth={2.1} /></span>
              <span className="row__body"><span className="row__title">Centro de ayuda</span></span>
              <ChevronRight size={19} strokeWidth={2.2} className="row__chev" />
            </button>
            <button className="row" onClick={() => onPush('account.about')}>
              <span className="row__icon"><Star size={17} strokeWidth={2.1} /></span>
              <span className="row__body"><span className="row__title">Calificar StructureCo</span></span>
              <ChevronRight size={19} strokeWidth={2.2} className="row__chev" />
            </button>
          </div>
        </section>

        <button className="btn btn--secondary btn--block btn--danger" onClick={onLogout}>
          <LogOut size={19} strokeWidth={2.1} />
          Cerrar sesión
        </button>
      </div>
    </Screen>
  )
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      className="switch"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
    />
  )
}

/* --- Subpantallas ---------------------------------------------------------- */

export function ProfileScreen({ onBack }: { onBack: () => void }) {
  return (
    <Screen title="Perfil" back={{ label: 'Cuenta', onPress: onBack }}>
      <div className="page">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--s3)', paddingTop: 'var(--s2)' }}>
          <div style={{ transform: 'scale(1.5)', margin: 'var(--s4) 0' }}>
            <Avatar initials={USER.initials} />
          </div>
          <button className="btn btn--ghost">Cambiar foto</button>
        </div>

        <div className="group">
          <div className="row">
            <span className="row__body"><span className="row__title">Nombre</span></span>
            <span className="row__value">{USER.name}</span>
          </div>
          <div className="row">
            <span className="row__body"><span className="row__title">Correo</span></span>
            <span className="row__value" style={{ maxWidth: '60%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {USER.email}
            </span>
          </div>
          <div className="row">
            <span className="row__body"><span className="row__title">Rol</span></span>
            <span className="row__value">Ingeniero estructural</span>
          </div>
          <div className="row">
            <span className="row__body"><span className="row__title">Organización</span></span>
            <span className="row__value">StructureCo</span>
          </div>
        </div>

        <div className="group">
          <div className="row">
            <span className="row__icon row__icon--accent"><BadgeCheck size={17} strokeWidth={2.1} /></span>
            <span className="row__body">
              <span className="row__title">{USER.plan}</span>
              <span className="row__sub">Renovación el 12 de abril de 2027</span>
            </span>
          </div>
          <button className="row">
            <span className="row__icon"><UserRound size={17} strokeWidth={2.1} /></span>
            <span className="row__body"><span className="row__title">Gestionar suscripción</span></span>
            <ChevronRight size={19} strokeWidth={2.2} className="row__chev" />
          </button>
        </div>

        <button className="btn btn--secondary btn--block btn--danger">
          <Trash2 size={19} strokeWidth={2.1} />
          Eliminar cuenta
        </button>
      </div>
    </Screen>
  )
}

export function UnitsScreen({ prefs, setPrefs, onBack }: { prefs: Prefs; setPrefs: (p: Partial<Prefs>) => void; onBack: () => void }) {
  return (
    <Screen title="Unidades" back={{ label: 'Cuenta', onPress: onBack }}>
      <div className="page">
        <section className="section">
          <div className="group__label">SISTEMA</div>
          <div className="group">
            <button className="row" onClick={() => setPrefs({ units: 'metric' })}>
              <span className="row__body">
                <span className="row__title">Métrico</span>
                <span className="row__sub">m · kN · kN·m · MPa</span>
              </span>
              {prefs.units === 'metric' && <BadgeCheck size={20} strokeWidth={2.2} style={{ color: 'var(--accent)' }} />}
            </button>
            <button className="row" onClick={() => setPrefs({ units: 'imperial' })}>
              <span className="row__body">
                <span className="row__title">Imperial</span>
                <span className="row__sub">ft · kip · kip·ft · ksi</span>
              </span>
              {prefs.units === 'imperial' && <BadgeCheck size={20} strokeWidth={2.2} style={{ color: 'var(--accent)' }} />}
            </button>
          </div>
        </section>

        <section className="section">
          <div className="group__label">PRECISIÓN</div>
          <div className="group" style={{ padding: 'var(--s3)' }}>
            <div className="segmented" role="tablist" aria-label="Decimales">
              {[1, 2, 3].map((d) => (
                <button
                  key={d}
                  role="tab"
                  className="segmented__item"
                  aria-selected={prefs.decimals === d}
                  onClick={() => setPrefs({ decimals: d })}
                >
                  {d} {d === 1 ? 'decimal' : 'decimales'}
                </button>
              ))}
            </div>
          </div>
          <p style={{ fontSize: 'var(--t-caption)', color: 'var(--text-3)', paddingInline: 'var(--s4)', lineHeight: 1.45 }}>
            Afecta a los resultados en pantalla, no al cálculo. Ejemplo:{' '}
            <b style={{ fontFamily: 'var(--font-mono)' }}>{(41.6).toFixed(prefs.decimals)} kN·m</b>
          </p>
        </section>
      </div>
    </Screen>
  )
}

export function SecurityScreen({ prefs, setPrefs, onBack }: { prefs: Prefs; setPrefs: (p: Partial<Prefs>) => void; onBack: () => void }) {
  return (
    <Screen title="Seguridad" back={{ label: 'Cuenta', onPress: onBack }}>
      <div className="page">
        <div className="group">
          <button className="row">
            <span className="row__icon"><KeyRound size={17} strokeWidth={2.1} /></span>
            <span className="row__body"><span className="row__title">Cambiar contraseña</span></span>
            <ChevronRight size={19} strokeWidth={2.2} className="row__chev" />
          </button>
          <div className="row">
            <span className="row__icon row__icon--accent"><Fingerprint size={17} strokeWidth={2.1} /></span>
            <span className="row__body">
              <span className="row__title">Face ID</span>
              <span className="row__sub">Desbloquea la app al abrirla</span>
            </span>
            <Toggle on={prefs.haptics} onChange={(v) => setPrefs({ haptics: v })} label="Face ID" />
          </div>
        </div>

        <section className="section">
          <div className="group__label">SESIONES ACTIVAS</div>
          <div className="group">
            <div className="row">
              <span className="row__icon row__icon--accent"><Smartphone size={17} strokeWidth={2.1} /></span>
              <span className="row__body">
                <span className="row__title">iPhone 17 Pro</span>
                <span className="row__sub">Este dispositivo · Madrid</span>
              </span>
              <span className="chip chip--accent">Activo</span>
            </div>
            <button className="row">
              <span className="row__icon"><Smartphone size={17} strokeWidth={2.1} /></span>
              <span className="row__body">
                <span className="row__title">MacBook Pro</span>
                <span className="row__sub">Hace 2 días · Madrid</span>
              </span>
              <ChevronRight size={19} strokeWidth={2.2} className="row__chev" />
            </button>
          </div>
        </section>

        <button className="btn btn--secondary btn--block btn--danger">
          <LogOut size={19} strokeWidth={2.1} />
          Cerrar todas las demás sesiones
        </button>
      </div>
    </Screen>
  )
}

export function AboutScreen({ onBack }: { onBack: () => void }) {
  return (
    <Screen title="Acerca de" back={{ label: 'Cuenta', onPress: onBack }}>
      <div className="page">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--s2)', padding: 'var(--s6) 0' }}>
          <BrandMark size={66} className="brand-mark" />
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--t-title2)', fontWeight: 720, letterSpacing: '-0.03em' }}>
            Structure<span style={{ color: 'var(--accent)' }}>Co</span>
          </div>
          <div style={{ fontSize: 'var(--t-footnote)', color: 'var(--text-3)' }}>Versión 0.8.2 · Prototipo iOS</div>
        </div>

        <div className="group">
          <div className="row">
            <span className="row__body"><span className="row__title">Motor de cálculo</span></span>
            <span className="row__value">Simulado</span>
          </div>
          <div className="row">
            <span className="row__body"><span className="row__title">Datos</span></span>
            <span className="row__value">Locales (mock)</span>
          </div>
          <button className="row">
            <span className="row__body"><span className="row__title">Notas de versión</span></span>
            <ChevronRight size={19} strokeWidth={2.2} className="row__chev" />
          </button>
          <button className="row">
            <span className="row__body"><span className="row__title">Términos y privacidad</span></span>
            <ChevronRight size={19} strokeWidth={2.2} className="row__chev" />
          </button>
        </div>

        <p style={{ fontSize: 'var(--t-caption)', color: 'var(--text-3)', textAlign: 'center', lineHeight: 1.5 }}>
          Este prototipo no ejecuta un solver real ni se conecta a ningún servidor.
          Los resultados que muestra son datos simulados para evaluar la interfaz.
        </p>
      </div>
    </Screen>
  )
}
