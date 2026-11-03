import { describe, expect, it } from 'vitest'
import { isValidUsername, loginEmail, normalizeUsername, suggestUsername } from './login'

describe('login por usuário', () => {
  it('normaliza acento, espaço e maiúscula', () => {
    expect(normalizeUsername('  Cída ')).toBe('cida')
    expect(normalizeUsername('JOÃO')).toBe('joao')
  })

  it('valida o formato', () => {
    expect(isValidUsername('maria')).toBe(true)
    expect(isValidUsername('m')).toBe(false)
    expect(isValidUsername('maria cida')).toBe(false)
    expect(isValidUsername('.maria')).toBe(false)
  })

  it('gera o e-mail interno', () => {
    expect(loginEmail('Karen')).toBe('karen@moradores.financas.local')
  })

  it('sugere usuário pelo primeiro nome', () => {
    expect(suggestUsername('Maria Aparecida')).toBe('maria')
    expect(suggestUsername("Zé D'Ávila")).toBe('ze')
  })
})
