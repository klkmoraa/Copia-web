import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Check, FolderOpen, Home as HomeIcon, Share, Trash2, UserRound } from 'lucide-react'
import './styles/app.css'

import { ActionSheet, TabBar, Toast, type ActionItem } from './components/Chrome'
import { Auth, Splash } from './screens/Onboarding'
import { Home } from './screens/Home'
import { Projects, SORT_LABEL, type Sort } from './screens/Projects'
import { CreateProject } from './screens/CreateProject'
import { Workspace } from './screens/Workspace'
import { Account, AboutScreen, ProfileScreen, SecurityScreen, UnitsScreen, type Prefs } from './screens/Account'
import { PROJECTS, type Project } from './lib/model'

type Phase = 'splash' | 'auth' | 'app'
type Tab = 'home' | 'projects' | 'account'
type AccountRoute = 'profile' | 'units' | 'security' | 'about'

const TABS = [
  { id: 'home', label: 'Inicio', icon: <HomeIcon size={23} strokeWidth={2} /> },
  { id: 'projects', label: 'Proyectos', icon: <FolderOpen size={23} strokeWidth={2} /> },
  { id: 'account', label: 'Cuenta', icon: <UserRound size={23} strokeWidth={2} /> },
]

const DEFAULT_PREFS: Prefs = {
  theme: 'light',
  grid: true,
  sync: true,
  haptics: true,
  units: 'metric',
  decimals: 1,
  notifications: true,
}

/** Mantiene un nodo montado durante su animación de salida. */
function usePresence(open: boolean, ms = 380) {
  const [mounted, setMounted] = useState(open)
  const [leaving, setLeaving] = useState(false)
  useEffect(() => {
    if (open) {
      setMounted(true)
      setLeaving(false)
      return
    }
    if (!mounted) return
    setLeaving(true)
    const t = setTimeout(() => { setMounted(false); setLeaving(false) }, ms)
    return () => clearTimeout(t)
  }, [open, ms, mounted])
  return { mounted, leaving }
}

function Layer({ open, kind, children }: { open: boolean; kind: 'cover' | 'push'; children: ReactNode }) {
  const { mounted, leaving } = usePresence(open)
  if (!mounted) return null
  const anim = kind === 'cover'
    ? (leaving ? 'anim-cover-out' : 'anim-cover-in')
    : (leaving ? 'anim-pop-out' : 'anim-push-in')
  return <div className={`layer ${anim}`}>{children}</div>
}

