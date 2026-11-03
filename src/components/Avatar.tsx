import type { CSSProperties } from 'react'
import type { Member } from '../types'

export function displayName(m: Pick<Member, 'name' | 'nickname'>): string {
  return m.nickname?.trim() || m.name
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/** Avatar com fundo tingido e iniciais na cor do morador. */
export function Avatar({ member, size = 'md' }: { member: Pick<Member, 'name' | 'nickname' | 'color'>; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'size-8 text-[0.8125rem]', md: 'size-11 text-base', lg: 'size-14 text-lg' }
  return (
    <span
      aria-hidden
      style={{ '--c': member.color } as CSSProperties}
      className={`inline-grid shrink-0 place-items-center rounded-full font-bold ${sizes[size]} bg-[color-mix(in_oklab,var(--c)_15%,transparent)] text-[color-mix(in_oklab,var(--c)_85%,black)]`}
    >
      {initials(displayName(member))}
    </span>
  )
}

/** Cores dos moradores. */
export const MEMBER_COLORS = ['#4A90A4', '#E0457B', '#8B5CF6', '#F07B1D', '#10A37F', '#3B82F6', '#C79A0A', '#6B7280']
