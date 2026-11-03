import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { CheckCircle2, ChevronLeft, Copy, ExternalLink, FileText, Pencil, QrCode, RotateCcw, Trash2 } from 'lucide-react'
import { Avatar, displayName } from '../components/Avatar'
import { CategoryIcon } from '../components/CategoryIcon'
import { Sheet } from '../components/Sheet'
import { Badge, Button, Card, Chip, ErrorBox, Money, SectionTitle, Spinner } from '../components/ui'
import { copyText, useToast } from '../components/Toast'
import { useBillHistory, useCategories, useDeleteExpense, useMonth, useRecurringBills, useSetPaid } from '../data/hooks'
import { useRepo } from '../data/repo'
import { useHousehold } from '../household/HouseholdProvider'
import { formatBillCode } from '../lib/barcode'
import { MONTH_NAMES } from '../lib/dates'
import { dueLabel, dueState, formatDate, todayIso } from '../lib/due'
import { formatBRL } from '../lib/money'
import { friendlyError } from '../lib/supabase'
import { monthParam, parseMonthParam } from './HomePage'

function BillHistory({ recurringBillId }: { recurringBillId: string }) {
  const history = useBillHistory(recurringBillId)
  const rows = (history.data ?? []).filter((r) => r.amount_cents != null).reverse()
  if (rows.length < 2) return null
  const max = Math.max(...rows.map((r) => r.amount_cents!))
  const avg = Math.round(rows.reduce((a, r) => a + r.amount_cents!, 0) / rows.length)
  return (
    <section className="mb-5">
      <SectionTitle>Últimos meses</SectionTitle>
      <Card>
        <div className="flex h-36 items-end gap-1.5" role="img" aria-label={`Histórico dos últimos ${rows.length} meses`}>
          {rows.map((r, i) => {
            const last = i === rows.length - 1
            return (
              <div key={`${r.year}-${r.month}`} className="flex flex-1 flex-col items-center gap-1.5" title={`${MONTH_NAMES[r.month - 1]}/${r.year}: ${formatBRL(r.amount_cents!)}`}>
                <div
                  className={`w-full max-w-9 rounded-lg ${last ? 'bg-primary' : 'bg-primary/25'}`}
                  style={{ height: `${Math.max(6, (r.amount_cents! / max) * 100)}%` }}
                />
                <span className="text-xs text-muted">{MONTH_NAMES[r.month - 1].slice(0, 3)}</span>
              </div>
            )
          })}
        </div>
        <p className="mt-3 text-[0.9375rem] text-muted">
          Média: <strong className="text-ink">{formatBRL(avg)}</strong> · Maior: <strong className="text-ink">{formatBRL(max)}</strong>
        </p>
      </Card>
    </section>
  )
}

