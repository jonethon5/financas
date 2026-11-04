-- Convites: o administrador de uma casa gera um código e manda para outra pessoa, que cria a PRÓPRIA casa
-- (vazia, com ela como administradora) entrando com e-mail e senha. As casas não veem os dados umas das outras (RLS).
-- O cadastro público continua desligado: sem convite ninguém cria conta.

-- E-mail de login de quem entra com e-mail (quem entra com usuário continua com username).
alter table public.members add column login_email text check (login_email is null or char_length(login_email) <= 254);

create table public.invites (
  -- Código sem o traço, maiúsculo (ex.: K7P29QXM)
  code               text primary key check (code ~ '^[A-Z0-9]{8}$'),
  household_id       uuid not null references public.households (id) on delete cascade,
  created_by         uuid references public.members (id) on delete set null,
  created_at         timestamptz not null default now(),
  expires_at         timestamptz not null default now() + interval '7 days',
  used_at            timestamptz,
  used_by_household  uuid references public.households (id) on delete set null
);

alter table public.invites enable row level security;
revoke all on public.invites from anon, authenticated;

-- Cria uma casa nova com categorias e contas fixas padrão e o primeiro morador como administrador.
-- (A primeira configuração usa bootstrap_household, que só funciona com o banco vazio.)
create function public.new_household(p_user uuid, p_house_name text, p_member_name text, p_username text, p_login_email text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_house uuid;
  v_cat   uuid;
  r       record;
begin
  insert into public.households (name) values (trim(p_house_name)) returning id into v_house;

  insert into public.members (household_id, user_id, username, login_email, role, name, color, sort_order)
  values (v_house, p_user, nullif(lower(trim(p_username)), ''), nullif(lower(trim(p_login_email)), ''), 'admin',
          trim(p_member_name), '#4A90A4', 0);

  for r in
    select * from (values
      ('Água',     '#3B82F6', 'droplet',       true,  1, 'Sabesp', 'https://agenciavirtual.sabesp.com.br/'),
      ('Luz',      '#F59E0B', 'zap',           true,  2, 'Enel',   'https://www.enel.com.br/pt-saopaulo.html'),
      ('Telefone', '#8B5CF6', 'phone',         true,  3, 'Vivo',   'https://meuvivo.vivo.com.br/'),
      ('Internet', '#06B6D4', 'wifi',          true,  4, 'Vivo',   'https://meuvivo.vivo.com.br/'),
      ('Compras',  '#F97316', 'shopping-cart', false, 5, null,     null),
      ('Extras',   '#64748B', 'receipt',       false, 6, null,     null)
    ) as t(name, color, icon, is_fixed, sort_order, provider, bill_url)
  loop
    insert into public.categories (household_id, name, color, icon, is_fixed, sort_order)
    values (v_house, r.name, r.color, r.icon, r.is_fixed, r.sort_order)
    returning id into v_cat;

    if r.is_fixed then
      insert into public.recurring_bills (household_id, category_id, description, provider, bill_url, due_day, sort_order)
      values (v_house, v_cat, r.name, r.provider, r.bill_url, 10, r.sort_order);
    end if;
  end loop;

  return v_house;
end;
$$;

revoke execute on function public.new_household(uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.new_household(uuid, text, text, text, text) to service_role;
