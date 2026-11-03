import { useMemo } from 'react'
import { Link } from 'react-router'
import { ChevronRight, History, Lock } from 'lucide-react'
import { Avatar, displayName } from '../components/Avatar'
import { Card, EmptyState, ErrorBox, Money, PageHeader, SectionTitle, Spinner } from '../components/ui'
import { useMonthTotals } from '../data/hooks'
import { useHousehold } from '../household/HouseholdProvider'
import { MONTH_NAMES } from '../lib/dates'
import { formatBRL } from '../lib/money'
import { variation } from '../lib/summary'
import { friendlyError } from '../lib/supabase'
import { monthParam } from './HomePage'

export function HistoryPage() {
  const { members } = useHousehold()
  const totals = useMonthTotals()
  const months = useMemo(() => [...(totals.data ?? [])].reverse(), [totals.data])
  const chart = useMemo(() => (totals.data ?? []).slice(-12), [totals.data])
  const max = Math.max(1, ...chart.map((m) => m.total_cents))
  const byYear = useMemo(() => {
    const groups = new Map<number, typeof months>()
    for (const m of months) groups.set(m.year, [...(groups.get(m.year) ?? []), m])
    return [...groups.entries()]
  }, [months])

  if (totals.isPending) return <Spinner />
  if (totals.error) return <ErrorBox message={friendlyError(totals.error)} onRetry={() => totals.refetch()} />

  return (
    <>
      <PageHeader title="Histórico" subtitle="Quanto a casa gastou em cada mês" />

      {months.length === 0 ? (
        <Card>
          <EmptyState icon={<History className="size-8" />} title="Nenhum mês ainda">
            Os meses aparecem aqui conforme vocês lançam as contas.
          </EmptyState>
        </Card>
      ) : (
        <>
          {chart.length > 1 && (
            <Card className="mb-6">
              <p className="mb-4 font-semibold text-muted">Últimos {chart.length} meses</p>
              <div className="flex h-40 items-end gap-1.5" role="img" aria-label="Gráfico do total de cada mês">
                {chart.map((m, i) => (
                  <Link
                    key={`${m.year}-${m.month}`}
                    to={`/?mes=${monthParam(m)}`}
                    className="flex h-full flex-1 flex-col items-center justify-end gap-1.5"
                    title={`${MONTH_NAMES[m.month - 1]}/${m.year}: ${formatBRL(m.total_cents)}`}
                  >
                    <div
                      className={`w-full max-w-10 rounded-lg ${i === chart.length - 1 ? 'bg-primary' : 'bg-primary/25'}`}
                      style={{ height: `${Math.max(4, (m.total_cents / max) * 100)}%` }}
                    />
                    <span className="text-xs text-muted">{MONTH_NAMES[m.month - 1].slice(0, 3)}</span>
                  </Link>
                ))}
              </div>
            </Card>
          )}

          {byYear.map(([year, list]) => (
            <section key={year} className="mb-6">
              <SectionTitle>{year}</SectionTitle>
              <Card className="overflow-hidden !p-0">
                <ul className="divide-y divide-line">
                  {list.map((m) => {
                    const idx = (totals.data ?? []).findIndex((x) => x.year === m.year && x.month === m.month)
                    const prev = idx > 0 ? totals.data![idx - 1] : null
                    const v = variation(m.total_cents, prev?.total_cents)
                    const shares = Object.entries(m.per_member).filter(([, c]) => c > 0)
                    const values = shares.map(([, c]) => c)
                    const even = values.length > 0 && Math.max(...values) - Math.min(...values) <= values.length
                    return (
                      <li key={`${m.year}-${m.month}`}>
                        <Link to={`/?mes=${monthParam(m)}`} className="block px-4 py-4 transition hover:bg-surface-2">
                          <div className="flex items-center gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="flex items-center gap-2 text-[1.0625rem] font-bold">
                                {MONTH_NAMES[m.month - 1]}
                                {m.status === 'closed' && <Lock className="size-4 text-muted" aria-label="Mês fechado" />}
                              </p>
                              <p className="text-[0.9375rem] text-muted">
                                {even ? `${formatBRL(Math.max(...values))} por pessoa` : shares.length ? 'Divisão variada' : 'Sem valores'}
                                {m.awaiting > 0 && ` · ${m.awaiting} sem valor`}
                              </p>
                            </div>
                            <div className="text-right">
                              <Money cents={m.total_cents} className="text-[1.0625rem] font-bold" />
                              {v && v.pct !== 0 && (
                                <p className={`text-[0.8125rem] font-semibold ${v.pct > 0 ? 'text-danger' : 'text-ok'}`}>
                                  {v.pct > 0 ? '+' : ''}
                                  {v.pct}% vs mês anterior
                                </p>
                              )}
                            </div>
                            <ChevronRight className="size-5 shrink-0 text-faint" aria-hidden />
                          </div>
                          {!even && shares.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                              {shares.map(([id, c]) => {
                                const mem = members.find((x) => x.id === id)
                                return mem ? (
                                  <span key={id} className="flex items-center gap-1.5 text-[0.9375rem]">
                                    <Avatar member={mem} size="sm" /> {displayName(mem)}: <strong>{formatBRL(c)}</strong>
                                  </span>
                                ) : null
                              })}
                            </div>
                          )}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </Card>
            </section>
          ))}
        </>
      )}
    </>
  )
}
