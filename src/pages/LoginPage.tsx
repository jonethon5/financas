import { useState, type FormEvent, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Eye, EyeOff } from 'lucide-react'
import { Button, ErrorBox, Field } from '../components/ui'
import { useAuth } from '../auth/AuthProvider'
import { friendlyError, supabase } from '../lib/supabase'
import { isValidLogin } from '../lib/login'
import { InvitePage, SetupPage } from './SetupPage'

export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="pt-safe flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" className="mx-auto mb-5 size-[4.5rem] rounded-[1.1rem] shadow-soft" />
          <h1 className="text-[1.875rem] leading-tight font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-2 text-lg text-muted">{subtitle}</p>}
        </div>
        <div className="shadow-soft rounded-[1.25rem] bg-surface p-5">{children}</div>
      </div>
    </div>
  )
}

export function PasswordField({ label, value, onChange, error, autoComplete, hint }: {
  label: string
  value: string
  onChange: (v: string) => void
  error?: string
  autoComplete: string
  hint?: string
}) {
  const [show, setShow] = useState(false)
  return (
    <Field
      label={label}
      type={show ? 'text' : 'password'}
      autoComplete={autoComplete}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      error={error}
      hint={hint}
      trailing={
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="grid size-11 place-items-center rounded-xl text-muted hover:bg-surface-2"
          aria-label={show ? 'Esconder senha' : 'Mostrar senha'}
        >
          {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
        </button>
      }
    />
  )
}

export function LoginPage() {
  const { signIn } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<{ username?: string; password?: string }>({})
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [setup, setSetup] = useState<'setup' | 'invite' | null>(null)
  const configured = useQuery({
    queryKey: ['is_configured'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('is_configured')
      if (error) throw error
      return data as boolean
    },
  })

  if (setup === 'setup') return <SetupPage onBack={() => setSetup(null)} />
  if (setup === 'invite') return <InvitePage onBack={() => setSetup(null)} />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const u = username.trim()
    const errs: typeof errors = {}
    if (!isValidLogin(u)) errs.username = 'Digite seu usuário (ex.: maria) ou seu e-mail.'
    if (!password) errs.password = 'Digite sua senha.'
    setErrors(errs)
    if (Object.keys(errs).length) return
    setLoading(true)
    setError(null)
    try {
      await signIn(u, password)
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell title="Finanças da Casa" subtitle="As contas da casa, divididas sem confusão">
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {error && <ErrorBox message={error} />}
        <Field
          label="Usuário ou e-mail"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="ex.: maria ou voce@email.com"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          error={errors.username}
        />
        <PasswordField label="Senha" autoComplete="current-password" value={password} onChange={setPassword} error={errors.password} />
        <Button type="submit" loading={loading} className="mt-1 w-full">
          Entrar
        </Button>
      </form>
      <p className="mt-5 text-center text-muted">Esqueceu a senha? Peça para o administrador da casa criar uma nova.</p>
      {configured.data === false ? (
        <Button variant="ghost" size="md" className="mt-3 w-full" onClick={() => setSetup('setup')}>
          Primeira vez? Configurar o app
        </Button>
      ) : (
        <Button variant="ghost" size="md" className="mt-3 w-full" onClick={() => setSetup('invite')}>
          Recebeu um convite? Criar sua casa
        </Button>
      )}
    </AuthShell>
  )
}
