import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { ChevronLeft } from 'lucide-react'
import { Button, Card, ErrorBox } from '../components/ui'
import { useToast } from '../components/Toast'
import { friendlyError, supabase } from '../lib/supabase'
import { PasswordField } from './LoginPage'

/** A própria pessoa troca a senha (continua logada). */
export function SetPasswordPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({})
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const errs: typeof errors = {}
    if (password.length < 6) errs.password = 'Use pelo menos 6 caracteres.'
    if (confirm !== password) errs.confirm = 'As senhas não são iguais.'
    setErrors(errs)
    if (Object.keys(errs).length) return
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) return setError(friendlyError(error))
    toast('Senha trocada')
    navigate('/ajustes', { replace: true })
  }

  return (
    <>
      <header className="mb-5 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="grid size-12 place-items-center rounded-full border border-line/70 bg-surface shadow-soft"
          aria-label="Voltar"
        >
          <ChevronLeft className="size-6" aria-hidden />
        </button>
        <h1 className="text-[1.625rem] font-bold tracking-tight">Trocar minha senha</h1>
      </header>
      <Card>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          {error && <ErrorBox message={error} />}
          <PasswordField label="Nova senha" autoComplete="new-password" value={password} onChange={setPassword} error={errors.password} hint="Pelo menos 6 caracteres." />
          <PasswordField label="Repita a senha" autoComplete="new-password" value={confirm} onChange={setConfirm} error={errors.confirm} />
          <Button type="submit" loading={loading} className="w-full">
            Salvar senha
          </Button>
        </form>
      </Card>
    </>
  )
}
