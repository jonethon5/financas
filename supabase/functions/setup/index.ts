// Configuração inicial: cria a casa e o primeiro usuário (administrador).
// Só funciona uma vez (enquanto não existe nenhuma casa) e exige o código SETUP_CODE,
// definido nos secrets do GitHub/Supabase. Assim ninguém de fora "pega" o app antes de você.
import {
  UserError,
  adminClient,
  assertPassword,
  assertUsername,
  friendlyAuthError,
  handle,
  json,
  loginEmail,
  normalizeUsername,
} from '../_shared/common.ts'

Deno.serve(
  handle(async (req) => {
    const body = await req.json().catch(() => ({}))
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
