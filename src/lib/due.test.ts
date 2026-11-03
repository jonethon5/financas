import { describe, expect, it } from 'vitest'
import { daysUntil, dueLabel, dueState } from './due'
import { summarizeMonth, variation } from './summary'
import type { Expense } from '../types'

const T = '2026-11-10'

describe('vencimento', () => {
  it('conta dias até o vencimento, inclusive virando o mês', () => {
    expect(daysUntil('2026-11-13', T)).toBe(3)
    expect(daysUntil('2026-12-01', '2026-11-30')).toBe(1)
    expect(daysUntil('2026-11-08', T)).toBe(-2)
  })

  it('classifica a situação', () => {
    expect(dueState({ status: 'paid', due_date: '2026-11-01' }, T)).toBe('paid')
    expect(dueState({ status: 'pending', due_date: '2026-11-09' }, T)).toBe('overdue')
    expect(dueState({ status: 'pending', due_date: T }, T)).toBe('today')
    expect(dueState({ status: 'pending', due_date: '2026-11-13' }, T)).toBe('soon')
    expect(dueState({ status: 'pending', due_date: '2026-11-14' }, T)).toBe('later')
    expect(dueState({ status: 'pending', due_date: null }, T)).toBe('no-date')
  })

  it('escreve o texto em português', () => {
    expect(dueLabel({ status: 'pending', due_date: T }, T)).toBe('Vence hoje')
    expect(dueLabel({ status: 'pending', due_date: '2026-11-11' }, T)).toBe('Vence amanhã')
    expect(dueLabel({ status: 'pending', due_date: '2026-11-15' }, T)).toBe('Vence em 5 dias')
    expect(dueLabel({ status: 'pending', due_date: '2026-11-30' }, T)).toBe('Vence 30/11')
    expect(dueLabel({ status: 'pending', due_date: '2026-11-09' }, T)).toBe('Venceu ontem')
    expect(dueLabel({ status: 'pending', due_date: '2026-11-05' }, T)).toBe('Venceu há 5 dias')
  })
})

function exp(amount: number | null, shares: [string, number][], extra: Partial<Expense> = {}): Expense {
  return {
    id: Math.random().toString(),
    month_id: 'm',
    category_id: null,
    recurring_bill_id: null,
    description: 'x',
    amount_cents: amount,
    due_date: null,
    expense_date: T,
    status: 'pending',
    paid_at: null,
    paid_by_member_id: null,
    split_mode: 'equal',
    attachment_path: null,
    barcode: null,
    pix_code: null,
    notes: null,
    created_at: T,
    shares: shares.map(([member_id, amount_cents]) => ({ member_id, amount_cents, weight: null })),
    ...extra,
  }
}

describe('resumo do mês', () => {
  const ids = ['a', 'b', 'c', 'd']

  it('soma o total, conta pagas e aguardando valor', () => {
    const s = summarizeMonth(
      [
        exp(10001, [['a', 2501], ['b', 2500], ['c', 2500], ['d', 2500]], { status: 'paid' }),
        exp(null, []),
        exp(400, [['a', 100], ['b', 100], ['c', 100], ['d', 100]]),
      ],
      ids,
    )
    expect(s.totalCents).toBe(10401)
    expect(s.evenSplit).toBe(true)
    expect(s.eachCents).toBe(2601)
    expect(s.perMember.get('d')).toBe(2600)
    expect([s.billCount, s.paidCount, s.awaitingCount]).toEqual([3, 1, 1])
  })

  it('detecta quando a divisão não foi igual para todos', () => {
    const s = summarizeMonth([exp(1000, [['a', 500], ['b', 500]])], ids)
    expect(s.evenSplit).toBe(false)
  })

  it('variação contra o mês anterior', () => {
    expect(variation(21000, 17800)).toEqual({ diffCents: 3200, pct: 18 })
    expect(variation(9000, 10000)).toEqual({ diffCents: -1000, pct: -10 })
    expect(variation(100, null)).toBeNull()
    expect(variation(null, 100)).toBeNull()
  })
})
