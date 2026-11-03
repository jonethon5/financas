import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { Camera, CheckCircle2, ChevronDown, ChevronLeft, ClipboardPaste, Paperclip, ScanBarcode, X } from 'lucide-react'
import { Avatar, displayName } from '../components/Avatar'
import { CategoryIcon } from '../components/CategoryIcon'
import { Button, Card, Chip, ErrorBox, Field, Spinner, TextArea } from '../components/ui'
import { useToast } from '../components/Toast'
import { useCategories, useMonth, useRecurringBills, useSaveExpense } from '../data/hooks'
import { useRepo } from '../data/repo'
import { useHousehold } from '../household/HouseholdProvider'
import { onlyDigits, parseBillCode, formatBillCode, type BillCode } from '../lib/barcode'
import { MONTH_NAMES, currentYearMonth, sameYearMonth } from '../lib/dates'
import { formatDate, todayIso } from '../lib/due'
import { centsToInput, formatBRL, parseBRL } from '../lib/money'
import { parsePix } from '../lib/pix'
import { buildShares, splitEqual, type SplitMode } from '../lib/split'
import { friendlyError } from '../lib/supabase'
import type { Expense, ExpenseInput } from '../types'
import { monthParam, parseMonthParam } from './HomePage'

// Segmento da conta de consumo → categoria sugerida
const SEGMENT_CATEGORY: Record<number, string> = { 2: 'Água', 3: 'Luz', 4: 'Telefone' }

type FormState = {
  barcode: string
  description: string
  categoryId: string | null
  amount: string
  dueDate: string
  expenseDate: string
  paid: boolean
  paidBy: string | null
  participants: string[]
  mode: SplitMode
  weights: Record<string, string>
  amounts: Record<string, string>
  pixCode: string
  notes: string
}

function equalPercents(ids: string[]): Record<string, string> {
  const parts = ids.length ? splitEqual(100, ids.length) : []
  return Object.fromEntries(ids.map((id, i) => [id, String(parts[i])]))
}

function initialState(expense: Expense | undefined, memberIds: string[], meId: string | null, monthIso: string): FormState {
  if (!expense) {
    return {
      barcode: '',
      description: '',
      categoryId: null,
      amount: '',
      dueDate: '',
      expenseDate: monthIso,
      paid: false,
      paidBy: meId,
      participants: memberIds,
      mode: 'equal',
      weights: equalPercents(memberIds),
      amounts: {},
      pixCode: '',
      notes: '',
    }
  }
  const participants = expense.shares.length ? expense.shares.map((s) => s.member_id) : memberIds
  return {
    barcode: expense.barcode ?? '',
    description: expense.description,
    categoryId: expense.category_id,
    amount: centsToInput(expense.amount_cents),
    dueDate: expense.due_date ?? '',
    expenseDate: expense.expense_date,
    paid: expense.status === 'paid',
    paidBy: expense.paid_by_member_id ?? meId,
    participants,
    mode: expense.split_mode,
    weights:
      expense.split_mode === 'weights'
        ? Object.fromEntries(expense.shares.map((s) => [s.member_id, String(s.weight ?? 0)]))
        : equalPercents(participants),
    amounts: Object.fromEntries(expense.shares.map((s) => [s.member_id, centsToInput(s.amount_cents)])),
    pixCode: expense.pix_code ?? '',
    notes: expense.notes ?? '',
  }
}

