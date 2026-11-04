import { describe, expect, it } from 'vitest'
import { dueDateFromFactor, formatBillCode, mod10, mod11Boleto, onlyDigits, parseBillCode } from './barcode'

// Exemplos gerados por uma implementação independente (script Python) para não testar o código contra ele mesmo.
const TODAY = new Date(2026, 10, 3) // 03/11/2026

const BOLETO_2026 = {
  line: '00190.00009 02345.678904 12345.678176 1 16360000012345',
  barcode: '00191163600000123450000002345678901234567817',
}
const BOLETO_2024 = '23791.23454 67890.123457 67890.123457 1 99470000099990' // venc. 31/12/2024 (ciclo antigo)
const BOLETO_SEM_VENC = '34195.55556 00000.111112 22222.333332 3 00000000000000'
const BOLETO_FATOR_1000 = '10499.87652 43210.987657 43210.987657 5 10000000000500' // venc. 22/02/2025
const SABESP_6 = '82660000000-2 87900097202-3 61115000123-2 45678900001-9'
const ENEL_8 = '838900000021103400480000000000000000987654321011'
const VIVO_7 = '84770000001-5 50000123111-6 11222223333-3 34444455555-3'

describe('dígitos verificadores', () => {
  it('módulo 10', () => {
    expect(mod10('001900000')).toBe(9)
    expect(mod10('0234567890')).toBe(4)
  })
  it('módulo 11 do boleto', () => {
    const b = BOLETO_2026.barcode
    expect(mod11Boleto(b.slice(0, 4) + b.slice(5))).toBe(1)
  })
})

describe('fator de vencimento', () => {
  it('ciclo antigo (base 07/10/1997)', () => {
    expect(dueDateFromFactor(9947, TODAY)).toBe('2024-12-31')
    expect(dueDateFromFactor(9999, TODAY)).toBe('2025-02-21')
  })
  it('novo ciclo a partir de 22/02/2025 (fator reinicia em 1000)', () => {
    expect(dueDateFromFactor(1000, TODAY)).toBe('2025-02-22')
    expect(dueDateFromFactor(1636, TODAY)).toBe('2026-11-20')
  })
  it('fator 0000 = sem vencimento', () => {
    expect(dueDateFromFactor(0, TODAY)).toBeNull()
  })
})

describe('boleto bancário', () => {
  it('linha digitável com pontos e espaços', () => {
    const r = parseBillCode(BOLETO_2026.line, TODAY)
    expect(r).toMatchObject({
      ok: true,
      kind: 'boleto',
      bankCode: '001',
      barcode: BOLETO_2026.barcode,
      amountCents: 12345,
      dueDate: '2026-11-20',
    })
  })

  it('aceita o código de barras de 44 dígitos', () => {
    expect(parseBillCode(BOLETO_2026.barcode, TODAY)).toMatchObject({ ok: true, amountCents: 12345, dueDate: '2026-11-20' })
  })

  it('vencimento no ciclo antigo e no dia da virada', () => {
    expect(parseBillCode(BOLETO_2024, TODAY)).toMatchObject({ ok: true, amountCents: 99990, dueDate: '2024-12-31' })
    expect(parseBillCode(BOLETO_FATOR_1000, TODAY)).toMatchObject({ ok: true, amountCents: 500, dueDate: '2025-02-22' })
  })

  it('sem vencimento e sem valor', () => {
    expect(parseBillCode(BOLETO_SEM_VENC, TODAY)).toMatchObject({ ok: true, amountCents: null, dueDate: null })
  })

  it('detecta número trocado', () => {
    const wrong = BOLETO_2026.line.replace('12345.678176', '12345.678177')
    expect(parseBillCode(wrong, TODAY)).toMatchObject({ ok: false })
    const wrongGeneral = BOLETO_2026.barcode.slice(0, 4) + '2' + BOLETO_2026.barcode.slice(5)
    expect(parseBillCode(wrongGeneral, TODAY)).toMatchObject({ ok: false })
  })
})

describe('conta de consumo (arrecadação)', () => {
  it('Sabesp, valor em reais (identificador 6, módulo 10) e data no código', () => {
    expect(parseBillCode(SABESP_6, TODAY)).toMatchObject({
      ok: true,
      kind: 'arrecadacao',
      segment: 2,
      segmentLabel: 'Saneamento (água e esgoto)',
      amountCents: 8790,
      valueIsReference: false,
      dueDate: '2026-11-15',
    })
  })

  it('energia com módulo 11 (identificador 8), sem data no código', () => {
    expect(parseBillCode(ENEL_8, TODAY)).toMatchObject({
      ok: true,
      segment: 3,
      amountCents: 21034,
      valueIsReference: false,
      dueDate: null,
    })
  })

  it('valor de referência (identificador 7) não é preenchido', () => {
    // 7 = valor de referência pelo padrão, mas na prática traz o valor da conta: preenche e pede para conferir
    expect(parseBillCode(VIVO_7, TODAY)).toMatchObject({ ok: true, segment: 4, amountCents: 15000, valueIsReference: true })
  })

  it('detecta bloco com dígito errado', () => {
    expect(parseBillCode(SABESP_6.replace('-9', '-8'), TODAY)).toMatchObject({ ok: false })
  })
})

describe('entrada', () => {
  it('vazio = nada a fazer', () => {
    expect(parseBillCode('  ', TODAY)).toBeNull()
  })
  it('incompleto', () => {
    expect(parseBillCode('00190.00009 02345', TODAY)).toEqual({ ok: false, message: expect.stringContaining('incompleto') })
  })
  it('guarda só os dígitos', () => {
    expect(onlyDigits('8266 0000-2.8')).toBe('8266000028')
  })
  it('formata a linha digitável', () => {
    expect(formatBillCode(onlyDigits(BOLETO_2026.line))).toBe('00190.00009 02345.678904 12345.678176 1 16360000012345')
  })
})
