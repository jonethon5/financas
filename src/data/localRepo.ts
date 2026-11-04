// Modo demonstração: os dados ficam só neste aparelho (localStorage). Usado quando o Supabase
// ainda não foi configurado, para dar para ver e testar o app inteiro no celular.
import { addMonths, currentYearMonth, type YearMonth } from '../lib/dates'
import { splitEqual } from '../lib/split'
import type { Category, Expense, Household, Member, Month, RecurringBill, Transfer } from '../types'
import type { MonthTotal, Repo } from './repo'

type State = {
  household: Household
  members: Member[]
  categories: Category[]
  recurring: RecurringBill[]
  months: Month[]
  expenses: Expense[]
  transfers: Transfer[]
}

const KEY = 'financas:demo:v2'
const id = () => crypto.randomUUID()
const pad = (n: number) => String(n).padStart(2, '0')
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`
const lastDay = (y: number, m: number) => new Date(y, m, 0).getDate()

function load(): State {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as State
  } catch {
    /* sem armazenamento: começa do zero */
  }
  const s = seed()
  save(s)
  return s
}

function save(s: State) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* modo privado: segue só na memória */
  }
}

let state: State | null = null
const db = () => (state ??= load())
const commit = () => save(db())

export function resetDemo() {
  state = seed()
  save(state)
}

function member(name: string, color: string, i: number, extra: Partial<Member> = {}): Member {
  return {
    id: id(),
    household_id: 'demo',
    user_id: null,
    username: null,
    role: 'member',
    name,
    nickname: null,
    color,
    pix_key: null,
    reminder_days: [5, 0],
    active: true,
    sort_order: i,
    ...extra,
  }
}

function seed(): State {
  const members = [
    member('Ana', '#4A90A4', 0, { user_id: 'demo-user', username: 'ana', role: 'admin' }),
    member('Bruno', '#E0457B', 1),
    member('Carla', '#8B5CF6', 2),
    member('Davi', '#F07B1D', 3),
  ]
  const defs = [
    ['Água', '#3B82F6', 'droplet', true, 'Sabesp', 'https://agenciavirtual.sabesp.com.br/'],
    ['Luz', '#F59E0B', 'zap', true, 'Enel', 'https://www.enel.com.br/pt-saopaulo.html'],
    ['Telefone', '#8B5CF6', 'phone', true, 'Vivo', 'https://meuvivo.vivo.com.br/'],
    ['Internet', '#06B6D4', 'wifi', true, 'Vivo', 'https://meuvivo.vivo.com.br/'],
    ['Compras', '#F97316', 'shopping-cart', false, null, null],
    ['Extras', '#64748B', 'receipt', false, null, null],
  ] as const
  const categories: Category[] = defs.map(([name, color, icon, is_fixed], i) => ({ id: id(), name, color, icon, is_fixed, sort_order: i + 1 }))
  const recurring: RecurringBill[] = defs
    .map((d, i) => [d, categories[i]] as const)
    .filter(([d]) => d[3])
    .map(([d, c], i) => ({
      id: id(),
      category_id: c.id,
      description: d[0],
      provider: d[4],
      customer_code: null,
      bill_url: d[5],
      due_day: [10, 15, 20, 20][i],
      default_amount_cents: d[0] === 'Internet' ? 11990 : null,
      default_payer_member_id: null,
      active: true,
      sort_order: i + 1,
    }))

  const s: State = { household: { id: 'demo', name: 'Casa de exemplo' }, members, categories, recurring, months: [], expenses: [], transfers: [] }
  state = s

  // Mês passado (fechado) e mês atual com alguns valores, para a demonstração ficar viva.
  const now = currentYearMonth()
  const prev = addMonths(now, -1)
  const fill = (ym: YearMonth, values: Record<string, number>, paidBy: Record<string, number>) => {
    const bundle = openMonthSync(ym)
    for (const e of bundle) {
      const v = values[e.description]
      if (v != null) setAmount(e, v)
      const p = paidBy[e.description]
      if (p != null) {
        e.status = 'paid'
        e.paid_by_member_id = members[p].id
        e.paid_at = e.due_date
      }
    }
  }
  fill(prev, { Água: 7840, Luz: 17820, Telefone: 5990 }, { Água: 0, Luz: 1, Telefone: 0, Internet: 0 })
  const today = new Date()
  fill(now, { Água: 8790, Luz: 21034 }, { Água: 1 })
  // Deixa a luz vencendo daqui a 2 dias para mostrar o alerta
  const luz = s.expenses.find((e) => e.description === 'Luz' && e.month_id === s.months.at(-1)!.id)!
  const due = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2)
  luz.due_date = iso(due.getFullYear(), due.getMonth() + 1, due.getDate())
  const mercado = baseExpense(s.months.at(-1)!.id, 'Mercado do mês', categories[4].id)
  setAmount(mercado, 31250)
  mercado.status = 'paid'
  mercado.paid_by_member_id = members[2].id
  mercado.paid_at = iso(now.year, now.month, 1)
  s.expenses.push(mercado)
  s.months.find((m) => m.year === prev.year && m.month === prev.month)!.status = 'closed'
  return s
}

function baseExpense(monthId: string, description: string, categoryId: string | null): Expense {
  return {
    id: id(),
    month_id: monthId,
    category_id: categoryId,
    recurring_bill_id: null,
    description,
    amount_cents: null,
    due_date: null,
    expense_date: new Date().toISOString().slice(0, 10),
    status: 'pending',
    paid_at: null,
    paid_by_member_id: null,
    split_mode: 'equal',
    attachment_path: null,
    barcode: null,
    pix_code: null,
    notes: null,
    created_at: new Date().toISOString(),
    shares: [],
  }
}

function activeMembers() {
  return db().members.filter((m) => m.active).sort((a, b) => a.sort_order - b.sort_order)
}

function setAmount(e: Expense, cents: number) {
  const ms = activeMembers()
  const parts = splitEqual(cents, ms.length)
  e.amount_cents = cents
  e.shares = ms.map((m, i) => ({ member_id: m.id, amount_cents: parts[i], weight: null }))
}

function openMonthSync({ year, month }: YearMonth): Expense[] {
  const s = db()
  let m = s.months.find((x) => x.year === year && x.month === month)
  if (!m) {
    m = { id: id(), year, month, status: 'open', closed_at: null }
    s.months.push(m)
    for (const rb of s.recurring.filter((r) => r.active).sort((a, b) => a.sort_order - b.sort_order)) {
      const e = baseExpense(m.id, rb.description, rb.category_id)
      e.recurring_bill_id = rb.id
      e.due_date = iso(year, month, Math.min(rb.due_day, lastDay(year, month)))
      e.expense_date = iso(year, month, 1)
      e.paid_by_member_id = rb.default_payer_member_id
      if (rb.default_amount_cents != null) setAmount(e, rb.default_amount_cents)
      s.expenses.push(e)
    }
  }
  const monthId = m.id
  return s.expenses.filter((e) => e.month_id === monthId)
}

function bundleFor(m: Month) {
  const s = db()
  const expenses = s.expenses
    .filter((e) => e.month_id === m.id)
    .sort((a, b) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999') || a.created_at.localeCompare(b.created_at))
  return structuredClone({ month: m, expenses, transfers: s.transfers.filter((t) => t.month_id === m.id) })
}

function assertOpen(monthId: string) {
  if (db().months.find((m) => m.id === monthId)?.status === 'closed') throw new Error('Este mês está fechado. Reabra o mês para editar.')
}

const delay = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), 60))

export const localRepo: Repo = {
  kind: 'local',

  async getHousehold() {
    const s = db()
    return delay(structuredClone({ household: s.household, members: s.members }))
  },

  async renameHousehold(_id, name) {
    db().household.name = name
    commit()
  },

  async saveMember(_h, { id: memberId, ...values }) {
    const s = db()
    if (memberId) Object.assign(s.members.find((m) => m.id === memberId)!, values)
    else s.members.push(member(values.name ?? 'Morador', values.color ?? '#4A90A4', s.members.length, values))
    commit()
  },

  async manageLogin() {
    throw new Error('No modo demonstração não há logins. Configure o Supabase para criar acessos.')
  },

  async getCategories() {
    return delay(structuredClone(db().categories))
  },

  async getRecurringBills() {
    return delay(structuredClone(db().recurring.sort((a, b) => a.sort_order - b.sort_order)))
  },

  async saveRecurringBill({ id: billId, ...values }) {
    const s = db()
    const newId = billId ?? id()
    if (billId) Object.assign(s.recurring.find((r) => r.id === billId)!, values)
    else
      s.recurring.push({
        id: newId,
        category_id: null,
        description: 'Conta',
        provider: null,
        customer_code: null,
        bill_url: null,
        due_day: 10,
        default_amount_cents: null,
        default_payer_member_id: null,
        active: true,
        sort_order: s.recurring.length + 1,
        ...values,
      })
    commit()
    return newId
  },

  async openMonth(ym) {
    openMonthSync(ym)
    commit()
    const m = db().months.find((x) => x.year === ym.year && x.month === ym.month)!
    return delay(bundleFor(m))
  },

  async getMonth(ym) {
    const m = db().months.find((x) => x.year === ym.year && x.month === ym.month)
    return delay(m ? bundleFor(m) : null)
  },

  async listMonthTotals() {
    const s = db()
    return delay(
      s.months
        .slice()
        .sort((a, b) => a.year - b.year || a.month - b.month)
        .map((m): MonthTotal => {
          const mine = s.expenses.filter((e) => e.month_id === m.id)
          const per_member: Record<string, number> = {}
          for (const e of mine) for (const sh of e.shares) per_member[sh.member_id] = (per_member[sh.member_id] ?? 0) + sh.amount_cents
          return {
            per_member,
            year: m.year,
            month: m.month,
            status: m.status,
            total_cents: mine.reduce((acc, e) => acc + (e.amount_cents ?? 0), 0),
            awaiting: mine.filter((e) => e.amount_cents == null).length,
          }
        }),
    )
  },

  async getBillHistory(recurringBillId, limit = 12) {
    const s = db()
    return delay(
      s.expenses
        .filter((e) => e.recurring_bill_id === recurringBillId)
        .map((e) => {
          const m = s.months.find((x) => x.id === e.month_id)!
          return { year: m.year, month: m.month, amount_cents: e.amount_cents }
        })
        .sort((a, b) => b.year - a.year || b.month - a.month)
        .slice(0, limit),
    )
  },

  async setMonthStatus(monthId, status) {
    const m = db().months.find((x) => x.id === monthId)!
    m.status = status
    m.closed_at = status === 'closed' ? new Date().toISOString() : null
    commit()
  },

  async saveExpense({ id: expenseId, shares, ...input }) {
    assertOpen(input.month_id)
    if (input.amount_cents != null) {
      if (shares.length === 0) throw new Error('Escolha quem participa da divisão.')
      if (shares.reduce((a, s) => a + s.amount_cents, 0) !== input.amount_cents) throw new Error('A divisão não fecha com o valor da conta.')
    }
    const s = db()
    let e = expenseId ? s.expenses.find((x) => x.id === expenseId) : undefined
    if (!e) {
      e = baseExpense(input.month_id, input.description, input.category_id)
      s.expenses.push(e)
    }
    Object.assign(e, input, { shares })
    commit()
    return e.id
  },

  async setExpensePaid(expense, paid, paidBy) {
    assertOpen(expense.month_id)
    const e = db().expenses.find((x) => x.id === expense.id)!
    e.status = paid ? 'paid' : 'pending'
    e.paid_at = paid ? new Date().toISOString().slice(0, 10) : null
    if (paid) e.paid_by_member_id = paidBy
    commit()
  },

  async deleteExpense(expenseId) {
    const s = db()
    const e = s.expenses.find((x) => x.id === expenseId)
    if (e) assertOpen(e.month_id)
    s.expenses = s.expenses.filter((x) => x.id !== expenseId)
    commit()
  },

  async uploadAttachment() {
    throw new Error('Anexos funcionam depois de configurar o Supabase.')
  },

  async attachmentUrl() {
    return ''
  },
}
