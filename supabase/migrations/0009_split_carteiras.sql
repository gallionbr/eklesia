-- Split de pagamento: carteira do Asaas (subconta) que recebe Missões e Primícias.
-- Só a tesouraria (admin/tesoureiro) lê; quem grava é o servidor (service role).
create table if not exists asaas_carteiras (
  tipo text primary key check (tipo in ('missoes', 'primicias')),
  wallet_id text not null check (wallet_id ~ '^[0-9a-fA-F-]{36}$'),
  conta_id text,
  titular text not null default '' check (char_length(titular) <= 120),
  percentual numeric(7,4) not null default 100 check (percentual > 0 and percentual <= 100),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create trigger asaas_carteiras_tocar before update on asaas_carteiras
  for each row execute function privado.tocar_atualizado();
alter table asaas_carteiras enable row level security;
create policy carteiras_financeiro on asaas_carteiras for select to authenticated using (privado.ve_financeiro());

-- Para a tela Ofertas saber quais tipos já têm split (sem expor a carteira).
create or replace function public.tipos_com_split() returns text[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(tipo order by tipo), '{}') from asaas_carteiras where auth.uid() is not null;
$$;
revoke execute on function public.tipos_com_split() from public, anon;
grant execute on function public.tipos_com_split() to authenticated;

-- Primícias como tipo de contribuição.
alter table contribuicoes drop constraint if exists contribuicoes_tipo_check;
alter table contribuicoes add constraint contribuicoes_tipo_check
  check (tipo in ('dizimo', 'oferta', 'missoes', 'primicias', 'campanha'));
alter table compromissos drop constraint if exists compromissos_tipo_check;
alter table compromissos add constraint compromissos_tipo_check
  check (tipo in ('dizimo', 'oferta', 'missoes', 'primicias'));