export default function App() {
  const [phase, setPhase] = useState<Phase>('splash')
  const [tab, setTab] = useState<Tab>('home')
  const [accountRoute, setAccountRoute] = useState<AccountRoute | null>(null)
  const [projects, setProjects] = useState<Project[]>(PROJECTS)
  const [openProject, setOpenProject] = useState<Project | null>(null)
  const [creating, setCreating] = useState(false)
  const [prefs, setPrefsState] = useState<Prefs>(DEFAULT_PREFS)
  const [menu, setMenu] = useState<{ title?: string; items: ActionItem[] } | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const setPrefs = useCallback((patch: Partial<Prefs>) => setPrefsState((p) => ({ ...p, ...patch })), [])
  const say = useCallback((msg: string) => setToast(msg), [])

  /* Tema: 'system' sigue al esquema del dispositivo, como en iOS. */
  useEffect(() => {
    const apply = () => {
      const dark = prefs.theme === 'dark'
        || (prefs.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
      document.documentElement.dataset.theme = dark ? 'dark' : 'light'
    }
    apply()
    if (prefs.theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [prefs.theme])

  const openWorkspace = useCallback((p: Project) => {
    setOpenProject(p)
    setCreating(false)
  }, [])

  const projectMenu = useCallback((p: Project) => {
    setMenu({
      title: p.name,
      items: [
        { label: 'Abrir', icon: <FolderOpen size={19} strokeWidth={2} />, onPress: () => openWorkspace(p) },
        { label: 'Duplicar', icon: <Check size={19} strokeWidth={2} />, onPress: () => say('Proyecto duplicado') },
        { label: 'Compartir', icon: <Share size={19} strokeWidth={2} />, onPress: () => say('Enlace copiado (simulado)') },
        {
          label: 'Eliminar',
          icon: <Trash2 size={19} strokeWidth={2} />,
          danger: true,
          onPress: () => { setProjects((all) => all.filter((x) => x.id !== p.id)); say(`“${p.name}” eliminado`) },
        },
      ],
    })
  }, [openWorkspace, say])

  const sortMenu = useCallback((current: Sort, apply: (s: Sort) => void) => {
    setMenu({
      title: 'Ordenar por',
      items: (['recent', 'name', 'status'] as Sort[]).map((s) => ({
        label: SORT_LABEL[s] + (s === current ? '  ✓' : ''),
        onPress: () => apply(s),
      })),
    })
  }, [])

  const tabView = useMemo(() => {
    if (tab === 'home') {
      return (
        <Home
          projects={projects}
          onOpen={openWorkspace}
          onCreate={() => setCreating(true)}
          onSeeAll={() => setTab('projects')}
          onProfile={() => { setTab('account'); setAccountRoute('profile') }}
          onNotify={() => say('No tienes notificaciones nuevas')}
          onQuick={(what) => say(`${what} — no implementado en el prototipo`)}
        />
      )
    }
    if (tab === 'projects') {
      return (
        <Projects
          projects={projects}
          onOpen={openWorkspace}
          onCreate={() => setCreating(true)}
          onMore={projectMenu}
          onSort={sortMenu}
        />
      )
    }
    return (
      <Account
        prefs={prefs}
        setPrefs={setPrefs}
        onPush={(r) => setAccountRoute(r.replace('account.', '') as AccountRoute)}
        onLogout={() => { setPhase('auth'); setTab('home'); setAccountRoute(null) }}
      />
    )
  }, [tab, projects, prefs, setPrefs, openWorkspace, projectMenu, sortMenu, say])

  if (phase === 'splash') {
    return (
      <div className="app">
        <Splash onDone={() => setPhase('auth')} />
      </div>
    )
  }

  if (phase === 'auth') {
    return (
      <div className="app">
        <div className="paper" />
        <div className="scene layer anim-fade-in">
          <Auth onEnter={(demo) => { setPhase('app'); if (demo) say('Sesión de demostración iniciada') }} />
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <div className="paper" />

      <div className="scene">
        <div className="layer layer--transparent">
          <div key={tab} className="layer layer--transparent anim-fade-in" style={{ position: 'relative', flex: '1 1 auto', minHeight: 0 }}>
            {tabView}
          </div>
          <TabBar tabs={TABS} active={tab} onSelect={(id) => { setTab(id as Tab); setAccountRoute(null) }} />
        </div>
      </div>

      <Layer open={accountRoute !== null} kind="push">
        {accountRoute === 'profile' && <ProfileScreen onBack={() => setAccountRoute(null)} />}
        {accountRoute === 'units' && <UnitsScreen prefs={prefs} setPrefs={setPrefs} onBack={() => setAccountRoute(null)} />}
        {accountRoute === 'security' && <SecurityScreen prefs={prefs} setPrefs={setPrefs} onBack={() => setAccountRoute(null)} />}
        {accountRoute === 'about' && <AboutScreen onBack={() => setAccountRoute(null)} />}
      </Layer>

      <Layer open={creating} kind="cover">
        <CreateProject
          onCancel={() => setCreating(false)}
          onCreate={(p) => {
            setProjects((all) => [p, ...all])
            setCreating(false)
            openWorkspace(p)
            say(`“${p.name}” creado`)
          }}
        />
      </Layer>

      <Layer open={openProject !== null} kind="cover">
        {openProject && (
          <Workspace
            key={openProject.id}
            project={openProject}
            gridOn={prefs.grid}
            decimals={prefs.decimals}
            onClose={() => setOpenProject(null)}
            onToast={say}
          />
        )}
      </Layer>

      {menu && <ActionSheet title={menu.title} items={menu.items} onClose={() => setMenu(null)} />}
      {toast && <Toast message={toast} icon={<Check size={16} strokeWidth={2.6} style={{ color: 'var(--accent)' }} />} onDone={() => setToast(null)} />}
    </div>
  )
}
