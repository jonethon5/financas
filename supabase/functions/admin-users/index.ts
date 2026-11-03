// Gerencia os acessos (usuário + senha) dos moradores.
//   create_login  { member_id, username, password }  → só o admin
//   set_password  { member_id, password }            → o admin, ou a própria pessoa
//   remove_login  { member_id }                      → só o admin (não pode remover o próprio)
//   set_role      { member_id, role }                → só o admin (não pode rebaixar a si mesmo)
import {
  UserError,
  adminClient,
  assertPassword,
  assertUsername,
  callerUserId,
  friendlyAuthError,
  handle,
  json,
  loginEmail,
  normalizeUsername,
} from '../_shared/common.ts'

type MemberRow = { id: string; household_id: string; user_id: string | null; role: string; active: boolean }

Deno.serve(
  handle(async (req) => {
    const admin = adminClient()
    const uid = await callerUserId(req, admin)
    const body = await req.json().catch(() => ({}))

    const { data: caller } = await admin
      .from('members')
      .select('id, household_id, user_id, role, active')
      .eq('user_id', uid)
      .maybeSingle<MemberRow>()
    if (!caller || !caller.active) throw new UserError('Você não faz parte de uma casa.', 403)

    const { data: target } = await admin
      .from('members')
      .select('id, household_id, user_id, role, active')
      .eq('id', String(body.member_id ?? ''))
      .maybeSingle<MemberRow>()
    if (!target || target.household_id !== caller.household_id) throw new UserError('Morador não encontrado.', 404)

    const isAdmin = caller.role === 'admin'
    const isSelf = target.id === caller.id

    switch (body.action) {
      case 'create_login': {
        if (!isAdmin) throw new UserError('Só o administrador cria acessos.', 403)
        if (target.user_id) throw new UserError('Esse morador já tem acesso. Use "Trocar senha".')
        const username = normalizeUsername(body.username)
        assertUsername(username)
        const password = assertPassword(body.password)

        const { data: taken } = await admin.from('members').select('id').eq('username', username).maybeSingle()
        if (taken) throw new UserError('Esse usuário já existe. Escolha outro.')

        const { data: created, error } = await admin.auth.admin.createUser({
          email: loginEmail(username),
          password,
          email_confirm: true,
          user_metadata: { username },
        })
        if (error || !created.user) throw new UserError(friendlyAuthError(error?.message ?? ''))

        const { error: upd } = await admin.from('members').update({ user_id: created.user.id, username }).eq('id', target.id)
        if (upd) {
          await admin.auth.admin.deleteUser(created.user.id)
          throw new UserError('Não foi possível ligar o acesso ao morador.')
        }
        return json({ ok: true, username })
      }

      case 'set_password': {
        if (!isAdmin && !isSelf) throw new UserError('Só o administrador troca a senha de outra pessoa.', 403)
        if (!target.user_id) throw new UserError('Esse morador ainda não tem acesso.')
        const password = assertPassword(body.password)
        const { error } = await admin.auth.admin.updateUserById(target.user_id, { password })
        if (error) throw new UserError(friendlyAuthError(error.message))
        return json({ ok: true })
      }

      case 'remove_login': {
        if (!isAdmin) throw new UserError('Só o administrador remove acessos.', 403)
        if (isSelf) throw new UserError('Você não pode remover o seu próprio acesso.')
        if (!target.user_id) return json({ ok: true })
        const { error } = await admin.auth.admin.deleteUser(target.user_id)
        if (error) throw new UserError('Não foi possível remover o acesso.')
        await admin.from('members').update({ user_id: null, username: null, role: 'member' }).eq('id', target.id)
        await admin.from('push_subscriptions').delete().eq('member_id', target.id)
        return json({ ok: true })
      }

      case 'set_role': {
        if (!isAdmin) throw new UserError('Só o administrador muda permissões.', 403)
        const role = body.role === 'admin' ? 'admin' : 'member'
        if (isSelf && role !== 'admin') throw new UserError('Você não pode tirar a sua própria permissão de administrador.')
        await admin.from('members').update({ role }).eq('id', target.id)
        return json({ ok: true })
      }

      default:
        throw new UserError('Ação inválida.')
    }
  }),
)
