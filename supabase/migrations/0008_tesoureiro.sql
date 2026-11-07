-- Eklésia — papel "tesoureiro": vê as contribuições (Painel → Dízimo) sem ser administrador.
-- Não publica no feed, não mexe em membros, avisos, agenda nem configurações.
--
-- As comparações usam papel::text para poder rodar no mesmo script que cria o valor
-- novo do enum (o Postgres não deixa usar um valor de enum recém-criado como literal
-- na mesma transação).

alter type papel add value if not exists 'tesoureiro';

-- Quem vê o financeiro: administradores e tesoureiros.
create or replace function privado.ve_financeiro() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and papel::text in ('admin', 'tesoureiro'));
$$;
revoke execute on function privado.ve_financeiro() from public, anon;
grant execute on function privado.ve_financeiro() to authenticated;

-- Leitura do financeiro passa a valer para tesoureiros também.
drop policy if exists contatos_ler on contatos_wa;
create policy contatos_ler on contatos_wa for select to authenticated
  using (profile_id = auth.uid() or privado.ve_financeiro());

drop policy if exists compromissos_ler on compromissos;
create policy compromissos_ler on compromissos for select to authenticated
  using (contato_id = privado.meu_contato() or privado.ve_financeiro());

drop policy if exists contribuicoes_ler on contribuicoes;
create policy contribuicoes_ler on contribuicoes for select to authenticated
  using (contato_id = privado.meu_contato() or privado.ve_financeiro());

-- Tesoureiro vê de onde vieram (nomes dos QR) e as campanhas; criar/editar segue só admin.
create policy qr_origens_financeiro on qr_origens for select to authenticated using (privado.ve_financeiro());

-- Resumo do mês: admin e tesoureiro.
create or replace function public.resumo_dizimo(mes date default current_date)
returns table (
  arrecadado_centavos bigint, liquido_centavos bigint, contribuicoes bigint,
  contribuintes bigint, recorrentes_ativos bigint, ticket_medio_centavos bigint)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  if not privado.ve_financeiro() then
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

-- Total por pessoa no ano (contribuições recebidas), para a tesouraria e o informe anual.
create or replace function public.totais_por_pessoa(ano int default extract(year from now())::int)
returns table (
  contato_id uuid, nome text, membro_app boolean, contribuicoes bigint,
  total_centavos bigint, dizimo_centavos bigint, ofertas_centavos bigint, ultima timestamptz)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  if not privado.ve_financeiro() then
    raise exception 'acesso negado' using errcode = '42501';
  end if;
  return query
  select c.id, coalesce(c.nome, c.telefone), c.profile_id is not null,
    count(*)::bigint,
    sum(x.valor_centavos)::bigint,
    coalesce(sum(x.valor_centavos) filter (where x.tipo = 'dizimo'), 0)::bigint,
    coalesce(sum(x.valor_centavos) filter (where x.tipo <> 'dizimo'), 0)::bigint,
    max(x.paga_em)
  from contribuicoes x
  join contatos_wa c on c.id = x.contato_id
  where x.status = 'paga'
    and x.paga_em >= make_timestamptz(ano, 1, 1, 0, 0, 0, 'America/Fortaleza')
    and x.paga_em <  make_timestamptz(ano + 1, 1, 1, 0, 0, 0, 'America/Fortaleza')
  group by c.id
  order by 5 desc;
end $$;
revoke execute on function public.totais_por_pessoa(int) from public, anon;
grant execute on function public.totais_por_pessoa(int) to authenticated;
