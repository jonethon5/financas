import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Bell, ChevronRight, KeyRound, LogOut, Plus, RotateCcw, Shield, UserPlus } from 'lucide-react'
import { Avatar, MEMBER_COLORS, displayName } from '../components/Avatar'
import { CategoryIcon } from '../components/CategoryIcon'
import { Sheet } from '../components/Sheet'
import { Badge, Button, Card, Chip, ErrorBox, Field, IconTile, List, PageHeader, Row, SectionTitle, Switch } from '../components/ui'
import { useToast } from '../components/Toast'
import { useAuth } from '../auth/AuthProvider'
import { useCategories, useManageLogin, useRecurringBills, useSaveMember, useSaveRecurringBill } from '../data/hooks'
import { resetDemo } from '../data/localRepo'
import { useHousehold } from '../household/HouseholdProvider'
import { centsToInput, formatBRL, parseBRL } from '../lib/money'
import { isValidUsername, normalizeUsername, suggestUsername } from '../lib/login'
import { notificationsSupported, REMINDER_DAYS, remindersOff, setRemindersOff } from '../lib/notify'
import { currentPushSubscription, disablePush, enablePush, pushSupported } from '../lib/push'
import { friendlyError } from '../lib/supabase'
import type { Member, RecurringBill } from '../types'
import { PasswordField } from './LoginPage'

function ListButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <li>
      <button onClick={onClick} className="flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition hover:bg-surface-2">
        {children}
        <ChevronRight className="size-5 shrink-0 text-faint" aria-hidden />
      </button>
    </li>
  )
}

// ---------------------------------------------------------------------------
// Moradores
// ---------------------------------------------------------------------------

