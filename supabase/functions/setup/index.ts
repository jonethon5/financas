// Configuração inicial: cria a casa e o primeiro usuário (administrador).
// Só funciona uma vez (enquanto não existe nenhuma casa) e exige o código SETUP_CODE,
// definido nos secrets do GitHub/Supabase. Assim ninguém de fora "pega" o app antes de você.
//
// Com { invite_code, house_name, name, email, password }: cria uma casa NOVA e vazia para quem recebeu
// um convite (gerado por um administrador em Ajustes). A pessoa entra com e-mail e senha.
import {
  UserError,
  adminClient,
  assertPassword,
  assertUsername,
  friendlyAuthError,
  handle,
  json,
  LOGIN_EMAIL_DOMAIN,
  loginEmail,
  normalizeUsername,
} from '../_shared/common.ts'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

async function createFromInvite(body: Record<string, unknown>) {
  const code = String(body.invite_code ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  const houseName = String(body.house_name ?? '').trim()
  const name = String(body.name ?? '').trim()
  const email = String(body.email ?? '').trim().toLowerCase()
  const password = assertPassword(body.password)
  if (code.length !== 8) throw new UserError('Digite o código do convite (8 letras e números).')
  if (!houseName || houseName.length > 80) throw new UserError('Dê um nome para a casa.')
  if (!name || name.length > 60) throw new UserError('Digite seu nome.')
  if (!EMAIL_RE.test(email) || email.length > 254 || email.endsWith(`@${LOGIN_EMAIL_DOMAIN}`)) throw new UserError('Digite um e-mail válido.')

  const admin = adminClient()
  // Reserva o convite (só um pedido consegue usar o mesmo código)
  const { data: invite } = await admin
    .from('invites')
    .update({ used_at: new Date().toISOString() })
    .eq('code', code)
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .select('code')
    .maybeSingle()
  if (!invite) throw new UserError('Convite inválido, já usado ou vencido. Peça um novo para quem te convidou.', 403)
  const release = () => admin.from('invites').update({ used_at: null }).eq('code', code)

  const { data: created, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (error || !created.user) {
    await release()
    throw new UserError(/already|registered|exists/i.test(error?.message ?? '') ? 'Esse e-mail já tem conta. Entre com ele na tela de login.' : friendlyAuthError(error?.message ?? ''))
  }

  const { data: houseId, error: rpcError } = await admin.rpc('new_household', {
    p_user: created.user.id,
    p_house_name: houseName,
    p_member_name: name,
    p_username: null,
    p_login_email: email,
  })
  if (rpcError) {
    await admin.auth.admin.deleteUser(created.user.id)
    await release()
    throw new UserError('Não foi possível criar a casa. Tente de novo.')
  }
  await admin.from('invites').update({ used_by_household: houseId }).eq('code', code)
  return json({ ok: true, email })
}

Deno.serve(
  handle(async (req) => {
    const body = await req.json().catch(() => ({}))
    if (body.invite_code !== undefined) return createFromInvite(body)

    const expected = Deno.env.get('SETUP_CODE')
    if (!expected) throw new UserError('Defina o secret SETUP_CODE antes de configurar o app (veja o README).', 500)
    if (String(body.setup_code ?? '') !== expected) throw new UserError('Código de configuração incorreto.', 403)

    const houseName = String(body.house_name ?? '').trim()
    const name = String(body.name ?? '').trim()
    const username = normalizeUsername(body.username)
    const password = assertPassword(body.password)
    if (!houseName || houseName.length > 80) throw new UserError('Dê um nome para a casa.')
    if (!name || name.length > 60) throw new UserError('Digite seu nome.')
    assertUsername(username)

    const admin = adminClient()
    const { count } = await admin.from('households').select('id', { count: 'exact', head: true })
    if ((count ?? 0) > 0) throw new UserError('O app já foi configurado. Entre com seu usuário e senha.', 409)

    const { data: created, error } = await admin.auth.admin.createUser({
      email: loginEmail(username),
      password,
      email_confirm: true,
      user_metadata: { username },
    })
    if (error || !created.user) throw new UserError(friendlyAuthError(error?.message ?? ''))

    const { error: rpcError } = await admin.rpc('bootstrap_household', {
      p_user: created.user.id,
      p_house_name: houseName,
      p_member_name: name,
      p_username: username,
    })
    if (rpcError) {
      // Desfaz o usuário criado para não deixar lixo
      await admin.auth.admin.deleteUser(created.user.id)
      throw new UserError(/configurado/.test(rpcError.message) ? 'O app já foi configurado.' : 'Não foi possível criar a casa.')
    }

    return json({ ok: true, username })
  }),
)
