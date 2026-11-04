import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { BackButton, Button, Card, ErrorBox, NavBar } from '../components/ui'
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
      <NavBar large={false} title="Trocar minha senha" left={<BackButton label="Ajustes" onClick={() => navigate(-1)} />} />
      <div className="h-4" />
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
