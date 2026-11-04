import { Droplet, Flame, Home, Phone, Receipt, ShoppingCart, Wifi, Zap, type LucideIcon } from 'lucide-react'
import type { Category } from '../types'
import { IconTile } from './ui'

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

export function categoryIcon(category: Pick<Category, 'icon'> | null | undefined): LucideIcon {
  return ICONS[category?.icon ?? 'receipt'] ?? Receipt
}

/** Ícone da categoria num quadradinho cinza (sem cores, como nos apps do iPhone). */
export function CategoryIcon({ category, size = 'md' }: { category: Pick<Category, 'icon' | 'color'> | null | undefined; size?: 'sm' | 'md' | 'lg' }) {
  const Icon = categoryIcon(category)
  return (
    <IconTile size={size}>
      <Icon strokeWidth={1.8} />
    </IconTile>
  )
}
