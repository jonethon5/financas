// Dinheiro é sempre guardado em CENTAVOS (inteiro). Float só para exibir.

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export function formatBRL(cents: number): string {
  // Intl usa espaço não separável depois de "R$"; trocamos por espaço normal para textos (WhatsApp, CSV).
  return brl.format(cents / 100).replace(/ /g, ' ')
}

/**
 * Converte o que a pessoa digitou em centavos. Aceita "1.234,56", "1234,5", "R$ 10", "10.50".
 * Retorna null se não for um valor válido. Não usa float em nenhum momento.
 */
export function parseBRL(input: string): number | null {
  const s = input.replace(/R\$/gi, '').replace(/[\s ]/g, '')
  if (s === '') return null

  let intPart: string
  let fracPart = ''

  if (s.includes(',')) {
    // Formato brasileiro: ponto = milhar, vírgula = decimal
    const parts = s.split(',')
    if (parts.length !== 2) return null
    const left = parts[0] || '0'
    if (!/^\d{1,3}(\.\d{3})*$|^\d+$/.test(left)) return null
    intPart = left.replace(/\./g, '')
    fracPart = parts[1]
  } else if (s.includes('.')) {
    const parts = s.split('.')
    const last = parts[parts.length - 1]
    if (parts.length === 2 && last.length <= 2) {
      // "10.5" / "10.50" → ponto decimal
      intPart = parts[0] || '0'
      fracPart = last
    } else {
      // "1.234" / "1.234.567" → ponto de milhar
      if (!/^\d{1,3}(\.\d{3})+$/.test(s)) return null
      intPart = s.replace(/\./g, '')
    }
  } else {
    intPart = s
  }

  if (!/^\d+$/.test(intPart) || !/^\d{0,2}$/.test(fracPart)) return null
  const cents = Number(intPart) * 100 + Number(fracPart.padEnd(2, '0'))
  return Number.isSafeInteger(cents) ? cents : null
}

/** Mostra centavos no formato de campo editável: 123456 → "1.234,56" */
export function centsToInput(cents: number | null | undefined): string {
  if (cents == null) return ''
  return formatBRL(cents).replace('R$', '').trim()
}
