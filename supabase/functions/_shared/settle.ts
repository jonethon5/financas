// Também usado pela Edge Function "ask" (Deno). Sem imports: roda igual no navegador e no servidor.
// Acerto entre moradores: quem pagou contas da casa recebe de quem ainda não pagou a sua parte.

export type SettleExpense = {
  amountCents: number | null
  status: 'pending' | 'paid'
  paidByMemberId: string | null
  shares: { memberId: string; amountCents: number }[]
}

export type SettleTransfer = { fromMemberId: string; toMemberId: string; amountCents: number }

export type MemberBalance = {
  memberId: string
  /** Quanto essa pessoa pagou de contas da casa */
  paidCents: number
  /** A parte dela nas contas que já foram pagas */
  shareCents: number
  /** Positivo = tem a receber; negativo = deve */
  netCents: number
}

/**
 * Saldo de cada morador considerando só as contas JÁ PAGAS por alguém
 * (conta pendente ainda não gerou dívida entre as pessoas) e os acertos já feitos.
 */
export function computeBalances(memberIds: string[], expenses: SettleExpense[], transfers: SettleTransfer[] = []): MemberBalance[] {
  const map = new Map(memberIds.map((id) => [id, { memberId: id, paidCents: 0, shareCents: 0, netCents: 0 }]))
  const get = (id: string) => {
    let b = map.get(id)
    if (!b) {
      b = { memberId: id, paidCents: 0, shareCents: 0, netCents: 0 }
      map.set(id, b)
    }
    return b
  }

  for (const e of expenses) {
    if (e.status !== 'paid' || !e.paidByMemberId || e.amountCents == null) continue
    get(e.paidByMemberId).paidCents += e.amountCents
    for (const s of e.shares) get(s.memberId).shareCents += s.amountCents
  }

  for (const b of map.values()) b.netCents = b.paidCents - b.shareCents

  // Acerto feito: quem transferiu diminui a dívida; quem recebeu diminui o crédito.
  for (const t of transfers) {
    get(t.fromMemberId).netCents += t.amountCents
    get(t.toMemberId).netCents -= t.amountCents
  }

  return [...map.values()]
}

/**
 * Menor número possível de transferências para zerar os saldos.
 * Para poucas pessoas (até 12) acha o ótimo de verdade: separa os saldos no maior número de grupos que
 * somam zero (cada grupo de k pessoas fecha com k−1 transferências). Acima disso, usa o método guloso.
 */
export function settle(balances: { memberId: string; netCents: number }[]): SettleTransfer[] {
  const items = balances.filter((b) => b.netCents !== 0)
  if (items.length === 0) return []
  const total = items.reduce((a, b) => a + b.netCents, 0)
  if (total !== 0) throw new Error('Os saldos não fecham em zero.')

  if (items.length > 12) return greedy(items)

  const n = items.length
  const full = (1 << n) - 1
  const sums = new Array<number>(1 << n).fill(0)
  for (let mask = 1; mask <= full; mask++) {
    const low = mask & -mask
    sums[mask] = sums[mask ^ low] + items[31 - Math.clz32(low)].netCents
  }
  // groups[mask] = maior número de grupos com soma zero em que dá para separar `mask`
  const groups = new Array<number>(1 << n).fill(0)
  for (let mask = 1; mask <= full; mask++) {
    let best = 0
    for (let i = 0; i < n; i++) if (mask & (1 << i)) best = Math.max(best, groups[mask ^ (1 << i)])
    groups[mask] = best + (sums[mask] === 0 ? 1 : 0)
  }

  // Reconstrói os grupos: tira sempre um subconjunto de soma zero que mantém o ótimo.
  const result: SettleTransfer[] = []
  let rest = full
  while (rest) {
    let chosen = rest
    for (let sub = (rest - 1) & rest; sub > 0; sub = (sub - 1) & rest) {
      if (sums[sub] === 0 && groups[rest ^ sub] === groups[rest] - 1 && bitCount(sub) < bitCount(chosen)) chosen = sub
    }
    result.push(...greedy(items.filter((_, i) => chosen & (1 << i))))
    rest ^= chosen
  }
  return result
}

function greedy(items: { memberId: string; netCents: number }[]): SettleTransfer[] {
  const creditors = items.filter((b) => b.netCents > 0).map((b) => ({ ...b }))
  const debtors = items.filter((b) => b.netCents < 0).map((b) => ({ ...b, netCents: -b.netCents }))
  const out: SettleTransfer[] = []
  while (creditors.length && debtors.length) {
    creditors.sort((a, b) => b.netCents - a.netCents)
    debtors.sort((a, b) => b.netCents - a.netCents)
    const c = creditors[0]
    const d = debtors[0]
    const amount = Math.min(c.netCents, d.netCents)
    out.push({ fromMemberId: d.memberId, toMemberId: c.memberId, amountCents: amount })
    c.netCents -= amount
    d.netCents -= amount
    if (c.netCents === 0) creditors.shift()
    if (d.netCents === 0) debtors.shift()
  }
  return out
}

function bitCount(x: number) {
  let c = 0
  while (x) {
    x &= x - 1
    c++
  }
  return c
}
