// Divisão de contas em CENTAVOS. A soma das partes sempre fecha exatamente com o total.

/**
 * Divide igualmente. Os centavos que sobram vão, um para cada, para os primeiros da lista.
 * Ex.: R$ 100,01 por 4 → 25,01 / 25,00 / 25,00 / 25,00
 * (A mesma regra existe no banco: public.split_equal.)
 */
export function splitEqual(totalCents: number, count: number): number[] {
  assertCents(totalCents)
  if (!Number.isInteger(count) || count <= 0) throw new Error('Escolha pelo menos uma pessoa para dividir.')
  const base = Math.floor(totalCents / count)
  const remainder = totalCents - base * count
  return Array.from({ length: count }, (_, i) => base + (i < remainder ? 1 : 0))
}

/**
 * Divide proporcionalmente a pesos inteiros (ex.: percentuais 60/40, ou 2 partes para um e 1 para outro).
 * Usa o método do maior resto: cada um recebe a parte inteira, e os centavos que sobram vão para quem
 * tinha a maior fração (empate: quem vem primeiro na lista).
 */
export function splitByWeights(totalCents: number, weights: number[]): number[] {
  assertCents(totalCents)
  if (weights.length === 0) throw new Error('Escolha pelo menos uma pessoa para dividir.')
  if (weights.some((w) => !Number.isInteger(w) || w < 0)) throw new Error('Os pesos precisam ser números inteiros positivos.')
  const sum = weights.reduce((a, b) => a + b, 0)
  if (sum === 0) throw new Error('Pelo menos uma pessoa precisa ter parte maior que zero.')

  // totalCents * w cabe com folga em Number (limite ~9 quatrilhões)
  const raw = weights.map((w) => totalCents * w)
  const parts = raw.map((r) => Math.floor(r / sum))
  let leftover = totalCents - parts.reduce((a, b) => a + b, 0)
  const order = raw
    .map((r, i) => ({ i, frac: r % sum }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i)
  for (const { i } of order) {
    if (leftover === 0) break
    parts[i] += 1
    leftover -= 1
  }
  return parts
}

export type SplitMode = 'equal' | 'weights' | 'amounts'

export type Share = { memberId: string; amountCents: number; weight: number | null }

export type SplitInput =
  | { mode: 'equal'; totalCents: number; memberIds: string[] }
  | { mode: 'weights'; totalCents: number; weights: { memberId: string; weight: number }[] }
  | { mode: 'amounts'; totalCents: number; amounts: { memberId: string; amountCents: number }[] }

/** Monta as partes de cada morador. Lança erro com mensagem amigável se a divisão não fechar. */
export function buildShares(input: SplitInput): Share[] {
  switch (input.mode) {
    case 'equal': {
      const parts = splitEqual(input.totalCents, input.memberIds.length)
      return input.memberIds.map((memberId, i) => ({ memberId, amountCents: parts[i], weight: null }))
    }
    case 'weights': {
      const active = input.weights.filter((w) => w.weight > 0)
      const parts = splitByWeights(
        input.totalCents,
        active.map((w) => w.weight),
      )
      return active.map((w, i) => ({ memberId: w.memberId, amountCents: parts[i], weight: w.weight }))
    }
    case 'amounts': {
      const active = input.amounts.filter((a) => a.amountCents > 0)
      active.forEach((a) => assertCents(a.amountCents))
      const sum = active.reduce((acc, a) => acc + a.amountCents, 0)
      if (active.length === 0) throw new Error('Informe quanto cada pessoa paga.')
      if (sum !== input.totalCents) {
        const diff = input.totalCents - sum
        throw new Error(diff > 0 ? `Faltam ${diff} centavos para fechar o total.` : `Passou ${-diff} centavos do total.`)
      }
      return active.map((a) => ({ memberId: a.memberId, amountCents: a.amountCents, weight: null }))
    }
  }
}

function assertCents(value: number) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('Valor inválido.')
}
