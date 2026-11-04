import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useSearchParams } from 'react-router'
import { ChartColumn, House, MessageCircle, Plus, Settings, WifiOff } from 'lucide-react'
import { useHousehold } from '../household/HouseholdProvider'
import { parseMonthParam } from '../pages/HomePage'
import { AddSheet } from './AddSheet'

const NAV = [
  { to: '/', label: 'Início', icon: House },
  { to: '/historico', label: 'Histórico', icon: ChartColumn },
  { to: '/perguntar', label: 'Perguntar', icon: MessageCircle },
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
        `flex h-[3.25rem] flex-col items-center justify-center gap-[3px] text-[0.625rem] font-medium tracking-wide transition active:opacity-60 ${
          isActive ? 'text-primary' : 'text-[#9aa1aa]'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <Icon className="size-[1.5rem]" strokeWidth={isActive ? 2.1 : 1.8} aria-hidden />
          {label}
        </>
      )}
    </NavLink>
  )
}

/**
 * Estrutura de app de celular (também no computador: uma coluna com largura de celular).
 * Barra de abas translúcida embaixo com o "+" no meio, que abre o menu de lançar.
 */
export function Layout() {
  const { demo } = useHousehold()
  const online = useOnline()
  const { pathname } = useLocation()
  const [params] = useSearchParams()
  const [addOpen, setAddOpen] = useState(false)
  // Formulários ocupam a tela toda (como as telas de "Novo" do iPhone)
  const fullScreen = pathname.startsWith('/lancar') || pathname.endsWith('/editar') || pathname === '/ajustes/senha'
  const ym = parseMonthParam(pathname === '/' || pathname.startsWith('/conta') ? params.get('mes') : null)

  return (
    <div className="mx-auto min-h-dvh w-full max-w-[30rem] bg-bg">
      {demo && (
        <p className="pt-safe px-4 pt-1.5 text-center text-[0.75rem] font-medium text-muted">Demonstração · os dados ficam só neste aparelho</p>
      )}
      {!online && (
        <div role="status" className="pt-safe flex items-center justify-center gap-2 bg-ink px-4 py-1.5 text-[0.8125rem] font-medium text-white">
          <WifiOff className="size-4" aria-hidden /> Sem internet · mostrando os últimos dados
        </div>
      )}

      <main className={`px-4 ${fullScreen ? 'pb-10' : 'pb-[calc(6.5rem+env(safe-area-inset-bottom))]'}`}>
        <div key={pathname} className="animate-page">
          <Outlet />
        </div>
      </main>

      {!fullScreen && (
        <nav
          aria-label="Principal"
          className="pb-safe fixed bottom-0 left-1/2 z-30 w-full max-w-[30rem] -translate-x-1/2 border-t border-black/[0.06] bg-white/85 backdrop-blur-xl backdrop-saturate-150"
        >
          <ul className="grid grid-cols-5 items-center px-1">
            <li>
              <NavItem {...NAV[0]} />
            </li>
            <li>
              <NavItem {...NAV[1]} />
            </li>
            <li className="flex justify-center">
              <button
                onClick={() => setAddOpen(true)}
                aria-label="Lançar conta"
                className="-mt-6 grid size-[3.5rem] place-items-center rounded-full bg-primary text-white shadow-[0_8px_20px_-6px_rgb(74_144_164/0.65)] transition active:scale-95"
              >
                <Plus className="size-7" strokeWidth={2.4} aria-hidden />
              </button>
            </li>
            <li>
              <NavItem {...NAV[2]} />
            </li>
            <li>
              <NavItem {...NAV[3]} />
            </li>
          </ul>
        </nav>
      )}

      <AddSheet open={addOpen} onClose={() => setAddOpen(false)} ym={ym} />
    </div>
  )
}
