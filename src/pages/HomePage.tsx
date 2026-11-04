import { useEffect, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ArrowDownRight, ArrowUpRight, CalendarPlus, Check, ChevronLeft, ChevronRight, Lock, LockOpen, ReceiptText } from 'lucide-react'
import { Avatar, displayName } from '../components/Avatar'
import { CategoryIcon } from '../components/CategoryIcon'
import { Button, Card, EmptyState, ErrorBox, IconButton, List, Money, NavBar, Row, SectionTitle, Spinner } from '../components/ui'
import { useCategories, useMonth, useMonthTotals, useRecurringBills, useSetMonthStatus, useStartMonth } from '../data/hooks'
import { useHousehold } from '../household/HouseholdProvider'
import { addMonths, compareYearMonth, currentYearMonth, greeting, MONTH_NAMES, sameYearMonth, type YearMonth } from '../lib/dates'
import { dueLabel, dueState, todayIso } from '../lib/due'
import { formatBRL } from '../lib/money'
import { notifyDueBills } from '../lib/notify'
import { summarizeMonth, variation } from '../lib/summary'
import { friendlyError } from '../lib/supabase'
import type { Expense } from '../types'

export function parseMonthParam(value: string | null): YearMonth {
  const m = value?.match(/^(\d{4})-(\d{2})$/)
  if (!m) return currentYearMonth()
  const month = Number(m[2])
  return month >= 1 && month <= 12 ? { year: Number(m[1]), month } : currentYearMonth()
}

export const monthParam = (ym: YearMonth) => `${ym.year}-${String(ym.month).padStart(2, '0')}`

const short = (month: number) => MONTH_NAMES[month - 1].slice(0, 3)

/** Folhinha de calendário com o dia do vencimento (como o ícone do Calendário do iPhone). */
function DateTile({ iso, overdue }: { iso: string; overdue: boolean }) {
  const [, m, d] = iso.split('-').map(Number)
  return (
    <span aria-hidden className="flex size-10 shrink-0 flex-col items-center justify-center rounded-[0.75rem] bg-surface-2 leading-none">
      <span className={`text-[0.5625rem] font-bold tracking-wider uppercase ${overdue ? 'text-danger' : 'text-primary'}`}>{short(m)}</span>
      <span className="num mt-0.5 text-[1.0625rem] font-semibold">{d}</span>
    </span>
  )
}

/** Gráfico de barras simples (últimos meses). O mês em foco fica em azul. */
function MiniBars({ data, focus }: { data: { key: string; label: string; cents: number; to: string }[]; focus: string }) {
  const max = Math.max(1, ...data.map((d) => d.cents))
  return (
    <div className="flex h-32 items-end gap-2" role="img" aria-label="Total dos últimos meses">
      {data.map((d) => (
        <Link key={d.key} to={d.to} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5" title={`${d.label}: ${formatBRL(d.cents)}`}>
          <div
            className={`w-full max-w-8 rounded-[0.4rem] transition-[height] duration-500 ${d.key === focus ? 'bg-primary' : 'bg-[#dfe3e8]'}`}
            style={{ height: `${Math.max(4, (d.cents / max) * 100)}%` }}
          />
          <span className={`text-[0.6875rem] ${d.key === focus ? 'font-semibold text-ink' : 'text-muted'}`}>{d.label}</span>
        </Link>
      ))}
    </div>
  )
}

