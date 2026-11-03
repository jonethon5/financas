import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { compareYearMonth, currentYearMonth, type YearMonth } from '../lib/dates'
import type { Expense, ExpenseInput, MonthStatus } from '../types'
import { useRepo, type LoginAction, type MemberInput, type RecurringBillInput } from './repo'

// Chaves das consultas. O tempo real (HouseholdProvider) invalida por esses prefixos.
export const keys = {
  household: ['household'] as const,
  categories: ['categories'] as const,
  recurring: ['recurring_bills'] as const,
  month: (ym: YearMonth) => ['month', ym.year, ym.month] as const,
  months: ['month', 'totals'] as const,
  billHistory: (id: string) => ['month', 'bill-history', id] as const,
}

export function useCategories() {
  const repo = useRepo()
  return useQuery({ queryKey: keys.categories, queryFn: () => repo.getCategories(), staleTime: 5 * 60_000 })
}

export function useRecurringBills() {
  const repo = useRepo()
  return useQuery({ queryKey: keys.recurring, queryFn: () => repo.getRecurringBills() })
}

/**
 * Mês atual e futuros são "abertos" (criados com as contas fixas). Meses passados só são lidos:
 * assim navegar pelo histórico não cria meses vazios.
 */
export function useMonth(ym: YearMonth) {
  const repo = useRepo()
  const canCreate = compareYearMonth(ym, currentYearMonth()) >= 0
  return useQuery({
    queryKey: keys.month(ym),
    queryFn: () => (canCreate ? repo.openMonth(ym) : repo.getMonth(ym)),
  })
}

export function useMonthTotals() {
  const repo = useRepo()
  return useQuery({ queryKey: keys.months, queryFn: () => repo.listMonthTotals() })
}

export function useBillHistory(recurringBillId: string | null) {
  const repo = useRepo()
  return useQuery({
    queryKey: keys.billHistory(recurringBillId ?? ''),
    queryFn: () => repo.getBillHistory(recurringBillId!, 12),
    enabled: Boolean(recurringBillId),
  })
}

function useInvalidate() {
  const qc = useQueryClient()
  return (...prefixes: string[]) => Promise.all(prefixes.map((p) => qc.invalidateQueries({ queryKey: [p] })))
}

export function useStartMonth() {
  const repo = useRepo()
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (ym: YearMonth) => repo.openMonth(ym),
    onSuccess: () => invalidate('month'),
  })
}

export function useSaveExpense() {
  const repo = useRepo()
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (input: ExpenseInput) => repo.saveExpense(input),
    onSuccess: () => invalidate('month'),
  })
}

export function useSetPaid() {
  const repo = useRepo()
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ expense, paid, paidBy }: { expense: Expense; paid: boolean; paidBy: string | null }) =>
      repo.setExpensePaid(expense, paid, paidBy),
    onSuccess: () => invalidate('month'),
  })
}

export function useDeleteExpense() {
  const repo = useRepo()
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (id: string) => repo.deleteExpense(id),
    onSuccess: () => invalidate('month'),
  })
}

export function useSetMonthStatus() {
  const repo = useRepo()
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ monthId, status }: { monthId: string; status: MonthStatus }) => repo.setMonthStatus(monthId, status),
    onSuccess: () => invalidate('month'),
  })
}

export function useSaveRecurringBill() {
  const repo = useRepo()
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (input: RecurringBillInput) => repo.saveRecurringBill(input),
    onSuccess: () => invalidate('recurring_bills'),
  })
}

export function useSaveMember(householdId: string) {
  const repo = useRepo()
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (input: MemberInput) => repo.saveMember(householdId, input),
    onSuccess: () => invalidate('household'),
  })
}

export function useManageLogin() {
  const repo = useRepo()
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (input: LoginAction) => repo.manageLogin(input),
    onSuccess: () => invalidate('household'),
  })
}

export function useRenameHousehold() {
  const repo = useRepo()
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => repo.renameHousehold(id, name),
    onSuccess: () => invalidate('household'),
  })
}
