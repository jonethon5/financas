import { describe, expect, it } from 'vitest'
import { crc16 } from './pix'
import { classifyScan } from './scan'

const TODAY = new Date(2026, 10, 3)

// Mesmos exemplos de barcode.test.ts, no formato que a câmera lê (44 dígitos da barra)
const BOLETO_BARRA = '00191163600000123450000002345678901234567817'
const SABESP_BARRA = '82660000000' + '87900097202' + '61115000123' + '45678900001'

function pix(): string {
  const body = '000201' + '26360014br.gov.bcb.pix0114+5511999999999' + '52040000' + '5303986' + '540587.90' + '5802BR' + '5915EMPRESA EXEMPLO' + '6009SAO PAULO' + '62070503***' + '6304'
  return body + crc16(body)
}

describe('leitura da câmera', () => {
  it('aceita o código de barras de um boleto', () => {
    expect(classifyScan(BOLETO_BARRA, TODAY)).toEqual({ kind: 'bill', digits: BOLETO_BARRA })
  })

  it('aceita o código de barras de uma conta de consumo', () => {
    expect(classifyScan(SABESP_BARRA, TODAY)).toEqual({ kind: 'bill', digits: SABESP_BARRA })
  })

  it('ignora leitura com um dígito trocado', () => {
    const errado = BOLETO_BARRA.slice(0, 20) + (BOLETO_BARRA[20] === '9' ? '0' : '9') + BOLETO_BARRA.slice(21)
    expect(classifyScan(errado, TODAY)).toBeNull()
  })

  it('ignora leitura incompleta ou que não é conta', () => {
    expect(classifyScan(BOLETO_BARRA.slice(0, 30), TODAY)).toBeNull()
    expect(classifyScan('https://exemplo.com', TODAY)).toBeNull()
  })

  it('aceita o QR Code do Pix', () => {
    const code = pix()
    expect(classifyScan(code, TODAY)).toEqual({ kind: 'pix', code })
  })

  it('ignora Pix com CRC errado', () => {
    const code = pix()
    expect(classifyScan(code.slice(0, -1) + (code.endsWith('0') ? '1' : '0'), TODAY)).toBeNull()
  })
})
