import { useState, type FormEvent } from 'react'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { Button, ErrorBox, Field } from '../components/ui'
import { useAuth } from '../auth/AuthProvider'
import { friendlyError, supabase } from '../lib/supabase'
import { isValidEmail, isValidUsername, normalizeUsername, suggestUsername } from '../lib/login'
import { AuthShell, PasswordField } from './LoginPage'

/** Primeira configuração: cria a casa e o usuário administrador. Pede o código definido em SETUP_CODE. */
export function SetupPage({ onBack }: { onBack: () => void }) {
  const { signIn } = useAuth()
  const [form, setForm] = useState({ code: '', house: 'Nossa casa', name: '', username: '', password: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }))

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const username = normalizeUsername(form.username)
    const errs: Record<string, string> = {}
    if (!form.code.trim()) errs.code = 'Digite o código de configuração.'
    if (!form.house.trim()) errs.house = 'Dê um nome para a casa.'
    if (!form.name.trim()) errs.name = 'Digite seu nome.'
    if (!isValidUsername(username)) errs.username = 'Use de 2 a 30 letras ou números, sem espaços.'
    if (form.password.length < 6) errs.password = 'Use pelo menos 6 caracteres.'
    setErrors(errs)
    if (Object.keys(errs).length) return

    setLoading(true)
    setError(null)
    const { error } = await supabase.functions.invoke('setup', {
      body: { setup_code: form.code.trim(), house_name: form.house.trim(), name: form.name.trim(), username, password: form.password },
    })
    if (error) {
      const body = error instanceof FunctionsHttpError ? await error.context.json().catch(() => null) : null
      setError(body?.error ?? friendlyError(error))
      setLoading(false)
      return
    }
    try {
      await signIn(username, form.password)
    } catch (err) {
      setError(friendlyError(err))
      setLoading(false)
    }
  }

  return (
    <AuthShell title="Configurar o app" subtitle="Você será o administrador da casa">
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {error && <ErrorBox message={error} />}
        <Field
          label="Código de configuração"
          hint="É o valor que você colocou no secret SETUP_CODE."
          value={form.code}
          onChange={(e) => set('code')(e.target.value)}
          error={errors.code}
          autoComplete="off"
        />
        <Field label="Nome da casa" value={form.house} onChange={(e) => set('house')(e.target.value)} error={errors.house} maxLength={80} />
        <Field
          label="Seu nome"
          value={form.name}
          onChange={(e) => {
            const name = e.target.value
            setForm((f) => ({ ...f, name, username: f.username && f.username !== suggestUsername(f.name) ? f.username : suggestUsername(name) }))
          }}
          error={errors.name}
          maxLength={60}
        />
        <Field
          label="Seu usuário"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={form.username}
          onChange={(e) => set('username')(e.target.value)}
          error={errors.username}
          hint="É com ele que você entra no app."
        />
        <PasswordField label="Sua senha" autoComplete="new-password" value={form.password} onChange={set('password')} error={errors.password} hint="Pelo menos 6 caracteres." />
        <Button type="submit" loading={loading} className="w-full">
          Criar casa e entrar
        </Button>
        <Button type="button" variant="ghost" size="md" onClick={onBack}>
          Voltar
        </Button>
      </form>
    </AuthShell>
  )
}

/**
 * Convite: quem recebeu um código de um administrador cria a PRÓPRIA casa (vazia) e entra com e-mail e senha.
 * As casas não enxergam os dados umas das outras.
 */
export function InvitePage({ onBack }: { onBack: () => void }) {
  const { signIn } = useAuth()
  const [form, setForm] = useState({ code: '', house: 'Minha casa', name: '', email: '', password: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }))

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const code = form.code.toUpperCase().replace(/[^A-Z0-9]/g, '')
    const email = form.email.trim().toLowerCase()
    const errs: Record<string, string> = {}
    if (code.length !== 8) errs.code = 'O código tem 8 letras e números (ex.: K7P2-9QXM).'
    if (!form.house.trim()) errs.house = 'Dê um nome para a casa.'
    if (!form.name.trim()) errs.name = 'Digite seu nome.'
    if (!isValidEmail(email)) errs.email = 'Digite um e-mail válido.'
    if (form.password.length < 6) errs.password = 'Use pelo menos 6 caracteres.'
    setErrors(errs)
    if (Object.keys(errs).length) return

    setLoading(true)
    setError(null)
    const { error } = await supabase.functions.invoke('setup', {
      body: { invite_code: code, house_name: form.house.trim(), name: form.name.trim(), email, password: form.password },
    })
    if (error) {
      const body = error instanceof FunctionsHttpError ? await error.context.json().catch(() => null) : null
      setError(body?.error ?? friendlyError(error))
      setLoading(false)
      return
    }
    try {
      await signIn(email, form.password)
    } catch (err) {
      setError(friendlyError(err))
      setLoading(false)
    }
  }

  return (
    <AuthShell title="Criar sua casa" subtitle="Com o código que você recebeu">
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {error && <ErrorBox message={error} />}
        <Field
          label="Código do convite"
          placeholder="ex.: K7P2-9QXM"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          value={form.code}
          onChange={(e) => set('code')(e.target.value)}
          error={errors.code}
          autoComplete="off"
        />
        <Field label="Nome da casa" value={form.house} onChange={(e) => set('house')(e.target.value)} error={errors.house} maxLength={80} />
        <Field label="Seu nome" value={form.name} onChange={(e) => set('name')(e.target.value)} error={errors.name} maxLength={60} autoComplete="name" />
        <Field
          label="Seu e-mail"
          type="email"
          inputMode="email"
          autoCapitalize="none"
          autoComplete="email"
          value={form.email}
          onChange={(e) => set('email')(e.target.value)}
          error={errors.email}
          hint="É com ele que você entra no app."
        />
        <PasswordField label="Crie uma senha" autoComplete="new-password" value={form.password} onChange={set('password')} error={errors.password} hint="Pelo menos 6 caracteres." />
        <Button type="submit" loading={loading} className="w-full">
          Criar minha casa
        </Button>
        <Button type="button" variant="ghost" size="md" onClick={onBack}>
          Voltar
        </Button>
      </form>
    </AuthShell>
  )
}
