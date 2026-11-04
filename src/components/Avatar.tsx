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

/** Avatar com as iniciais em azul sobre cinza (igual ao print de referência). */
export function Avatar({ member, size = 'md' }: { member: Pick<Member, 'name' | 'nickname' | 'color'>; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'size-7 text-[0.75rem]', md: 'size-10 text-[0.9375rem]', lg: 'size-12 text-[1.0625rem]' }
  return (
    <span aria-hidden className={`inline-grid shrink-0 place-items-center rounded-full bg-[#e9ecf1] font-semibold text-primary-strong ${sizes[size]}`}>
      {initials(displayName(member))}
    </span>
  )
}

/** Cores dos moradores. */
export const MEMBER_COLORS = ['#4A90A4', '#E0457B', '#8B5CF6', '#F07B1D', '#10A37F', '#3B82F6', '#C79A0A', '#6B7280']
