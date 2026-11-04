// Leitura de código de barras / linha digitável de contas brasileiras. Tudo local, sem API externa.
//
// Dois tipos:
//  • Boleto bancário: linha digitável de 47 dígitos (ou código de barras de 44).
//  • Conta de consumo / arrecadação (água, luz, telefone…): 48 dígitos começando com 8 (ou 44 lidos da barra).

export type BillCode =
  | {
      ok: true
      kind: 'boleto'
      /** Só os dígitos, como foram digitados (47 ou 44) */
      digits: string
      /** Código de barras de 44 dígitos */
      barcode: string
      bankCode: string
      amountCents: number | null
      /** AAAA-MM-DD */
      dueDate: string | null
    }
  | {
      ok: true
      kind: 'arrecadacao'
      digits: string
      barcode: string
      segment: number
      segmentLabel: string
      /** Preenchido só quando o código traz o valor em reais. */
      amountCents: number | null
      /** true quando o valor no código é só "de referência" (não é o valor a pagar). */
      valueIsReference: boolean
      dueDate: string | null
    }
  | { ok: false; message: string }

export function onlyDigits(input: string): string {
  return input.replace(/\D/g, '')
}

/** Formata para leitura humana (grupos de 5/6 dígitos), sem mudar os números. */
export function formatBillCode(digits: string): string {
  if (digits.length === 47) {
    return `${digits.slice(0, 5)}.${digits.slice(5, 10)} ${digits.slice(10, 15)}.${digits.slice(15, 21)} ${digits.slice(21, 26)}.${digits.slice(26, 32)} ${digits[32]} ${digits.slice(33)}`
  }
  if (digits.length === 48) {
    return [0, 12, 24, 36].map((i) => `${digits.slice(i, i + 11)}-${digits[i + 11]}`).join(' ')
  }
  return digits.replace(/(\d{5})(?=\d)/g, '$1 ')
}

// ---------------------------------------------------------------------------
// Dígitos verificadores
// ---------------------------------------------------------------------------

/** Módulo 10: pesos 2,1,2,1… da direita para a esquerda; soma os algarismos de cada produto. */
export function mod10(digits: string): number {
  let sum = 0
  let weight = 2
  for (let i = digits.length - 1; i >= 0; i--) {
    const p = Number(digits[i]) * weight
    sum += Math.floor(p / 10) + (p % 10)
    weight = weight === 2 ? 1 : 2
  }
  return (10 - (sum % 10)) % 10
}

function mod11Sum(digits: string): number {
  let sum = 0
  let weight = 2
  for (let i = digits.length - 1; i >= 0; i--) {
    sum += Number(digits[i]) * weight
    weight = weight === 9 ? 2 : weight + 1
  }
  return sum
}

/** Módulo 11 do boleto bancário: resultado 0, 10 ou 11 vira 1. */
export function mod11Boleto(digits: string): number {
  const dv = 11 - (mod11Sum(digits) % 11)
  return dv === 0 || dv === 10 || dv === 11 ? 1 : dv
}

/** Módulo 11 da arrecadação: resto 0 ou 1 vira 0. */
export function mod11Arrecadacao(digits: string): number {
  const r = mod11Sum(digits) % 11
  return r === 0 || r === 1 ? 0 : 11 - r
}

// ---------------------------------------------------------------------------
// Datas
// ---------------------------------------------------------------------------

const DAY = 86_400_000
const BASE_1997 = Date.UTC(1997, 9, 7) // 07/10/1997, fator 0
const BASE_2025 = Date.UTC(2025, 1, 22) // 22/02/2025, o fator recomeça em 1000

