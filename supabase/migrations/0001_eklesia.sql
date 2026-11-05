-- Eklésia — esquema inicial (Supabase / Postgres)
-- Rode no SQL Editor do Supabase ou com `supabase db push`.

create extension if not exists pgcrypto;

-- ───────────────────────── Tipos
do $$ begin
  create type papel as enum ('membro', 'lider', 'admin');
exception when duplicate_object then null; end $$;

-- ───────────────────────── Configuração da igreja (linha única)
create table if not exists config (
  id int primary key default 1 check (id = 1),
  nome_igreja text not null default 'Igreja Eklésia',
  slogan text default 'Chamados para fora, reunidos em Cristo.',
  endereco text,
  horarios_culto text default 'Domingo 18h · Quarta 19h30',
  instagram text,
  youtube text,
  whatsapp text,
  pix_chave text,
  pix_recebedor text,          -- até 25 caracteres, sem acento de preferência
  pix_cidade text,             -- até 15 caracteres
  atualizado_em timestamptz default now()
);
insert into config (id) values (1) on conflict do nothing;

-- ───────────────────────── Células
create table if not exists celulas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  descricao text,
  lider_id uuid,
  dia_semana text,             -- ex.: 'Terça'
  horario text,                -- ex.: '19h30'
  endereco text,
  bairro text,
  ativa boolean not null default true,
  criado_em timestamptz not null default now()
);

-- ───────────────────────── Perfis (1:1 com auth.users)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null default '',
  email text,
  telefone text,
  nascimento date,
  bairro text,
  papel papel not null default 'membro',
  celula_id uuid references celulas(id) on delete set null,
  membro_desde date,
  criado_em timestamptz not null default now()
);
alter table celulas
  drop constraint if exists celulas_lider_fk,
  add constraint celulas_lider_fk foreign key (lider_id) references profiles(id) on delete set null;

create index if not exists profiles_celula_idx on profiles(celula_id);

-- ───────────────────────── Avisos
create table if not exists avisos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  corpo text not null default '',
  link text,
  fixado boolean not null default false,
  publicado_em timestamptz not null default now(),
  expira_em timestamptz,
  autor_id uuid references profiles(id) on delete set null
);
create index if not exists avisos_pub_idx on avisos(fixado desc, publicado_em desc);

-- ───────────────────────── Agenda
create table if not exists eventos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descricao text,
  local text,
  inicio timestamptz not null,
  fim timestamptz,
  vagas int,                         -- null = sem limite
  inscricao_aberta boolean not null default false,
  criado_em timestamptz not null default now()
);
create index if not exists eventos_inicio_idx on eventos(inicio);

create table if not exists inscricoes (
  evento_id uuid not null references eventos(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  criado_em timestamptz not null default now(),
  primary key (evento_id, user_id)
);

-- ───────────────────────── Devocional diário
create table if not exists devocionais (
  id uuid primary key default gen_random_uuid(),
  data date not null unique,
  titulo text not null,
  referencia text not null,          -- ex.: 'João 3:16'
  texto_biblico text not null,
  reflexao text not null,
  oracao text,
  criado_em timestamptz not null default now()
);

-- ───────────────────────── Pedidos de oração
create table if not exists pedidos_oracao (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references profiles(id) on delete cascade,
  autor_nome text,                   -- null quando anônimo
  pedido text not null check (char_length(pedido) between 3 and 1000),
  publico boolean not null default false,   -- aparece no mural da igreja
  anonimo boolean not null default false,
  respondido boolean not null default false,
  testemunho text,
  criado_em timestamptz not null default now()
);
create index if not exists pedidos_criado_idx on pedidos_oracao(criado_em desc);

create table if not exists oracoes (
  pedido_id uuid not null references pedidos_oracao(id) on delete cascade,
  user_id uuid not null default auth.uid() references profiles(id) on delete cascade,
  criado_em timestamptz not null default now(),
  primary key (pedido_id, user_id)
);

-- ───────────────────────── Funções auxiliares
create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and papel = 'admin');
$$;

create or replace function lidera_celula(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from celulas where id = c and lider_id = auth.uid());
$$;

-- Total de inscritos por evento (sem expor quem são)
create or replace function inscritos_por_evento()
returns table (evento_id uuid, total bigint)
language sql stable security definer set search_path = public as $$
  select evento_id, count(*) from inscricoes group by evento_id;
$$;

-- Total de "estou orando" por pedido
create or replace function oracoes_por_pedido()
returns table (pedido_id uuid, total bigint)
language sql stable security definer set search_path = public as $$
  select pedido_id, count(*) from oracoes group by pedido_id;
$$;

