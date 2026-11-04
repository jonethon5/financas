-- Assistente (Edge Function "ask"): limite de perguntas por pessoa por dia (horário de Brasília).
-- Só a função (chave de serviço) mexe aqui; o app não lê nem grava.

create table public.ai_usage (
  member_id  uuid not null references public.members (id) on delete cascade,
  day        date not null,
  questions  int not null default 0 check (questions >= 0),
  primary key (member_id, day)
);

alter table public.ai_usage enable row level security;
revoke all on public.ai_usage from anon, authenticated;

-- Conta mais uma pergunta e devolve o total de hoje; devolve null se o limite já foi atingido.
create function public.ai_take_quota(p_member uuid, p_limit int)
returns int
language sql
security definer
set search_path = ''
as $$
  insert into public.ai_usage as u (member_id, day, questions)
  values (p_member, (now() at time zone 'America/Sao_Paulo')::date, 1)
  on conflict (member_id, day) do update set questions = u.questions + 1
    where u.questions < p_limit
  returning questions;
$$;

-- Devolve a pergunta quando o Gemini falha (a pessoa não perde a vez).
create function public.ai_give_back(p_member uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.ai_usage set questions = greatest(questions - 1, 0)
   where member_id = p_member and day = (now() at time zone 'America/Sao_Paulo')::date;
$$;

create function public.ai_used_today(p_member uuid)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select questions from public.ai_usage
                    where member_id = p_member and day = (now() at time zone 'America/Sao_Paulo')::date), 0);
$$;

revoke execute on function public.ai_take_quota(uuid, int) from public, anon, authenticated;
revoke execute on function public.ai_give_back(uuid) from public, anon, authenticated;
revoke execute on function public.ai_used_today(uuid) from public, anon, authenticated;
grant execute on function public.ai_take_quota(uuid, int) to service_role;
grant execute on function public.ai_give_back(uuid) to service_role;
grant execute on function public.ai_used_today(uuid) to service_role;
