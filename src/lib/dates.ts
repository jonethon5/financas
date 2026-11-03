export const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

export type YearMonth = { year: number; month: number } // month: 1–12

export function currentYearMonth(today = new Date()): YearMonth {
  return { year: today.getFullYear(), month: today.getMonth() + 1 }
}

export function addMonths({ year, month }: YearMonth, delta: number): YearMonth {
  const index = year * 12 + (month - 1) + delta
  return { year: Math.floor(index / 12), month: (index % 12) + 1 }
}

export function monthLabel({ year, month }: YearMonth): string {
  return `${MONTH_NAMES[month - 1]} de ${year}`
}

export function monthShort({ month }: YearMonth): string {
  return MONTH_NAMES[month - 1].slice(0, 3)
}

export function sameYearMonth(a: YearMonth, b: YearMonth): boolean {
  return a.year === b.year && a.month === b.month
}

/** negativo se a < b, 0 se igual, positivo se a > b */
export function compareYearMonth(a: YearMonth, b: YearMonth): number {
  return a.year * 12 + a.month - (b.year * 12 + b.month)
}

export function greeting(now = new Date()): string {
  const h = now.getHours()
  if (h < 5) return 'Boa noite'
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}
