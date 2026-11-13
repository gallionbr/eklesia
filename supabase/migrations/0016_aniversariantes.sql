-- Mural de aniversariantes do mês: só nome, foto e dia (nunca o ano nem a idade).
create or replace function public.aniversariantes_do_mes()
returns table (id uuid, nome text, avatar_url text, dia int)
language sql stable security definer set search_path = public
as $$
  select p.id, p.nome, p.avatar_url, extract(day from p.nascimento)::int as dia
  from profiles p
  where auth.uid() is not null
    and p.nascimento is not null
    and extract(month from p.nascimento) = extract(month from (now() at time zone 'America/Fortaleza'))
  order by dia, p.nome;
$$;
revoke all on function public.aniversariantes_do_mes() from public, anon;
grant execute on function public.aniversariantes_do_mes() to authenticated;
