// Envio de notificações (web push, padrão VAPID) a partir das Edge Functions.
// As chaves VAPID são geradas na primeira vez e guardadas em public.app_secrets (só o servidor acessa).
import * as webpush from 'jsr:@negrel/webpush@0.5.0'
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'

let cached: Promise<{ server: webpush.ApplicationServer; publicKey: string }> | null = null

async function loadOrCreateKeys(admin: SupabaseClient): Promise<CryptoKeyPair> {
  const { data } = await admin.from('app_secrets').select('value').eq('key', 'vapid').maybeSingle()
  if (data?.value) return await webpush.importVapidKeys(data.value as webpush.ExportedVapidKeys, { extractable: false })

  const keys = await webpush.generateVapidKeys({ extractable: true })
  const exported = await webpush.exportVapidKeys(keys)
  // Se duas chamadas gerarem ao mesmo tempo, fica a primeira gravada
  const { error } = await admin.from('app_secrets').insert({ key: 'vapid', value: exported })
  if (error) {
    const { data: again } = await admin.from('app_secrets').select('value').eq('key', 'vapid').single()
    return await webpush.importVapidKeys(again!.value as webpush.ExportedVapidKeys, { extractable: false })
  }
  return keys
}

export function pushServer(admin: SupabaseClient) {
  cached ??= (async () => {
    const vapidKeys = await loadOrCreateKeys(admin)
    const server = await webpush.ApplicationServer.new({
      // Contato exigido pelo padrão VAPID; não é um e-mail real de ninguém.
      contactInformation: 'mailto:avisos@financas.invalid',
      vapidKeys,
    })
    const publicKey = await webpush.exportApplicationServerKey(vapidKeys)
    return { server, publicKey }
  })()
  cached.catch(() => (cached = null))
  return cached
}

export type PushPayload = { title: string; body: string; url?: string; tag?: string }

type SubscriptionRow = { id: string; endpoint: string; p256dh: string; auth: string }

/**
 * Envia a notificação para todas as inscrições informadas.
 * Inscrições que o navegador já cancelou (aparelho trocado, permissão retirada) são apagadas.
 */
export async function sendToSubscriptions(admin: SupabaseClient, subs: SubscriptionRow[], payload: PushPayload): Promise<number> {
  const { server } = await pushServer(admin)
  let sent = 0
  for (const s of subs) {
    try {
      const subscriber = server.subscribe({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } })
      await subscriber.pushTextMessage(JSON.stringify(payload), { ttl: 60 * 60 * 24, urgency: webpush.Urgency.High })
      sent++
    } catch (err) {
      if (err instanceof webpush.PushMessageError && err.isGone()) {
        await admin.from('push_subscriptions').delete().eq('id', s.id)
      } else {
        console.error('Falha ao enviar push', err)
      }
    }
  }
  return sent
}
