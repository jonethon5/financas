import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from './supabase'

/** Chamada à Edge Function "push", com a mensagem de erro em português. */
async function callPush<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('push', { body })
  if (error) {
    const detail = error instanceof FunctionsHttpError ? await error.context.json().catch(() => null) : null
    throw new Error(detail?.error ?? 'Não foi possível falar com o servidor de notificações.')
  }
  return data as T
}

function base64UrlToBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const bytes = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes
}

export function pushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

/** Este aparelho já está inscrito para receber avisos? */
export async function currentPushSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null
  const reg = await navigator.serviceWorker.getRegistration()
  return (await reg?.pushManager.getSubscription()) ?? null
}

/**
 * Pede permissão e inscreve este aparelho para receber os avisos de vencimento mesmo com o app fechado.
 * No iPhone só funciona com o app instalado na tela inicial (iOS 16.4+).
 */
export async function enablePush(): Promise<void> {
  if (!pushSupported()) throw new Error('Este navegador não recebe notificações. No iPhone, instale o app na tela inicial primeiro.')
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Permissão negada. Libere as notificações nas configurações do celular.')
  const reg = await navigator.serviceWorker.ready
  const { publicKey } = await callPush<{ publicKey: string }>({ action: 'public_key' })
  let sub = await reg.pushManager.getSubscription()
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(publicKey) })
  await callPush({ action: 'subscribe', subscription: sub.toJSON() })
}

export async function disablePush(): Promise<void> {
  const sub = await currentPushSubscription()
  if (!sub) return
  await callPush({ action: 'unsubscribe', endpoint: sub.endpoint }).catch(() => undefined)
  await sub.unsubscribe()
}

export async function sendTestPush(): Promise<void> {
  await callPush({ action: 'test' })
}
