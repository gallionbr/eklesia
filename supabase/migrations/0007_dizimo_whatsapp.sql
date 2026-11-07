-- Eklésia — Dízimo e ofertas pelo WhatsApp (módulo inspirado no Dizify)
--
-- Quem escreve: só o servidor (service role) — webhooks do WhatsApp (Meta Cloud API)
-- e do Asaas, e as rotas /api/dizimo/*. O app (anon/authenticated) só LÊ:
--   membro → o que é dele; admin → tudo.
-- Dinheiro em centavos (bigint) + moeda. Datas em timestamptz (UTC).

-- ---------------------------------------------------------------------------
-- Utilitários
-- ---------------------------------------------------------------------------
create or replace function privado.tocar_atualizado() returns trigger
language plpgsql set search_path = public as $$
begin
  new.atualizado_em := now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- QR Codes: cada lugar (painel de LED, cartaz, telão, boletim) tem um código.
-- eklesia.international/D        → origem geral (codigo = '')
-- eklesia.international/D/LED    → origem "Painel de LED"
-- A rota registra o scan e redireciona pro wa.me da igreja.
-- ---------------------------------------------------------------------------
create table if not exists qr_origens (
  id uuid primary key default gen_random_uuid(),
  -- até 6 caracteres: HTTPS://EKLESIA.INTERNATIONAL/D/XXXXXX ainda cabe num QR 25×25
  codigo text not null unique check (codigo ~ '^[A-Z0-9]{0,6}$'),
  nome text not null check (char_length(nome) between 1 and 60),
  texto_inicial text not null default 'Quero contribuir'
    check (char_length(texto_inicial) between 1 and 120),
  ativo boolean not null default true,
  scans integer not null default 0,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create trigger qr_origens_tocar before update on qr_origens
  for each row execute function privado.tocar_atualizado();

insert into qr_origens (codigo, nome) values
  ('', 'Geral'), ('LED', 'Painel de LED'), ('APP', 'App Eklésia')
on conflict (codigo) do nothing;

create table if not exists qr_scans (
  id uuid primary key default gen_random_uuid(),
  origem_id uuid not null references qr_origens(id) on delete cascade,
  criado_em timestamptz not null default now()
);
create index if not exists qr_scans_origem_idx on qr_scans(origem_id, criado_em desc);

-- ---------------------------------------------------------------------------
-- Contatos do WhatsApp (quem fala com o bot). Pode ser membro do app ou não.
-- ---------------------------------------------------------------------------
create table if not exists contatos_wa (
  id uuid primary key default gen_random_uuid(),
  telefone text not null unique check (telefone ~ '^\+[1-9][0-9]{7,14}$'),  -- E.164
  profile_id uuid unique references profiles(id) on delete set null,
  nome text check (char_length(nome) <= 120),
  cpf text check (cpf ~ '^[0-9]{11}$'),
  nascimento date check (nascimento between '1900-01-01' and current_date),
  asaas_cliente_id text unique,
  origem_id uuid references qr_origens(id) on delete set null,  -- de onde veio na 1ª vez
  aceitou_em timestamptz,          -- aceite LGPD no 1º contato
  saiu_em timestamptz,             -- mandou PARAR: não recebe lembretes/campanhas
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists contatos_wa_origem_idx on contatos_wa(origem_id);
create index if not exists contatos_wa_aniversario_idx
  on contatos_wa((extract(month from nascimento)), (extract(day from nascimento)));
create trigger contatos_wa_tocar before update on contatos_wa
  for each row execute function privado.tocar_atualizado();

-- Estado da conversa (máquina de estados do bot). versao = trava otimista.
create table if not exists conversas_wa (
  contato_id uuid primary key references contatos_wa(id) on delete cascade,
  estado text not null default 'inicio' check (estado in (
    'inicio', 'cad_nome', 'cad_cpf', 'cad_nascimento',
    'escolher_tipo', 'escolher_campanha', 'escolher_valor', 'valor_livre',
    'escolher_forma', 'escolher_recorrencia', 'aguardando_pagamento',
    'menu', 'gerenciar', 'atendimento')),
  contexto jsonb not null default '{}'::jsonb,
  versao integer not null default 0,
  ultima_entrada_em timestamptz,   -- abre a janela de 24h do WhatsApp
  atualizado_em timestamptz not null default now()
);
create trigger conversas_wa_tocar before update on conversas_wa
  for each row execute function privado.tocar_atualizado();

create table if not exists mensagens_wa (
  id uuid primary key default gen_random_uuid(),
  contato_id uuid not null references contatos_wa(id) on delete cascade,
  direcao text not null check (direcao in ('entrada', 'saida')),
  wa_message_id text unique,       -- a Meta reenvia webhooks: dedupe aqui
  tipo text not null default 'texto'
    check (tipo in ('texto', 'botao', 'lista', 'imagem', 'template', 'outro')),
  template text,
  corpo text,
  status text not null default 'enviada'
    check (status in ('recebida', 'enviada', 'entregue', 'lida', 'falhou')),
  erro text,
  criado_em timestamptz not null default now()
);
create index if not exists mensagens_wa_contato_idx on mensagens_wa(contato_id, criado_em desc);

-- Vincular o WhatsApp à conta do app: o app gera um token e abre
-- wa.me/<igreja>?text=VINCULAR <token>. O bot liga telefone ↔ profile.
create table if not exists vinculos_wa (
  token text primary key check (token ~ '^[A-Z0-9]{6}$'),
  profile_id uuid not null references profiles(id) on delete cascade,
  expira_em timestamptz not null default now() + interval '15 minutes',
  usado_em timestamptz,
  criado_em timestamptz not null default now()
);
create index if not exists vinculos_wa_profile_idx on vinculos_wa(profile_id);

-- ---------------------------------------------------------------------------
-- Campanhas, compromissos (recorrência) e contribuições
-- ---------------------------------------------------------------------------
create table if not exists campanhas (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (char_length(titulo) between 1 and 80),
  descricao text not null default '' check (char_length(descricao) <= 1000),
  meta_centavos bigint check (meta_centavos > 0),
  moeda char(3) not null default 'BRL',
  inicio date not null default current_date,
  fim date,
  ativa boolean not null default true,
  criado_por uuid references profiles(id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  check (fim is null or fim >= inicio)
);
create index if not exists campanhas_ativas_idx on campanhas(ativa, inicio);
create index if not exists campanhas_criado_por_idx on campanhas(criado_por);
create trigger campanhas_tocar before update on campanhas
  for each row execute function privado.tocar_atualizado();

create table if not exists compromissos (
  id uuid primary key default gen_random_uuid(),
  contato_id uuid not null references contatos_wa(id) on delete cascade,
  tipo text not null check (tipo in ('dizimo', 'oferta', 'missoes')),
  valor_centavos bigint not null check (valor_centavos >= 100),
  moeda char(3) not null default 'BRL',
  forma text not null check (forma in ('pix', 'cartao')),
  dia_mes smallint not null check (dia_mes between 1 and 28),
  status text not null default 'ativo' check (status in ('ativo', 'pausado', 'cancelado')),
  asaas_assinatura_id text unique,  -- só cartão: o Asaas cobra sozinho todo mês
  cancelado_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists compromissos_contato_idx on compromissos(contato_id);
create index if not exists compromissos_lembrete_idx on compromissos(status, forma, dia_mes);
-- um compromisso ativo por tipo por pessoa
create unique index if not exists compromissos_um_ativo_idx
  on compromissos(contato_id, tipo) where status = 'ativo';
create trigger compromissos_tocar before update on compromissos
  for each row execute function privado.tocar_atualizado();

create table if not exists contribuicoes (
  id uuid primary key default gen_random_uuid(),
  -- restrict: registro financeiro fica; pedido de exclusão LGPD anonimiza o contato
  contato_id uuid not null references contatos_wa(id) on delete restrict,
  compromisso_id uuid references compromissos(id) on delete set null,
  campanha_id uuid references campanhas(id) on delete set null,
  origem_id uuid references qr_origens(id) on delete set null,
  tipo text not null check (tipo in ('dizimo', 'oferta', 'missoes', 'campanha')),
  valor_centavos bigint not null check (valor_centavos >= 100),
  taxa_centavos bigint not null default 0 check (taxa_centavos >= 0),
  liquido_centavos bigint generated always as (valor_centavos - taxa_centavos) stored,
  moeda char(3) not null default 'BRL',
  forma text not null check (forma in ('pix', 'cartao')),
  status text not null default 'pendente' check (status in (
    'pendente', 'paga', 'vencida', 'falhou', 'estornada', 'chargeback')),
  asaas_cobranca_id text unique,      -- nulo só no instante entre gravar e o Asaas responder
  pix_copia_cola text,
  link_pagamento text,
  vence_em date,
  paga_em timestamptz,
  recibo_enviado_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  check (tipo <> 'campanha' or campanha_id is not null),
  check (status <> 'paga' or paga_em is not null)
);
create index if not exists contribuicoes_contato_idx on contribuicoes(contato_id, criado_em desc);
create index if not exists contribuicoes_status_idx on contribuicoes(status, criado_em desc);
create index if not exists contribuicoes_paga_em_idx on contribuicoes(paga_em) where status = 'paga';
create index if not exists contribuicoes_compromisso_idx on contribuicoes(compromisso_id);
create index if not exists contribuicoes_campanha_idx on contribuicoes(campanha_id);
create index if not exists contribuicoes_origem_idx on contribuicoes(origem_id);
create trigger contribuicoes_tocar before update on contribuicoes
  for each row execute function privado.tocar_atualizado();

-- ---------------------------------------------------------------------------
-- Disparos (lembretes, aniversários, campanhas, avisos) e idempotência de webhooks
-- ---------------------------------------------------------------------------
create table if not exists envios_agendados (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('lembrete', 'aniversario', 'campanha', 'aviso')),
  publico text not null default 'todos'
    check (publico in ('todos', 'recorrentes', 'inativos', 'aniversariantes', 'membros_app')),
  template text not null,          -- nome do template aprovado na Meta
  parametros jsonb not null default '{}'::jsonb,
  campanha_id uuid references campanhas(id) on delete set null,
  agendado_para timestamptz not null default now(),
  status text not null default 'rascunho'
    check (status in ('rascunho', 'agendado', 'enviando', 'enviado', 'falhou')),
  total integer not null default 0,
  enviados integer not null default 0,
  criado_por uuid references profiles(id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists envios_fila_idx on envios_agendados(status, agendado_para);
create index if not exists envios_campanha_idx on envios_agendados(campanha_id);
create index if not exists envios_criado_por_idx on envios_agendados(criado_por);
create trigger envios_tocar before update on envios_agendados
  for each row execute function privado.tocar_atualizado();

create table if not exists webhook_eventos (
  provedor text not null check (provedor in ('whatsapp', 'asaas')),
  evento_id text not null,
  recebido_em timestamptz not null default now(),
  processado_em timestamptz,
  erro text,
  primary key (provedor, evento_id)
);

-- ---------------------------------------------------------------------------
-- Acesso (RLS)
-- ---------------------------------------------------------------------------
create or replace function privado.meu_contato() returns uuid
language sql stable security definer set search_path = public as $$
  select id from contatos_wa where profile_id = auth.uid();
$$;
revoke execute on function privado.meu_contato() from public, anon;
grant execute on function privado.meu_contato() to authenticated;

alter table qr_origens enable row level security;
alter table qr_scans enable row level security;
alter table contatos_wa enable row level security;
alter table conversas_wa enable row level security;
alter table mensagens_wa enable row level security;
alter table vinculos_wa enable row level security;
alter table campanhas enable row level security;
alter table compromissos enable row level security;
alter table contribuicoes enable row level security;
alter table envios_agendados enable row level security;
alter table webhook_eventos enable row level security;
-- conversas_wa, vinculos_wa e webhook_eventos: sem policy = só o servidor.

create policy qr_origens_admin on qr_origens for all to authenticated
  using (privado.is_admin()) with check (privado.is_admin());
create policy qr_scans_admin on qr_scans for select to authenticated using (privado.is_admin());

create policy contatos_ler on contatos_wa for select to authenticated
  using (profile_id = auth.uid() or privado.is_admin());

create policy mensagens_admin on mensagens_wa for select to authenticated using (privado.is_admin());

create policy campanhas_ler on campanhas for select to authenticated
  using (ativa or privado.is_admin());
create policy campanhas_admin on campanhas for all to authenticated
  using (privado.is_admin()) with check (privado.is_admin());

-- Mudanças em compromissos passam pelo servidor (precisam cancelar no Asaas também).
create policy compromissos_ler on compromissos for select to authenticated
  using (contato_id = privado.meu_contato() or privado.is_admin());

create policy contribuicoes_ler on contribuicoes for select to authenticated
  using (contato_id = privado.meu_contato() or privado.is_admin());

create policy envios_admin on envios_agendados for all to authenticated
  using (privado.is_admin()) with check (privado.is_admin());

-- ---------------------------------------------------------------------------
-- Painel: resumo do mês (só admin)
-- ---------------------------------------------------------------------------
create or replace function public.resumo_dizimo(mes date default current_date)
returns table (
  arrecadado_centavos bigint, liquido_centavos bigint, contribuicoes bigint,
  contribuintes bigint, recorrentes_ativos bigint, ticket_medio_centavos bigint)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  if not privado.is_admin() then
    raise exception 'acesso negado' using errcode = '42501';
  end if;
  return query
  with pagas as (
    select * from contribuicoes
    where status = 'paga'
      and paga_em >= date_trunc('month', mes)
      and paga_em <  date_trunc('month', mes) + interval '1 month'
  )
  select
    coalesce(sum(valor_centavos), 0)::bigint,
    coalesce(sum(liquido_centavos), 0)::bigint,
    count(*)::bigint,
    count(distinct contato_id)::bigint,
    (select count(*) from compromissos where status = 'ativo')::bigint,
    coalesce(avg(valor_centavos), 0)::bigint
  from pagas;
end $$;
revoke execute on function public.resumo_dizimo(date) from public, anon;
grant execute on function public.resumo_dizimo(date) to authenticated;

-- ---------------------------------------------------------------------------
-- Funções só do servidor (service role). Ficam em public para a API alcançar,
-- mas ninguém além do service_role pode executar.
-- ---------------------------------------------------------------------------

-- Conta o scan e devolve o texto pré-preenchido da conversa, com a origem (#LED).
create or replace function public.registrar_scan(p_codigo text)
returns text
language plpgsql security definer set search_path = public as $$
declare o qr_origens;
begin
  select * into o from qr_origens where codigo = upper(coalesce(p_codigo, '')) and ativo;
  if not found then
    select * into o from qr_origens where codigo = '';
  end if;
  update qr_origens set scans = scans + 1 where id = o.id;
  insert into qr_scans (origem_id) values (o.id);
  return o.texto_inicial || ' #' || coalesce(nullif(o.codigo, ''), 'GERAL');
end $$;

-- Chave de comparação de telefone brasileiro: DDD + 8 últimos dígitos.
-- O WhatsApp às vezes manda celular brasileiro sem o 9, e o cadastro do app tem
-- formato livre ("(85) 99999-0001", "085...", "+55..."). Nulo se não parecer telefone BR.
create or replace function privado.chave_telefone(t text) returns text
language sql immutable as $$
  select case when length(d) in (10, 11) then left(d, 2) || right(d, 8) end
  from (
    select case
      when d like '55%' and length(d) in (12, 13) then substr(d, 3)
      when d like '0%' then substr(d, 2)
      else d end as d
    from (select regexp_replace(coalesce(t, ''), '\D', '', 'g') as d) a
  ) b;
$$;

-- Acha o membro do app pelo telefone do WhatsApp. Só devolve se houver exatamente um.
create or replace function public.perfil_por_telefone(p_digitos text)
returns uuid
language sql stable security definer set search_path = public as $$
  with c as (
    select p.id from profiles p
    where privado.chave_telefone(p.telefone) = privado.chave_telefone(p_digitos)
  )
  select id from c where (select count(*) from c) = 1;
$$;

revoke execute on function public.registrar_scan(text) from public, anon, authenticated;
revoke execute on function public.perfil_por_telefone(text) from public, anon, authenticated;
grant execute on function public.registrar_scan(text) to service_role;
grant execute on function public.perfil_por_telefone(text) to service_role;
