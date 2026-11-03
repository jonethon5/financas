// Situação de vencimento de cada conta. Datas sempre no formato AAAA-MM-DD (sem fuso horário).

export type DueState = 'paid' | 'overdue' | 'today' | 'soon' | 'later' | 'no-date'

export function todayIso(now = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function toUtc(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

/** Dias até o vencimento (negativo = já venceu). */
export function daysUntil(dueIso: string, todayIsoStr: string): number {
  return Math.round((toUtc(dueIso) - toUtc(todayIsoStr)) / 86_400_000)
}

export function dueState(e: { status: string; due_date: string | null }, today: string, soonDays = 3): DueState {
  if (e.status === 'paid') return 'paid'
  if (!e.due_date) return 'no-date'
  const d = daysUntil(e.due_date, today)
  if (d < 0) return 'overdue'
  if (d === 0) return 'today'
  if (d <= soonDays) return 'soon'
  return 'later'
}

export function formatShortDate(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

/** Texto curto do vencimento: "Vence hoje", "Vence em 3 dias", "Venceu há 2 dias", "Vence 10/11". */
export function dueLabel(e: { status: string; due_date: string | null }, today: string): string {
  if (!e.due_date) return 'Sem vencimento'
  const d = daysUntil(e.due_date, today)
  if (e.status === 'paid') return `Venceu ${formatShortDate(e.due_date)}`
  if (d < -1) return `Venceu há ${-d} dias`
  if (d === -1) return 'Venceu ontem'
  if (d === 0) return 'Vence hoje'
  if (d === 1) return 'Vence amanhã'
  if (d <= 7) return `Vence em ${d} dias`
  return `Vence ${formatShortDate(e.due_date)}`
}
