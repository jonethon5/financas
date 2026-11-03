// Leitura do "Pix copia e cola" (padrão EMV do Banco Central). Tudo local.

/** CRC16-CCITT (polinômio 0x1021, início 0xFFFF), usado no campo 63 do Pix. */
export function crc16(text: string): string {
  let crc = 0xffff
  for (let i = 0; i < text.length; i++) {
    crc ^= text.charCodeAt(i) << 8
    for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

function parseTlv(payload: string): Map<string, string> | null {
  const fields = new Map<string, string>()
  let i = 0
  while (i < payload.length) {
    const tag = payload.slice(i, i + 2)
    const len = Number(payload.slice(i + 2, i + 4))
    if (!/^\d{2}$/.test(tag) || !Number.isInteger(len)) return null
    const value = payload.slice(i + 4, i + 4 + len)
    if (value.length !== len) return null
    fields.set(tag, value)
    i += 4 + len
  }
  return fields
}

export type PixInfo =
  | { ok: true; amountCents: number | null; merchant: string | null; city: string | null }
  | { ok: false; message: string }

export function parsePix(input: string): PixInfo | null {
  const code = input.trim()
  if (!code) return null
  if (!code.startsWith('000201')) return { ok: false, message: 'Isso não parece um Pix copia e cola.' }
  const fields = parseTlv(code)
  if (!fields || !fields.has('63')) return { ok: false, message: 'Pix incompleto. Copie o código inteiro de novo.' }
  if (crc16(code.slice(0, -4)) !== code.slice(-4).toUpperCase()) {
    return { ok: false, message: 'Esse Pix parece ter algum caractere errado. Copie de novo.' }
  }
  const amount = fields.get('54')
  let amountCents: number | null = null
  if (amount && /^\d+(\.\d{1,2})?$/.test(amount)) {
    const [int, frac = ''] = amount.split('.')
    amountCents = Number(int) * 100 + Number(frac.padEnd(2, '0'))
  }
  return { ok: true, amountCents, merchant: fields.get('59') ?? null, city: fields.get('60') ?? null }
}
