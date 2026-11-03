import { describe, expect, it } from 'vitest'
import { centsToInput, formatBRL, parseBRL } from './money'

describe('formatBRL', () => {
  it('formata centavos em reais', () => {
    expect(formatBRL(0)).toBe('R$ 0,00')
    expect(formatBRL(5)).toBe('R$ 0,05')
    expect(formatBRL(123456)).toBe('R$ 1.234,56')
    expect(formatBRL(-2500)).toMatch(/-\s?R\$ 25,00/)
  })
})

describe('parseBRL', () => {
  it.each([
    ['10', 1000],
    ['10,5', 1050],
    ['10,50', 1050],
    ['1.234,56', 123456],
    ['R$ 1.234,56', 123456],
    ['0,01', 1],
    [',99', 99],
    ['10.50', 1050],
    ['10.5', 1050],
    ['1.234', 123400],
    ['1.234.567', 123456700],
    ['007,10', 710],
  ])('"%s" → %i centavos', (input, cents) => {
    expect(parseBRL(input)).toBe(cents)
  })

  it.each(['', 'abc', '1,2,3', '10,555', '-5', '12.34.5', '1.23,45'])('rejeita "%s"', (input) => {
    expect(parseBRL(input)).toBeNull()
  })
})

describe('centsToInput', () => {
  it('converte para o formato do campo', () => {
    expect(centsToInput(123456)).toBe('1.234,56')
    expect(centsToInput(null)).toBe('')
  })
})
