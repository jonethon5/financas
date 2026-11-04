import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react'
import { AlertCircle, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { formatBRL } from '../lib/money'

const variants = {
  primary: 'bg-primary text-on-primary active:bg-primary-strong disabled:opacity-40',
  secondary: 'bg-surface text-ink shadow-soft active:bg-surface-2 disabled:opacity-40',
  soft: 'bg-primary-soft text-primary-strong active:brightness-95 disabled:opacity-40',
  ghost: 'text-primary active:opacity-60 disabled:opacity-40',
  danger: 'bg-surface text-danger shadow-soft active:bg-surface-2 disabled:opacity-40',
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants
  loading?: boolean
  size?: 'lg' | 'md' | 'sm'
}

export function Button({ variant = 'primary', loading, size = 'lg', className = '', children, disabled, ...rest }: ButtonProps) {
  const sizing = { lg: 'min-h-[3.25rem] px-6 text-[1.0625rem]', md: 'min-h-12 px-5 text-base', sm: 'min-h-10 px-4 text-[0.9375rem]' }[size]
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-[0.875rem] font-semibold transition select-none ${sizing} ${variants[variant]} ${className}`}
    >
      {loading && <Loader2 className="size-5 animate-spin" aria-hidden />}
      {children}
    </button>
  )
}

const inputClass = (error?: string | null) =>
  `min-h-[3.25rem] w-full rounded-[0.875rem] border bg-surface px-4 text-[1.0625rem] text-ink transition placeholder:text-faint disabled:bg-surface-2 disabled:text-muted ${
    error ? 'border-danger' : 'border-line'
  } focus:border-primary focus:outline-none`

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  error?: string | null
  hint?: ReactNode
  prefix?: string
  trailing?: ReactNode
}

export function Field({ label, error, hint, prefix, trailing, className = '', ...rest }: FieldProps) {
  const id = useId()
  const describedBy = error ? `${id}-erro` : hint ? `${id}-dica` : undefined
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block px-1 text-[0.875rem] font-medium text-muted">
        {label}
      </label>
      <div className="relative">
        {prefix && <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-[1.0625rem] text-muted">{prefix}</span>}
        <input
          id={id}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          {...rest}
          className={`${inputClass(error)} ${prefix ? 'pl-11' : ''} ${trailing ? 'pr-14' : ''}`}
        />
        {trailing && <div className="absolute top-1/2 right-1.5 -translate-y-1/2">{trailing}</div>}
      </div>
      {error ? (
        <p id={`${id}-erro`} role="alert" className="mt-1.5 px-1 text-[0.875rem] font-medium text-danger">
          {error}
        </p>
      ) : hint ? (
        <div id={`${id}-dica`} className="mt-1.5 px-1 text-[0.875rem] text-muted">
          {hint}
        </div>
      ) : null}
    </div>
  )
}

export function TextArea({ label, className = '', ...rest }: InputHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  const id = useId()
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block px-1 text-[0.875rem] font-medium text-muted">
        {label}
      </label>
      <textarea id={id} rows={3} {...rest} className={`${inputClass()} min-h-24 py-3`} />
    </div>
  )
}

export function Select({ label, children, className = '', ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  const id = useId()
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block px-1 text-[0.875rem] font-medium text-muted">
        {label}
      </label>
      <select id={id} {...rest} className={`${inputClass()} appearance-none pr-12`}>
        {children}
      </select>
    </div>
  )
}

/** Opção selecionável em forma de pílula (moradores, categorias…). */
export function Chip({
  selected,
  onClick,
  children,
  className = '',
}: {
  selected: boolean
  onClick: () => void
  children: ReactNode
  color?: string
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-[0.9375rem] font-medium transition select-none ${
        selected ? 'bg-primary text-white' : 'bg-surface text-ink shadow-soft active:bg-surface-2'
      } ${className}`}
    >
      {children}
    </button>
  )
}

