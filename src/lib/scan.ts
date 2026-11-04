import { onlyDigits, parseBillCode } from './barcode'
import { parsePix } from './pix'

/** O que a câmera leu: código de barras de uma conta (44 dígitos) ou um Pix copia e cola (QR Code). */
export type ScanResult = { kind: 'bill'; digits: string } | { kind: 'pix'; code: string }

/**
 * Decide se uma leitura da câmera serve. Leituras parciais ou com dígito verificador errado
 * (comuns quando o código ainda está fora de foco) são ignoradas, e a câmera continua tentando.
 */
export function classifyScan(raw: string, today: Date = new Date()): ScanResult | null {
  const text = raw.trim()
  if (text.startsWith('000201')) {
    return parsePix(text)?.ok ? { kind: 'pix', code: text } : null
  }
  const digits = onlyDigits(text)
  if (digits.length !== 44 || digits !== text) return null
  return parseBillCode(digits, today)?.ok ? { kind: 'bill', digits } : null
}