function LoginSection({ member }: { member: Member }) {
  const { isAdmin, me, demo } = useHousehold()
  const manage = useManageLogin()
  const toast = useToast()
  const [username, setUsername] = useState(member.username ?? suggestUsername(member.name))
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  if (demo) {
    return (
      <p className="rounded-2xl bg-surface-2 p-4 text-muted">
        No modo demonstração não há logins. Depois de configurar o Supabase, o administrador cria aqui o usuário e a senha de cada morador.
      </p>
    )
  }
  if (!isAdmin) return null

  const isMe = member.id === me?.id
  const run = (input: Parameters<typeof manage.mutate>[0], success: string) => {
    setError(null)
    manage.mutate(input, {
      onSuccess: () => {
        toast(success)
        setPassword('')
      },
      onError: (err) => setError(friendlyError(err)),
    })
  }

  if (!member.user_id) {
    return (
      <div className="flex flex-col gap-4 rounded-2xl bg-surface-2 p-4">
        <div>
          <p className="font-semibold">Acesso ao app</p>
          <p className="text-[0.9375rem] text-muted">Crie um usuário e uma senha. A pessoa entra só com isso, sem e-mail.</p>
        </div>
        {error && <ErrorBox message={error} />}
        <Field label="Usuário" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={username} onChange={(e) => setUsername(e.target.value)} />
        <PasswordField label="Senha" autoComplete="new-password" value={password} onChange={setPassword} hint="Pelo menos 6 caracteres. Pode ser só números." />
        <Button
          type="button"
          loading={manage.isPending}
          onClick={() => {
            const u = normalizeUsername(username)
            if (!isValidUsername(u)) return setError('Usuário: use de 2 a 30 letras ou números, sem espaços.')
            if (password.length < 6) return setError('A senha precisa ter pelo menos 6 caracteres.')
            run({ action: 'create_login', member_id: member.id, username: u, password }, `Acesso criado: ${u}`)
          }}
        >
          <KeyRound className="size-5" aria-hidden /> Criar acesso
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-surface-2 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-semibold">Acesso ao app</p>
          <p className="text-muted">
            Usuário: <strong className="text-ink">{member.username}</strong>
          </p>
        </div>
        {member.role === 'admin' && <Badge tone="primary">Administrador</Badge>}
      </div>
      {error && <ErrorBox message={error} />}
      {isMe ? (
        <Link to="/ajustes/senha" className="font-semibold text-primary">
          Trocar minha senha
        </Link>
      ) : (
        <>
          <PasswordField label="Nova senha" autoComplete="new-password" value={password} onChange={setPassword} />
          <Button
            type="button"
            variant="secondary"
            loading={manage.isPending && manage.variables?.action === 'set_password'}
            onClick={() => {
              if (password.length < 6) return setError('A senha precisa ter pelo menos 6 caracteres.')
              run({ action: 'set_password', member_id: member.id, password }, 'Senha trocada')
            }}
          >
            Trocar senha
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="md"
            onClick={() => run({ action: 'set_role', member_id: member.id, role: member.role === 'admin' ? 'member' : 'admin' }, 'Permissão atualizada')}
          >
            <Shield className="size-5" aria-hidden /> {member.role === 'admin' ? 'Tirar permissão de administrador' : 'Tornar administrador'}
          </Button>
          <Button
            type="button"
            variant="danger"
            size="md"
            onClick={() => {
              if (window.confirm(`Remover o acesso de ${displayName(member)}? A pessoa não conseguirá mais entrar.`))
                run({ action: 'remove_login', member_id: member.id }, 'Acesso removido')
            }}
          >
            Remover acesso
          </Button>
        </>
      )}
    </div>
  )
}

function MemberSheet({ member, open, onClose }: { member: Member | null; open: boolean; onClose: () => void }) {
  const { household, members, me, isAdmin, demo } = useHousehold()
  const save = useSaveMember(household.id)
  const toast = useToast()
  const [form, setForm] = useState({ name: '', nickname: '', color: MEMBER_COLORS[0], pix_key: '' })
  const [error, setError] = useState<string | null>(null)
  // Versão mais recente do morador (o acesso muda depois de criar o login)
  const current = member ? (members.find((m) => m.id === member.id) ?? member) : null

  useEffect(() => {
    if (!open) return
    setError(null)
    setForm(
      member
        ? { name: member.name, nickname: member.nickname ?? '', color: member.color, pix_key: member.pix_key ?? '' }
        : { name: '', nickname: '', color: MEMBER_COLORS[members.length % MEMBER_COLORS.length], pix_key: '' },
    )
  }, [open, member, members.length])

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return setError('Digite o nome.')
    save.mutate(
      {
        id: member?.id,
        name: form.name.trim(),
        nickname: form.nickname.trim() || null,
        color: form.color,
        pix_key: form.pix_key.trim() || null,
        ...(member ? {} : { sort_order: members.length }),
      },
      {
        onSuccess: () => {
          toast(member ? 'Morador atualizado' : 'Morador adicionado')
          onClose()
        },
        onError: (err) => setError(friendlyError(err)),
      },
    )
  }

  return (
    <Sheet open={open} onClose={onClose} title={member ? displayName(member) : 'Novo morador'}>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {error && <ErrorBox message={error} />}
        <Field label="Nome" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} maxLength={60} />
        <Field
          label="Apelido (opcional)"
          value={form.nickname}
          onChange={(e) => setForm((f) => ({ ...f, nickname: e.target.value }))}
          hint="É assim que o nome aparece nas contas. Ex.: Cida"
          maxLength={30}
        />
        <Field
          label="Chave Pix (opcional)"
          value={form.pix_key}
          onChange={(e) => setForm((f) => ({ ...f, pix_key: e.target.value }))}
          hint="Para os outros copiarem na hora do acerto."
          maxLength={140}
          autoComplete="off"
        />
        <Button type="submit" loading={save.isPending} className="mt-1 w-full">
          Salvar
        </Button>

        {current && <LoginSection key={current.id} member={current} />}

        {current && (isAdmin || demo) && current.id !== me?.id && (
          <Button
            type="button"
            variant="ghost"
            size="md"
            onClick={() => save.mutate({ id: current.id, active: !current.active }, { onSuccess: onClose, onError: (err) => setError(friendlyError(err)) })}
          >
            {current.active ? 'Desativar (não mora mais aqui)' : 'Reativar morador'}
          </Button>
        )}
      </form>
    </Sheet>
  )
}

// ---------------------------------------------------------------------------
// Contas fixas
// ---------------------------------------------------------------------------

type BillForm = {
  description: string
  provider: string
  customer_code: string
  bill_url: string
  due_day: string
  amount: string
  payer: string | null
  category_id: string | null
  active: boolean
}

const EMPTY_BILL: BillForm = { description: '', provider: '', customer_code: '', bill_url: '', due_day: '10', amount: '', payer: null, category_id: null, active: true }

