import { createContext, useContext } from 'react'
import type { YearMonth } from '../lib/dates'
import type { Category, Expense, ExpenseInput, Household, Member, MonthBundle, MonthStatus, RecurringBill } from '../types'

export type MemberInput = Partial<Pick<Member, 'name' | 'nickname' | 'color' | 'pix_key' | 'reminder_days' | 'active' | 'sort_order'>> & {
  id?: string
}

export type RecurringBillInput = Partial<Omit<RecurringBill, 'id'>> & { id?: string }

export type LoginAction =
  | { action: 'create_login'; member_id: string; username: string; password: string }
  | { action: 'set_password'; member_id: string; password: string }
  | { action: 'remove_login'; member_id: string }
  | { action: 'set_role'; member_id: string; role: 'admin' | 'member' }

export type MonthTotal = {
  year: number
  month: number
  status: MonthStatus
  total_cents: number
  awaiting: number
  /** Parte de cada morador no mês (id → centavos) */
  per_member: Record<string, number>
}

/**
 * Tudo que o app lê e grava passa por aqui. Duas implementações:
 *  - supabaseRepo: dados compartilhados entre os moradores (produção)
 *  - localRepo: dados só neste aparelho (modo demonstração)
 */
export interface Repo {
  readonly kind: 'supabase' | 'local'
  getHousehold(userId: string | null): Promise<{ household: Household; members: Member[] } | null>
  renameHousehold(id: string, name: string): Promise<void>
  saveMember(householdId: string, input: MemberInput): Promise<void>
  manageLogin(input: LoginAction): Promise<void>

  getCategories(): Promise<Category[]>
  getRecurringBills(): Promise<RecurringBill[]>
  /** Cria ou altera uma conta fixa. Devolve o id. */
  saveRecurringBill(input: RecurringBillInput): Promise<string>

  /** Abre o mês (cria com as contas fixas se ainda não existir). */
  openMonth(ym: YearMonth): Promise<MonthBundle>
  /** Lê o mês sem criar. */
  getMonth(ym: YearMonth): Promise<MonthBundle | null>
  listMonthTotals(): Promise<MonthTotal[]>
  /** Últimos valores de uma conta fixa (mais recente primeiro). */
  getBillHistory(recurringBillId: string, limit?: number): Promise<{ year: number; month: number; amount_cents: number | null }[]>
  setMonthStatus(monthId: string, status: MonthStatus): Promise<void>

  saveExpense(input: ExpenseInput): Promise<string>
  setExpensePaid(expense: Expense, paid: boolean, paidBy: string | null): Promise<void>
  deleteExpense(id: string): Promise<void>

  uploadAttachment(householdId: string, file: File): Promise<string>
  attachmentUrl(path: string): Promise<string>
}

export const RepoContext = createContext<Repo | null>(null)

export function useRepo(): Repo {
  const repo = useContext(RepoContext)
  if (!repo) throw new Error('useRepo fora do RepoContext')
  return repo
}
