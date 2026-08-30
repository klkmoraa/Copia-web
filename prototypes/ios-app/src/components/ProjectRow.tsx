import { MoreHorizontal } from 'lucide-react'
import { StructureView } from './Structure'
import { STATUS_COLOR, STATUS_LABEL, type Project } from '../lib/model'

export function ProjectRow({
  project, onOpen, onMore,
}: { project: Project; onOpen: () => void; onMore?: () => void }) {
  return (
    <div className="card pressable" style={{ display: 'flex', alignItems: 'center' }}>
      <button className="project" onClick={onOpen} aria-label={`Abrir ${project.name}`}>
        <span className="project__thumb">
          <StructureView model={project.model} weight={1.6} supports className="thumb-svg" ariaLabel="" />
        </span>
        <span className="project__body">
          <span className="project__name">{project.name}</span>
          <span className="project__meta">
            <i className="dot" style={{ background: STATUS_COLOR[project.status] }} />
            <span>{STATUS_LABEL[project.status]}</span>
            <span className="project__sep">·</span>
            <span>{project.updatedAt}</span>
          </span>
        </span>
      </button>
      {onMore && (
        <button
          className="project__more"
          onClick={onMore}
          aria-label={`Más opciones de ${project.name}`}
          style={{ marginInlineEnd: 'var(--s2)' }}
        >
          <MoreHorizontal size={20} strokeWidth={2.2} />
        </button>
      )}
    </div>
  )
}
