import { Navigate, Route, Routes } from 'react-router'
import { useAuth } from './auth/AuthProvider'
import { HouseholdProvider, useHouseholdQuery } from './household/HouseholdProvider'
import { friendlyError } from './lib/supabase'
import { Layout } from './components/Layout'
import { Button, ErrorBox, Spinner } from './components/ui'
import { useRepo } from './data/repo'
import { LoginPage, AuthShell } from './pages/LoginPage'
import { SetPasswordPage } from './pages/SetPasswordPage'
import { HomePage } from './pages/HomePage'
import { ExpenseDetailPage } from './pages/ExpenseDetailPage'
import { ExpenseFormPage } from './pages/ExpenseFormPage'
import { HistoryPage } from './pages/HistoryPage'
import { SettingsPage } from './pages/SettingsPage'
import { AskPage } from './pages/AskPage'

function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="lancar" element={<ExpenseFormPage />} />
        <Route path="conta/:id" element={<ExpenseDetailPage />} />
        <Route path="conta/:id/editar" element={<ExpenseFormPage />} />
        <Route path="historico" element={<HistoryPage />} />
        <Route path="perguntar" element={<AskPage />} />
        <Route path="ajustes" element={<SettingsPage />} />
        <Route path="ajustes/senha" element={<SetPasswordPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

function FullScreen({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-dvh items-center justify-center p-4">{children}</div>
}

function HouseholdGate({ userId }: { userId: string | null }) {
  const query = useHouseholdQuery(userId)
  const { signOut } = useAuth()

  if (query.isPending) {
    return (
      <FullScreen>
        <Spinner label="Abrindo a casa…" />
      </FullScreen>
    )
  }
  if (query.isError) {
    return (
      <FullScreen>
        <div className="w-full max-w-md">
          <ErrorBox message={friendlyError(query.error)} onRetry={() => query.refetch()} />
        </div>
      </FullScreen>
    )
  }
  if (!query.data) {
    return (
      <AuthShell title="Sem acesso" subtitle="Seu usuário não está ligado a nenhuma casa ativa.">
        <p className="text-muted">Peça para o administrador da casa conferir o seu acesso em Ajustes › Moradores.</p>
        <Button variant="secondary" className="mt-5 w-full" onClick={signOut}>
          Sair
        </Button>
      </AuthShell>
    )
  }
  return (
    <HouseholdProvider data={query.data}>
      <AppRoutes />
    </HouseholdProvider>
  )
}

export function App() {
  const repo = useRepo()
  const { session, loading } = useAuth()

  // Modo demonstração (Supabase não configurado): entra direto, dados só neste aparelho.
  if (repo.kind === 'local') return <HouseholdGate userId={null} />

  if (loading) {
    return (
      <FullScreen>
        <Spinner />
      </FullScreen>
    )
  }
  if (!session) return <LoginPage />
  return <HouseholdGate userId={session.user.id} />
}
