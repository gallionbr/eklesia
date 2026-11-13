-- Repasse por Pix para contas fora do Asaas (Redes e Missões).
-- Cada pagamento do app traz na referência para quem é (app:rede_rosa:…, insc:<evento>:…);
-- quando ele cai, o app transfere o valor líquido para a chave Pix daquele destino.

create table if not exists destinos_pix (
  tipo text primary key check (tipo in ('missoes', 'primicias', 'rede_rosa', 'rede_azul', 'rede_santa', 'rede_familia')),
  chave text not null check (char_length(chave) between 5 and 120),
  tipo_chave text not null default 'EMAIL' check (tipo_chave in ('EMAIL', 'CPF', 'CNPJ', 'PHONE', 'EVP')),
  ativo boolean not null default true,
  atualizado_em timestamptz not null default now()
);
create trigger destinos_pix_tocar before update on destinos_pix
  for each row execute function privado.tocar_atualizado();
alter table destinos_pix enable row level security;
create policy destinos_pix_financeiro on destinos_pix for select to authenticated using (privado.ve_financeiro());

insert into destinos_pix (tipo, chave) values
  ('rede_santa', 'redesanta@eklesia.international'),
  ('rede_rosa', 'rederosabrasil@eklesia.international'),
  ('rede_azul', 'redeazul@eklesia.international'),
  ('missoes', 'missoes@eklesia.international')
on conflict (tipo) do update set chave = excluded.chave, ativo = true;

alter table repasses add column if not exists chave_pix text;

-- Propósitos disponíveis no app: subconta Asaas OU chave Pix ativa.
create or replace function public.tipos_com_split() returns text[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(distinct t order by t), '{}') from (
    select tipo as t from asaas_carteiras
    union select tipo from destinos_pix where ativo
  ) x where auth.uid() is not null;
$$;
revoke execute on function public.tipos_com_split() from public, anon;
grant execute on function public.tipos_com_split() to authenticated;