export function HomePage() {
  const { me, activeMembers } = useHousehold()
  const [params, setParams] = useSearchParams()
  const ym = parseMonthParam(params.get('mes'))
  const prevYm = addMonths(ym, -1)
  const month = useMonth(ym)
  const prevMonth = useMonth(prevYm)
  const totals = useMonthTotals()
  const categories = useCategories()
  const recurring = useRecurringBills()
  const startMonth = useStartMonth()
  const setStatus = useSetMonthStatus()
  const today = todayIso()
  const query = `?mes=${monthParam(ym)}`
  const isCurrent = sameYearMonth(ym, currentYearMonth())

  const setYm = (next: YearMonth) => setParams(sameYearMonth(next, currentYearMonth()) ? {} : { mes: monthParam(next) }, { replace: true })

  const expenses = useMemo(() => month.data?.expenses ?? [], [month.data])
  const summary = useMemo(() => summarizeMonth(expenses, activeMembers.map((m) => m.id)), [expenses, activeMembers])
  const catById = useMemo(() => new Map((categories.data ?? []).map((c) => [c.id, c])), [categories.data])
  const billById = useMemo(() => new Map((recurring.data ?? []).map((b) => [b.id, b])), [recurring.data])

  // Valor da mesma conta no mês anterior (conta fixa pelo modelo; outras pela descrição)
  const previousAmount = useMemo(() => {
    const map = new Map<string, number | null>()
    for (const e of prevMonth.data?.expenses ?? []) map.set(e.recurring_bill_id ?? `d:${e.description.toLowerCase()}`, e.amount_cents)
    return (e: Expense) => map.get(e.recurring_bill_id ?? `d:${e.description.toLowerCase()}`)
  }, [prevMonth.data])

  // Aviso do sistema ao abrir o app (mês atual)
  useEffect(() => {
    if (me && isCurrent && expenses.length) notifyDueBills(expenses, today, me.reminder_days)
  }, [expenses, me, today, isCurrent])

  const paidCents = expenses.reduce((a, e) => a + (e.status === 'paid' ? (e.amount_cents ?? 0) : 0), 0)
  const pendingCents = summary.totalCents - paidCents
  const prevTotal = prevMonth.data?.expenses.reduce((a, e) => a + (e.amount_cents ?? 0), 0)
  const monthVar = variation(summary.totalCents, prevTotal)
  const paidPct = summary.totalCents ? (paidCents / summary.totalCents) * 100 : 0

  const upcoming = expenses
    .filter((e) => e.status !== 'paid' && e.due_date)
    .sort((a, b) => a.due_date!.localeCompare(b.due_date!))
    .slice(0, 4)
  const sorted = [...expenses.filter((e) => e.recurring_bill_id), ...expenses.filter((e) => !e.recurring_bill_id)]

  const byCategory = useMemo(() => {
    const map = new Map<string, number>()
    for (const e of expenses) if (e.amount_cents) map.set(e.category_id ?? '', (map.get(e.category_id ?? '') ?? 0) + e.amount_cents)
    return [...map.entries()].sort((a, b) => b[1] - a[1])
  }, [expenses])

  const history = useMemo(() => {
    const list = (totals.data ?? []).filter((t) => compareYearMonth(t, ym) <= 0).slice(-6)
    return list.map((t) => ({ key: monthParam(t), label: short(t.month), cents: t.total_cents, to: `/?mes=${monthParam(t)}` }))
  }, [totals.data, ym])

  const closed = month.data?.month.status === 'closed'
  const isPast = compareYearMonth(ym, currentYearMonth()) < 0
  const monthName = MONTH_NAMES[ym.month - 1]

  return (
    <>
      <NavBar
        title={monthName}
        subtitle={`${greeting()}${me ? `, ${displayName(me)}` : ''}`}
        right={
          <>
            <IconButton label="Mês anterior" onClick={() => setYm(addMonths(ym, -1))}>
              <ChevronLeft className="size-5" strokeWidth={2.2} aria-hidden />
            </IconButton>
            <IconButton label="Próximo mês" onClick={() => setYm(addMonths(ym, 1))}>
              <ChevronRight className="size-5" strokeWidth={2.2} aria-hidden />
            </IconButton>
          </>
        }
      >
        <p className="mt-0.5 flex items-center gap-2 text-[0.9375rem] text-muted">
          {ym.year}
          {closed && (
            <span className="flex items-center gap-1">
              · <Lock className="size-3.5" aria-hidden /> fechado
            </span>
          )}
          {!isCurrent && (
            <button onClick={() => setYm(currentYearMonth())} className="font-medium text-primary">
              · Voltar para hoje
            </button>
          )}
        </p>
      </NavBar>

      {month.isPending ? (
        <Spinner />
      ) : month.isError ? (
        <ErrorBox message={friendlyError(month.error)} onRetry={() => month.refetch()} />
      ) : !month.data ? (
        <Card>
          <EmptyState
            icon={<CalendarPlus strokeWidth={1.8} />}
            title={`${monthName} ainda não começou`}
            action={
              <Button size="md" loading={startMonth.isPending} onClick={() => startMonth.mutate(ym)}>
                Começar {monthName.toLowerCase()}
              </Button>
            }
          >
            {isPast ? 'Quer lançar as contas desse mês agora?' : 'As contas fixas aparecem sozinhas.'}
          </EmptyState>
          {startMonth.error && <ErrorBox message={friendlyError(startMonth.error)} />}
        </Card>
      ) : (
        <div className="flex flex-col gap-7">
          {/* Resumo do mês */}
          <Card className="!p-5">
            <p className="text-[0.9375rem] text-muted">Total do mês</p>
            <Money cents={summary.totalCents} className="mt-0.5 block text-[2.5rem] leading-[1.1] font-bold" />
            {monthVar && monthVar.pct !== 0 && (
              <p className="mt-1 flex items-center gap-1 text-[0.875rem] text-muted">
                {monthVar.pct > 0 ? <ArrowUpRight className="size-4" aria-hidden /> : <ArrowDownRight className="size-4" aria-hidden />}
                {Math.abs(monthVar.pct)}% {monthVar.pct > 0 ? 'a mais' : 'a menos'} que {MONTH_NAMES[prevYm.month - 1].toLowerCase()}
              </p>
            )}

            <div
              className="mt-5 h-2 overflow-hidden rounded-full bg-surface-2"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(paidPct)}
              aria-label="Quanto já foi pago"
            >
              <div className="h-full rounded-full bg-primary transition-[width] duration-700" style={{ width: `${paidPct}%` }} />
            </div>
            <div className="mt-2.5 flex justify-between text-[0.875rem]">
              <span className="flex items-center gap-1.5 text-muted">
                <span className="size-2 rounded-full bg-primary" /> Pago <Money cents={paidCents} className="font-semibold text-ink" />
              </span>
              <span className="flex items-center gap-1.5 text-muted">
                <span className="size-2 rounded-full bg-[#dfe3e8]" /> A pagar <Money cents={pendingCents} className="font-semibold text-ink" />
              </span>
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-line pt-4">
              <div>
                <p className="text-[0.9375rem] font-medium">{summary.evenSplit ? 'Cada um paga' : 'Sua parte'}</p>
                {summary.awaitingCount > 0 && (
                  <p className="text-[0.8125rem] text-muted">
                    {summary.awaitingCount} {summary.awaitingCount === 1 ? 'conta ainda sem valor' : 'contas ainda sem valor'}
                  </p>
                )}
              </div>
              <Money cents={summary.evenSplit ? summary.eachCents : (summary.perMember.get(me?.id ?? '') ?? 0)} className="text-[1.375rem] font-bold text-primary-strong" />
            </div>
          </Card>

          {/* Próximos vencimentos */}
          {upcoming.length > 0 && !closed && (
            <section>
              <SectionTitle>A pagar</SectionTitle>
              <List>
                {upcoming.map((e) => {
                  const state = dueState(e, today)
                  return (
                    <Row
                      key={e.id}
                      as={(content, cls) => (
                        <Link to={`/conta/${e.id}${query}`} className={cls}>
                          {content}
                        </Link>
                      )}
                      icon={<DateTile iso={e.due_date!} overdue={state === 'overdue'} />}
                      title={e.description}
                      subtitle={
                        <span className={state === 'overdue' ? 'font-medium text-danger' : state === 'today' ? 'font-medium text-ink' : ''}>{dueLabel(e, today)}</span>
                      }
                      trailing={
                        e.amount_cents == null ? (
                          <span className="text-[0.9375rem] text-primary">Informar</span>
                        ) : (
                          <Money cents={e.amount_cents} className="text-[1.0625rem] font-semibold" />
                        )
                      }
                      chevron
                    />
                  )
                })}
              </List>
            </section>
          )}

          {/* Contas do mês */}
          <section>
            <SectionTitle action={<span className="text-[0.9375rem] text-muted">{summary.paidCount} de {summary.billCount} pagas</span>}>Contas</SectionTitle>
            {expenses.length === 0 ? (
              <Card>
                <EmptyState icon={<ReceiptText strokeWidth={1.8} />} title="Nenhuma conta neste mês">
                  Toque no <strong>+</strong> para lançar a primeira.
                </EmptyState>
              </Card>
            ) : (
              <List>
                {sorted.map((e) => {
                  const state = dueState(e, today)
                  const v = variation(e.amount_cents, previousAmount(e))
                  const provider = billById.get(e.recurring_bill_id ?? '')?.provider
                  return (
                    <Row
                      key={e.id}
                      as={(content, cls) => (
                        <Link to={`/conta/${e.id}${query}`} className={cls}>
                          {content}
                        </Link>
                      )}
                      icon={<CategoryIcon category={catById.get(e.category_id ?? '')} />}
                      title={e.description}
                      subtitle={
                        state === 'paid' ? (
                          <span className="flex items-center gap-1">
                            <Check className="size-3.5 text-ok" strokeWidth={3} aria-hidden /> Paga{provider ? ` · ${provider}` : ''}
                          </span>
                        ) : (
                          <span className={state === 'overdue' ? 'text-danger' : ''}>{[provider, e.due_date ? dueLabel(e, today) : 'Pendente'].filter(Boolean).join(' · ')}</span>
                        )
                      }
                      trailing={
                        <div className="flex shrink-0 flex-col items-end">
                          {e.amount_cents == null ? (
                            <span className="text-[0.9375rem] text-primary">Informar valor</span>
                          ) : (
                            <Money cents={e.amount_cents} className={`text-[1.0625rem] font-semibold ${state === 'paid' ? 'text-muted' : ''}`} />
                          )}
                          {v && v.pct !== 0 && (
                            <span className="num text-[0.75rem] text-muted" title={`Em ${MONTH_NAMES[prevYm.month - 1].toLowerCase()}: ${formatBRL(previousAmount(e)!)}`}>
                              {v.pct > 0 ? '↑' : '↓'} {Math.abs(v.pct)}%
                            </span>
                          )}
                        </div>
                      }
                    />
                  )
                })}
              </List>
            )}
          </section>

          {/* Gastos por categoria */}
          {byCategory.length > 1 && (
            <section>
              <SectionTitle>Por categoria</SectionTitle>
              <Card className="flex flex-col gap-3.5">
                {byCategory.map(([catId, cents]) => {
                  const cat = catById.get(catId)
                  return (
                    <div key={catId} className="flex items-center gap-3">
                      <CategoryIcon category={cat} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex justify-between gap-2 text-[0.9375rem]">
                          <span className="truncate">{cat?.name ?? 'Outros'}</span>
                          <Money cents={cents} className="font-medium" />
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                          <div className="h-full rounded-full bg-primary/80" style={{ width: `${(cents / byCategory[0][1]) * 100}%` }} />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </Card>
            </section>
          )}

          {/* Por pessoa */}
          {summary.totalCents > 0 && (
            <section>
              <SectionTitle>Por pessoa</SectionTitle>
              <List>
                {activeMembers.map((m) => (
                  <Row
                    key={m.id}
                    icon={<Avatar member={m} />}
                    title={
                      <>
                        {displayName(m)}
                        {m.id === me?.id && <span className="text-muted"> (você)</span>}
                      </>
                    }
                    trailing={<Money cents={summary.perMember.get(m.id) ?? 0} className="text-[1.0625rem] font-semibold" />}
                  />
                ))}
              </List>
            </section>
          )}

          {/* Últimos meses */}
          {history.length > 1 && (
            <section>
              <SectionTitle
                action={
                  <Link to="/historico" className="text-[0.9375rem] text-primary">
                    Ver tudo
                  </Link>
                }
              >
                Últimos meses
              </SectionTitle>
              <Card className="!pt-5">
                <MiniBars data={history} focus={monthParam(ym)} />
              </Card>
            </section>
          )}

          {/* Fechar / reabrir o mês */}
          {expenses.length > 0 && (
            <div>
              {closed ? (
                <Button
                  variant="secondary"
                  className="w-full"
                  loading={setStatus.isPending}
                  onClick={() => {
                    if (window.confirm('Reabrir o mês? Os valores poderão ser alterados de novo.'))
                      setStatus.mutate({ monthId: month.data!.month.id, status: 'open' })
                  }}
                >
                  <LockOpen className="size-5" strokeWidth={1.8} aria-hidden /> Reabrir {monthName.toLowerCase()}
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  className="w-full"
                  loading={setStatus.isPending}
                  onClick={() => {
                    const msg =
                      summary.awaitingCount > 0
                        ? `Ainda há ${summary.awaitingCount} conta(s) sem valor. Fechar o mês mesmo assim?`
                        : 'Fechar o mês? Depois disso ninguém altera os valores sem reabrir.'
                    if (window.confirm(msg)) setStatus.mutate({ monthId: month.data!.month.id, status: 'closed' })
                  }}
                >
                  <Lock className="size-5" strokeWidth={1.8} aria-hidden /> Fechar {monthName.toLowerCase()}
                </Button>
              )}
              <p className="mt-2 px-1 text-center text-[0.8125rem] text-muted">
                {closed ? 'Mês fechado: ninguém altera os valores.' : 'Feche o mês quando todos tiverem acertado.'}
              </p>
              {setStatus.error && (
                <div className="mt-3">
                  <ErrorBox message={friendlyError(setStatus.error)} />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </>
  )
}
