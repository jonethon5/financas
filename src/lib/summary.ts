import type { Expense } from '../types'

export type MonthSummary = {
  totalCents: number
  /** Parte de cada morador (soma das partes em todas as contas com valor) */
  perMember: Map<string, number>
  /** true quando todas as contas foram divididas igualmente entre todos os moradores ativos */
  evenSplit: boolean
  /** Valor exibido em "Cada um paga" quando evenSplit */
  eachCents: number
  billCount: number
  paidCount: number
  awaitingCount: number
}

export function summarizeMonth(expenses: Expense[], activeMemberIds: string[]): MonthSummary {
  const perMember = new Map(activeMemberIds.map((id) => [id, 0]))
  let total = 0
  let even = true
  for (const e of expenses) {
    if (e.amount_cents == null) continue
    total += e.amount_cents
    for (const s of e.shares) perMember.set(s.member_id, (perMember.get(s.member_id) ?? 0) + s.amount_cents)
    const ids = new Set(e.shares.map((s) => s.member_id))
    if (e.split_mode !== 'equal' || ids.size !== activeMemberIds.length || !activeMemberIds.every((id) => ids.has(id))) {
      even = false
    }
  }
  const values = [...perMember.values()]
  return {
    totalCents: total,
    perMember,
    evenSplit: even,
    eachCents: values.length ? Math.max(...values) : 0,
    billCount: expenses.length,
    paidCount: expenses.filter((e) => e.status === 'paid').length,
    awaitingCount: expenses.filter((e) => e.amount_cents == null).length,
  }
}

/** Variação em relação a outro valor: { diff em centavos, pct arredondado } ou null se não dá para comparar. */
export function variation(current: number | null, previous: number | null | undefined) {
  if (current == null || previous == null || previous === 0) return null
  const diff = current - previous
  return { diffCents: diff, pct: Math.round((diff / previous) * 100) }
}
