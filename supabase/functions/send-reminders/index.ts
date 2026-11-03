// Envia os avisos de vencimento do dia (chamado 1x por dia pelo workflow .github/workflows/reminders.yml).
// Cada morador recebe uma notificação por dia com as contas que vencem nos dias que ele escolheu
// (ex.: 3 dias antes, 1 dia antes, no dia) e as que venceram há 1 ou 3 dias e ainda não foram pagas.
// Protegido pelo cabeçalho x-cron-secret (igual ao secret SETUP_CODE).
import { UserError, adminClient, handle, json } from '../_shared/common.ts'
import { sendToSubscriptions } from '../_shared/push.ts'

type Expense = { id: string; household_id: string; description: string; amount_cents: number | null; due_date: string }
type Member = { id: string; household_id: string; reminder_days: number[] }

const OVERDUE_DAYS = [-1, -3]

function todayInBrazil(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
}

function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / 86_400_000)
}

function addDays(iso: string, n: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)
}

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const money = (c: number | null) => (c == null ? 'valor a informar' : brl.format(c / 100).replace(/ /g, ' '))

function label(days: number): string {
  if (days < -1) return `venceu há ${-days} dias`
  if (days === -1) return 'venceu ontem'
  if (days === 0) return 'vence hoje'
  if (days === 1) return 'vence amanhã'
  return `vence em ${days} dias`
}

Deno.serve(
  handle(async (req) => {
    const secret = Deno.env.get('SETUP_CODE')
    if (!secret || req.headers.get('x-cron-secret') !== secret) throw new UserError('Não autorizado.', 401)

    const admin = adminClient()
    const today = todayInBrazil()

    const { data: expenses } = await admin
      .from('expenses')
      .select('id, household_id, description, amount_cents, due_date')
      .eq('status', 'pending')
      .gte('due_date', addDays(today, -3))
      .lte('due_date', addDays(today, 7))
      .order('due_date')
    const { data: members } = await admin.from('members').select('id, household_id, reminder_days').eq('active', true).not('user_id', 'is', null)
    const { data: subs } = await admin.from('push_subscriptions').select('id, member_id, endpoint, p256dh, auth')
    const { data: already } = await admin.from('reminder_log').select('member_id').eq('sent_on', today)
    const done = new Set((already ?? []).map((r) => r.member_id))

    let notified = 0
    for (const m of (members ?? []) as Member[]) {
      if (done.has(m.id)) continue
      const mySubs = (subs ?? []).filter((s) => s.member_id === m.id)
      if (!mySubs.length) continue

      const due = ((expenses ?? []) as Expense[])
        .filter((e) => e.household_id === m.household_id)
        .map((e) => ({ ...e, days: daysBetween(today, e.due_date) }))
        .filter((e) => m.reminder_days.includes(e.days) || OVERDUE_DAYS.includes(e.days))
      if (!due.length) continue

      const overdue = due.some((e) => e.days < 0)
      const title =
        due.length === 1
          ? `${due[0].description} ${label(due[0].days)}`
          : `${due.length} contas ${overdue ? 'precisam de atenção' : 'vencendo'}`
      const body = due.map((e) => `${e.description}: ${money(e.amount_cents)} — ${label(e.days)}`).join('\n')

      const sent = await sendToSubscriptions(admin, mySubs, { title, body, url: './', tag: `lembrete-${today}` })
      if (sent > 0) {
        await admin.from('reminder_log').insert({ member_id: m.id, sent_on: today, bills: due.length })
        notified++
      }
    }

    return json({ ok: true, today, notified })
  }),
)