export function ExpenseDetailPage() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const toast = useToast()
  const repo = useRepo()
  const { members, me } = useHousehold()
  const ym = parseMonthParam(params.get('mes'))
  const month = useMonth(ym)
  const categories = useCategories()
  const recurring = useRecurringBills()
  const setPaid = useSetPaid()
  const remove = useDeleteExpense()
  const [payOpen, setPayOpen] = useState(false)
  const [payer, setPayer] = useState<string | null>(me?.id ?? null)

  if (month.isPending) return <Spinner />
  if (month.error) return <ErrorBox message={friendlyError(month.error)} onRetry={() => month.refetch()} />
  const expense = month.data?.expenses.find((e) => e.id === id)
  if (!expense) return <ErrorBox message="Conta não encontrada. Ela pode ter sido apagada." />

  const today = todayIso()
  const category = categories.data?.find((c) => c.id === expense.category_id)
  const bill = recurring.data?.find((r) => r.id === expense.recurring_bill_id)
  const closed = month.data!.month.status === 'closed'
  const state = dueState(expense, today)
  const paidBy = members.find((m) => m.id === expense.paid_by_member_id)
  const q = `?mes=${monthParam(ym)}`
  const editHref = `/conta/${expense.id}/editar${q}`

  async function copy(text: string, message: string) {
    if (await copyText(text)) toast(message)
  }

  async function openAttachment() {
    try {
      const url = await repo.attachmentUrl(expense!.attachment_path!)
      if (url) window.open(url, '_blank', 'noopener')
    } catch (err) {
      toast(friendlyError(err))
    }
  }

  const statusBadge =
    state === 'paid' ? (
      <Badge tone="ok">Paga</Badge>
    ) : state === 'overdue' ? (
      <Badge tone="danger">{dueLabel(expense, today)}</Badge>
    ) : state === 'today' || state === 'soon' ? (
      <Badge tone="warn">{dueLabel(expense, today)}</Badge>
    ) : (
      <Badge tone="neutral">Pendente</Badge>
    )

  return (
    <>
      <header className="mb-5 flex items-center justify-between gap-3">
        <button
          onClick={() => (window.history.length > 1 ? navigate(-1) : navigate(`/${q}`))}
          className="grid size-12 place-items-center rounded-full border border-line/70 bg-surface shadow-soft"
          aria-label="Voltar"
        >
          <ChevronLeft className="size-6" aria-hidden />
        </button>
        {!closed && (
          <Link to={editHref} className="flex min-h-12 items-center gap-2 rounded-full border border-line/70 bg-surface px-5 font-semibold shadow-soft">
            <Pencil className="size-[1.125rem]" aria-hidden /> Editar
          </Link>
        )}
      </header>

      <Card className="mb-5 text-center">
        <div className="flex justify-center">
          <CategoryIcon category={category} size="lg" />
        </div>
        <h1 className="mt-3 text-2xl font-bold tracking-tight">{expense.description}</h1>
        <p className="text-muted">
          {[bill?.provider, `${MONTH_NAMES[ym.month - 1]} de ${ym.year}`].filter(Boolean).join(' · ')}
        </p>
        {expense.amount_cents == null ? (
          <p className="mt-4 text-2xl font-bold text-muted">Aguardando valor</p>
        ) : (
          <Money cents={expense.amount_cents} className="mt-3 block text-[2.5rem] leading-tight font-bold tracking-tight" />
        )}
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          {statusBadge}
          {expense.due_date && <Badge tone="neutral">Vencimento {formatDate(expense.due_date)}</Badge>}
        </div>
        {expense.status === 'paid' && paidBy && (
          <p className="mt-3 text-muted">
            Paga por <strong className="text-ink">{displayName(paidBy)}</strong>
            {expense.paid_at ? ` em ${formatDate(expense.paid_at)}` : ''}
          </p>
        )}
      </Card>

      {/* Ações principais (botões grandes) */}
      <div className="mb-5 flex flex-col gap-3">
        {expense.amount_cents == null && !closed && (
          <Link to={editHref} className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-primary text-[1.0625rem] font-semibold text-on-primary">
            <Pencil className="size-5" aria-hidden /> Informar valor
          </Link>
        )}
        {expense.barcode && (
          <Button onClick={() => copy(expense.barcode!, 'Código copiado')} variant={expense.status === 'paid' ? 'secondary' : 'primary'}>
            <Copy className="size-5" aria-hidden /> Copiar código de barras
          </Button>
        )}
        {expense.pix_code && (
          <Button onClick={() => copy(expense.pix_code!, 'Pix copiado')} variant="secondary">
            <QrCode className="size-5" aria-hidden /> Copiar Pix copia e cola
          </Button>
        )}
        {!closed &&
          (expense.status === 'paid' ? (
            <Button variant="secondary" loading={setPaid.isPending} onClick={() => setPaid.mutate({ expense, paid: false, paidBy: null })}>
              <RotateCcw className="size-5" aria-hidden /> Marcar como não paga
            </Button>
          ) : (
            <Button
              variant={expense.barcode ? 'soft' : 'primary'}
              onClick={() => {
                setPayer(expense.paid_by_member_id ?? me?.id ?? null)
                setPayOpen(true)
              }}
            >
              <CheckCircle2 className="size-5" aria-hidden /> Marcar como paga
            </Button>
          ))}
        {bill?.bill_url && (
          <a
            href={bill.bill_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-line bg-surface text-[1.0625rem] font-semibold hover:bg-surface-2"
          >
            <ExternalLink className="size-5" aria-hidden /> Tirar 2ª via {bill.provider ? `(${bill.provider})` : ''}
          </a>
        )}
        {setPaid.error && <ErrorBox message={friendlyError(setPaid.error)} />}
      </div>

      {(expense.barcode || bill?.customer_code) && (
        <Card className="mb-5 !p-0">
          {expense.barcode && (
            <div className="border-b border-line px-5 py-4 last:border-0">
              <p className="text-sm font-semibold text-muted">Código de barras</p>
              <p className="mt-1 font-mono text-[0.9375rem] break-all">{formatBillCode(expense.barcode)}</p>
            </div>
          )}
          {bill?.customer_code && (
            <button onClick={() => copy(bill.customer_code!, 'Código do cliente copiado')} className="flex w-full items-center gap-3 px-5 py-4 text-left">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-muted">Código do cliente / instalação</p>
                <p className="mt-1 font-mono text-lg">{bill.customer_code}</p>
              </div>
              <Copy className="size-5 text-primary" aria-label="Copiar" />
            </button>
          )}
        </Card>
      )}

      {expense.shares.length > 0 && (
        <section className="mb-5">
          <SectionTitle>Divisão</SectionTitle>
          <Card className="overflow-hidden !p-0">
            <ul className="divide-y divide-line">
              {expense.shares.map((s) => {
                const m = members.find((x) => x.id === s.member_id)
                if (!m) return null
                return (
                  <li key={s.member_id} className="flex items-center gap-3.5 px-4 py-3">
                    <Avatar member={m} />
                    <span className="min-w-0 flex-1 truncate font-semibold">
                      {displayName(m)}
                      {s.weight != null && <span className="font-normal text-muted"> · {s.weight}%</span>}
                    </span>
                    <Money cents={s.amount_cents} className="font-bold" />
                  </li>
                )
              })}
            </ul>
          </Card>
        </section>
      )}

      {expense.recurring_bill_id && <BillHistory recurringBillId={expense.recurring_bill_id} />}

      {(expense.notes || expense.attachment_path) && (
        <Card className="mb-5">
          {expense.notes && <p className="whitespace-pre-wrap">{expense.notes}</p>}
          {expense.attachment_path && (
            <Button variant="secondary" size="md" className={`w-full ${expense.notes ? 'mt-4' : ''}`} onClick={openAttachment}>
              <FileText className="size-5" aria-hidden /> Ver anexo
            </Button>
          )}
        </Card>
      )}

      {!closed && (
        <Button
          variant="danger"
          size="md"
          className="w-full"
          loading={remove.isPending}
          onClick={() => {
            if (window.confirm(`Apagar “${expense.description}”? Isso não pode ser desfeito.`))
              remove.mutate(expense.id, { onSuccess: () => { toast('Conta apagada'); navigate(`/${q}`, { replace: true }) } })
          }}
        >
          <Trash2 className="size-5" aria-hidden /> Apagar conta
        </Button>
      )}
      {remove.error && <div className="mt-3"><ErrorBox message={friendlyError(remove.error)} /></div>}

      <Sheet open={payOpen} onClose={() => setPayOpen(false)} title="Quem pagou?">
        <div className="flex flex-wrap gap-2">
          {members
            .filter((m) => m.active)
            .map((m) => (
              <Chip key={m.id} selected={payer === m.id} onClick={() => setPayer(m.id)} className="pl-1.5">
                <Avatar member={m} size="sm" />
                {displayName(m)}
              </Chip>
            ))}
        </div>
        <Button
          className="mt-6 w-full"
          disabled={!payer}
          loading={setPaid.isPending}
          onClick={() =>
            setPaid.mutate(
              { expense, paid: true, paidBy: payer },
              {
                onSuccess: () => {
                  setPayOpen(false)
                  toast('Conta marcada como paga')
                },
              },
            )
          }
        >
          Confirmar pagamento
        </Button>
      </Sheet>
    </>
  )
}
