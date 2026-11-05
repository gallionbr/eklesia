-- Funções internas fora da API pública; lista de líderes só para membros logados.
create schema if not exists privado;
grant usage on schema privado to authenticated;

alter function public.is_admin() set schema privado;
alter function public.lidera_celula(uuid) set schema privado;
alter function public.handle_new_user() set schema privado;
alter function public.proteger_papel() set schema privado;
alter function public.checar_vagas() set schema privado;

alter function privado.is_admin() set search_path = public, privado;
alter function privado.proteger_papel() set search_path = public, privado;

revoke execute on all functions in schema privado from public, anon;
grant execute on function privado.is_admin() to authenticated;
grant execute on function privado.lidera_celula(uuid) to authenticated;

drop view public.lideres;
create function public.lideres() returns table (id uuid, nome text)
language sql stable security definer set search_path = public as $$
  select p.id, p.nome from profiles p where p.papel in ('lider', 'admin') and auth.uid() is not null;
$$;
revoke execute on function public.lideres() from public, anon;
grant execute on function public.lideres() to authenticated;
revoke execute on function public.inscritos_por_evento() from public, anon;
revoke execute on function public.oracoes_por_pedido() from public, anon;
