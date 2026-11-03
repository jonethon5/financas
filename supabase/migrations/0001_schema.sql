-- =====================================================================
-- Finanças da Casa — schema
-- Aplicado automaticamente pelo workflow .github/workflows/supabase.yml
-- (ou manualmente: Supabase > SQL Editor > cole este arquivo > Run).
-- Não contém nenhum dado pessoal: a casa e os moradores são criados pelo app.
-- Valores em dinheiro são sempre CENTAVOS (bigint), nunca float.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------

create table public.households (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 80),
  created_at  timestamptz not null default now()
);

create table public.members (
  id             uuid primary key default gen_random_uuid(),
  household_id   uuid not null references public.households (id) on delete cascade,
  -- Login do morador. Só as Edge Functions (com a chave de serviço) preenchem user_id/username/role.
  user_id        uuid unique references auth.users (id) on delete set null,
  username       text unique check (username ~ '^[a-z0-9][a-z0-9._-]{1,29}$'),
  role           text not null default 'member' check (role in ('admin', 'member')),
  name           text not null check (char_length(name) between 1 and 60),
  nickname       text check (char_length(nickname) <= 30),
  color          text not null default '#3A8296' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  pix_key        text check (char_length(pix_key) <= 140),
  -- Com quantos dias de antecedência avisar dos vencimentos (0 = no dia).
  reminder_days  smallint[] not null default '{3,1,0}',
  active         boolean not null default true,
  sort_order     int not null default 0,
  created_at     timestamptz not null default now(),
  unique (id, household_id)
);

create table public.categories (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households (id) on delete cascade,
  name          text not null check (char_length(name) between 1 and 40),
  color         text not null default '#64748B' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  icon          text not null default 'receipt',
  is_fixed      boolean not null default false,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now(),
  unique (household_id, name),
  unique (id, household_id)
);

-- Modelo das contas fixas (água, luz...). Todo mês vira uma conta "aguardando valor".
create table public.recurring_bills (
  id                       uuid primary key default gen_random_uuid(),
  household_id             uuid not null references public.households (id) on delete cascade,
  category_id              uuid,
  description              text not null check (char_length(description) between 1 and 80),
  -- Empresa (Sabesp, Enel, Vivo...), código do cliente / nº de instalação e link da 2ª via.
  provider                 text check (char_length(provider) <= 60),
  customer_code            text check (char_length(customer_code) <= 60),
  bill_url                 text check (bill_url is null or bill_url ~ '^https://'),
  due_day                  smallint not null default 10 check (due_day between 1 and 31),
  -- Para contas de valor fixo (ex.: internet). null = preencher todo mês.
  default_amount_cents     bigint check (default_amount_cents >= 0),
  default_payer_member_id  uuid,
  active                   boolean not null default true,
  sort_order               int not null default 0,
  created_at               timestamptz not null default now(),
  unique (id, household_id),
  foreign key (category_id, household_id)
    references public.categories (id, household_id) on delete set null (category_id),
  foreign key (default_payer_member_id, household_id)
    references public.members (id, household_id) on delete set null (default_payer_member_id)
);

create table public.months (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households (id) on delete cascade,
  year          int not null check (year between 2000 and 2100),
  month         smallint not null check (month between 1 and 12),
  status        text not null default 'open' check (status in ('open', 'closed')),
  closed_at     timestamptz,
  closed_by     uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  unique (household_id, year, month),
  unique (id, household_id)
);