export function ExpenseFormPage() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const toast = useToast()
  const repo = useRepo()
  const { household, activeMembers, members, me } = useHousehold()
  const ym = parseMonthParam(params.get('mes'))
  const month = useMonth(ym)
  const categories = useCategories()
  const recurring = useRecurringBills()
  const save = useSaveExpense()

  const expense = id ? month.data?.expenses.find((e) => e.id === id) : undefined
  const recurringBill = expense?.recurring_bill_id ? recurring.data?.find((r) => r.id === expense.recurring_bill_id) : undefined
  const monthIso = sameYearMonth(ym, currentYearMonth()) ? todayIso() : `${monthParam(ym)}-01`

  const [form, setForm] = useState<FormState | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [codeInfo, setCodeInfo] = useState<BillCode | null>(null)
  const [moreOpen, setMoreOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (form || !month.data) return
    if (id && !expense) return
    const state = initialState(
      expense,
      activeMembers.map((m) => m.id),
      me?.id ?? null,
      monthIso,
    )
    setForm(state)
    if (state.barcode) setCodeInfo(parseBillCode(state.barcode))
    setMoreOpen(Boolean(expense?.pix_code || expense?.notes))
  }, [form, month.data, id, expense, activeMembers, me, monthIso])

  const amountCents = form ? parseBRL(form.amount) : null

  // Prévia da divisão (mostra o erro amigável se não fechar)
  const preview = useMemo(() => {
    if (!form || amountCents == null) return { shares: [], error: null as string | null }
    try {
      const shares =
        form.mode === 'equal'
          ? buildShares({ mode: 'equal', totalCents: amountCents, memberIds: form.participants })
          : form.mode === 'weights'
            ? buildShares({
                mode: 'weights',
                totalCents: amountCents,
                weights: form.participants.map((m) => ({ memberId: m, weight: Number(form.weights[m] || 0) })),
              })
            : buildShares({
                mode: 'amounts',
                totalCents: amountCents,
                amounts: form.participants.map((m) => ({ memberId: m, amountCents: parseBRL(form.amounts[m] ?? '') ?? 0 })),
              })
      return { shares, error: null }
    } catch (err) {
      return { shares: [], error: (err as Error).message }
    }
  }, [form, amountCents])

  if (month.isPending || recurring.isPending || categories.isPending) return <Spinner />
  if (month.error) return <ErrorBox message={friendlyError(month.error)} onRetry={() => month.refetch()} />
  if (!month.data) return <ErrorBox message="Esse mês ainda não foi começado. Volte e toque em “Começar”." />
  if (id && !expense) return <ErrorBox message="Conta não encontrada." />
  if (!form) return <Spinner />

  const closed = month.data.month.status === 'closed'
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => (f ? { ...f, [k]: v } : f))
  const isPercent = form.mode === 'weights'
  const percentSum = form.participants.reduce((a, m) => a + Number(form.weights[m] || 0), 0)

  function applyCode(raw: string) {
    const info = parseBillCode(raw)
    setCodeInfo(info)
    setForm((f) => {
      if (!f) return f
      const next = { ...f, barcode: raw }
      if (info?.ok) {
        if (info.amountCents != null) next.amount = centsToInput(info.amountCents)
        if (info.dueDate) next.dueDate = info.dueDate
        if (info.kind === 'arrecadacao' && !f.categoryId) {
          const cat = categories.data?.find((c) => c.name === SEGMENT_CATEGORY[info.segment])
          if (cat) {
            next.categoryId = cat.id
            if (!f.description) next.description = cat.name
          }
        }
      }
      return next
    })
  }

  async function pasteCode() {
    try {
      const text = await navigator.clipboard.readText()
      if (text) applyCode(text)
    } catch {
      toast('Toque no campo e use “Colar” do teclado')
    }
  }

  function toggleParticipant(memberId: string) {
    setForm((f) => {
      if (!f) return f
      const has = f.participants.includes(memberId)
      const participants = has ? f.participants.filter((m) => m !== memberId) : activeMembers.map((m) => m.id).filter((m) => m === memberId || f.participants.includes(m))
      return { ...f, participants, weights: equalPercents(participants) }
    })
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form) return
    const errs: Record<string, string> = {}
    if (!form.description.trim()) errs.description = 'Diga o que é a conta (ex.: Luz, Mercado).'
    if (form.amount.trim() && amountCents == null) errs.amount = 'Valor inválido. Ex.: 87,90'
    if (!form.amount.trim() && !expense?.recurring_bill_id) errs.amount = 'Digite o valor.'
    if (amountCents != null && form.participants.length === 0) errs.split = 'Escolha quem divide essa conta.'
    else if (amountCents != null && preview.error) errs.split = preview.error
    if (isPercent && amountCents != null && percentSum !== 100) errs.split = `Os percentuais somam ${percentSum}%. Precisam somar 100%.`
    if (form.paid && !form.paidBy) errs.paidBy = 'Escolha quem pagou.'
    const pixInfo = parsePix(form.pixCode)
    if (pixInfo && !pixInfo.ok) errs.pix = pixInfo.message
    setErrors(errs)
    if (Object.keys(errs).length) {
      document.querySelector('[aria-invalid="true"], [role="alert"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }

    let attachmentPath = expense?.attachment_path ?? null
    try {
      if (file) {
        setUploading(true)
        attachmentPath = await repo.uploadAttachment(household.id, file)
      }
    } catch (err) {
      setUploading(false)
      setErrors({ form: friendlyError(err) })
      return
    }
    setUploading(false)

    const digits = onlyDigits(form.barcode)
    const input: ExpenseInput = {
      id: expense?.id,
      month_id: month.data!.month.id,
      category_id: form.categoryId,
      recurring_bill_id: expense?.recurring_bill_id ?? null,
      description: form.description.trim(),
      amount_cents: amountCents,
      due_date: form.dueDate || null,
      expense_date: form.expenseDate || monthIso,
      status: form.paid ? 'paid' : 'pending',
      paid_at: form.paid ? (expense?.paid_at ?? todayIso()) : null,
      paid_by_member_id: form.paid ? form.paidBy : null,
      split_mode: form.mode,
      attachment_path: attachmentPath,
      barcode: digits.length >= 44 && digits.length <= 48 ? digits : null,
      pix_code: form.pixCode.trim() || null,
      notes: form.notes.trim() || null,
      shares: preview.shares.map((s) => ({ member_id: s.memberId, amount_cents: s.amountCents, weight: s.weight })),
    }
    save.mutate(input, {
      onSuccess: (savedId) => {
        toast(expense ? 'Conta atualizada' : 'Conta lançada')
        navigate(`/conta/${savedId}?mes=${monthParam(ym)}`, { replace: true })
      },
    })
  }

  const title = expense ? (expense.amount_cents == null ? `Valor da ${expense.description.toLowerCase()}` : 'Editar conta') : 'Nova conta'

  return (
    <form onSubmit={onSubmit} noValidate className="pb-4">
      <header className="mb-5 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="grid size-12 shrink-0 place-items-center rounded-full border border-line/70 bg-surface shadow-soft"
          aria-label="Voltar"
        >
          <ChevronLeft className="size-6" aria-hidden />
        </button>
        <div className="min-w-0">
          <h1 className="truncate text-[1.625rem] leading-tight font-bold tracking-tight">{title}</h1>
          <p className="text-muted">
            {MONTH_NAMES[ym.month - 1]} de {ym.year}
            {recurringBill?.provider ? ` · ${recurringBill.provider}` : ''}
          </p>
        </div>
      </header>

      {closed && <ErrorBox message="Este mês está fechado. Reabra o mês na tela inicial para editar." />}

      <fieldset disabled={closed} className="flex min-w-0 flex-col gap-5">
        {/* Código de barras */}
        <Card className="!p-4">
          <Field
            label="Código de barras (opcional)"
            inputMode="numeric"
            placeholder="Cole aqui a linha digitável"
            value={form.barcode}
            onChange={(e) => applyCode(e.target.value)}
            autoComplete="off"
            trailing={
              <button type="button" onClick={pasteCode} className="grid size-11 place-items-center rounded-xl text-primary hover:bg-primary-soft" aria-label="Colar código">
                <ClipboardPaste className="size-6" aria-hidden />
              </button>
            }
            hint={
              codeInfo?.ok ? (
                <span className="flex items-start gap-1.5 font-medium text-ok">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <span>
                    {codeInfo.kind === 'boleto' ? 'Boleto bancário' : codeInfo.segmentLabel} válido
                    {codeInfo.amountCents != null && ` · ${formatBRL(codeInfo.amountCents)}`}
                    {codeInfo.dueDate && ` · vence ${formatDate(codeInfo.dueDate)}`}
                    {codeInfo.kind === 'arrecadacao' && codeInfo.valueIsReference && ' · o valor do código é só de referência, confira na conta'}
                    {codeInfo.kind === 'arrecadacao' && !codeInfo.dueDate && ' · preencha o vencimento'}
                  </span>
                </span>
              ) : codeInfo ? (
                <span className="flex items-start gap-1.5 font-medium text-warn">
                  <ScanBarcode className="mt-0.5 size-4 shrink-0" aria-hidden />
                  {codeInfo.message} Você pode salvar mesmo assim.
                </span>
              ) : (
                'O app lê o valor e o vencimento sozinho.'
              )
            }
          />
          {codeInfo?.ok && <p className="mt-2 font-mono text-sm break-all text-muted">{formatBillCode(codeInfo.digits)}</p>}
        </Card>

        {/* Categoria */}
        <div>
          <p className="mb-2 px-1 font-semibold text-muted">Categoria</p>
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            {(categories.data ?? []).map((c) => (
              <Chip
                key={c.id}
                selected={form.categoryId === c.id}
                onClick={() =>
                  setForm((f) =>
                    f ? { ...f, categoryId: c.id, description: !f.description || f.description === categories.data?.find((x) => x.id === f.categoryId)?.name ? c.name : f.description } : f,
                  )
                }
                className="shrink-0 pl-2"
              >
                <CategoryIcon category={c} size="sm" />
                {c.name}
              </Chip>
            ))}
          </div>
        </div>

        <Field
          label="Descrição"
          placeholder="Ex.: Luz, Mercado, Farmácia"
          value={form.description}
          onChange={(e) => set('description', e.target.value)}
          error={errors.description}
          maxLength={120}
        />

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field
            label="Valor"
            prefix="R$"
            inputMode="decimal"
            placeholder="0,00"
            value={form.amount}
            onChange={(e) => set('amount', e.target.value)}
            error={errors.amount}
            hint={expense?.recurring_bill_id && !form.amount ? 'Pode deixar em branco até a conta chegar.' : undefined}
          />
          <Field label="Vencimento" type="date" value={form.dueDate} onChange={(e) => set('dueDate', e.target.value)} />
        </div>

        {/* Situação */}
        <div>
          <p className="mb-2 px-1 font-semibold text-muted">Situação</p>
          <div className="grid grid-cols-2 gap-2">
            <Chip selected={!form.paid} onClick={() => set('paid', false)} className="justify-center">
              Pendente
            </Chip>
            <Chip selected={form.paid} onClick={() => set('paid', true)} className="justify-center" color="#16A34A">
              Paga
            </Chip>
          </div>
        </div>

        {form.paid && (
          <div>
            <p className="mb-2 px-1 font-semibold text-muted">Quem pagou?</p>
            <div className="flex flex-wrap gap-2">
              {members
                .filter((m) => m.active || m.id === form.paidBy)
                .map((m) => (
                  <Chip key={m.id} selected={form.paidBy === m.id} onClick={() => set('paidBy', m.id)} className="pl-1.5">
                    <Avatar member={m} size="sm" />
                    {displayName(m)}
                  </Chip>
                ))}
            </div>
            {errors.paidBy && <p role="alert" className="mt-1.5 px-1 font-medium text-danger">{errors.paidBy}</p>}
          </div>
        )}

        {/* Divisão */}
        <Card className="!p-4">
          <p className="mb-2 font-semibold text-muted">Dividir entre</p>
          <div className="flex flex-wrap gap-2">
            {activeMembers.map((m) => (
              <Chip key={m.id} selected={form.participants.includes(m.id)} onClick={() => toggleParticipant(m.id)} className="pl-1.5">
                <Avatar member={m} size="sm" />
                {displayName(m)}
              </Chip>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-3 gap-1 rounded-2xl bg-surface-2 p-1" role="radiogroup" aria-label="Como dividir">
            {(
              [
                ['equal', 'Igual'],
                ['weights', '%'],
                ['amounts', 'Valores'],
              ] as const
            ).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                role="radio"
                aria-checked={form.mode === mode}
                onClick={() => set('mode', mode)}
                className={`min-h-11 rounded-xl font-semibold transition ${form.mode === mode ? 'bg-surface text-ink shadow-soft' : 'text-muted'}`}
              >
                {label}
              </button>
            ))}
          </div>

          <ul className="mt-3 divide-y divide-line">
            {form.participants.map((memberId) => {
              const m = members.find((x) => x.id === memberId)!
              const share = preview.shares.find((s) => s.memberId === memberId)
              return (
                <li key={memberId} className="flex items-center gap-3 py-2.5">
                  <Avatar member={m} size="sm" />
                  <span className="min-w-0 flex-1 truncate font-medium">{displayName(m)}</span>
                  {form.mode === 'weights' && (
                    <label className="flex items-center gap-1">
                      <span className="sr-only">Percentual de {displayName(m)}</span>
                      <input
                        inputMode="numeric"
                        value={form.weights[memberId] ?? ''}
                        onChange={(e) => set('weights', { ...form.weights, [memberId]: e.target.value.replace(/\D/g, '').slice(0, 3) })}
                        className="h-11 w-16 rounded-xl border border-line bg-surface text-center text-lg"
                      />
                      <span className="text-muted">%</span>
                    </label>
                  )}
                  {form.mode === 'amounts' ? (
                    <label className="flex items-center gap-1">
                      <span className="text-muted">R$</span>
                      <span className="sr-only">Valor de {displayName(m)}</span>
                      <input
                        inputMode="decimal"
                        placeholder="0,00"
                        value={form.amounts[memberId] ?? ''}
                        onChange={(e) => set('amounts', { ...form.amounts, [memberId]: e.target.value })}
                        className="h-11 w-28 rounded-xl border border-line bg-surface px-3 text-right text-lg"
                      />
                    </label>
                  ) : (
                    <span className="w-24 text-right font-bold tabular-nums">{share ? formatBRL(share.amountCents) : '—'}</span>
                  )}
                </li>
              )
            })}
          </ul>
          {form.mode === 'weights' && <p className={`mt-1 text-sm ${percentSum === 100 ? 'text-muted' : 'font-semibold text-warn'}`}>Total: {percentSum}%</p>}
          {errors.split && (
            <p role="alert" className="mt-2 font-medium text-danger">
              {errors.split}
            </p>
          )}
        </Card>

        {/* Mais opções */}
        <div>
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            aria-expanded={moreOpen}
            className="flex w-full items-center justify-between rounded-2xl px-1 py-2 font-semibold text-primary"
          >
            Mais opções (Pix, anexo, observação)
            <ChevronDown className={`size-5 transition ${moreOpen ? 'rotate-180' : ''}`} aria-hidden />
          </button>
          {moreOpen && (
            <div className="mt-3 flex flex-col gap-5">
              <Field
                label="Pix copia e cola (opcional)"
                placeholder="00020101021226..."
                value={form.pixCode}
                onChange={(e) => {
                  const value = e.target.value
                  set('pixCode', value)
                  const info = parsePix(value)
                  if (info?.ok && info.amountCents != null && !form.amount) set('amount', centsToInput(info.amountCents))
                }}
                error={errors.pix}
                autoComplete="off"
              />
              <Field label="Data da compra" type="date" value={form.expenseDate} onChange={(e) => set('expenseDate', e.target.value)} />
              <TextArea label="Observação" value={form.notes} onChange={(e) => set('notes', e.target.value)} maxLength={500} />
              <div>
                <p className="mb-2 font-semibold text-muted">Foto da conta ou comprovante</p>
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
                {file || expense?.attachment_path ? (
                  <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3">
                    <Paperclip className="size-5 text-muted" aria-hidden />
                    <span className="min-w-0 flex-1 truncate">{file ? file.name : 'Anexo salvo'}</span>
                    <button type="button" onClick={() => fileInput.current?.click()} className="font-semibold text-primary">
                      Trocar
                    </button>
                    {file && (
                      <button type="button" onClick={() => setFile(null)} aria-label="Remover arquivo">
                        <X className="size-5 text-muted" />
                      </button>
                    )}
                  </div>
                ) : (
                  <Button type="button" variant="secondary" size="md" className="w-full" onClick={() => fileInput.current?.click()}>
                    <Camera className="size-5" aria-hidden /> Tirar foto ou escolher arquivo
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        {(errors.form || save.error) && <ErrorBox message={errors.form ?? friendlyError(save.error)} />}

        <div className="pb-safe sticky bottom-24 z-10 md:bottom-4">
          <Button type="submit" className="w-full shadow-lg" loading={save.isPending || uploading}>
            {expense ? 'Salvar' : 'Lançar conta'}
          </Button>
        </div>
      </fieldset>
    </form>
  )
}