/** Botão liga/desliga no estilo do iPhone. */
export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-[1.9rem] w-[3.1rem] shrink-0 rounded-full transition-colors duration-200 ${checked ? 'bg-ok' : 'bg-[#e3e5e9]'}`}
    >
      <span
        className={`absolute top-[0.125rem] left-[0.125rem] size-[1.65rem] rounded-full bg-white shadow-[0_2px_6px_rgb(0_0_0/0.18)] transition-transform duration-200 ${checked ? 'translate-x-[1.2rem]' : ''}`}
      />
    </button>
  )
}

export function Card({ className = '', children }: { className?: string; children: ReactNode }) {
  return <div className={`shadow-soft rounded-[1.25rem] bg-surface p-4 ${className}`}>{children}</div>
}

/** Lista agrupada (como no app Ajustes do iPhone). Use com <Row>. */
export function List({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <ul className={`shadow-soft overflow-hidden rounded-[1.25rem] bg-surface ${className}`}>{children}</ul>
}

/** Linha de lista: ícone, título, subtítulo e valor. A linha divisória começa depois do ícone. */
export function Row({
  icon,
  title,
  subtitle,
  trailing,
  chevron,
  onClick,
  as,
  className = '',
}: {
  icon?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  trailing?: ReactNode
  chevron?: boolean
  onClick?: () => void
  /** Elemento clicável já pronto (ex.: Link) — a linha é renderizada dentro dele */
  as?: (content: ReactNode, className: string) => ReactNode
  className?: string
}) {
  const content = (
    <>
      {icon}
      <div className="flex min-h-[3.5rem] min-w-0 flex-1 items-center gap-3 border-b border-line py-2.5 pr-4 group-last:border-0">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[1.0625rem] leading-snug">{title}</div>
          {subtitle && <div className="truncate text-[0.875rem] leading-snug text-muted">{subtitle}</div>}
        </div>
        {trailing}
        {chevron && <ChevronRight className="-mr-1 size-5 shrink-0 text-faint" aria-hidden />}
      </div>
    </>
  )
  const cls = `flex w-full items-center gap-3 pl-4 text-left transition active:bg-surface-2 ${className}`
  return (
    <li className="group">
      {as ? (
        as(content, cls)
      ) : onClick ? (
        <button type="button" onClick={onClick} className={cls}>
          {content}
        </button>
      ) : (
        <div className={cls.replace('active:bg-surface-2', '')}>{content}</div>
      )}
    </li>
  )
}

/** Quadradinho cinza com ícone (todos os ícones do app são numa cor só). */
export function IconTile({ children, size = 'md', className = '' }: { children: ReactNode; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const sizes = { sm: 'size-8 rounded-[0.6rem] [&>svg]:size-[1.05rem]', md: 'size-10 rounded-[0.75rem] [&>svg]:size-5', lg: 'size-14 rounded-[1rem] [&>svg]:size-7' }
  return (
    <span aria-hidden className={`grid shrink-0 place-items-center bg-surface-2 text-ink/80 ${sizes[size]} ${className}`}>
      {children}
    </span>
  )
}

/** Valor em reais com números alinhados. */
export function Money({ cents, className = '' }: { cents: number; className?: string }) {
  return <span className={`num whitespace-nowrap ${className}`}>{formatBRL(cents)}</span>
}

export function Spinner({ label = 'Carregando…' }: { label?: string }) {
  return (
    <div role="status" className="flex flex-col items-center justify-center gap-3 py-16 text-muted">
      <Loader2 className="size-6 animate-spin" aria-hidden />
      <span className="text-[0.9375rem]">{label}</span>
    </div>
  )
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-[1rem] bg-danger-soft p-4 text-ink">
      <AlertCircle className="mt-0.5 size-5 shrink-0 text-danger" aria-hidden />
      <div className="flex-1">
        <p className="text-[0.9375rem] font-medium">{message}</p>
        {onRetry && (
          <button onClick={onRetry} className="mt-2 font-semibold text-danger">
            Tentar de novo
          </button>
        )}
      </div>
    </div>
  )
}

export function EmptyState({ icon, title, children, action }: { icon: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <IconTile size="lg" className="mb-4">
        {icon}
      </IconTile>
      <h2 className="text-[1.125rem] font-semibold">{title}</h2>
      {children && <div className="mt-1 max-w-xs text-[0.9375rem] text-muted">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2.5 flex items-end justify-between gap-3 px-1">
      <h2 className="text-[1.25rem] font-bold tracking-tight">{children}</h2>
      {action}
    </div>
  )
}

/**
 * Barra do topo no estilo iOS: título grande na página que, ao rolar, vira um título pequeno
 * centralizado numa barra translúcida. `left`/`right` ficam sempre na barra (Voltar, Editar, Salvar…).
 */
export function NavBar({
  title,
  subtitle,
  left,
  right,
  large = true,
  children,
}: {
  title: string
  subtitle?: ReactNode
  left?: ReactNode
  right?: ReactNode
  /** false: só a barra pequena (telas internas, formulários) */
  large?: boolean
  /** Conteúdo extra abaixo do título grande */
  children?: ReactNode
}) {
  const sentinel = useRef<HTMLDivElement>(null)
  const [compact, setCompact] = useState(!large)

  useEffect(() => {
    if (!large || !sentinel.current) return
    const io = new IntersectionObserver(([e]) => setCompact(!e.isIntersecting), { rootMargin: '-56px 0px 0px 0px' })
    io.observe(sentinel.current)
    return () => io.disconnect()
  }, [large])

  return (
    <>
      <div
        className={`pt-safe sticky top-0 z-30 -mx-4 transition-colors duration-200 ${
          compact ? 'border-b border-black/[0.06] bg-bg/80 backdrop-blur-xl backdrop-saturate-150' : 'border-b border-transparent bg-bg'
        }`}
      >
        <div className="grid h-12 grid-cols-[1fr_auto_1fr] items-center px-4">
          <div className="flex min-w-0 justify-start">{left}</div>
          <p className={`max-w-[55vw] truncate text-[1.0625rem] font-semibold transition-opacity duration-200 ${compact ? 'opacity-100' : 'opacity-0'}`}>{title}</p>
          <div className="flex min-w-0 justify-end gap-2">{right}</div>
        </div>
      </div>
      {large && (
        <header className="mb-5 px-1 pt-1">
          {subtitle && <p className="text-[0.9375rem] text-muted">{subtitle}</p>}
          <h1 ref={sentinel} className="text-[2.125rem] leading-[1.15] font-bold tracking-[-0.025em]">
            {title}
          </h1>
          {children}
        </header>
      )}
    </>
  )
}

/** Botão de texto da barra do topo (Cancelar, Salvar, Editar…). */
export function NavButton({ children, onClick, strong, disabled, type = 'button' }: { children: ReactNode; onClick?: () => void; strong?: boolean; disabled?: boolean; type?: 'button' | 'submit' }) {
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`min-h-11 px-1 text-[1.0625rem] text-primary transition active:opacity-50 disabled:opacity-40 ${strong ? 'font-semibold' : ''}`}>
      {children}
    </button>
  )
}

/** "‹ Voltar" do iPhone. */
export function BackButton({ label = 'Voltar', onClick }: { label?: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="-ml-2 flex min-h-11 items-center text-[1.0625rem] text-primary transition active:opacity-50">
      <ChevronLeft className="size-7" strokeWidth={2.2} aria-hidden />
      <span className="-ml-0.5 truncate">{label}</span>
    </button>
  )
}

/** Botão redondo de ícone (barra do topo). */
export function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className="grid size-9 place-items-center rounded-full bg-surface text-ink shadow-soft transition active:scale-95">
      {children}
    </button>
  )
}

/** Compatibilidade: título de página grande. */
export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode; back?: ReactNode }) {
  return <NavBar title={title} subtitle={subtitle} right={action} />
}

/** Etiqueta de status: Paga, Vencida, Vence hoje… */
export function Badge({ tone, children }: { tone: 'ok' | 'warn' | 'danger' | 'neutral' | 'primary'; children: ReactNode }) {
  const tones = {
    ok: 'bg-ok-soft text-ok',
    warn: 'bg-warn-soft text-warn',
    danger: 'bg-danger-soft text-danger',
    neutral: 'bg-surface-2 text-muted',
    primary: 'bg-primary-soft text-primary-strong',
  }
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[0.8125rem] font-semibold whitespace-nowrap ${tones[tone]}`}>{children}</span>
}
