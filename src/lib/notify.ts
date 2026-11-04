import type { Expense } from '../types'
import { daysUntil, dueLabel } from './due'
import { formatBRL } from './money'

/** Avisos automáticos: 5 dias antes e no dia do vencimento (contas vencidas também são lembradas). */
export const REMINDER_DAYS = [5, 0]

const OFF_KEY = 'financas:avisos-desligados'

/** A pessoa desligou os avisos neste aparelho? */
export function remindersOff(): boolean {
  try {
    return localStorage.getItem(OFF_KEY) === '1'
  } catch {
    return false
  }
}

export function setRemindersOff(off: boolean) {
  try {
    if (off) localStorage.setItem(OFF_KEY, '1')
    else localStorage.removeItem(OFF_KEY)
  } catch {
    /* sem armazenamento: nada a guardar */
  }
}

/** Contas que merecem aviso hoje, conforme os dias de antecedência escolhidos (ex.: 3, 1 e 0 = no dia). */
export function billsToRemind(expenses: Expense[], today: string, reminderDays: number[]): Expense[] {
  return expenses.filter((e) => {
    if (e.status === 'paid' || !e.due_date) return false
    const d = daysUntil(e.due_date, today)
    return d < 0 || reminderDays.includes(d)
  })
}

export function notificationsSupported(): boolean {
  return 'Notification' in window && 'serviceWorker' in navigator
}

/**
 * Mostra uma notificação do sistema para cada conta que vence (no máximo uma por conta por dia).
 * Funciona quando o app é aberto. No iPhone, só com o app instalado na tela inicial.
 */
export async function notifyDueBills(expenses: Expense[], today: string, reminderDays: number[]) {
  if (!notificationsSupported() || Notification.permission !== 'granted' || remindersOff()) return
  const registration = await navigator.serviceWorker.getRegistration()
  for (const e of billsToRemind(expenses, today, reminderDays)) {
    const key = `financas:aviso:${e.id}:${today}`
    try {
      if (localStorage.getItem(key)) continue
      localStorage.setItem(key, '1')
    } catch {
      /* sem armazenamento: avisa mesmo assim */
    }
    const title = `${e.description}: ${dueLabel(e, today).toLowerCase()}`
    const body = e.amount_cents != null ? `Valor: ${formatBRL(e.amount_cents)}` : 'Valor ainda não informado'
    const options: NotificationOptions = { body, icon: `${import.meta.env.BASE_URL}pwa-192x192.png`, tag: `conta-${e.id}` }
    if (registration) await registration.showNotification(title, options)
    else new Notification(title, options)
  }
}
