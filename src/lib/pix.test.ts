import { describe, expect, it } from 'vitest'
import { crc16, parsePix } from './pix'

// Monta um Pix de teste com CRC calculado
function build(fields: [string, string][]): string {
  const body = fields.map(([t, v]) => t + String(v.length).padStart(2, '0') + v).join('') + '6304'
  return body + crc16(body)
}

describe('Pix copia e cola', () => {
  it('CRC16 confere com o valor de referência do padrão (123456789 → 29B1)', () => {
    expect(crc16('123456789')).toBe('29B1')
  })

  const pix = build([
    ['00', '01'],
    ['26', '0014br.gov.bcb.pix0114+5511999999999'],
    ['52', '0000'],
    ['53', '986'],
    ['54', '87.90'],
    ['58', 'BR'],
    ['59', 'EMPRESA EXEMPLO'],
    ['60', 'SAO PAULO'],
    ['62', '0503***'],
  ])

  it('lê valor, recebedor e cidade', () => {
    expect(parsePix(pix)).toEqual({ ok: true, amountCents: 8790, merchant: 'EMPRESA EXEMPLO', city: 'SAO PAULO' })
  })

  it('Pix sem valor', () => {
    const semValor = build([
      ['00', '01'],
      ['26', '0014br.gov.bcb.pix0114+5511999999999'],
      ['53', '986'],
      ['58', 'BR'],
    ])
    expect(parsePix(semValor)).toMatchObject({ ok: true, amountCents: null })
  })

  it('detecta caractere alterado', () => {
    expect(parsePix(pix.replace('87.90', '97.90'))).toMatchObject({ ok: false })
  })

  it('rejeita texto que não é Pix', () => {
    expect(parsePix('banana')).toMatchObject({ ok: false })
    expect(parsePix('   ')).toBeNull()
  })
})