create table public.expenses (
  id                 uuid primary key default gen_random_uuid(),
  household_id       uuid not null references public.households (id) on delete cascade,
  month_id           uuid not null,
  category_id        uuid,
  recurring_bill_id  uuid,
  description        text not null check (char_length(description) between 1 and 120),
  -- null = conta fixa "aguardando valor"
  amount_cents       bigint check (amount_cents >= 0),
  due_date           date,
  expense_date       date not null default current_date,
  status             text not null default 'pending' check (status in ('pending', 'paid')),
  paid_at            date,
  paid_by_member_id  uuid,
  split_mode         text not null default 'equal' check (split_mode in ('equal', 'weights', 'amounts')),
  attachment_path    text,
  -- Só os dígitos do código de barras / linha digitável
  barcode            text check (barcode is null or barcode ~ '^[0-9]{44,48}$'),
  pix_code           text check (char_length(pix_code) <= 512),
  notes              text check (char_length(notes) <= 500),
  created_by         uuid default auth.uid() references auth.users (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  foreign key (month_id, household_id)
    references public.months (id, household_id) on delete cascade,
  foreign key (category_id, household_id)
    references public.categories (id, household_id) on delete set null (category_id),
  foreign key (recurring_bill_id, household_id)
    references public.recurring_bills (id, household_id) on delete set null (recurring_bill_id),
  foreign key (paid_by_member_id, household_id)
    references public.members (id, household_id) on delete set null (paid_by_member_id)
);
create index expenses_month_idx on public.expenses (month_id);
create index expenses_recurring_idx on public.expenses (recurring_bill_id);

-- Quanto cada morador participa de cada conta. A soma fecha exatamente com amount_cents.
create table public.expense_shares (
  id            uuid primary key default gen_random_uuid(),
  expense_id    uuid not null references public.expenses (id) on delete cascade,
  member_id     uuid not null references public.members (id) on delete restrict,
  amount_cents  bigint not null check (amount_cents >= 0),
  -- Peso usado na divisão por percentual (ex.: 60 e 40). null nas outras divisões.
  weight        int check (weight >= 0),
  unique (expense_id, member_id)
);
create index expense_shares_member_idx on public.expense_shares (member_id);

-- Acertos já feitos entre moradores ("Karen passou R$ 50 para Johnny").
create table public.transfers (
  id              uuid primary key default gen_random_uuid(),
  household_id    uuid not null references public.households (id) on delete cascade,
  month_id        uuid not null,
  from_member_id  uuid not null,
  to_member_id    uuid not null,
  amount_cents    bigint not null check (amount_cents > 0),
  paid_on         date not null default current_date,
  created_by      uuid default auth.uid() references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  check (from_member_id <> to_member_id),
  foreign key (month_id, household_id)
    references public.months (id, household_id) on delete cascade,
  foreign key (from_member_id, household_id) references public.members (id, household_id),
  foreign key (to_member_id, household_id) references public.members (id, household_id)
);

-- Inscrições de notificação (web push) de cada aparelho.
create table public.push_subscriptions (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households (id) on delete cascade,
  member_id     uuid not null references public.members (id) on delete cascade,
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint      text not null unique,
  p256dh        text not null,
  auth          text not null,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Funções auxiliares de acesso (security definer para evitar recursão no RLS)
-- ---------------------------------------------------------------------

create or replace function public.is_member_of(h uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.members m
    where m.household_id = h and m.user_id = (select auth.uid()) and m.active
  );
$$;

create or replace function public.is_admin_of(h uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.members m
    where m.household_id = h and m.user_id = (select auth.uid()) and m.active and m.role = 'admin'
  );
$$;

-- Versão que aceita texto (caminho de arquivo no Storage) sem quebrar com texto inválido.
create or replace function public.is_member_of_text(h text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select case
    when h ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      then public.is_member_of(h::uuid)
    else false
  end;
$$;

create or replace function public.my_household_id()
returns uuid
language sql stable security definer set search_path = ''
as $$
  select m.household_id from public.members m
  where m.user_id = (select auth.uid()) and m.active
  limit 1;
$$;

-- O app já foi configurado? (Mostra a tela de primeira configuração só quando ainda não.)
create or replace function public.is_configured()
returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.households); $$;

-- Usada pelo workflow keepalive (consulta leve para o projeto gratuito não pausar).
create or replace function public.ping()
returns text
language sql stable
as $$ select 'ok'::text; $$;

-- ---------------------------------------------------------------------
-- Configuração inicial (chamada só pela Edge Function "setup", com a chave de serviço)
-- ---------------------------------------------------------------------

create or replace function public.bootstrap_household(p_user uuid, p_house_name text, p_member_name text, p_username text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_house uuid;
  v_cat   uuid;
  r       record;
begin
  if exists (select 1 from public.households) then
    raise exception 'O app já foi configurado.';
  end if;

  insert into public.households (name) values (trim(p_house_name)) returning id into v_house;

  insert into public.members (household_id, user_id, username, role, name, color, sort_order)
  values (v_house, p_user, lower(trim(p_username)), 'admin', trim(p_member_name), '#3A8296', 0);

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

-- ---------------------------------------------------------------------
-- Operações do app (security invoker: o RLS continua valendo)
-- ---------------------------------------------------------------------

-- Divide um valor igualmente; os centavos que sobram vão para os primeiros da lista.
-- (Mesma regra de src/lib/split.ts.)
create or replace function public.split_equal(p_total bigint, p_count int, p_index int)
returns bigint
language sql immutable
as $$
  select (p_total / p_count) + case when p_index < (p_total % p_count) then 1 else 0 end;
$$;

-- Garante que o mês existe. Na primeira vez, cria as contas fixas "aguardando valor".
create or replace function public.ensure_month(p_year int, p_month int)
returns uuid
language plpgsql security invoker set search_path = ''
as $$
declare
  v_house   uuid := public.my_household_id();
  v_month   uuid;
  v_last    int;
  v_members uuid[];
  v_count   int;
  r         record;
  v_exp     uuid;
begin
  if v_house is null then
    raise exception 'Você não faz parte de uma casa.';
  end if;

  insert into public.months (household_id, year, month)
  values (v_house, p_year, p_month)
  on conflict (household_id, year, month) do nothing
  returning id into v_month;

  if v_month is null then
    select id into v_month from public.months
     where household_id = v_house and year = p_year and month = p_month;
    return v_month;
  end if;

  -- Mês novo: cria as contas fixas
  v_last := extract(day from (make_date(p_year, p_month, 1) + interval '1 month - 1 day'))::int;
  select array_agg(id order by sort_order, created_at) into v_members
    from public.members where household_id = v_house and active;
  v_count := coalesce(array_length(v_members, 1), 0);

  for r in
    select * from public.recurring_bills
     where household_id = v_house and active
     order by sort_order, created_at
  loop
    insert into public.expenses (household_id, month_id, category_id, recurring_bill_id, description,
                                 amount_cents, due_date, expense_date, paid_by_member_id)
    values (v_house, v_month, r.category_id, r.id, r.description, r.default_amount_cents,
            make_date(p_year, p_month, least(r.due_day, v_last)), make_date(p_year, p_month, 1),
            r.default_payer_member_id)
    returning id into v_exp;

    -- Conta de valor fixo: já divide igualmente entre os moradores ativos
    if r.default_amount_cents is not null and v_count > 0 then
      insert into public.expense_shares (expense_id, member_id, amount_cents)
      select v_exp, v_members[i], public.split_equal(r.default_amount_cents, v_count, i - 1)
        from generate_subscripts(v_members, 1) as i;
    end if;
  end loop;

  return v_month;
end;
$$;

-- Salva uma conta e a divisão dela numa única transação.
-- p: { id?, month_id, category_id?, recurring_bill_id?, description, amount_cents?, due_date?, expense_date?,
--      status, paid_at?, paid_by_member_id?, split_mode, barcode?, pix_code?, notes?, attachment_path?,
--      shares: [{ member_id, amount_cents, weight? }] }
create or replace function public.save_expense(p jsonb)
returns uuid
language plpgsql security invoker set search_path = ''
as $$
declare
  v_id     uuid := nullif(p ->> 'id', '')::uuid;
  v_house  uuid := public.my_household_id();
  v_amount bigint := nullif(p ->> 'amount_cents', '')::bigint;
  v_shares jsonb := coalesce(p -> 'shares', '[]'::jsonb);
  v_sum    bigint;
begin
  if v_house is null then
    raise exception 'Você não faz parte de uma casa.';
  end if;

  if v_amount is not null then
    if jsonb_array_length(v_shares) = 0 then
      raise exception 'Escolha quem participa da divisão.';
    end if;
    select coalesce(sum((s ->> 'amount_cents')::bigint), 0) into v_sum from jsonb_array_elements(v_shares) s;
    if v_sum <> v_amount then
      raise exception 'A divisão (%) não fecha com o valor da conta (%).', v_sum, v_amount;
    end if;
  end if;

  if v_id is null then
    insert into public.expenses (household_id, month_id, category_id, recurring_bill_id, description, amount_cents,
                                 due_date, expense_date, status, paid_at, paid_by_member_id, split_mode,
                                 barcode, pix_code, notes, attachment_path)
    values (v_house,
            (p ->> 'month_id')::uuid,
            nullif(p ->> 'category_id', '')::uuid,
            nullif(p ->> 'recurring_bill_id', '')::uuid,
            p ->> 'description',
            v_amount,
            nullif(p ->> 'due_date', '')::date,
            coalesce(nullif(p ->> 'expense_date', '')::date, current_date),
            coalesce(p ->> 'status', 'pending'),
            nullif(p ->> 'paid_at', '')::date,
            nullif(p ->> 'paid_by_member_id', '')::uuid,
            coalesce(p ->> 'split_mode', 'equal'),
            nullif(p ->> 'barcode', ''),
            nullif(p ->> 'pix_code', ''),
            nullif(p ->> 'notes', ''),
            nullif(p ->> 'attachment_path', ''))
    returning id into v_id;
  else
    update public.expenses set
      category_id       = nullif(p ->> 'category_id', '')::uuid,
      description       = p ->> 'description',
      amount_cents      = v_amount,
      due_date          = nullif(p ->> 'due_date', '')::date,
      expense_date      = coalesce(nullif(p ->> 'expense_date', '')::date, expense_date),
      status            = coalesce(p ->> 'status', status),
      paid_at           = nullif(p ->> 'paid_at', '')::date,
      paid_by_member_id = nullif(p ->> 'paid_by_member_id', '')::uuid,
      split_mode        = coalesce(p ->> 'split_mode', split_mode),
      barcode           = nullif(p ->> 'barcode', ''),
      pix_code          = nullif(p ->> 'pix_code', ''),
      notes             = nullif(p ->> 'notes', ''),
      attachment_path   = nullif(p ->> 'attachment_path', '')
    where id = v_id;
    if not found then
      raise exception 'Conta não encontrada.';
    end if;
    delete from public.expense_shares where expense_id = v_id;
  end if;

  insert into public.expense_shares (expense_id, member_id, amount_cents, weight)
  select v_id, (s ->> 'member_id')::uuid, (s ->> 'amount_cents')::bigint, nullif(s ->> 'weight', '')::int
    from jsonb_array_elements(v_shares) s;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------
-- Gatilhos: updated_at, fechamento de mês e bloqueio de edição em mês fechado
-- ---------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger expenses_touch before update on public.expenses
  for each row execute function public.touch_updated_at();

create or replace function public.stamp_month_status()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status = 'closed' and old.status = 'open' then
    new.closed_at := now();
    new.closed_by := auth.uid();
  elsif new.status = 'open' then
    new.closed_at := null;
    new.closed_by := null;
  end if;
  return new;
end;
$$;

create trigger months_stamp before update of status on public.months
  for each row execute function public.stamp_month_status();

create or replace function public.month_is_closed(p_month uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.months where id = p_month and status = 'closed');
$$;

create or replace function public.guard_closed_month()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_old uuid;
  v_new uuid;
begin
  if tg_table_name = 'expense_shares' then
    if tg_op <> 'INSERT' then
      select month_id into v_old from public.expenses where id = old.expense_id;
    end if;
    if tg_op <> 'DELETE' then
      select month_id into v_new from public.expenses where id = new.expense_id;
    end if;
  else
    if tg_op <> 'INSERT' then v_old := old.month_id; end if;
    if tg_op <> 'DELETE' then v_new := new.month_id; end if;
  end if;

  if public.month_is_closed(v_old) or public.month_is_closed(v_new) then
    raise exception 'Este mês está fechado. Reabra o mês para editar.' using errcode = 'P0001';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger expenses_closed_guard before insert or update or delete on public.expenses
  for each row execute function public.guard_closed_month();
create trigger expense_shares_closed_guard before insert or update or delete on public.expense_shares
  for each row execute function public.guard_closed_month();
create trigger transfers_closed_guard before insert or update or delete on public.transfers
  for each row execute function public.guard_closed_month();

-- ---------------------------------------------------------------------
-- Permissões e Row Level Security
-- ---------------------------------------------------------------------

alter table public.households         enable row level security;
alter table public.members            enable row level security;
alter table public.categories         enable row level security;
alter table public.recurring_bills    enable row level security;
alter table public.months             enable row level security;
alter table public.expenses           enable row level security;
alter table public.expense_shares     enable row level security;
alter table public.transfers          enable row level security;
alter table public.push_subscriptions enable row level security;

-- Visitantes sem login (anon) não acessam nenhuma tabela.
revoke all on public.households, public.members, public.categories, public.recurring_bills, public.months,
  public.expenses, public.expense_shares, public.transfers, public.push_subscriptions from anon;

-- Casa: criada só pela função bootstrap_household; só o admin renomeia; ninguém apaga pelo app.
revoke insert, delete on public.households from authenticated;
create policy households_select on public.households for select to authenticated
  using (public.is_member_of(id));
create policy households_update on public.households for update to authenticated
  using (public.is_admin_of(id)) with check (public.is_admin_of(id));

-- Moradores: login (user_id, username, role) só pelas Edge Functions.
-- Todos editam nome/apelido/cor/Pix/avisos; só o admin adiciona, desativa ou remove morador.
revoke insert, update on public.members from authenticated;
grant insert (household_id, name, nickname, color, pix_key, active, sort_order) on public.members to authenticated;
grant update (name, nickname, color, pix_key, reminder_days, active, sort_order) on public.members to authenticated;
create policy members_select on public.members for select to authenticated
  using (public.is_member_of(household_id));
create policy members_insert on public.members for insert to authenticated
  with check (public.is_admin_of(household_id));
create policy members_update on public.members for update to authenticated
  using (public.is_member_of(household_id)) with check (public.is_member_of(household_id));
create policy members_delete on public.members for delete to authenticated
  using (public.is_admin_of(household_id) and user_id is null);

-- Impede que um morador comum desative alguém (só o admin).
create or replace function public.guard_member_active()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- auth.uid() é null quando quem altera é o servidor (Edge Function com chave de serviço).
  if new.active is distinct from old.active and auth.uid() is not null
     and not public.is_admin_of(old.household_id) then
    raise exception 'Só o administrador pode desativar ou reativar moradores.';
  end if;
  return new;
end;
$$;
create trigger members_active_guard before update on public.members
  for each row execute function public.guard_member_active();

create policy categories_all on public.categories for all to authenticated
  using (public.is_member_of(household_id)) with check (public.is_member_of(household_id));

create policy recurring_bills_all on public.recurring_bills for all to authenticated
  using (public.is_member_of(household_id)) with check (public.is_member_of(household_id));

-- Meses: não se apaga mês pelo app (só fecha/reabre).
revoke delete on public.months from authenticated;
create policy months_all on public.months for all to authenticated
  using (public.is_member_of(household_id)) with check (public.is_member_of(household_id));

create policy expenses_all on public.expenses for all to authenticated
  using (public.is_member_of(household_id)) with check (public.is_member_of(household_id));

create policy expense_shares_all on public.expense_shares for all to authenticated
  using (exists (select 1 from public.expenses e
                 where e.id = expense_id and public.is_member_of(e.household_id)))
  with check (exists (select 1 from public.expenses e
                      where e.id = expense_id and public.is_member_of(e.household_id)));

create policy transfers_all on public.transfers for all to authenticated
  using (public.is_member_of(household_id)) with check (public.is_member_of(household_id));

-- Cada pessoa só vê e gerencia as inscrições de notificação dos próprios aparelhos.
create policy push_subscriptions_own on public.push_subscriptions for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.is_member_of(household_id));

-- Funções: por padrão o Postgres/Supabase liberam EXECUTE para todos; restringimos.
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function
  public.is_member_of(uuid), public.is_admin_of(uuid), public.is_member_of_text(text), public.my_household_id(),
  public.month_is_closed(uuid), public.split_equal(bigint, int, int),
  public.ensure_month(int, int), public.save_expense(jsonb)
  to authenticated;
grant execute on function public.ping(), public.is_configured() to anon, authenticated;
grant execute on function public.bootstrap_household(uuid, text, text, text) to service_role;

-- ---------------------------------------------------------------------
-- Realtime: os moradores veem as mudanças na hora
-- ---------------------------------------------------------------------

alter publication supabase_realtime add table
  public.households, public.members, public.categories, public.recurring_bills,
  public.months, public.expenses, public.expense_shares, public.transfers;

-- ---------------------------------------------------------------------
-- Storage: bucket PRIVADO de anexos. Caminho: <household_id>/<arquivo>
-- ---------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('anexos', 'anexos', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'])
on conflict (id) do nothing;

create policy anexos_select on storage.objects for select to authenticated
  using (bucket_id = 'anexos' and public.is_member_of_text((storage.foldername(name))[1]));
create policy anexos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'anexos' and public.is_member_of_text((storage.foldername(name))[1]));
create policy anexos_update on storage.objects for update to authenticated
  using (bucket_id = 'anexos' and public.is_member_of_text((storage.foldername(name))[1]));
create policy anexos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'anexos' and public.is_member_of_text((storage.foldername(name))[1]));
