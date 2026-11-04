import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router'
import { Camera, CheckCircle2, ChevronDown, ClipboardPaste, Paperclip, ScanBarcode, X } from 'lucide-react'
import { Avatar, displayName } from '../components/Avatar'
import { categoryIcon } from '../components/CategoryIcon'
import { Button, Chip, ErrorBox, Field, NavBar, NavButton, Spinner, Switch, TextArea } from '../components/ui'
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

const rowCls = 'flex min-h-[3.25rem] items-center gap-3 border-b border-line px-4 last:border-0'
const groupLabel = 'mb-2 px-1 text-[0.8125rem] font-medium tracking-wide text-muted uppercase'
// Pílulas dentro de cartão branco: cinza quando não marcadas
const chipInCard = '!bg-surface-2 !text-ink !shadow-none aria-pressed:!bg-primary-soft aria-pressed:!text-primary-strong aria-pressed:ring-1 aria-pressed:ring-primary/50 pl-1.5'

export function ExpenseFormPage() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const location = useLocation()
  // Vindo do menu do "+": código já colado ou pedido para abrir o campo do código
  const incoming = (location.state ?? {}) as { barcode?: string; focusBarcode?: boolean }
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
  const [showCode, setShowCode] = useState(Boolean(incoming.focusBarcode || incoming.barcode))
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const pendingCode = useRef(incoming.barcode ?? null)

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

  // Código colado pelo menu do "+": aplica assim que o formulário existir
  useEffect(() => {
    if (form && pendingCode.current) {
      const code = pendingCode.current
      pendingCode.current = null
      applyCode(code)
    }
  })

  if (month.isPending || recurring.isPending || categories.isPending) return <Spinner />
  if (month.error) return <ErrorBox message={friendlyError(month.error)} onRetry={() => month.refetch()} />
  if (!month.data) return <ErrorBox message="Esse mês ainda não foi começado. Volte e toque em “Começar”." />
  if (id && !expense) return <ErrorBox message="Conta não encontrada." />
  if (!form) return <Spinner />

  const closed = month.data.month.status === 'closed'
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => (f ? { ...f, [k]: v } : f))
  const isPercent = form.mode === 'weights'
  const percentSum = form.participants.reduce((a, m) => a + Number(form.weights[m] || 0), 0)

  async function pasteCode() {
    setShowCode(true)
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

  const title = expense ? (expense.amount_cents == null ? expense.description : 'Editar conta') : 'Nova conta'
  const back = () => (window.history.length > 1 ? navigate(-1) : navigate(`/?mes=${monthParam(ym)}`))

  return (
    <form onSubmit={onSubmit} noValidate>
      <NavBar
        large={false}
        title={title}
        left={<NavButton onClick={back}>Cancelar</NavButton>}
        right={
          !closed && (
            <NavButton type="submit" strong disabled={save.isPending || uploading}>
              Salvar
            </NavButton>
          )
        }
      />

      {closed && <ErrorBox message="Este mês está fechado. Reabra o mês na tela inicial para editar." />}

      <fieldset disabled={closed} className="flex min-w-0 flex-col gap-6">
        {/* Valor em destaque */}
        <div className="pt-6 text-center">
          <label htmlFor="valor" className="text-[0.9375rem] text-muted">
            {recurringBill?.provider ? `${form.description} · ${recurringBill.provider}` : 'Valor'}
          </label>
          <div className="mt-1 flex items-baseline justify-center gap-1.5">
            <span className="text-[1.5rem] font-semibold text-muted">R$</span>
            <input
              id="valor"
              inputMode="decimal"
              placeholder="0,00"
              autoComplete="off"
              autoFocus={!showCode && (!expense || expense.amount_cents == null)}
              value={form.amount}
              onChange={(e) => set('amount', e.target.value)}
              aria-invalid={Boolean(errors.amount)}
              style={{ width: `${Math.max(4, form.amount.length) + 0.6}ch` }}
              className="num max-w-[75vw] bg-transparent text-center text-[3rem] leading-tight font-bold outline-none placeholder:text-[#c9ced5]"
            />
          </div>
          {errors.amount ? (
            <p role="alert" className="mt-1 text-[0.875rem] font-medium text-danger">
              {errors.amount}
            </p>
          ) : expense?.recurring_bill_id && !form.amount ? (
            <p className="mt-1 text-[0.875rem] text-muted">Pode deixar em branco até a conta chegar.</p>
          ) : null}
          <p className="mt-1 text-[0.875rem] text-muted">
            {MONTH_NAMES[ym.month - 1]} de {ym.year}
          </p>
        </div>

        {/* Código de barras */}
        {showCode || form.barcode ? (
          <div className="shadow-soft rounded-[1.25rem] bg-surface p-4">
            <Field
              label="Código de barras"
              inputMode="numeric"
              placeholder="Cole aqui a linha digitável"
              value={form.barcode}
              autoFocus={incoming.focusBarcode}
              onChange={(e) => applyCode(e.target.value)}
              autoComplete="off"
              trailing={
                <button type="button" onClick={pasteCode} className="grid size-11 place-items-center rounded-xl text-primary" aria-label="Colar código">
                  <ClipboardPaste className="size-[1.375rem]" strokeWidth={1.8} aria-hidden />
                </button>
              }
              hint={
                codeInfo?.ok ? (
                  <span className="flex items-start gap-1.5 text-ink">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-ok" aria-hidden />
                    <span>
                      {codeInfo.kind === 'boleto' ? 'Boleto bancário' : codeInfo.segmentLabel} válido
                      {codeInfo.amountCents != null && ` · ${formatBRL(codeInfo.amountCents)}`}
                      {codeInfo.dueDate && ` · vence ${formatDate(codeInfo.dueDate)}`}
                      {codeInfo.kind === 'arrecadacao' && codeInfo.valueIsReference && ' · o valor do código é só de referência, confira na conta'}
                      {codeInfo.kind === 'arrecadacao' && !codeInfo.dueDate && ' · preencha o vencimento'}
                    </span>
                  </span>
                ) : codeInfo ? (
                  <span className="flex items-start gap-1.5 text-warn">
                    <ScanBarcode className="mt-0.5 size-4 shrink-0" aria-hidden />
                    {codeInfo.message} Você pode salvar mesmo assim.
                  </span>
                ) : (
                  'O app lê o valor e o vencimento sozinho.'
                )
              }
            />
            {codeInfo?.ok && <p className="num mt-2 px-1 font-mono text-[0.8125rem] break-all text-muted">{formatBillCode(codeInfo.digits)}</p>}
          </div>
        ) : (
          <button
            type="button"
            onClick={pasteCode}
            className="shadow-soft mx-auto flex min-h-11 items-center gap-2 rounded-full bg-surface px-5 text-[0.9375rem] font-medium text-primary transition active:bg-surface-2"
          >
            <ScanBarcode className="size-5" strokeWidth={1.8} aria-hidden /> Colar código de barras
          </button>
        )}

        {/* Categoria */}
        <div>
          <p className={groupLabel}>Categoria</p>
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 py-1">
            {(categories.data ?? []).map((c) => {
              const Icon = categoryIcon(c)
              return (
                <Chip
                  key={c.id}
                  selected={form.categoryId === c.id}
                  onClick={() =>
                    setForm((f) =>
                      f ? { ...f, categoryId: c.id, description: !f.description || f.description === categories.data?.find((x) => x.id === f.categoryId)?.name ? c.name : f.description } : f,
                    )
                  }
                  className="shrink-0"
                >
                  <Icon className="size-[1.125rem]" strokeWidth={1.8} aria-hidden />
                  {c.name}
                </Chip>
              )
            })}
          </div>
        </div>

        {/* Detalhes */}
        <div>
          <p className={groupLabel}>Detalhes</p>
          <div className="shadow-soft rounded-[1.25rem] bg-surface">
            <div className={rowCls}>
              <label htmlFor="descricao" className="w-28 shrink-0 text-[1.0625rem]">
                Descrição
              </label>
              <input
                id="descricao"
                placeholder="Ex.: Mercado"
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
                maxLength={120}
                aria-invalid={Boolean(errors.description)}
                className="min-w-0 flex-1 bg-transparent py-3 text-right text-[1.0625rem] outline-none placeholder:text-faint"
              />
            </div>
            <div className={rowCls}>
              <label htmlFor="vencimento" className="w-28 shrink-0 text-[1.0625rem]">
                Vencimento
              </label>
              <input
                id="vencimento"
                type="date"
                value={form.dueDate}
                onChange={(e) => set('dueDate', e.target.value)}
                className="min-w-0 flex-1 bg-transparent py-3 text-right text-[1.0625rem] text-primary outline-none"
              />
            </div>
            <div className={rowCls}>
              <span className="flex-1 text-[1.0625rem]">Já está paga</span>
              <Switch checked={form.paid} onChange={(v) => set('paid', v)} label="Já está paga" />
            </div>
            {form.paid && (
              <div className="px-4 pt-1 pb-4">
                <p className="mb-2 text-[0.875rem] text-muted">Quem pagou?</p>
                <div className="flex flex-wrap gap-2">
                  {members
                    .filter((m) => m.active || m.id === form.paidBy)
                    .map((m) => (
                      <Chip key={m.id} selected={form.paidBy === m.id} onClick={() => set('paidBy', m.id)} className={chipInCard}>
                        <Avatar member={m} size="sm" />
                        {displayName(m)}
                      </Chip>
                    ))}
                </div>
                {errors.paidBy && (
                  <p role="alert" className="mt-1.5 text-[0.875rem] font-medium text-danger">
                    {errors.paidBy}
                  </p>
                )}
              </div>
            )}
          </div>
          {errors.description && (
            <p role="alert" className="mt-1.5 px-1 text-[0.875rem] font-medium text-danger">
              {errors.description}
            </p>
          )}
        </div>

        {/* Divisão */}
        <div>
          <p className={groupLabel}>Dividir entre</p>
          <div className="shadow-soft rounded-[1.25rem] bg-surface p-4">
            <div className="flex flex-wrap gap-2">
              {activeMembers.map((m) => (
                <Chip key={m.id} selected={form.participants.includes(m.id)} onClick={() => toggleParticipant(m.id)} className={chipInCard}>
                  <Avatar member={m} size="sm" />
                  {displayName(m)}
                </Chip>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-3 gap-0.5 rounded-[0.6rem] bg-surface-2 p-0.5" role="radiogroup" aria-label="Como dividir">
              {(
                [
                  ['equal', 'Igual'],
                  ['weights', 'Percentual'],
                  ['amounts', 'Valores'],
                ] as const
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  role="radio"
                  aria-checked={form.mode === mode}
                  onClick={() => set('mode', mode)}
                  className={`min-h-9 rounded-[0.5rem] text-[0.875rem] font-medium transition ${form.mode === mode ? 'bg-white shadow-[0_1px_3px_rgb(0_0_0/0.12)]' : 'text-ink/70'}`}
                >
                  {label}
                </button>
              ))}
            </div>

            <ul className="mt-2">
              {form.participants.map((memberId) => {
                const m = members.find((x) => x.id === memberId)!
                const share = preview.shares.find((s) => s.memberId === memberId)
                return (
                  <li key={memberId} className="flex items-center gap-3 border-b border-line py-2.5 last:border-0">
                    <span className="min-w-0 flex-1 truncate text-[1.0625rem]">{displayName(m)}</span>
                    {form.mode === 'weights' && (
                      <label className="flex items-center gap-1">
                        <span className="sr-only">Percentual de {displayName(m)}</span>
                        <input
                          inputMode="numeric"
                          value={form.weights[memberId] ?? ''}
                          onChange={(e) => set('weights', { ...form.weights, [memberId]: e.target.value.replace(/\D/g, '').slice(0, 3) })}
                          className="num h-10 w-14 rounded-[0.6rem] bg-surface-2 text-center text-[1.0625rem] outline-none"
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
                          className="num h-10 w-24 rounded-[0.6rem] bg-surface-2 px-3 text-right text-[1.0625rem] outline-none"
                        />
                      </label>
                    ) : (
                      <span className="num w-24 text-right text-[1.0625rem] font-semibold">{share ? formatBRL(share.amountCents) : '—'}</span>
                    )}
                  </li>
                )
              })}
            </ul>
            {form.mode === 'weights' && <p className={`mt-1 text-[0.875rem] ${percentSum === 100 ? 'text-muted' : 'font-medium text-warn'}`}>Total: {percentSum}%</p>}
            {errors.split && (
              <p role="alert" className="mt-2 text-[0.875rem] font-medium text-danger">
                {errors.split}
              </p>
            )}
          </div>
        </div>

        {/* Mais opções */}
        <div>
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            aria-expanded={moreOpen}
            className="shadow-soft flex min-h-[3.25rem] w-full items-center justify-between rounded-[1.25rem] bg-surface px-4 text-[1.0625rem]"
          >
            Pix, anexo e observação
            <ChevronDown className={`size-5 text-faint transition ${moreOpen ? 'rotate-180' : ''}`} aria-hidden />
          </button>
          {moreOpen && (
            <div className="mt-4 flex flex-col gap-4">
              <Field
                label="Pix copia e cola"
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
                <p className="mb-1.5 px-1 text-[0.875rem] font-medium text-muted">Foto da conta ou comprovante</p>
                <input ref={fileInput} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                {file || expense?.attachment_path ? (
                  <div className="shadow-soft flex items-center gap-3 rounded-[0.875rem] bg-surface px-4 py-3">
                    <Paperclip className="size-5 text-muted" aria-hidden />
                    <span className="min-w-0 flex-1 truncate">{file ? file.name : 'Anexo salvo'}</span>
                    <button type="button" onClick={() => fileInput.current?.click()} className="text-primary">
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
                    <Camera className="size-5" strokeWidth={1.8} aria-hidden /> Tirar foto ou escolher arquivo
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        {(errors.form || save.error) && <ErrorBox message={errors.form ?? friendlyError(save.error)} />}

        <div className="pb-safe sticky bottom-3 z-10">
          <Button type="submit" className="w-full shadow-[0_8px_24px_-8px_rgb(74_144_164/0.6)]" loading={save.isPending || uploading}>
            {expense ? 'Salvar' : 'Lançar conta'}
          </Button>
        </div>
      </fieldset>
    </form>
  )
}
