import { useMemo, useState } from 'react'
import { ArrowDownUp, FolderPlus, Plus, Search, X } from 'lucide-react'
import { Screen } from '../components/Chrome'
import { ProjectRow } from '../components/ProjectRow'
import { PROJECT_TYPES, type Project, type ProjectTypeId } from '../lib/model'

type Sort = 'recent' | 'name' | 'status'
type Filter = 'all' | ProjectTypeId

const SORT_LABEL: Record<Sort, string> = {
  recent: 'Más recientes',
  name: 'Nombre (A–Z)',
  status: 'Estado',
}

interface Props {
  projects: Project[]
  onOpen: (p: Project) => void
  onCreate: () => void
  onMore: (p: Project) => void
  onSort: (current: Sort, apply: (s: Sort) => void) => void
}

export function Projects({ projects, onOpen, onCreate, onMore, onSort }: Props) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [sort, setSort] = useState<Sort>('recent')

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = projects.filter(
      (p) => (filter === 'all' || p.type === filter) && (q === '' || p.name.toLowerCase().includes(q) || p.template.toLowerCase().includes(q)),
    )
    if (sort === 'name') return [...list].sort((a, b) => a.name.localeCompare(b.name, 'es'))
    if (sort === 'status') return [...list].sort((a, b) => a.status.localeCompare(b.status))
    return list
  }, [projects, query, filter, sort])

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: projects.length }
    for (const p of projects) c[p.type] = (c[p.type] ?? 0) + 1
    return c
  }, [projects])

  return (
    <>
      <Screen
        title="Proyectos"
        trail={
          <button className="navbtn navbtn--glass" onClick={() => onSort(sort, setSort)} aria-label="Ordenar proyectos">
            <ArrowDownUp size={17} strokeWidth={2.2} />
          </button>
        }
      >
        <div className="page" style={{ gap: 'var(--s4)' }}>
          <label className="field" style={{ minHeight: 46 }}>
            <span className="field__icon"><Search size={18} strokeWidth={2.2} /></span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar proyectos"
              aria-label="Buscar proyectos"
              style={{ fontSize: 'var(--t-subhead)' }}
            />
            {query && (
              <button className="field__icon" onClick={() => setQuery('')} aria-label="Limpiar búsqueda" style={{ minWidth: 30, minHeight: 30 }}>
                <X size={17} strokeWidth={2.4} />
              </button>
            )}
          </label>

          <div className="filters" role="group" aria-label="Filtrar por tipo">
            <button className="filter" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>
              Todos · {counts.all}
            </button>
            {PROJECT_TYPES.filter((t) => counts[t.id]).map((t) => (
              <button key={t.id} className="filter" aria-pressed={filter === t.id} onClick={() => setFilter(t.id)}>
                {t.name} · {counts[t.id]}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingInline: 'var(--s1)' }}>
            <span style={{ fontSize: 'var(--t-footnote)', color: 'var(--text-3)' }}>
              {visible.length} {visible.length === 1 ? 'proyecto' : 'proyectos'}
            </span>
            <button className="section__link" style={{ fontSize: 'var(--t-footnote)' }} onClick={() => onSort(sort, setSort)}>
              {SORT_LABEL[sort]}
            </button>
          </div>

          {visible.length > 0 ? (
            <div className="stack" style={{ paddingBottom: 72 }}>
              {visible.map((p) => (
                <ProjectRow key={p.id} project={p} onOpen={() => onOpen(p)} onMore={() => onMore(p)} />
              ))}
            </div>
          ) : (
            <div className="empty">
              <div
                style={{
                  width: 72, height: 72, borderRadius: 24, display: 'grid', placeItems: 'center',
                  background: 'var(--accent-soft)', color: 'var(--accent)',
                }}
              >
                <FolderPlus size={30} strokeWidth={1.9} />
              </div>
              <div className="empty__title">Sin resultados</div>
              <p className="empty__sub">
                {query
                  ? `No hay proyectos que coincidan con “${query}”. Prueba con otro nombre o cambia el filtro.`
                  : 'Todavía no tienes proyectos de este tipo. Crea el primero y aparecerá aquí.'}
              </p>
              <button className="btn btn--primary" onClick={onCreate}>
                <Plus size={19} strokeWidth={2.4} />
                Crear proyecto
              </button>
            </div>
          )}
        </div>
      </Screen>

      <button className="fab" onClick={onCreate}>
        <Plus size={21} strokeWidth={2.6} />
        Nuevo
      </button>
    </>
  )
}

export type { Sort }
export { SORT_LABEL }
