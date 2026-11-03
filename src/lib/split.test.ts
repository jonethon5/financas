import { describe, expect, it } from 'vitest'
import { buildShares, splitByWeights, splitEqual } from './split'

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

describe('splitEqual', () => {
  it('divide exato quando não há resto', () => {
    expect(splitEqual(40000, 4)).toEqual([10000, 10000, 10000, 10000])
  })

  it('distribui os centavos que sobram entre os primeiros', () => {
    expect(splitEqual(10001, 4)).toEqual([2501, 2500, 2500, 2500])
    expect(splitEqual(10003, 4)).toEqual([2501, 2501, 2501, 2500])
    expect(splitEqual(1, 4)).toEqual([1, 0, 0, 0])
  })

  it('a soma sempre fecha com o total', () => {
    for (const total of [0, 1, 2, 3, 99, 100, 12345, 99999, 1234567]) {
      for (const n of [1, 2, 3, 4, 5, 7]) {
        const parts = splitEqual(total, n)
        expect(sum(parts)).toBe(total)
        expect(Math.max(...parts) - Math.min(...parts)).toBeLessThanOrEqual(1)
      }
    }
  })

  it('rejeita divisão sem pessoas ou valor inválido', () => {
    expect(() => splitEqual(100, 0)).toThrow()
    expect(() => splitEqual(10.5, 2)).toThrow()
    expect(() => splitEqual(-1, 2)).toThrow()
  })
})

describe('splitByWeights', () => {
  it('divide por percentual', () => {
    expect(splitByWeights(10000, [60, 40])).toEqual([6000, 4000])
  })

  it('usa o maior resto para os centavos', () => {
    // 100 centavos em 3 partes iguais → 34/33/33
    expect(splitByWeights(100, [1, 1, 1])).toEqual([34, 33, 33])
    // 1001 em 2:1 → 667,33 / 333,67 → o segundo tem a maior fração e leva o centavo
    expect(splitByWeights(1001, [2, 1])).toEqual([667, 334])
  })

  it('pessoa com peso zero não paga nada', () => {
    expect(splitByWeights(999, [1, 0, 1])).toEqual([500, 0, 499])
  })

  it('a soma sempre fecha com o total', () => {
    const cases: number[][] = [[33, 33, 34], [1, 2, 3, 4], [70, 30], [1, 1, 1, 1, 1, 1, 1]]
    for (const w of cases) for (const total of [1, 7, 100, 10001, 333333]) expect(sum(splitByWeights(total, w))).toBe(total)
  })

  it('rejeita pesos inválidos', () => {
    expect(() => splitByWeights(100, [])).toThrow()
    expect(() => splitByWeights(100, [0, 0])).toThrow()
    expect(() => splitByWeights(100, [1.5, 1])).toThrow()
  })
})

describe('buildShares', () => {
  it('divisão igual entre só 2 moradores (compra extra)', () => {
    expect(buildShares({ mode: 'equal', totalCents: 5001, memberIds: ['a', 'b'] })).toEqual([
      { memberId: 'a', amountCents: 2501, weight: null },
      { memberId: 'b', amountCents: 2500, weight: null },
    ])
  })

  it('divisão por percentual ignora quem tem 0%', () => {
    const shares = buildShares({
      mode: 'weights',
      totalCents: 20000,
      weights: [
        { memberId: 'a', weight: 50 },
        { memberId: 'b', weight: 0 },
        { memberId: 'c', weight: 50 },
      ],
    })
    expect(shares.map((s) => s.memberId)).toEqual(['a', 'c'])
    expect(sum(shares.map((s) => s.amountCents))).toBe(20000)
  })

  it('valores manuais precisam fechar com o total', () => {
    expect(() =>
      buildShares({ mode: 'amounts', totalCents: 1000, amounts: [{ memberId: 'a', amountCents: 600 }, { memberId: 'b', amountCents: 300 }] }),
    ).toThrow(/Faltam 100 centavos/)
    expect(
      buildShares({ mode: 'amounts', totalCents: 1000, amounts: [{ memberId: 'a', amountCents: 700 }, { memberId: 'b', amountCents: 300 }] }),
    ).toHaveLength(2)
  })
})
