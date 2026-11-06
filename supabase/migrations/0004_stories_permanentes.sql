-- Stories ficam no ar até um admin apagar (não expiram mais em 24h).
alter table stories alter column expira_em drop not null;
alter table stories alter column expira_em drop default;
update stories set expira_em = null;

drop policy if exists stories_ler on stories;
create policy stories_ler on stories for select to authenticated
  using (expira_em is null or expira_em > now() or privado.is_admin());

drop policy if exists stories_apagar on stories;
create policy stories_apagar on stories for delete to authenticated using (privado.is_admin());
