import type { CSSProperties } from 'react'
import { Droplet, Flame, Home, Phone, Receipt, ShoppingCart, Wifi, Zap, type LucideIcon } from 'lucide-react'
import type { Category } from '../types'

const ICONS: Record<string, LucideIcon> = {
  droplet: Droplet,
  zap: Zap,
  phone: Phone,
  wifi: Wifi,
  'shopping-cart': ShoppingCart,
  receipt: Receipt,
  home: Home,
  flame: Flame,
}

/** Círculo com o ícone da categoria na cor dela (fundo tingido). */
export function CategoryIcon({ category, size = 'md' }: { category: Pick<Category, 'icon' | 'color'> | null | undefined; size?: 'sm' | 'md' | 'lg' }) {
  const Icon = ICONS[category?.icon ?? 'receipt'] ?? Receipt
  const color = category?.color ?? '#64748B'
  const sizes = { sm: 'size-9', md: 'size-12', lg: 'size-14' }
  const icon = { sm: 'size-[1.125rem]', md: 'size-[1.375rem]', lg: 'size-6' }
  return (
    <span
      aria-hidden
      style={{ '--c': color } as CSSProperties}
      className={`grid shrink-0 place-items-center rounded-full bg-[color-mix(in_oklab,var(--c)_14%,transparent)] text-[color-mix(in_oklab,var(--c)_85%,black)] ${sizes[size]}`}
    >
      <Icon className={icon[size]} strokeWidth={2} />
    </span>
  )
}
