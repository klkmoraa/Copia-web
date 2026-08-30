import { useState } from 'react'
import { ArrowRight, Check, FileText, ShieldCheck, Sparkles, X } from 'lucide-react'
import { StructureView } from '../components/Structure'
import {
  PROJECT_TYPES, TEMPLATES, UNIT_SYSTEMS,
  type Project, type ProjectTypeId, type Template, type UnitsId,
} from '../lib/model'

interface Props {
  onCancel: () => void
  onCreate: (project: Project) => void
}

export function CreateProject({ onCancel, onCreate }: Props) {
  const [step, setStep] = useState<1 | 2>(1)
  const [name, setName] = useState('Pórtico a dos aguas 6 × 5')
  const [type, setType] = useState<ProjectTypeId>('frame')
  const [units, setUnits] = useState<UnitsId>('metric')
  const [templateId, setTemplateId] = useState('gable')

  const template = TEMPLATES.find((t) => t.id === templateId)!
  const canContinue = name.trim().length > 1

  const build = (): Project => {
    const model = template.build()
    return {
      id: `new-${Date.now()}`,
      name: name.trim(),
      type,
      template: template.name,
      units,
      status: 'draft',
      updatedAt: 'Ahora mismo',
      nodes: model.nodes.length,
      members: model.members.length,
      loadCases: model.loads.length,
      model,
    }
  }

  return (
    <>
      <div className="navbar navbar--stuck">
        <div className="navbar__row">
          <div className="navbar__lead">
            <button className="navbtn" onClick={onCancel} aria-label="Cancelar" style={{ paddingInline: 4 }}>
              <X size={24} strokeWidth={2.3} />
            </button>
          </div>
          <div className="navbar__center" style={{ opacity: 1, transform: 'none' }}>Crear proyecto</div>
          <div className="navbar__trail" style={{ width: 40 }} />
        </div>
      </div>

      <div className="scroll">
        <div className="page" style={{ paddingTop: 'var(--s4)', gap: 'var(--s5)' }}>
          <div className="steps">
            <div className={step === 1 ? 'step step--on' : 'step step--done'}>
              <span className="step__dot">{step === 1 ? '1' : <Check size={14} strokeWidth={3} />}</span>
              <span className="step__label">Detalles</span>
            </div>
            <div className="steps__line" />
            <div className={step === 2 ? 'step step--on' : 'step'}>
              <span className="step__dot">2</span>
              <span className="step__label">Configurar</span>
            </div>
          </div>

          {step === 1 ? (
            <>
              <section className="section">
                <div className="group__label">NOMBRE DEL PROYECTO</div>
                <label className="field">
                  <span className="field__icon"><FileText size={18} strokeWidth={2} /></span>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ej. Nave industrial — Marco A"
                    aria-label="Nombre del proyecto"
                  />
                  {name && (
                    <button className="field__icon" onClick={() => setName('')} aria-label="Borrar nombre" style={{ minWidth: 30, minHeight: 30 }}>
                      <X size={16} strokeWidth={2.4} />
                    </button>
                  )}
                </label>
              </section>

              <section className="section">
                <div className="group__label">TIPO DE PROYECTO</div>
                <div className="picker picker--2">
                  {PROJECT_TYPES.map((t) => (
                    <button
                      key={t.id}
                      className="pick pressable"
                      aria-pressed={type === t.id}
                      onClick={() => setType(t.id)}
                    >
                      <span className="pick__glyph" style={{ opacity: type === t.id ? 1 : 0.55 }}>
                        <TypeGlyph id={t.id} />
                      </span>
                      <span className="pick__name">{t.name}</span>
                      <span className="pick__desc">{t.desc}</span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="section">
                <div className="group__label">UNIDADES</div>
                <div className="group">
                  {UNIT_SYSTEMS.map((u) => (
                    <button key={u.id} className="row" onClick={() => setUnits(u.id)}>
                      <span className="row__body">
                        <span className="row__title">{u.name}</span>
                        <span className="row__sub">{u.detail}</span>
                      </span>
                      {units === u.id && <Check size={20} strokeWidth={2.6} style={{ color: 'var(--accent)' }} />}
                    </button>
                  ))}
                </div>
                <p style={{ fontSize: 'var(--t-caption)', color: 'var(--text-3)', paddingInline: 'var(--s4)' }}>
                  Puedes cambiar las unidades más adelante desde Ajustes.
                </p>
              </section>
            </>
          ) : (
            <>
              <section className="section">
                <div className="group__label">PLANTILLA INICIAL</div>
                <div className="stack">
                  {TEMPLATES.map((t) => (
                    <TemplateRow key={t.id} t={t} on={templateId === t.id} onPress={() => setTemplateId(t.id)} />
                  ))}
                </div>
              </section>

              <section className="section">
                <div className="group__label">RESUMEN</div>
                <div className="group">
                  <div className="row">
                    <span className="row__body"><span className="row__title">Nombre</span></span>
                    <span className="row__value" style={{ maxWidth: '58%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {name || '—'}
                    </span>
                  </div>
                  <div className="row">
                    <span className="row__body"><span className="row__title">Tipo</span></span>
                    <span className="row__value">{PROJECT_TYPES.find((t) => t.id === type)!.name}</span>
                  </div>
                  <div className="row">
                    <span className="row__body"><span className="row__title">Unidades</span></span>
                    <span className="row__value">{UNIT_SYSTEMS.find((u) => u.id === units)!.detail}</span>
                  </div>
                  <div className="row">
                    <span className="row__body"><span className="row__title">Plantilla</span></span>
                    <span className="row__value">{template.name}</span>
                  </div>
                </div>
              </section>

              <div className="note">
                <ShieldCheck size={17} strokeWidth={2.1} />
                <span>Podrás ajustar geometría, cargas y combinaciones una vez creado el proyecto.</span>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="docked">
        {step === 2 && (
          <button className="btn btn--secondary" onClick={() => setStep(1)} style={{ flex: '0 0 auto', paddingInline: 'var(--s5)' }}>
            Atrás
          </button>
        )}
        {step === 1 ? (
          <button className="btn btn--primary" style={{ flex: 1 }} disabled={!canContinue} onClick={() => setStep(2)}>
            Continuar
            <ArrowRight size={19} strokeWidth={2.4} />
          </button>
        ) : (
          <button className="btn btn--primary" style={{ flex: 1 }} onClick={() => onCreate(build())}>
            <Sparkles size={19} strokeWidth={2.2} />
            Crear y abrir
          </button>
        )}
      </div>
    </>
  )
}

function TemplateRow({ t, on, onPress }: { t: Template; on: boolean; onPress: () => void }) {
  const model = t.build()
  return (
    <button className="template pressable" aria-pressed={on} onClick={onPress}>
      <span className="template__thumb">
        {model.members.length > 0 ? (
          <StructureView model={model} weight={1.6} className="thumb-svg" ariaLabel="" />
        ) : (
          <Sparkles size={20} strokeWidth={1.8} style={{ color: 'var(--text-3)' }} />
        )}
      </span>
      <span style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span className="pick__name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {t.name}
        </span>
        {/* La etiqueta va en la segunda línea: junto al nombre le robaba la
            mitad del ancho y "Pórtico a dos aguas" se cortaba. */}
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          {t.recommended && <span className="chip chip--accent">Recomendado</span>}
          <span className="pick__desc" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {t.detail}
          </span>
        </span>
      </span>
      {on && <Check size={20} strokeWidth={2.6} style={{ color: 'var(--accent)', flex: '0 0 auto' }} />}
    </button>
  )
}

function TypeGlyph({ id }: { id: ProjectTypeId }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  if (id === 'frame') {
    return <svg width="26" height="24" viewBox="0 0 26 24" {...common}><path d="M3 21V8l10-5 10 5v13" /><path d="M3 8h20" /></svg>
  }
  if (id === 'truss') {
    return <svg width="26" height="24" viewBox="0 0 26 24" {...common}><path d="M2 18h22M2 18l5-9 5 9 5-9 5 9M7 9h10" /></svg>
  }
  if (id === 'beam') {
    return <svg width="26" height="24" viewBox="0 0 26 24" {...common}><path d="M2 11h22M5 11v5M13 11v5M21 11v5M3 19h4M11 19h4M19 19h4" /></svg>
  }
  return <svg width="26" height="24" viewBox="0 0 26 24" {...common}><path d="M2 14h22M4 14v6M22 14v6M6 14l4-6 4 6 4-6 4 6" /></svg>
}
