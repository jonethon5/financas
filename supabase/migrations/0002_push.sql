-- =====================================================================
-- Notificações (web push) de vencimento com o app fechado
-- =====================================================================

-- Cofre interno: guarda as chaves VAPID geradas pela Edge Function "push".
-- RLS ligado e nenhuma política: só a chave de serviço (Edge Functions) lê e grava.
create table public.app_secrets (
  key         text primary key,
  value       jsonb not null,
  created_at  timestamptz not null default now()
);
alter table public.app_secrets enable row level security;
revoke all on public.app_secrets from anon, authenticated;

-- Avisos já enviados (um por morador por dia), para não repetir se o agendamento rodar duas vezes.
create table public.reminder_log (
  member_id  uuid not null references public.members (id) on delete cascade,
  sent_on    date not null,
  bills      int not null,
  created_at timestamptz not null default now(),
  primary key (member_id, sent_on)
);
alter table public.reminder_log enable row level security;
revoke all on public.reminder_log from anon, authenticated;

-- As inscrições passam a ser gravadas pela Edge Function "push" (com validação do morador).
-- O app só lê e apaga as do próprio usuário.
revoke insert, update on public.push_subscriptions from authenticated;
