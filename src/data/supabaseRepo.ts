import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Expense, ExpenseShare, Household, Member, MonthBundle, RecurringBill, Category, Transfer } from '../types'
import type { MonthTotal, Repo } from './repo'

const EXPENSE_SELECT = '*, shares:expense_shares(member_id, amount_cents, weight)'

/** Resultado obrigatório: lança o erro do Supabase ou devolve os dados. */
function check<R extends { data: unknown; error: unknown }>(res: R): NonNullable<R['data']> {
  if (res.error) throw res.error
  return res.data as NonNullable<R['data']>
}

/** Resultado que pode não existir (maybeSingle). */
function checkMaybe<R extends { data: unknown; error: unknown }>(res: R): R['data'] {
  if (res.error) throw res.error
  return res.data
}

function normalizeExpense(row: Expense & { shares: ExpenseShare[] | null }): Expense {
  return { ...row, shares: row.shares ?? [] }
}

export const supabaseRepo: Repo = {
  kind: 'supabase',

  async getHousehold(userId) {
    if (!userId) return null
    const me = checkMaybe(await supabase.from('members').select('household_id').eq('user_id', userId).eq('active', true).maybeSingle())
    if (!me) return null
    const [h, m] = await Promise.all([
      supabase.from('households').select('id, name').eq('id', me.household_id).single(),
      supabase.from('members').select('*').eq('household_id', me.household_id).order('sort_order').order('created_at'),
    ])
    return { household: check(h) as Household, members: check(m) as Member[] }
  },

  async renameHousehold(id, name) {
    check(await supabase.from('households').update({ name }).eq('id', id))
  },

  async saveMember(householdId, { id, ...values }) {
    if (id) check(await supabase.from('members').update(values).eq('id', id))
    else check(await supabase.from('members').insert({ ...values, household_id: householdId }))
  },

  async manageLogin(input) {
    const { error } = await supabase.functions.invoke('admin-users', { body: input })
    if (error) {
      if (error instanceof FunctionsHttpError) {
        const body = await error.context.json().catch(() => null)
        throw new Error(body?.error ?? 'Não foi possível salvar o acesso.')
      }
      throw error
    }
  },

  async getCategories() {
    return check(await supabase.from('categories').select('*').order('sort_order')) as Category[]
  },

  async getRecurringBills() {
    return check(await supabase.from('recurring_bills').select('*').order('sort_order').order('created_at')) as RecurringBill[]
  },

  async saveRecurringBill({ id, ...values }) {
    if (id) {
      check(await supabase.from('recurring_bills').update(values).eq('id', id))
    } else {
      const household_id = check(await supabase.rpc('my_household_id'))
      check(await supabase.from('recurring_bills').insert({ ...values, household_id }))
    }
  },

  async openMonth({ year, month }) {
    const monthId = check(await supabase.rpc('ensure_month', { p_year: year, p_month: month })) as string
    return loadBundle(monthId)
  },

  async getMonth({ year, month }) {
    const row = checkMaybe(await supabase.from('months').select('id').eq('year', year).eq('month', month).maybeSingle())
    return row ? loadBundle(row.id) : null
  },

  async listMonthTotals() {
    const months = check(await supabase.from('months').select('id, year, month, status').order('year').order('month'))
    const expenses = check(
      await supabase.from('expenses').select('month_id, amount_cents, shares:expense_shares(member_id, amount_cents)'),
    ) as { month_id: string; amount_cents: number | null; shares: { member_id: string; amount_cents: number }[] }[]
    return months.map((m) => {
      const mine = expenses.filter((e) => e.month_id === m.id)
      const per_member: Record<string, number> = {}
      for (const e of mine) for (const s of e.shares ?? []) per_member[s.member_id] = (per_member[s.member_id] ?? 0) + s.amount_cents
      return {
        per_member,
        year: m.year,
        month: m.month,
        status: m.status,
        total_cents: mine.reduce((acc, e) => acc + (e.amount_cents ?? 0), 0),
        awaiting: mine.filter((e) => e.amount_cents == null).length,
      } satisfies MonthTotal
    })
  },

  async getBillHistory(recurringBillId, limit = 12) {
    const rows = check(
      await supabase
        .from('expenses')
        .select('amount_cents, month:months!inner(year, month)')
        .eq('recurring_bill_id', recurringBillId)
        .order('month(year)', { ascending: false })
        .order('month(month)', { ascending: false })
        .limit(limit),
    ) as unknown as { amount_cents: number | null; month: { year: number; month: number } }[]
    return rows.map((r) => ({ year: r.month.year, month: r.month.month, amount_cents: r.amount_cents }))
  },

  async setMonthStatus(monthId, status) {
    check(await supabase.from('months').update({ status }).eq('id', monthId))
  },

  async saveExpense({ shares, ...input }) {
    const payload = { ...input, shares: shares.map((s) => ({ member_id: s.member_id, amount_cents: s.amount_cents, weight: s.weight })) }
    return check(await supabase.rpc('save_expense', { p: payload })) as string
  },

  async setExpensePaid(expense, paid, paidBy) {
    check(
      await supabase
        .from('expenses')
        .update({
          status: paid ? 'paid' : 'pending',
          paid_at: paid ? new Date().toISOString().slice(0, 10) : null,
          paid_by_member_id: paid ? paidBy : expense.paid_by_member_id,
        })
        .eq('id', expense.id),
    )
  },

  async deleteExpense(id) {
    const row = check(await supabase.from('expenses').select('attachment_path').eq('id', id).single())
    check(await supabase.from('expenses').delete().eq('id', id))
    if (row.attachment_path) await supabase.storage.from('anexos').remove([row.attachment_path])
  },

  async uploadAttachment(householdId, file) {
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '')
    const path = `${householdId}/${crypto.randomUUID()}.${ext}`
    check(await supabase.storage.from('anexos').upload(path, file, { contentType: file.type || undefined }))
    return path
  },

  async attachmentUrl(path) {
    const data = check(await supabase.storage.from('anexos').createSignedUrl(path, 60 * 10))
    return data.signedUrl
  },
}

async function loadBundle(monthId: string): Promise<MonthBundle> {
  const [m, e, t] = await Promise.all([
    supabase.from('months').select('id, year, month, status, closed_at').eq('id', monthId).single(),
    supabase.from('expenses').select(EXPENSE_SELECT).eq('month_id', monthId).order('due_date', { nullsFirst: false }).order('created_at'),
    supabase.from('transfers').select('*').eq('month_id', monthId).order('paid_on'),
  ])
  return {
    month: check(m),
    expenses: (check(e) as (Expense & { shares: ExpenseShare[] | null })[]).map(normalizeExpense),
    transfers: check(t) as Transfer[],
  }
}
