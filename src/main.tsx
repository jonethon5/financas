import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { registerSW } from 'virtual:pwa-register'
import { AuthProvider } from './auth/AuthProvider'
import { RepoContext } from './data/repo'
import { supabaseRepo } from './data/supabaseRepo'
import { localRepo } from './data/localRepo'
import { isSupabaseConfigured } from './lib/supabase'
import { ToastProvider } from './components/Toast'
import { App } from './App'
import './index.css'

// Service worker do PWA: atualiza sozinho quando sai versão nova.
registerSW({ immediate: true })

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      // Deixa a requisição chegar ao service worker, que responde com o cache quando está offline.
      networkMode: 'offlineFirst',
    },
  },
})

// Sem Supabase configurado, o app roda em modo demonstração com dados só neste aparelho.
const repo = isSupabaseConfigured ? supabaseRepo : localRepo

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RepoContext.Provider value={repo}>
        <HashRouter>
          <AuthProvider>
            <ToastProvider>
              <App />
            </ToastProvider>
          </AuthProvider>
        </HashRouter>
      </RepoContext.Provider>
    </QueryClientProvider>
  </StrictMode>,
)
