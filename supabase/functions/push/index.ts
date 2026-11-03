// Notificações do aparelho do usuário logado.
//   public_key                     → chave pública VAPID para o navegador se inscrever
//   subscribe   { subscription }   → grava a inscrição deste aparelho
//   unsubscribe { endpoint }       → remove a inscrição deste aparelho
//   test                           → envia uma notificação de teste para os aparelhos do usuário
import { UserError, adminClient, callerUserId, handle, json } from '../_shared/common.ts'
import { pushServer, sendToSubscriptions } from '../_shared/push.ts'

Deno.serve(
  handle(async (req) => {
    const admin = adminClient()
    const uid = await callerUserId(req, admin)
    const body = await req.json().catch(() => ({}))

    const { data: member } = await admin
      .from('members')
      .select('id, household_id, active')
      .eq('user_id', uid)
      .maybeSingle<{ id: string; household_id: string; active: boolean }>()
    if (!member || !member.active) throw new UserError('Você não faz parte de uma casa.', 403)

    switch (body.action) {
      case 'public_key': {
        const { publicKey } = await pushServer(admin)
        return json({ publicKey })
      }

      case 'subscribe': {
        const sub = body.subscription
        const endpoint = String(sub?.endpoint ?? '')
        const p256dh = String(sub?.keys?.p256dh ?? '')
        const auth = String(sub?.keys?.auth ?? '')
        if (!/^https:\/\//.test(endpoint) || !p256dh || !auth || endpoint.length > 1000) throw new UserError('Inscrição inválida.')
        // Mesmo aparelho pode ter sido usado por outra pessoa: o endpoint passa a ser deste usuário.
        await admin.from('push_subscriptions').delete().eq('endpoint', endpoint)
        const { error } = await admin.from('push_subscriptions').insert({
          household_id: member.household_id,
          member_id: member.id,
          user_id: uid,
          endpoint,
          p256dh,
          auth,
        })
        if (error) throw new UserError('Não foi possível ativar as notificações.')
        return json({ ok: true })
      }

      case 'unsubscribe': {
        await admin.from('push_subscriptions').delete().eq('endpoint', String(body.endpoint ?? '')).eq('user_id', uid)
        return json({ ok: true })
      }

      case 'test': {
        const { data: subs } = await admin.from('push_subscriptions').select('id, endpoint, p256dh, auth').eq('user_id', uid)
        if (!subs?.length) throw new UserError('Ative as notificações neste aparelho primeiro.')
        const sent = await sendToSubscriptions(admin, subs, {
          title: 'Tudo certo! 🔔',
          body: 'Você vai receber aqui os avisos de vencimento das contas.',
          url: './',
          tag: 'teste',
        })
        return json({ ok: true, sent })
      }

      default:
        throw new UserError('Ação inválida.')
    }
  }),
)
