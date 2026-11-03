import { useEffect, useState } from 'react'
import { NavLink, Outlet, Link, useLocation, useSearchParams } from 'react-router'
import { History, Home, MessageCircleQuestion, Plus, Settings, WifiOff, Smartphone } from 'lucide-react'
import { useHousehold } from '../household/HouseholdProvider'
import { Avatar, displayName } from './Avatar'

const NAV = [
  { to: '/', label: 'Início', icon: Home },
  { to: '/historico', label: 'Histórico', icon: History },
  { to: '/perguntar', label: 'Perguntar', icon: MessageCircleQuestion },
  { to: '/ajustes', label: 'Ajustes', icon: Settings },
]

function useOnline() {
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  return online
}

function NavItem({ to, label, icon: Icon }: (typeof NAV)[number]) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        `flex min-h-[4.25rem] flex-col items-center justify-center gap-1 text-[0.8125rem] font-semibold transition ${
          isActive ? 'text-primary' : 'text-faint'
        }`
      }
    >
      <Icon className="size-[1.625rem]" strokeWidth={1.9} aria-hidden />
      {label}
    </NavLink>
  )
}

export function Layout() {
  const { household, me, demo } = useHousehold()
  const online = useOnline()
  const { pathname } = useLocation()
  const [params] = useSearchParams()
  // O "+" lança a conta no mês que está aberto na tela inicial
  const newHref = pathname === '/' && params.get('mes') ? `/lancar?mes=${params.get('mes')}` : '/lancar'

  return (
    <div className="min-h-dvh md:flex">
      {/* Desktop: menu lateral */}
      <aside className="sticky top-0 hidden h-dvh w-72 shrink-0 flex-col border-r border-line bg-surface px-5 py-7 md:flex">
        <Link to="/" className="mb-9 flex items-center gap-3 px-2">
          <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" className="size-10 rounded-xl" />
          <div className="min-w-0">
            <p className="font-bold leading-tight">Finanças da Casa</p>
            <p className="truncate text-sm text-muted">{household.name}</p>
          </div>
        </Link>

        <Link
          to={newHref}
          className="mb-6 flex min-h-13 items-center justify-center gap-2 rounded-2xl bg-primary font-semibold text-on-primary transition hover:bg-primary-strong"
        >
          <Plus className="size-5" strokeWidth={2.5} aria-hidden /> Lançar conta
        </Link>

        <nav aria-label="Principal" className="flex flex-col gap-1">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-2xl px-4 py-3 font-semibold transition ${
                  isActive ? 'bg-primary-soft text-primary-strong dark:text-primary' : 'text-muted hover:bg-surface-2 hover:text-ink'
                }`
              }
            >
              <Icon className="size-[1.375rem]" strokeWidth={1.9} aria-hidden />
              {label}
            </NavLink>
          ))}
        </nav>

        {me && (
          <Link to="/ajustes" className="mt-auto flex items-center gap-3 rounded-2xl p-2 hover:bg-surface-2">
            <Avatar member={me} size="md" />
            <div className="min-w-0">
              <p className="truncate font-semibold">{displayName(me)}</p>
              <p className="truncate text-sm text-muted">{me.role === 'admin' ? 'Administrador' : 'Morador'}</p>
            </div>
          </Link>
        )}
      </aside>

      <div className="min-w-0 flex-1">
        {demo && (
          <Link
            to="/ajustes#demonstracao"
            className="pt-safe flex items-center justify-center gap-2 bg-primary-soft px-4 py-2 text-sm font-semibold text-primary-strong dark:text-primary"
          >
            <Smartphone className="size-4" aria-hidden /> Modo demonstração — os dados ficam só neste aparelho
          </Link>
        )}
        {!online && (
          <div role="status" className="flex items-center justify-center gap-2 bg-ink px-4 py-2 text-sm font-semibold text-bg">
            <WifiOff className="size-4" aria-hidden /> Sem internet — mostrando os últimos dados salvos
          </div>
        )}
        <main className={`mx-auto w-full max-w-2xl px-4 pb-36 md:px-10 md:pt-10 md:pb-16 ${demo ? 'pt-5' : 'pt-safe'}`}>
          <div className={demo ? '' : 'pt-5'}>
            <Outlet />
          </div>
        </main>
      </div>

      {/* Celular: navegação inferior com o "+" no meio */}
      <nav aria-label="Principal" className="pb-safe fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 backdrop-blur-xl md:hidden">
        <ul className="mx-auto grid max-w-lg grid-cols-5 items-end">
          <li>
            <NavItem {...NAV[0]} />
          </li>
          <li>
            <NavItem {...NAV[1]} />
          </li>
          <li className="flex justify-center">
            <Link
              to={newHref}
              aria-label="Lançar conta"
              className="-mt-7 mb-2 grid size-[4.25rem] place-items-center rounded-full bg-primary text-on-primary shadow-[0_10px_24px_-6px_color-mix(in_oklab,var(--color-primary)_70%,transparent)] ring-4 ring-bg transition active:scale-95"
            >
              <Plus className="size-8" strokeWidth={2.5} aria-hidden />
            </Link>
          </li>
          <li>
            <NavItem {...NAV[2]} />
          </li>
          <li>
            <NavItem {...NAV[3]} />
          </li>
        </ul>
      </nav>
    </div>
  )
}