function toIso(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

/**
 * Converte o fator de vencimento (4 dígitos) em data.
 * O fator chegou a 9999 em 21/02/2025 e voltou para 1000 em 22/02/2025. Como o mesmo número pode
 * representar duas datas (uma em cada ciclo), escolhemos a mais próxima de hoje.
 * Fator 0000 = boleto sem vencimento.
 */
export function dueDateFromFactor(factor: number, today: Date = new Date()): string | null {
  if (factor === 0) return null
  const oldCycle = BASE_1997 + factor * DAY
  if (factor < 1000) return toIso(oldCycle)
  const newCycle = BASE_2025 + (factor - 1000) * DAY
  const now = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  return toIso(Math.abs(newCycle - now) < Math.abs(oldCycle - now) ? newCycle : oldCycle)
}

function isoFromYmd(ymd: string, today: Date): string | null {
  const y = Number(ymd.slice(0, 4))
  const m = Number(ymd.slice(4, 6))
  const d = Number(ymd.slice(6, 8))
  if (m < 1 || m > 12 || d < 1 || d > 31) return null
  const ms = Date.UTC(y, m - 1, d)
  const date = new Date(ms)
  if (date.getUTCMonth() !== m - 1) return null // ex.: 31/02
  const now = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  // Só aceita se for uma data plausível (até ~1 ano de distância de hoje)
  if (Math.abs(ms - now) > 400 * DAY) return null
  return toIso(ms)
}

// ---------------------------------------------------------------------------
// Boleto bancário
// ---------------------------------------------------------------------------

/** Linha digitável (47) → código de barras (44). */
function boletoLineToBarcode(line: string): string {
  return line.slice(0, 4) + line[32] + line.slice(33, 47) + line.slice(4, 9) + line.slice(10, 20) + line.slice(21, 31)
}

function parseBoleto(digits: string, today: Date): BillCode {
  let barcode: string
  if (digits.length === 47) {
    const fields: [number, number][] = [
      [0, 9],
      [10, 20],
      [21, 31],
    ]
    for (const [start, end] of fields) {
      if (mod10(digits.slice(start, end)) !== Number(digits[end])) return invalid()
    }
    barcode = boletoLineToBarcode(digits)
  } else {
    barcode = digits
  }

  const generalDv = mod11Boleto(barcode.slice(0, 4) + barcode.slice(5))
  if (generalDv !== Number(barcode[4])) return invalid()

  const factor = Number(barcode.slice(5, 9))
  const amount = Number(barcode.slice(9, 19))
  return {
    ok: true,
    kind: 'boleto',
    digits,
    barcode,
    bankCode: barcode.slice(0, 3),
    amountCents: amount > 0 ? amount : null,
    dueDate: dueDateFromFactor(factor, today),
  }
}

// ---------------------------------------------------------------------------
// Arrecadação / concessionárias (água, luz, telefone, gás, impostos…)
// ---------------------------------------------------------------------------

export const SEGMENTS: Record<number, string> = {
  1: 'Prefeitura',
  2: 'Saneamento (água e esgoto)',
  3: 'Energia elétrica e gás',
  4: 'Telecomunicações',
  5: 'Órgãos governamentais',
  6: 'Carnês e assemelhados',
  7: 'Multas de trânsito',
  9: 'Uso exclusivo do banco',
}

function parseArrecadacao(digits: string, today: Date): BillCode {
  // 3º dígito (identificador de valor): 6/7 → DV módulo 10; 8/9 → módulo 11.
  // 6 e 8 = valor efetivo em reais; 7 e 9 = "quantidade de moeda / valor de referência" (padrão FEBRABAN).
  // Na prática muitas empresas usam 7/9 com o valor da conta em reais (os apps de banco mostram esse valor),
  // então o valor também é preenchido nesses casos, com o aviso para conferir.
  const valueId = Number(digits[2])
  if (![6, 7, 8, 9].includes(valueId)) return invalid()
  const dvFn = valueId === 6 || valueId === 7 ? mod10 : mod11Arrecadacao

  let barcode: string
  if (digits.length === 48) {
    barcode = ''
    for (let i = 0; i < 48; i += 12) {
      const block = digits.slice(i, i + 11)
      if (dvFn(block) !== Number(digits[i + 11])) return invalid()
      barcode += block
    }
  } else {
    barcode = digits
  }

  if (dvFn(barcode.slice(0, 3) + barcode.slice(4)) !== Number(barcode[3])) return invalid()

  const segment = Number(barcode[1])
  const isReais = valueId === 6 || valueId === 8
  const amount = Number(barcode.slice(4, 15))
  return {
    ok: true,
    kind: 'arrecadacao',
    digits,
    barcode,
    segment,
    segmentLabel: SEGMENTS[segment] ?? 'Conta de consumo',
    amountCents: amount > 0 ? amount : null,
    valueIsReference: !isReais,
    // O vencimento normalmente não vem no código; alguns emissores colocam AAAAMMDD no início do campo livre.
    dueDate: isoFromYmd(barcode.slice(19, 27), today),
  }
}

// ---------------------------------------------------------------------------

function invalid(): BillCode {
  return { ok: false, message: 'Esse código parece ter algum número errado. Confira os números.' }
}

/**
 * Identifica e valida o código colado (aceita pontos, espaços e traços).
 * Retorna null se o campo estiver vazio.
 */
export function parseBillCode(input: string, today: Date = new Date()): BillCode | null {
  const digits = onlyDigits(input)
  if (digits.length === 0) return null

  if (digits[0] === '8' && (digits.length === 48 || digits.length === 44)) return parseArrecadacao(digits, today)
  if (digits[0] !== '8' && (digits.length === 47 || digits.length === 44)) return parseBoleto(digits, today)

  if (digits.length < 44 || (digits[0] === '8' && digits.length < 48) || (digits[0] !== '8' && digits.length < 47)) {
    return { ok: false, message: 'Esse código parece incompleto, confira os números.' }
  }
  return { ok: false, message: 'Esse código tem números a mais. Confira se colou só o código da conta.' }
}