-- Novo usuário → cria perfil. O primeiro cadastro vira admin.
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, nome, email, papel)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    case when exists (select 1 from profiles where papel = 'admin') then 'membro'::papel else 'admin'::papel end
  );
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- Membro comum não pode mudar o próprio papel
create or replace function proteger_papel() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.papel is distinct from old.papel and not is_admin() then
    raise exception 'Somente administradores podem alterar papéis';
  end if;
  return new;
end $$;

drop trigger if exists profiles_proteger_papel on profiles;
create trigger profiles_proteger_papel before update on profiles
  for each row execute function proteger_papel();

-- Valida vagas na inscrição
create or replace function checar_vagas() returns trigger
language plpgsql security definer set search_path = public as $$
declare v int; aberta boolean; total int;
begin
  select vagas, inscricao_aberta into v, aberta from eventos where id = new.evento_id;
  if not aberta then raise exception 'Inscrições encerradas'; end if;
  if v is not null then
    select count(*) into total from inscricoes where evento_id = new.evento_id;
    if total >= v then raise exception 'Vagas esgotadas'; end if;
  end if;
  return new;
end $$;

drop trigger if exists inscricoes_vagas on inscricoes;
create trigger inscricoes_vagas before insert on inscricoes
  for each row execute function checar_vagas();

-- ───────────────────────── RLS
alter table config enable row level security;
alter table celulas enable row level security;
alter table profiles enable row level security;
alter table avisos enable row level security;
alter table eventos enable row level security;
alter table inscricoes enable row level security;
alter table devocionais enable row level security;
alter table pedidos_oracao enable row level security;
alter table oracoes enable row level security;

-- Conteúdo da igreja: leitura para membros logados, escrita só admin
do $$
declare t text;
begin
  foreach t in array array['config','celulas','avisos','eventos','devocionais'] loop
    execute format('drop policy if exists "%1$s_ler" on %1$s', t);
    execute format('create policy "%1$s_ler" on %1$s for select to authenticated using (true)', t);
    execute format('drop policy if exists "%1$s_admin" on %1$s', t);
    execute format('create policy "%1$s_admin" on %1$s for all to authenticated using (is_admin()) with check (is_admin())', t);
  end loop;
end $$;

-- Perfis
drop policy if exists profiles_ler on profiles;
create policy profiles_ler on profiles for select to authenticated using (
  id = auth.uid() or is_admin() or (celula_id is not null and lidera_celula(celula_id))
);
drop policy if exists profiles_editar on profiles;
create policy profiles_editar on profiles for update to authenticated
  using (id = auth.uid() or is_admin()) with check (id = auth.uid() or is_admin());
drop policy if exists profiles_apagar on profiles;
create policy profiles_apagar on profiles for delete to authenticated using (is_admin());

-- Nome do líder visível para todos (sem expor o resto do perfil)
create or replace view lideres as
  select p.id, p.nome from profiles p where p.papel in ('lider', 'admin');
grant select on lideres to authenticated;

-- Inscrições
drop policy if exists inscricoes_ler on inscricoes;
create policy inscricoes_ler on inscricoes for select to authenticated using (user_id = auth.uid() or is_admin());
drop policy if exists inscricoes_criar on inscricoes;
create policy inscricoes_criar on inscricoes for insert to authenticated with check (user_id = auth.uid());
drop policy if exists inscricoes_cancelar on inscricoes;
create policy inscricoes_cancelar on inscricoes for delete to authenticated using (user_id = auth.uid() or is_admin());

-- Pedidos de oração
drop policy if exists pedidos_ler on pedidos_oracao;
create policy pedidos_ler on pedidos_oracao for select to authenticated using (publico or user_id = auth.uid() or is_admin());
drop policy if exists pedidos_criar on pedidos_oracao;
create policy pedidos_criar on pedidos_oracao for insert to authenticated with check (user_id = auth.uid());
drop policy if exists pedidos_editar on pedidos_oracao;
create policy pedidos_editar on pedidos_oracao for update to authenticated using (user_id = auth.uid() or is_admin());
drop policy if exists pedidos_apagar on pedidos_oracao;
create policy pedidos_apagar on pedidos_oracao for delete to authenticated using (user_id = auth.uid() or is_admin());

-- "Estou orando"
drop policy if exists oracoes_ler on oracoes;
create policy oracoes_ler on oracoes for select to authenticated using (user_id = auth.uid());
drop policy if exists oracoes_criar on oracoes;
create policy oracoes_criar on oracoes for insert to authenticated with check (user_id = auth.uid());
drop policy if exists oracoes_apagar on oracoes;
create policy oracoes_apagar on oracoes for delete to authenticated using (user_id = auth.uid());

grant execute on function inscritos_por_evento() to authenticated;
grant execute on function oracoes_por_pedido() to authenticated;
