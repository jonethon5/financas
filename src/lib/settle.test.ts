import { describe, expect, it } from 'vitest'
import { computeBalances, settle, type SettleExpense } from './settle'
import { splitEqual } from './split'

const ids = ['johnny', 'karen', 'maria', 'armando']

function equalExpense(total: number, paidBy: string, status: 'paid' | 'pending' = 'paid', members = ids): SettleExpense {
  const parts = splitEqual(total, members.length)
  return { amountCents: total, status, paidByMemberId: paidBy, shares: members.map((m, i) => ({ memberId: m, amountCents: parts[i] })) }
}

function applyTransfers(balances: { memberId: string; netCents: number }[], transfers: ReturnType<typeof settle>) {
  const net = new Map(balances.map((b) => [b.memberId, b.netCents]))
  for (const t of transfers) {
    net.set(t.fromMemberId, net.get(t.fromMemberId)! + t.amountCents)
    net.set(t.toMemberId, net.get(t.toMemberId)! - t.amountCents)
  }
  return [...net.values()]
}

describe('computeBalances', () => {
  it('quem pagou tem a receber, os outros devem a parte', () => {
    const b = computeBalances(ids, [equalExpense(40000, 'johnny')])
    expect(b.find((x) => x.memberId === 'johnny')!.netCents).toBe(30000)
    expect(b.find((x) => x.memberId === 'karen')!.netCents).toBe(-10000)
  })

  it('conta pendente não entra no acerto', () => {
    const b = computeBalances(ids, [equalExpense(40000, 'johnny', 'pending')])
    expect(b.every((x) => x.netCents === 0)).toBe(true)
  })

  it('resto de centavos: a soma dos saldos continua zero', () => {
    const b = computeBalances(ids, [equalExpense(10001, 'karen'), equalExpense(333, 'maria')])
    expect(b.reduce((a, x) => a + x.netCents, 0)).toBe(0)
    expect(b.find((x) => x.memberId === 'johnny')!.netCents).toBe(-2501 - 84)
  })

  it('acerto já feito abate a dívida', () => {
    const b = computeBalances(ids, [equalExpense(40000, 'johnny')], [{ fromMemberId: 'karen', toMemberId: 'johnny', amountCents: 10000 }])
    expect(b.find((x) => x.memberId === 'karen')!.netCents).toBe(0)
    expect(b.find((x) => x.memberId === 'johnny')!.netCents).toBe(20000)
  })
})

describe('settle', () => {
  it('3 pessoas pagam quem adiantou tudo', () => {
    const balances = computeBalances(ids, [equalExpense(40000, 'johnny')])
    const t = settle(balances)
    expect(t).toHaveLength(3)
    expect(t.every((x) => x.toMemberId === 'johnny' && x.amountCents === 10000)).toBe(true)
  })

  it('zera todos os saldos com resto de centavos', () => {
    const balances = computeBalances(ids, [equalExpense(12345, 'johnny'), equalExpense(9871, 'karen'), equalExpense(77, 'maria')])
    const t = settle(balances)
    expect(applyTransfers(balances, t).every((v) => v === 0)).toBe(true)
    expect(t.length).toBeLessThanOrEqual(3)
  })

  it('usa o menor número de transferências (pares que se anulam)', () => {
    // A deve 10 a B e C deve 7 a D: o guloso faria 3 transferências; o ótimo são 2.
    const balances = [
      { memberId: 'a', netCents: -1000 },
      { memberId: 'b', netCents: 1000 },
      { memberId: 'c', netCents: -700 },
      { memberId: 'd', netCents: 700 },
    ]
    const t = settle(balances)
    expect(t).toEqual(
      expect.arrayContaining([
        { fromMemberId: 'a', toMemberId: 'b', amountCents: 1000 },
        { fromMemberId: 'c', toMemberId: 'd', amountCents: 700 },
      ]),
    )
    expect(t).toHaveLength(2)
  })

  it('sem saldo, sem transferência', () => {
    expect(settle([{ memberId: 'a', netCents: 0 }])).toEqual([])
  })

  it('rejeita saldos que não fecham', () => {
    expect(() => settle([{ memberId: 'a', netCents: 5 }])).toThrow()
  })
})
