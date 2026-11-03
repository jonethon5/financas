import { useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react'
import { AlertCircle, Loader2 } from 'lucide-react'
import { formatBRL } from '../lib/money'

const variants = {
  primary: 'bg-primary text-on-primary hover:bg-primary-strong active:opacity-90 disabled:opacity-50',
  secondary: 'bg-surface text-ink border border-line hover:bg-surface-2 active:opacity-90 disabled:opacity-50',
  soft: 'bg-primary-soft text-primary-strong hover:brightness-95 disabled:opacity-50',
  ghost: 'text-primary-strong hover:bg-primary-soft disabled:opacity-50',
  danger: 'bg-danger-soft text-danger hover:brightness-95 disabled:opacity-50',
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants
  loading?: boolean
  size?: 'lg' | 'md' | 'sm'
}

export function Button({ variant = 'primary', loading, size = 'lg', className = '', children, disabled, ...rest }: ButtonProps) {
  const sizing = { lg: 'min-h-14 px-6 text-[1.0625rem]', md: 'min-h-12 px-5 text-base', sm: 'min-h-10 px-4 text-[0.9375rem]' }[size]
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-2xl font-semibold transition ${sizing} ${variants[variant]} ${className}`}
    >
      {loading && <Loader2 className="size-5 animate-spin" aria-hidden />}
      {children}
    </button>
  )
}

const inputClass = (error?: string | null) =>
  `min-h-14 w-full rounded-2xl border bg-surface px-4 text-lg text-ink transition placeholder:text-faint disabled:bg-surface-2 disabled:text-muted ${
    error ? 'border-danger' : 'border-line'
  } focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15`

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
      <label htmlFor={id} className="mb-2 block font-semibold text-muted">
        {label}
      </label>
      <div className="relative">
        {prefix && <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-lg font-medium text-muted">{prefix}</span>}
        <input
          id={id}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          {...rest}
          className={`${inputClass(error)} ${prefix ? 'pl-12' : ''} ${trailing ? 'pr-14' : ''}`}
        />
        {trailing && <div className="absolute top-1/2 right-2 -translate-y-1/2">{trailing}</div>}
      </div>
      {error ? (
        <p id={`${id}-erro`} role="alert" className="mt-1.5 text-[0.9375rem] font-medium text-danger">
          {error}
        </p>
      ) : hint ? (
        <div id={`${id}-dica`} className="mt-1.5 text-[0.9375rem] text-muted">
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
      <label htmlFor={id} className="mb-2 block font-semibold text-muted">
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
      <label htmlFor={id} className="mb-2 block font-semibold text-muted">
        {label}
      </label>
      <select id={id} {...rest} className={`${inputClass()} appearance-none bg-[length:1.25rem] bg-[right_1rem_center] bg-no-repeat pr-12`}>
        {children}
      </select>
    </div>
  )
}

/** Opção selecionável em forma de pílula (moradores, categorias, status…). */
export function Chip({
  selected,
  onClick,
  children,
  color,
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
      className={`inline-flex min-h-12 items-center gap-2 rounded-full border px-4 text-base font-semibold transition ${
        selected ? 'border-transparent bg-primary text-on-primary' : 'border-line bg-surface text-ink hover:bg-surface-2'
      } ${className}`}
      style={selected && color ? { backgroundColor: color, color: '#fff' } : undefined}
    >
      {children}
    </button>
  )
}

export function Card({ className = '', children }: { className?: string; children: ReactNode }) {
  return <div className={`shadow-soft rounded-3xl border border-line/70 bg-surface p-5 ${className}`}>{children}</div>
}

/** Valor em reais com números alinhados. */
export function Money({ cents, className = '' }: { cents: number; className?: string }) {
  return <span className={`whitespace-nowrap tabular-nums ${className}`}>{formatBRL(cents)}</span>
}

export function Spinner({ label = 'Carregando…' }: { label?: string }) {
  return (
    <div role="status" className="flex flex-col items-center justify-center gap-3 py-16 text-muted">
      <Loader2 className="size-7 animate-spin text-primary" aria-hidden />
      <span>{label}</span>
    </div>
  )
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-2xl bg-danger-soft p-4 text-ink">
      <AlertCircle className="mt-0.5 size-5 shrink-0 text-danger" aria-hidden />
      <div className="flex-1">
        <p className="font-medium">{message}</p>
        {onRetry && (
          <button onClick={onRetry} className="mt-2 font-semibold text-danger underline underline-offset-4">
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
      <div className="mb-4 grid size-16 place-items-center rounded-full bg-primary-soft text-primary-strong">{icon}</div>
      <h2 className="text-lg font-bold">{title}</h2>
      {children && <div className="mt-1.5 max-w-sm text-muted">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3 px-1">
      <h2 className="text-lg font-bold">{children}</h2>
      {action}
    </div>
  )
}

export function PageHeader({ title, subtitle, action, back }: { title: string; subtitle?: string; action?: ReactNode; back?: ReactNode }) {
  return (
    <header className="mb-6">
      {back}
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-[1.875rem] leading-tight font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1 text-muted">{subtitle}</p>}
        </div>
        {action}
      </div>
    </header>
  )
}

/** Pílula de status: Paga, Vencida, Vence hoje… */
export function Badge({ tone, children }: { tone: 'ok' | 'warn' | 'danger' | 'neutral' | 'primary'; children: ReactNode }) {
  const tones = {
    ok: 'bg-ok-soft text-ok',
    warn: 'bg-warn-soft text-warn',
    danger: 'bg-danger-soft text-danger',
    neutral: 'bg-surface-2 text-muted',
    primary: 'bg-primary-soft text-primary-strong',
  }
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[0.8125rem] font-semibold whitespace-nowrap ${tones[tone]}`}>{children}</span>
}
