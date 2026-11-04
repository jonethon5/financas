import { useState, type ReactNode } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { Check, CheckCircle2, Copy, ExternalLink, FileText, Hash, Pencil, QrCode, RotateCcw, ScanBarcode } from 'lucide-react'
import { Avatar, displayName } from '../components/Avatar'
import { CategoryIcon } from '../components/CategoryIcon'
import { Sheet } from '../components/Sheet'
import { BackButton, Button, Card, Chip, ErrorBox, IconTile, List, Money, NavBar, NavButton, Row, SectionTitle, Spinner } from '../components/ui'
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
    <section>
      <SectionTitle>Últimos meses</SectionTitle>
      <Card className="!pt-5">
        <div className="flex h-32 items-end gap-2" role="img" aria-label={`Histórico dos últimos ${rows.length} meses`}>
          {rows.map((r, i) => {
            const last = i === rows.length - 1
            return (
              <div key={`${r.year}-${r.month}`} className="flex flex-1 flex-col items-center gap-1.5" title={`${MONTH_NAMES[r.month - 1]}/${r.year}: ${formatBRL(r.amount_cents!)}`}>
                <div
                  className={`w-full max-w-8 rounded-[0.4rem] ${last ? 'bg-primary' : 'bg-[#dfe3e8]'}`}
                  style={{ height: `${Math.max(6, (r.amount_cents! / max) * 100)}%` }}
                />
                <span className={`text-[0.6875rem] ${last ? 'font-semibold text-ink' : 'text-muted'}`}>{MONTH_NAMES[r.month - 1].slice(0, 3)}</span>
              </div>
            )
          })}
        </div>
        <div className="mt-4 grid grid-cols-2 border-t border-line pt-3 text-[0.875rem] text-muted">
          <p>
            Média <span className="num block text-[1.0625rem] font-semibold text-ink">{formatBRL(avg)}</span>
          </p>
          <p>
            Maior <span className="num block text-[1.0625rem] font-semibold text-ink">{formatBRL(max)}</span>
          </p>
        </div>
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

  const statusLine =
    state === 'paid' ? (
      <span className="flex items-center justify-center gap-1.5 text-ok">
        <Check className="size-4" strokeWidth={3} aria-hidden />
        Paga{paidBy ? ` por ${displayName(paidBy)}` : ''}
        {expense.paid_at ? ` em ${formatDate(expense.paid_at)}` : ''}
      </span>
    ) : (
      <span className={state === 'overdue' ? 'font-medium text-danger' : state === 'today' ? 'font-medium' : ''}>
        {expense.due_date ? `${dueLabel(expense, today)} · ${formatDate(expense.due_date)}` : 'Pendente'}
      </span>
    )

  const tap = (onClick: () => void) => (content: ReactNode, cls: string) => (
    <button type="button" onClick={onClick} className={cls}>
      {content}
    </button>
  )

  return (
    <>
      <NavBar
        large={false}
        title={expense.description}
        left={<BackButton label="Início" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate(`/${q}`))} />}
        right={!closed && <NavButton onClick={() => navigate(editHref)}>Editar</NavButton>}
      />

      <div className="flex flex-col gap-7">
        {/* Cabeçalho da conta */}
        <div className="pt-4 text-center">
          <div className="flex justify-center">
            <CategoryIcon category={category} size="lg" />
          </div>
          <h1 className="mt-3 text-[1.375rem] font-semibold tracking-tight">{expense.description}</h1>
          <p className="text-[0.9375rem] text-muted">{[bill?.provider, `${MONTH_NAMES[ym.month - 1]} de ${ym.year}`].filter(Boolean).join(' · ')}</p>
          {expense.amount_cents == null ? (
            <p className="mt-4 text-[1.75rem] font-bold text-faint">Sem valor ainda</p>
          ) : (
            <Money cents={expense.amount_cents} className="mt-3 block text-[2.75rem] leading-[1.1] font-bold" />
          )}
          <p className="mt-2 text-[0.9375rem] text-muted">{statusLine}</p>
        </div>

        {/* Ações principais */}
        <div className="flex flex-col gap-3">
          {expense.amount_cents == null && !closed && (
            <Button onClick={() => navigate(editHref)}>
              <Pencil className="size-5" strokeWidth={1.8} aria-hidden /> Informar valor
            </Button>
          )}
          {expense.barcode && (
            <Button onClick={() => copy(expense.barcode!, 'Código copiado')} variant={expense.status === 'paid' ? 'secondary' : 'primary'}>
              <Copy className="size-5" strokeWidth={1.8} aria-hidden /> Copiar código de barras
            </Button>
          )}
          {expense.pix_code && (
            <Button onClick={() => copy(expense.pix_code!, 'Pix copiado')} variant="secondary">
              <QrCode className="size-5" strokeWidth={1.8} aria-hidden /> Copiar Pix copia e cola
            </Button>
          )}
          {!closed &&
            (expense.status === 'paid' ? (
              <Button variant="secondary" loading={setPaid.isPending} onClick={() => setPaid.mutate({ expense, paid: false, paidBy: null })}>
                <RotateCcw className="size-5" strokeWidth={1.8} aria-hidden /> Marcar como não paga
              </Button>
            ) : (
              <Button
                variant={expense.barcode || expense.amount_cents == null ? 'secondary' : 'primary'}
                onClick={() => {
                  setPayer(expense.paid_by_member_id ?? me?.id ?? null)
                  setPayOpen(true)
                }}
              >
                <CheckCircle2 className="size-5" strokeWidth={1.8} aria-hidden /> Marcar como paga
              </Button>
            ))}
          {setPaid.error && <ErrorBox message={friendlyError(setPaid.error)} />}
        </div>

        {/* Informações da conta */}
        {(bill?.bill_url || bill?.customer_code || expense.barcode) && (
          <List>
            {bill?.bill_url && (
              <Row
                as={(content, cls) => (
                  <a href={bill.bill_url!} target="_blank" rel="noopener noreferrer" className={cls}>
                    {content}
                  </a>
                )}
                icon={
                  <IconTile>
                    <ExternalLink strokeWidth={1.8} />
                  </IconTile>
                }
                title={`Tirar 2ª via${bill.provider ? ` · ${bill.provider}` : ''}`}
                chevron
              />
            )}
            {bill?.customer_code && (
              <Row
                as={tap(() => copy(bill.customer_code!, 'Código do cliente copiado'))}
                icon={
                  <IconTile>
                    <Hash strokeWidth={1.8} />
                  </IconTile>
                }
                title={<span className="num">{bill.customer_code}</span>}
                subtitle="Código do cliente · toque para copiar"
                trailing={<Copy className="size-[1.125rem] text-faint" aria-hidden />}
              />
            )}
            {expense.barcode && (
              <Row
                as={tap(() => copy(expense.barcode!, 'Código copiado'))}
                icon={
                  <IconTile>
                    <ScanBarcode strokeWidth={1.8} />
                  </IconTile>
                }
                title={<span className="num block text-[0.875rem] leading-snug whitespace-normal">{formatBillCode(expense.barcode)}</span>}
                subtitle="Código de barras · toque para copiar"
              />
            )}
          </List>
        )}

        {expense.shares.length > 0 && (
          <section>
            <SectionTitle>Divisão</SectionTitle>
            <List>
              {expense.shares.map((s) => {
                const m = members.find((x) => x.id === s.member_id)
                if (!m) return null
                return (
                  <Row
                    key={s.member_id}
                    icon={<Avatar member={m} />}
                    title={displayName(m)}
                    subtitle={s.weight != null ? `${s.weight}%` : undefined}
                    trailing={<Money cents={s.amount_cents} className="text-[1.0625rem] font-semibold" />}
                  />
                )
              })}
            </List>
          </section>
        )}

        {expense.recurring_bill_id && <BillHistory recurringBillId={expense.recurring_bill_id} />}

        {(expense.notes || expense.attachment_path) && (
          <section>
            <SectionTitle>Observação</SectionTitle>
            <Card>
              {expense.notes && <p className="whitespace-pre-wrap">{expense.notes}</p>}
              {expense.attachment_path && (
                <Button variant="secondary" size="md" className={`w-full !bg-surface-2 !shadow-none ${expense.notes ? 'mt-4' : ''}`} onClick={openAttachment}>
                  <FileText className="size-5" strokeWidth={1.8} aria-hidden /> Ver anexo
                </Button>
              )}
            </Card>
          </section>
        )}

        {!closed && (
          <div>
            <Button
              variant="danger"
              className="w-full"
              loading={remove.isPending}
              onClick={() => {
                if (window.confirm(`Apagar “${expense.description}”? Isso não pode ser desfeito.`))
                  remove.mutate(expense.id, {
                    onSuccess: () => {
                      toast('Conta apagada')
                      navigate(`/${q}`, { replace: true })
                    },
                  })
              }}
            >
              Apagar conta
            </Button>
            {remove.error && (
              <div className="mt-3">
                <ErrorBox message={friendlyError(remove.error)} />
              </div>
            )}
          </div>
        )}
      </div>

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
