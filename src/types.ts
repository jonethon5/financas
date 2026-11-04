export type Household = {
  id: string
  name: string
}

export type Member = {
  id: string
  household_id: string
  user_id: string | null
  username: string | null
  /** E-mail de login (só de quem criou a casa por convite) */
  login_email?: string | null
  role: 'admin' | 'member'
  name: string
  nickname: string | null
  color: string
  pix_key: string | null
  reminder_days: number[]
  active: boolean
  sort_order: number
}

export type Category = {
  id: string
  name: string
  color: string
  icon: string
  is_fixed: boolean
  sort_order: number
}

export type RecurringBill = {
  id: string
  category_id: string | null
  description: string
  provider: string | null
  customer_code: string | null
  bill_url: string | null
  due_day: number
  default_amount_cents: number | null
  default_payer_member_id: string | null
  active: boolean
  sort_order: number
}

export type MonthStatus = 'open' | 'closed'

export type Month = {
  id: string
  year: number
  month: number
  status: MonthStatus
  closed_at: string | null
}

export type ExpenseShare = {
  member_id: string
  amount_cents: number
  weight: number | null
}

export type ExpenseStatus = 'pending' | 'paid'

export type Expense = {
  id: string
  month_id: string
  category_id: string | null
  recurring_bill_id: string | null
  description: string
  amount_cents: number | null
  due_date: string | null
  expense_date: string
  status: ExpenseStatus
  paid_at: string | null
  paid_by_member_id: string | null
  split_mode: 'equal' | 'weights' | 'amounts'
  attachment_path: string | null
  barcode: string | null
  pix_code: string | null
  notes: string | null
  created_at: string
  shares: ExpenseShare[]
}

export type Transfer = {
  id: string
  month_id: string
  from_member_id: string
  to_member_id: string
  amount_cents: number
  paid_on: string
}

export type MonthBundle = {
  month: Month
  expenses: Expense[]
  transfers: Transfer[]
}

/** O que o formulário envia para salvar uma conta. */
export type ExpenseInput = Omit<Expense, 'id' | 'created_at' | 'shares'> & {
  id?: string
  shares: ExpenseShare[]
}
