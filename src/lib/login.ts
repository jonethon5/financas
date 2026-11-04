// Login por usuário (sem e-mail). O Supabase Auth exige um e-mail, então usamos um endereço interno
// derivado do usuário, que nunca recebe mensagens. A MESMA regra existe em supabase/functions/_shared/common.ts.

export const LOGIN_EMAIL_DOMAIN = 'moradores.financas.local'

/** "  Cída " → "cida" */
export function normalizeUsername(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()
}

export function isValidUsername(username: string): boolean {
  return /^[a-z0-9][a-z0-9._-]{1,29}$/.test(username)
}

export function loginEmail(username: string): string {
  return `${normalizeUsername(username)}@${LOGIN_EMAIL_DOMAIN}`
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim())
}

/**
 * O login aceita usuário (moradores criados pelo administrador) ou e-mail (quem criou a casa por convite).
 * Devolve o e-mail que vai para o Supabase Auth.
 */
export function authEmail(identifier: string): string {
  const id = identifier.trim()
  return id.includes('@') ? id.toLowerCase() : loginEmail(id)
}

export function isValidLogin(identifier: string): boolean {
  return identifier.includes('@') ? isValidEmail(identifier) : isValidUsername(normalizeUsername(identifier))
}

/** Sugestão de usuário a partir do nome: "Maria Aparecida" → "maria" */
export function suggestUsername(name: string): string {
  return normalizeUsername(name.split(/\s+/)[0] ?? '').replace(/[^a-z0-9._-]/g, '')
}
