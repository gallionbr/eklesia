-- Chave Pix para presentes (opcional, no perfil). Só é entregue no dia do aniversário.
alter table profiles add column if not exists pix_presente text check (char_length(pix_presente) <= 120);

drop function if exists public.aniversariantes_do_mes();
create function public.aniversariantes_do_mes()
returns table (id uuid, nome text, avatar_url text, dia int, tem_pix boolean)
language sql stable security definer set search_path = public
as $$
  select p.id, p.nome, p.avatar_url, extract(day from p.nascimento)::int as dia,
         coalesce(trim(p.pix_presente), '') <> '' as tem_pix
  from profiles p
  where auth.uid() is not null
    and p.nascimento is not null
    and extract(month from p.nascimento) = extract(month from (now() at time zone 'America/Fortaleza'))
  order by dia, p.nome;
$$;
revoke all on function public.aniversariantes_do_mes() from public, anon;
grant execute on function public.aniversariantes_do_mes() to authenticated;

create or replace function public.pix_do_aniversariante(alvo uuid)
returns text
language sql stable security definer set search_path = public
as $$
  select nullif(trim(p.pix_presente), '')
  from profiles p
  where auth.uid() is not null
    and p.id = alvo
    and p.nascimento is not null
    and extract(month from p.nascimento) = extract(month from (now() at time zone 'America/Fortaleza'))
    and extract(day from p.nascimento) = extract(day from (now() at time zone 'America/Fortaleza'));
$$;
revoke all on function public.pix_do_aniversariante(uuid) from public, anon;
grant execute on function public.pix_do_aniversariante(uuid) to authenticated;
