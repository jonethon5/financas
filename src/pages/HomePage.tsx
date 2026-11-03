import { useEffect, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router'
import { AlertTriangle, ArrowDownRight, ArrowUpRight, BellRing, CalendarClock, ChevronLeft, ChevronRight, Lock, LockOpen, ReceiptText } from 'lucide-react'
import { Avatar, displayName } from '../components/Avatar'
import { CategoryIcon } from '../components/CategoryIcon'
import { Badge, Button, Card, EmptyState, ErrorBox, Money, SectionTitle, Spinner } from '../components/ui'
import { useCategories, useMonth, useRecurringBills, useSetMonthStatus, useStartMonth } from '../data/hooks'
import { useHousehold } from '../household/HouseholdProvider'
import { addMonths, compareYearMonth, currentYearMonth, greeting, MONTH_NAMES, monthLabel, sameYearMonth, type YearMonth } from '../lib/dates'
import { dueLabel, dueState, todayIso, type DueState } from '../lib/due'
import { formatBRL } from '../lib/money'
import { notifyDueBills } from '../lib/notify'
import { summarizeMonth, variation } from '../lib/summary'
import { friendlyError } from '../lib/supabase'
import type { Category, Expense } from '../types'

export function parseMonthParam(value: string | null): YearMonth {
  const m = value?.match(/^(\d{4})-(\d{2})$/)
  if (!m) return currentYearMonth()
  const month = Number(m[2])
  return month >= 1 && month <= 12 ? { year: Number(m[1]), month } : currentYearMonth()
}

export const monthParam = (ym: YearMonth) => `${ym.year}-${String(ym.month).padStart(2, '0')}`

const STATE_BADGE: Record<DueState, { tone: 'ok' | 'warn' | 'danger' | 'neutral'; label?: string } | null> = {
  paid: { tone: 'ok', label: 'Paga' },
  overdue: { tone: 'danger' },
  today: { tone: 'warn' },
  soon: { tone: 'warn' },
  later: null,
  'no-date': null,
}

function MonthSwitcher({ ym, onChange }: { ym: YearMonth; onChange: (ym: YearMonth) => void }) {
  const isCurrent = sameYearMonth(ym, currentYearMonth())
  const btn = 'grid size-12 place-items-center rounded-full bg-surface shadow-soft border border-line/70 hover:bg-surface-2 transition'
  return (
    <div className="mb-5 flex items-center justify-between gap-3">
      <button onClick={() => onChange(addMonths(ym, -1))} className={btn} aria-label="Mês anterior">
        <ChevronLeft className="size-6" aria-hidden />
      </button>
      <div className="text-center">
        <p className="text-lg font-bold">{monthLabel(ym)}</p>
        {!isCurrent && (
          <button onClick={() => onChange(currentYearMonth())} className="text-[0.9375rem] font-semibold text-primary">
            Ir para o mês atual
          </button>
        )}
      </div>
      <button onClick={() => onChange(addMonths(ym, 1))} className={btn} aria-label="Próximo mês">
        <ChevronRight className="size-6" aria-hidden />
      </button>
    </div>
  )
}

function ExpenseRow({
  expense,
  category,
  provider,
  previous,
  previousMonthName,
  today,
  query,
}: {
  expense: Expense
  category: Category | undefined
  provider: string | null
  previous: number | null | undefined
  previousMonthName: string
  today: string
  query: string
}) {
  const state = dueState(expense, today)
  const badge = STATE_BADGE[state]
  const v = variation(expense.amount_cents, previous)
  const subtitle = [provider, expense.status === 'paid' ? 'Paga' : expense.due_date ? dueLabel(expense, today) : null].filter(Boolean).join(' · ')

  return (
    <li>
      <Link to={`/conta/${expense.id}${query}`} className="flex items-center gap-3.5 px-4 py-3.5 transition hover:bg-surface-2 active:bg-surface-2">
        <CategoryIcon category={category} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[1.0625rem] font-semibold">{expense.description}</p>
          <p className={`truncate text-[0.9375rem] ${state === 'overdue' ? 'font-semibold text-danger' : state === 'paid' ? 'font-medium text-ok' : 'text-muted'}`}>
            {subtitle}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {expense.amount_cents == null ? (
            <Badge tone="primary">Informar valor</Badge>
          ) : (
            <Money cents={expense.amount_cents} className="text-[1.0625rem] font-bold" />
          )}
          {v && v.pct !== 0 ? (
            <span
              className={`flex items-center text-[0.8125rem] font-semibold ${v.pct > 0 ? 'text-danger' : 'text-ok'}`}
              title={`Em ${previousMonthName}: ${formatBRL(previous!)}`}
            >
              {v.pct > 0 ? <ArrowUpRight className="size-3.5" aria-hidden /> : <ArrowDownRight className="size-3.5" aria-hidden />}
              {v.pct > 0 ? '+' : ''}
              {v.pct}% vs {previousMonthName.slice(0, 3).toLowerCase()}
            </span>
          ) : badge ? (
            <Badge tone={badge.tone}>{badge.label ?? dueLabel(expense, today)}</Badge>
          ) : null}
        </div>
      </Link>
    </li>
  )
}

export function HomePage() {
  const { me, activeMembers } = useHousehold()
  const [params, setParams] = useSearchParams()
  const ym = parseMonthParam(params.get('mes'))
  const prevYm = addMonths(ym, -1)
  const month = useMonth(ym)
  const prevMonth = useMonth(prevYm)
  const categories = useCategories()
  const recurring = useRecurringBills()
  const startMonth = useStartMonth()
  const setStatus = useSetMonthStatus()
  const today = todayIso()
  const query = `?mes=${monthParam(ym)}`

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

  const attention = expenses.filter((e) => ['overdue', 'today', 'soon'].includes(dueState(e, today)))
  const overdue = attention.filter((e) => dueState(e, today) === 'overdue')
  const fixed = expenses.filter((e) => e.recurring_bill_id)
  const others = expenses.filter((e) => !e.recurring_bill_id)
  const closed = month.data?.month.status === 'closed'
  const isPast = compareYearMonth(ym, currentYearMonth()) < 0

  // Aviso do sistema ao abrir o app (mês atual)
  useEffect(() => {
    if (me && sameYearMonth(ym, currentYearMonth()) && expenses.length) notifyDueBills(expenses, today, me.reminder_days)
  }, [expenses, me, today, ym])

  const pct = summary.billCount ? Math.round((summary.paidCount / summary.billCount) * 100) : 0
  const headline =
    overdue.length > 0
      ? `${overdue.length} ${overdue.length === 1 ? 'conta vencida' : 'contas vencidas'}`
      : attention.length > 0
        ? `${attention.length} ${attention.length === 1 ? 'conta vence' : 'contas vencem'} logo`
        : 'Suas contas em dia'

  return (
    <>
      <header className="mb-6 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-muted">
            {greeting()}
            {me ? `, ${displayName(me)}` : ''}! 👋
          </p>
          <h1 className="text-[1.75rem] leading-tight font-bold tracking-tight">{headline}</h1>
        </div>
        {me && (
          <Link to="/ajustes" aria-label="Ajustes" className="md:hidden">
            <Avatar member={me} size="lg" />
          </Link>
        )}
      </header>

      <MonthSwitcher ym={ym} onChange={setYm} />

      {month.isPending ? (
        <Spinner />
      ) : month.isError ? (
        <ErrorBox message={friendlyError(month.error)} onRetry={() => month.refetch()} />
      ) : !month.data ? (
        <Card>
          <EmptyState
            icon={<CalendarClock className="size-8" />}
            title="Nada lançado neste mês"
            action={
              <Button size="md" variant="soft" loading={startMonth.isPending} onClick={() => startMonth.mutate(ym)}>
                Começar {MONTH_NAMES[ym.month - 1].toLowerCase()}
              </Button>
            }
          >
            {isPast ? 'Quer lançar as contas desse mês agora?' : 'As contas fixas aparecem automaticamente.'}
          </EmptyState>
          {startMonth.error && <ErrorBox message={friendlyError(startMonth.error)} />}
        </Card>
      ) : (
        <>
          {closed && (
            <div className="mb-4 flex items-center gap-3 rounded-2xl bg-surface-2 px-4 py-3">
              <Lock className="size-5 shrink-0 text-muted" aria-hidden />
              <p className="flex-1 font-medium">Mês fechado. Os valores não podem ser alterados.</p>
            </div>
          )}

          {/* Resumo */}
          <Card className="mb-5">
            <p className="font-semibold text-muted">Total do mês</p>
            <Money cents={summary.totalCents} className="mt-0.5 block text-[2.5rem] leading-tight font-bold tracking-tight" />
            <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-primary-soft px-4 py-3.5">
              <p className="font-semibold text-primary-strong">{summary.evenSplit ? 'Cada um paga' : 'Sua parte'}</p>
              <Money
                cents={summary.evenSplit ? summary.eachCents : (summary.perMember.get(me?.id ?? '') ?? 0)}
                className="text-[1.5rem] font-bold text-primary-strong"
              />
            </div>
            <div className="mt-4 mb-2 flex items-center justify-between text-[0.9375rem]">
              <span className="font-semibold text-muted">Contas pagas</span>
              <span className="font-bold tabular-nums">
                {summary.paidCount} <span className="font-medium text-muted">de {summary.billCount}</span>
              </span>
            </div>
            <div
              className="h-2.5 overflow-hidden rounded-full bg-surface-2"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={pct}
              aria-label="Contas pagas"
            >
              <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${pct}%` }} />
            </div>
            {summary.awaitingCount > 0 && (
              <p className="mt-3 text-[0.9375rem] text-muted">
                {summary.awaitingCount} {summary.awaitingCount === 1 ? 'conta aguardando valor' : 'contas aguardando valor'}
              </p>
            )}
          </Card>

          {/* Alertas de vencimento */}
          {attention.length > 0 && !closed && (
            <div
              className={`mb-5 rounded-3xl p-4 ${overdue.length ? 'bg-danger-soft' : 'bg-warn-soft'}`}
              role="status"
            >
              <div className="mb-2 flex items-center gap-2">
                {overdue.length ? (
                  <AlertTriangle className="size-5 text-danger" aria-hidden />
                ) : (
                  <BellRing className="size-5 text-warn" aria-hidden />
                )}
                <p className={`font-bold ${overdue.length ? 'text-danger' : 'text-warn'}`}>Atenção aos vencimentos</p>
              </div>
              <ul className="space-y-1.5">
                {attention.map((e) => (
                  <li key={e.id}>
                    <Link to={`/conta/${e.id}${query}`} className="flex items-center justify-between gap-3 font-medium">
                      <span className="truncate">
                        {e.description} — {dueLabel(e, today).toLowerCase()}
                      </span>
                      {e.amount_cents != null && <Money cents={e.amount_cents} className="shrink-0 font-semibold" />}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {expenses.length === 0 ? (
            <Card>
              <EmptyState icon={<ReceiptText className="size-8" />} title="Nenhuma conta neste mês">
                Toque no <strong>+</strong> para lançar a primeira.
              </EmptyState>
            </Card>
          ) : (
            <>
              {fixed.length > 0 && (
                <section className="mb-5">
                  <SectionTitle>Contas fixas</SectionTitle>
                  <Card className="overflow-hidden !p-0">
                    <ul className="divide-y divide-line">
                      {fixed.map((e) => (
                        <ExpenseRow
                          key={e.id}
                          expense={e}
                          category={catById.get(e.category_id ?? '')}
                          provider={billById.get(e.recurring_bill_id ?? '')?.provider ?? null}
                          previous={previousAmount(e)}
                          previousMonthName={MONTH_NAMES[prevYm.month - 1]}
                          today={today}
                          query={query}
                        />
                      ))}
                    </ul>
                  </Card>
                </section>
              )}
              {others.length > 0 && (
                <section className="mb-5">
                  <SectionTitle>Compras e extras</SectionTitle>
                  <Card className="overflow-hidden !p-0">
                    <ul className="divide-y divide-line">
                      {others.map((e) => (
                        <ExpenseRow
                          key={e.id}
                          expense={e}
                          category={catById.get(e.category_id ?? '')}
                          provider={null}
                          previous={previousAmount(e)}
                          previousMonthName={MONTH_NAMES[prevYm.month - 1]}
                          today={today}
                          query={query}
                        />
                      ))}
                    </ul>
                  </Card>
                </section>
              )}
            </>
          )}

          {/* Quanto cada um paga */}
          {summary.totalCents > 0 && (
            <section className="mb-5">
              <SectionTitle>Por pessoa</SectionTitle>
              <Card className="overflow-hidden !p-0">
                <ul className="divide-y divide-line">
                  {activeMembers.map((m) => (
                    <li key={m.id} className="flex items-center gap-3.5 px-4 py-3">
                      <Avatar member={m} />
                      <p className="min-w-0 flex-1 truncate font-semibold">{displayName(m)}</p>
                      <Money cents={summary.perMember.get(m.id) ?? 0} className="font-bold" />
                    </li>
                  ))}
                </ul>
              </Card>
            </section>
          )}

          {/* Fechar / reabrir o mês */}
          {expenses.length > 0 && (
            <div className="mt-2">
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
                  <LockOpen className="size-5" aria-hidden /> Reabrir o mês
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
                  <Lock className="size-5" aria-hidden /> Fechar o mês
                </Button>
              )}
              {setStatus.error && <div className="mt-3"><ErrorBox message={friendlyError(setStatus.error)} /></div>}
            </div>
          )}
        </>
      )}
    </>
  )
}
