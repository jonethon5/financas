import { describe, expect, it } from 'vitest'
import { addMonths, monthLabel } from './dates'

describe('addMonths', () => {
  it('vira o ano corretamente', () => {
    expect(addMonths({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 })
    expect(addMonths({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 })
    expect(addMonths({ year: 2026, month: 11 }, -23)).toEqual({ year: 2024, month: 12 })
  })
})

describe('monthLabel', () => {
  it('escreve o mês em português', () => {
    expect(monthLabel({ year: 2026, month: 3 })).toBe('Março de 2026')
  })
})
