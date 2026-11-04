import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from './supabase'

export type Invite = { code: string; expires_at: string }

/** Gera um convite (só administrador): quem recebe cria a própria casa, vazia, entrando com e-mail. */
export async function createInvite(): Promise<Invite> {
  const { data, error } = await supabase.functions.invoke('admin-users', { body: { action: 'create_invite' } })
  if (error) {
    const detail = error instanceof FunctionsHttpError ? await error.context.json().catch(() => null) : null
    throw new Error(detail?.error ?? 'Não foi possível gerar o convite. Confira a internet.')
  }
  return data as Invite
}

/** Mensagem pronta para mandar no WhatsApp. */
export function inviteMessage(invite: Invite, appUrl: string): string {
  return [
    'Te convidei para o app Finanças da Casa, para organizar as contas da sua casa.',
    '',
    `1. Abra ${appUrl}`,
    '2. Toque em "Recebeu um convite? Criar sua casa"',
    `3. Use o código: ${invite.code}`,
    '',
    'O código vale por 7 dias e só pode ser usado uma vez. Sua casa começa vazia e só você (e quem você adicionar) vê os dados.',
  ].join('\n')
}