function RecurringSheet({ bill, open, onClose }: { bill: RecurringBill | null; open: boolean; onClose: () => void }) {
  const { activeMembers } = useHousehold()
  const categories = useCategories()
  const save = useSaveRecurringBill()
  const toast = useToast()
  const [form, setForm] = useState<BillForm>(EMPTY_BILL)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const set = <K extends keyof BillForm>(k: K, v: BillForm[K]) => setForm((f) => ({ ...f, [k]: v }))

  useEffect(() => {
    if (!open) return
    setErrors({})
    setForm(
      bill
        ? {
            description: bill.description,
            provider: bill.provider ?? '',
            customer_code: bill.customer_code ?? '',
            bill_url: bill.bill_url ?? '',
            due_day: String(bill.due_day),
            amount: centsToInput(bill.default_amount_cents),
            payer: bill.default_payer_member_id,
            category_id: bill.category_id,
            active: bill.active,
          }
        : EMPTY_BILL,
    )
  }, [open, bill])

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const errs: Record<string, string> = {}
    const day = Number(form.due_day)
    const amount = form.amount.trim() ? parseBRL(form.amount) : null
    let url = form.bill_url.trim()
    if (url && !/^https?:\/\//.test(url)) url = `https://${url}`
    url = url.replace(/^http:\/\//, 'https://')
    if (!form.description.trim()) errs.description = 'Dê um nome (ex.: Luz).'
    if (!Number.isInteger(day) || day < 1 || day > 31) errs.due_day = 'Dia entre 1 e 31.'
    if (form.amount.trim() && amount == null) errs.amount = 'Valor inválido.'
    if (url && !/^https:\/\/[^\s/]+\.[^\s]+/.test(url)) errs.bill_url = 'Link inválido.'
    setErrors(errs)
    if (Object.keys(errs).length) return
    save.mutate(
      {
        id: bill?.id,
        description: form.description.trim(),
        provider: form.provider.trim() || null,
        customer_code: form.customer_code.trim() || null,
        bill_url: url || null,
        due_day: day,
        default_amount_cents: amount,
        default_payer_member_id: form.payer,
        category_id: form.category_id,
        active: form.active,
      },
      {
        onSuccess: () => {
          toast('Conta fixa salva')
          onClose()
        },
        onError: (err) => setErrors({ form: friendlyError(err) }),
      },
    )
  }

  return (
    <Sheet open={open} onClose={onClose} title={bill ? bill.description : 'Nova conta fixa'}>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {errors.form && <ErrorBox message={errors.form} />}
        <Field label="Nome" value={form.description} onChange={(e) => set('description', e.target.value)} error={errors.description} placeholder="Ex.: Luz" />
        <div>
          <p className="mb-2 font-semibold text-muted">Categoria</p>
          <div className="flex flex-wrap gap-2">
            {(categories.data ?? []).map((c) => (
              <Chip key={c.id} selected={form.category_id === c.id} onClick={() => set('category_id', c.id)} className="pl-1.5">
                <CategoryIcon category={c} size="sm" />
                {c.name}
              </Chip>
            ))}
          </div>
        </div>
        <Field label="Empresa" value={form.provider} onChange={(e) => set('provider', e.target.value)} placeholder="Ex.: Sabesp, Enel, Vivo" />
        <Field
          label="Código do cliente / nº de instalação"
          value={form.customer_code}
          onChange={(e) => set('customer_code', e.target.value)}
          hint="Fica guardado só no banco da casa. Útil para pedir a 2ª via."
          autoComplete="off"
        />
        <Field label="Link para tirar a 2ª via" inputMode="url" value={form.bill_url} onChange={(e) => set('bill_url', e.target.value)} error={errors.bill_url} placeholder="https://" />
        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Dia do vencimento"
            inputMode="numeric"
            value={form.due_day}
            onChange={(e) => set('due_day', e.target.value.replace(/\D/g, '').slice(0, 2))}
            error={errors.due_day}
          />
          <Field label="Valor fixo" prefix="R$" inputMode="decimal" placeholder="Varia" value={form.amount} onChange={(e) => set('amount', e.target.value)} error={errors.amount} />
        </div>
        <p className="-mt-2 text-[0.9375rem] text-muted">Deixe o valor em branco se ele muda todo mês (água, luz). Preencha para contas de valor igual (internet).</p>
        <div>
          <p className="mb-2 font-semibold text-muted">Quem costuma pagar</p>
          <div className="flex flex-wrap gap-2">
            <Chip selected={form.payer === null} onClick={() => set('payer', null)}>
              Varia
            </Chip>
            {activeMembers.map((m) => (
              <Chip key={m.id} selected={form.payer === m.id} onClick={() => set('payer', m.id)} className="pl-1.5">
                <Avatar member={m} size="sm" />
                {displayName(m)}
              </Chip>
            ))}
          </div>
        </div>
        <label className="flex items-center justify-between gap-3 rounded-2xl bg-surface-2 px-4 py-3">
          <span className="font-semibold">Criar todo mês</span>
          <input type="checkbox" className="size-6 accent-[var(--primary)]" checked={form.active} onChange={(e) => set('active', e.target.checked)} />
        </label>
        <p className="-mt-2 text-[0.9375rem] text-muted">As mudanças valem a partir do próximo mês criado.</p>
        <Button type="submit" loading={save.isPending} className="w-full">
          Salvar
        </Button>
      </form>
    </Sheet>
  )
}

// ---------------------------------------------------------------------------
// Avisos
// ---------------------------------------------------------------------------

function RemindersSection() {
  const { me, household, demo } = useHousehold()
  const save = useSaveMember(household.id)
  const toast = useToast()
  // Push (com o app fechado) só existe com o Supabase; no modo demonstração, só avisos ao abrir o app
  const [state, setState] = useState<'loading' | 'on' | 'off' | 'denied' | 'unsupported'>('loading')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!notificationsSupported() || (!demo && !pushSupported())) return setState('unsupported')
    if (Notification.permission === 'denied') return setState('denied')
    if (remindersOff()) return setState('off')
    if (demo) return setState(Notification.permission === 'granted' ? 'on' : 'off')
    currentPushSubscription().then((sub) => setState(sub && Notification.permission === 'granted' ? 'on' : 'off'))
  }, [demo])

  if (!me) return null

  async function toggle(on: boolean) {
    setBusy(true)
    setError(null)
    try {
      if (on) {
        if (demo) {
          const result = await Notification.requestPermission()
          if (result !== 'granted') {
            setState(result === 'denied' ? 'denied' : 'off')
            return
          }
        } else {
          await enablePush()
        }
        setRemindersOff(false)
        if (me!.reminder_days.join() !== REMINDER_DAYS.join()) save.mutate({ id: me!.id, reminder_days: REMINDER_DAYS })
        setState('on')
        toast('Avisos ligados')
      } else {
        if (!demo) await disablePush()
        setRemindersOff(true)
        setState('off')
        toast('Avisos desligados')
      }
    } catch (err) {
      setError(friendlyError(err))
      if (Notification.permission === 'denied') setState('denied')
    } finally {
      setBusy(false)
    }
  }

  const subtitle =
    state === 'denied'
      ? 'Bloqueados nas configurações do celular'
      : state === 'unsupported'
        ? 'Abra pelo ícone do app na tela inicial'
        : '5 dias antes e no dia de vencer'

  return (
    <section className="mb-8">
      <List>
        <Row
          icon={
            <IconTile>
              <Bell strokeWidth={1.8} />
            </IconTile>
          }
          title="Avisos"
          subtitle={subtitle}
          trailing={
            <Switch
              checked={state === 'on'}
              disabled={busy || state === 'loading' || state === 'denied' || state === 'unsupported'}
              onChange={toggle}
              label="Avisos de vencimento"
            />
          }
        />
      </List>
      {error && (
        <div className="mt-3">
          <ErrorBox message={error} />
        </div>
      )}
    </section>
  )
}

