import { Bell, CheckCircle2, Clock3, Download, FolderOpen, Layers, Plus, Ruler, ShieldCheck } from 'lucide-react'
import { Avatar, Screen } from '../components/Chrome'
import { ProjectRow } from '../components/ProjectRow'
import { StructureView } from '../components/Structure'
import { gableFrame, USER, type Project } from '../lib/model'

interface Props {
  projects: Project[]
  onOpen: (p: Project) => void
  onCreate: () => void
  onSeeAll: () => void
  onProfile: () => void
  onNotify: () => void
  onQuick: (what: string) => void
}

export function Home({ projects, onOpen, onCreate, onSeeAll, onProfile, onNotify, onQuick }: Props) {
  const recent = projects.slice(0, 3)
  const done = projects.filter((p) => p.status === 'calculated').length
  const wip = projects.filter((p) => p.status !== 'calculated').length

  return (
    <Screen
      title="Inicio"
      trail={
        <button className="navbtn navbtn--glass" onClick={onNotify} aria-label="Notificaciones" style={{ position: 'relative' }}>
          <Bell size={18} strokeWidth={2.1} />
          <i className="dot" style={{ position: 'absolute', top: 7, right: 8, background: 'var(--green-400)' }} />
        </button>
      }
    >
      <div className="page">
        <button className="greet" onClick={onProfile} style={{ textAlign: 'start' }}>
          <span className="greet__body">
            <span className="greet__eyebrow">Hola de nuevo</span>
            <span className="greet__name">{USER.name}</span>
            <span className="greet__sub">¿Listo para diseñar algo increíble?</span>
          </span>
          <Avatar initials={USER.initials} ping />
        </button>

        <button className="hero pressable" onClick={onCreate} aria-label="Crear proyecto">
          <span className="hero__art" aria-hidden="true">
            <StructureView model={gableFrame()} grid weight={2} loads className="hero-svg" ariaLabel="" />
          </span>
          <span className="hero__body">
            <span className="hero__plus"><Plus size={24} strokeWidth={2.6} /></span>
            <span className="hero__title">Crear proyecto</span>
            <span className="hero__sub">Comienza un nuevo análisis desde cero o con una plantilla.</span>
          </span>
        </button>

        <section className="section">
          <div className="section__head">
            <h2 className="section__title">Proyectos recientes</h2>
            <button className="section__link" onClick={onSeeAll}>Ver todos</button>
          </div>
          <div className="stack">
            {recent.map((p) => (
              <ProjectRow key={p.id} project={p} onOpen={() => onOpen(p)} />
            ))}
          </div>
        </section>

        <section className="section">
          <div className="section__head">
            <h2 className="section__title">Resumen rápido</h2>
          </div>
          <div className="stats">
            <div className="stat">
              <span className="stat__icon" style={{ color: 'var(--accent)' }}><ShieldCheck size={19} strokeWidth={2.1} /></span>
              <span className="stat__val">{projects.length}</span>
              <span className="stat__label">Proyectos totales</span>
            </div>
            <div className="stat">
              <span className="stat__icon" style={{ color: 'var(--success)' }}><CheckCircle2 size={19} strokeWidth={2.1} /></span>
              <span className="stat__val">{done}</span>
              <span className="stat__label">Calculados</span>
            </div>
            <div className="stat">
              <span className="stat__icon" style={{ color: 'var(--info)' }}><Clock3 size={19} strokeWidth={2.1} /></span>
              <span className="stat__val">{wip}</span>
              <span className="stat__label">En progreso</span>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="section__head">
            <h2 className="section__title">Accesos rápidos</h2>
          </div>
          <div className="quick">
            <button className="quick__item pressable" onClick={() => onQuick('Biblioteca de secciones')}>
              <Layers size={21} strokeWidth={2} style={{ color: 'var(--accent)' }} />
              <span className="quick__label">Biblioteca de secciones</span>
            </button>
            <button className="quick__item pressable" onClick={() => onQuick('Cargas frecuentes')}>
              <Download size={21} strokeWidth={2} style={{ color: 'var(--distributed)' }} />
              <span className="quick__label">Cargas frecuentes</span>
            </button>
            <button className="quick__item pressable" onClick={() => onQuick('Unidades y normas')}>
              <Ruler size={21} strokeWidth={2} style={{ color: 'var(--axial)' }} />
              <span className="quick__label">Unidades y normas</span>
            </button>
          </div>
        </section>

        <button className="btn btn--secondary btn--block" onClick={onSeeAll}>
          <FolderOpen size={19} strokeWidth={2.1} />
          Abrir un proyecto existente
        </button>
      </div>
    </Screen>
  )
}
