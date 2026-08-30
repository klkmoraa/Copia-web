import { useEffect, useState } from 'react'
import { ArrowRight, Eye, EyeOff, Lock, Mail, UserRound } from 'lucide-react'
import { BrandMark, Wordmark } from '../components/Chrome'
import { StructureView } from '../components/Structure'
import { gableFrame, USER } from '../lib/model'

export function Splash({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 1750)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <div className="splash">
      <div className="splash__glow" />
      <div className="splash__inner">
        <BrandMark size={92} className="brand-mark" />
        <div>
          <div className="splash__word">
            Structure<span style={{ color: 'var(--accent)' }}>Co</span>
          </div>
          <p className="splash__tag" style={{ marginTop: 10 }}>
            Diseño estructural, con precisión que construye confianza.
          </p>
        </div>
        <div className="splash__spinner" />
        <div style={{ fontSize: 'var(--t-caption)', color: 'var(--text-3)' }}>Cargando tu espacio de trabajo</div>
      </div>
    </div>
  )
}

export function Auth({ onEnter }: { onEnter: (demo: boolean) => void }) {
  const [email, setEmail] = useState(USER.email)
  const [password, setPassword] = useState('estructura2026')
  const [show, setShow] = useState(false)
  const model = gableFrame()

  return (
    <>
      <div className="navbar" style={{ paddingBottom: 'var(--s2)' }}>
        <div className="navbar__row">
          <Wordmark size={26} />
        </div>
      </div>

      <div className="scroll">
        <form
          className="page auth"
          onSubmit={(e) => {
            e.preventDefault()
            onEnter(false)
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s3)' }}>
            <span className="auth__eyebrow">Hola de nuevo</span>
            <h1 className="auth__title">Te damos la bienvenida</h1>
            <p className="auth__lede">
              Inicia sesión para continuar diseñando, analizando y verificando tus estructuras.
            </p>
          </div>

          <div className="auth__hero">
            <StructureView
              model={model}
              grid
              loads
              weight={2.2}
              className="auth__svg"
              ariaLabel="Pórtico a dos aguas con cargas"
            />
            <div style={{ padding: 'var(--s4)', borderTop: '1px solid var(--border-soft)', background: 'var(--surface)' }}>
              <div style={{ fontSize: 'var(--t-subhead)', fontWeight: 620, letterSpacing: '-0.014em' }}>
                Diseña con confianza
              </div>
              <p style={{ fontSize: 'var(--t-footnote)', color: 'var(--text-2)', marginTop: 4, lineHeight: 1.45 }}>
                Modela, analiza y verifica estructuras de forma rápida y precisa.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s3)' }}>
            <label className="field">
              <span className="field__icon"><Mail size={19} strokeWidth={2} /></span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Correo electrónico"
                autoComplete="username"
                aria-label="Correo electrónico"
              />
            </label>
            <label className="field">
              <span className="field__icon"><Lock size={19} strokeWidth={2} /></span>
              <input
                type={show ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Contraseña"
                autoComplete="current-password"
                aria-label="Contraseña"
              />
              <button
                type="button"
                className="field__icon"
                onClick={() => setShow((v) => !v)}
                aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                style={{ minWidth: 32, minHeight: 32 }}
              >
                {show ? <EyeOff size={19} strokeWidth={2} /> : <Eye size={19} strokeWidth={2} />}
              </button>
            </label>
            <button type="button" className="btn btn--ghost" style={{ alignSelf: 'flex-end', fontSize: 'var(--t-footnote)' }}>
              ¿Olvidaste tu contraseña?
            </button>
          </div>

          <button type="submit" className="btn btn--primary btn--block" disabled={!email || !password}>
            Iniciar sesión
            <ArrowRight size={19} strokeWidth={2.4} />
          </button>

          <div className="auth__rule">o</div>

          <button type="button" className="btn btn--secondary btn--block" onClick={() => onEnter(true)}>
            <UserRound size={19} strokeWidth={2} />
            Continuar como demo
          </button>

          <p className="auth__foot">
            ¿No tienes cuenta? <b>Crear cuenta</b>
          </p>
        </form>
      </div>
    </>
  )
}
