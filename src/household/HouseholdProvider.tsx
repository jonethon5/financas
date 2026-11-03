import { createContext, useContext, useEffect, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useRepo } from '../data/repo'
import { keys } from '../data/hooks'
import type { Household, Member } from '../types'

export type HouseholdData = {
  household: Household
  members: Member[]
  /** Moradores ativos (os que entram na divisão). */
  activeMembers: Member[]
  /** O morador ligado ao usuário logado. */
  me: Member | null
  isAdmin: boolean
  /** Modo demonstração: dados só neste aparelho. */
  demo: boolean
}

const HouseholdContext = createContext<HouseholdData | null>(null)

export function useHousehold(): HouseholdData {
  const ctx = useContext(HouseholdContext)
  if (!ctx) throw new Error('useHousehold fora do HouseholdProvider')
  return ctx
}

export function useHouseholdQuery(userId: string | null) {
  const repo = useRepo()
  return useQuery({
    queryKey: [...keys.household, userId],
    queryFn: async (): Promise<HouseholdData | null> => {
      const data = await repo.getHousehold(userId)
      if (!data) return null
      const members = [...data.members].sort((a, b) => a.sort_order - b.sort_order)
      const me = repo.kind === 'local' ? members[0] : (members.find((m) => m.user_id === userId) ?? null)
      return {
        household: data.household,
        members,
        activeMembers: members.filter((m) => m.active),
        me,
        isAdmin: me?.role === 'admin',
        demo: repo.kind === 'local',
      }
    },
  })
}

// Tabela que mudou → prefixo das consultas a recarregar.
const REALTIME_TABLES: Record<string, string> = {
  households: 'household',
  members: 'household',
  categories: 'categories',
  recurring_bills: 'recurring_bills',
  months: 'month',
  expenses: 'month',
  expense_shares: 'month',
  transfers: 'month',
}

/** Quando qualquer morador muda algo, os outros veem na hora. */
function useRealtimeSync(householdId: string, enabled: boolean) {
  const queryClient = useQueryClient()
  useEffect(() => {
    if (!enabled) return
    const channel = supabase.channel(`casa-${householdId}`)
    for (const [table, prefix] of Object.entries(REALTIME_TABLES)) {
      // expense_shares não tem household_id; o RLS já filtra o que cada um pode ver.
      const filter = table === 'expense_shares' ? undefined : table === 'households' ? `id=eq.${householdId}` : `household_id=eq.${householdId}`
      channel.on('postgres_changes', { event: '*', schema: 'public', table, filter }, () => {
        queryClient.invalidateQueries({ queryKey: [prefix] })
      })
    }
    channel.subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [householdId, enabled, queryClient])
}

export function HouseholdProvider({ data, children }: { data: HouseholdData; children: ReactNode }) {
  useRealtimeSync(data.household.id, !data.demo)
  return <HouseholdContext.Provider value={data}>{children}</HouseholdContext.Provider>
}