export function SettingsPage() {
  const { household, members, me, isAdmin, demo } = useHousehold()
  const { signOut } = useAuth()
  const recurring = useRecurringBills()
  const categories = useCategories()
  const [memberSheet, setMemberSheet] = useState<{ open: boolean; member: Member | null }>({ open: false, member: null })
  const [billSheet, setBillSheet] = useState<{ open: boolean; bill: RecurringBill | null }>({ open: false, bill: null })

  return (
    <>
      <PageHeader title="Ajustes" subtitle={household.name} />

      <section className="mb-8">
        <SectionTitle
          action={
            (isAdmin || demo) && (
              <button onClick={() => setMemberSheet({ open: true, member: null })} className="flex min-h-11 items-center gap-1.5 text-[0.9375rem] text-primary">
                <UserPlus className="size-5" aria-hidden /> Adicionar
              </button>
            )
          }
        >
          Moradores
        </SectionTitle>
        <Card className="overflow-hidden !p-0">
          <ul className="divide-y divide-line">
            {members.map((m) => (
              <ListButton key={m.id} onClick={() => setMemberSheet({ open: true, member: m })}>
                <Avatar member={m} />
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-[1.0625rem] ${m.active ? '' : 'text-muted line-through'}`}>
                    {displayName(m)} {m.id === me?.id && <span className="font-normal text-muted">(você)</span>}
                  </p>
                  <p className="truncate text-[0.875rem] text-muted">
                    {!m.active ? 'Desativado' : m.username ? `Usuário: ${m.username}${m.role === 'admin' ? ' · admin' : ''}` : 'Sem acesso ao app'}
                  </p>
                </div>
              </ListButton>
            ))}
          </ul>
        </Card>
        {isAdmin && !demo && <p className="mt-2 px-1 text-[0.9375rem] text-muted">Toque em um morador para criar o usuário e a senha dele.</p>}
      </section>

      <section className="mb-8">
        <SectionTitle
          action={
            <button onClick={() => setBillSheet({ open: true, bill: null })} className="flex min-h-11 items-center gap-1.5 text-[0.9375rem] text-primary">
              <Plus className="size-5" aria-hidden /> Adicionar
            </button>
          }
        >
          Contas fixas
        </SectionTitle>
        <Card className="overflow-hidden !p-0">
          <ul className="divide-y divide-line">
            {(recurring.data ?? []).map((b) => (
              <ListButton key={b.id} onClick={() => setBillSheet({ open: true, bill: b })}>
                <CategoryIcon category={categories.data?.find((c) => c.id === b.category_id)} />
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-[1.0625rem] ${b.active ? '' : 'text-muted line-through'}`}>{b.description}</p>
                  <p className="truncate text-[0.875rem] text-muted">
                    {[b.provider, `vence dia ${b.due_day}`, b.default_amount_cents != null ? formatBRL(b.default_amount_cents) : null].filter(Boolean).join(' · ')}
                  </p>
                </div>
              </ListButton>
            ))}
          </ul>
        </Card>
      </section>

      <RemindersSection />

      <section className="mb-8">
        <SectionTitle>Minha conta</SectionTitle>
        <Card className="overflow-hidden !p-0">
          {me && (
            <div className="flex items-center gap-3.5 border-b border-line px-4 py-3.5 last:border-0">
              <Avatar member={me} />
              <div className="min-w-0">
                <p className="truncate text-[1.0625rem]">{displayName(me)}</p>
                <p className="truncate text-[0.875rem] text-muted">{demo ? 'Modo demonstração' : `Usuário: ${me.username}`}</p>
              </div>
            </div>
          )}
          {!demo && (
            <>
              <Link to="/ajustes/senha" className="flex items-center gap-3.5 border-b border-line px-4 py-4 transition hover:bg-surface-2">
                <KeyRound className="size-[1.375rem] text-muted" aria-hidden />
                <span className="flex-1 text-[1.0625rem]">Trocar minha senha</span>
                <ChevronRight className="size-5 text-faint" aria-hidden />
              </Link>
              <button onClick={signOut} className="flex w-full items-center gap-3.5 px-4 py-4 text-left text-danger transition hover:bg-surface-2">
                <LogOut className="size-[1.375rem]" aria-hidden />
                <span className="text-[1.0625rem]">Sair</span>
              </button>
            </>
          )}
        </Card>
      </section>


      {demo && (
        <section id="demonstracao" className="mb-7">
          <SectionTitle>Modo demonstração</SectionTitle>
          <Card>
            <p className="text-muted">
              O app está funcionando com dados de exemplo, guardados só neste aparelho. Quando o Supabase for configurado, os dados passam a ser
              compartilhados entre todos da casa, cada um com seu usuário e senha.
            </p>
            <Button
              variant="secondary"
              size="md"
              className="mt-4 w-full !bg-surface-2 !shadow-none"
              onClick={() => {
                if (window.confirm('Apagar tudo e recomeçar com os dados de exemplo?')) {
                  resetDemo()
                  window.location.reload()
                }
              }}
            >
              <RotateCcw className="size-5" aria-hidden /> Recomeçar demonstração
            </Button>
          </Card>
        </section>
      )}

      <p className="text-center text-sm text-muted">Finanças da Casa · versão {__APP_VERSION__}</p>

      <MemberSheet member={memberSheet.member} open={memberSheet.open} onClose={() => setMemberSheet((s) => ({ ...s, open: false }))} />
      <RecurringSheet bill={billSheet.bill} open={billSheet.open} onClose={() => setBillSheet((s) => ({ ...s, open: false }))} />
    </>
  )
}
