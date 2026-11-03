import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isSupabaseConfigured = Boolean(url && anonKey)

// A anon key é pública por natureza; quem protege os dados é o RLS no banco.
// NUNCA coloque a service_role key no front-end.
export const supabase = createClient(url || 'https://nao-configurado.supabase.co', anonKey || 'nao-configurado', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
})

/** Traduz mensagens comuns para português. */
export function friendlyError(err: unknown): string {
  const msg =
    err instanceof Error
      ? err.message
      : typeof err === 'object' && err && 'message' in err
        ? String(err.message)
        : String(err)
  if (/invalid login credentials/i.test(msg)) return 'Usuário ou senha incorretos.'
  if (/rate limit|too many/i.test(msg)) return 'Muitas tentativas. Espere alguns minutos e tente de novo.'
  if (/password should be at least/i.test(msg)) return 'A senha precisa ter pelo menos 6 caracteres.'
  if (/same.*password|different from the old/i.test(msg)) return 'A nova senha precisa ser diferente da anterior.'
  if (/failed to fetch|network|load failed/i.test(msg)) return 'Sem conexão com a internet. Tente de novo.'
  if (/JWT|session.*(expired|missing)/i.test(msg)) return 'Sua sessão expirou. Entre de novo.'
  // Mensagens que o próprio app/banco já escrevem em português
  if (/[ãçéêáíóõúâô]/.test(msg) && msg.length < 200) return msg
  return 'Algo deu errado. Tente de novo em instantes.'
}
