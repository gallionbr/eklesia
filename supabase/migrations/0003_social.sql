-- Eklésia — feed e stories estilo Instagram. Só a liderança (líder/admin) publica.

alter table profiles add column if not exists avatar_url text;
alter table config
  add column if not exists bio text,
  add column if not exists ao_vivo boolean not null default false,
  add column if not exists ao_vivo_url text;

create or replace function privado.is_lider() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and papel in ('lider', 'admin'));
$$;
revoke execute on function privado.is_lider() from public, anon;
grant execute on function privado.is_lider() to authenticated;

-- Posts do feed. midias = [{url, tipo: 'imagem'|'video', w, h}]
create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  autor_id uuid not null default auth.uid() references profiles(id) on delete cascade,
  como_igreja boolean not null default false,
  legenda text not null default '' check (char_length(legenda) <= 2200),
  midias jsonb not null default '[]'::jsonb,
  criado_em timestamptz not null default now()
);
create index if not exists posts_criado_idx on posts(criado_em desc);
create index if not exists posts_autor_idx on posts(autor_id);

create table if not exists post_amens (
  post_id uuid not null references posts(id) on delete cascade,
  user_id uuid not null default auth.uid() references profiles(id) on delete cascade,
  criado_em timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index if not exists post_amens_user_idx on post_amens(user_id);

create table if not exists post_comentarios (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  user_id uuid not null default auth.uid() references profiles(id) on delete cascade,
  texto text not null check (char_length(texto) between 1 and 1000),
  criado_em timestamptz not null default now()
);
create index if not exists post_coment_post_idx on post_comentarios(post_id, criado_em);
create index if not exists post_coment_user_idx on post_comentarios(user_id);

-- Stories: somem depois de 24h. celula_id nulo = story da igreja.
create table if not exists stories (
  id uuid primary key default gen_random_uuid(),
  autor_id uuid not null default auth.uid() references profiles(id) on delete cascade,
  celula_id uuid references celulas(id) on delete cascade,
  tipo text not null check (tipo in ('imagem', 'video', 'texto')),
  midia_url text,
  texto text check (char_length(texto) <= 500),
  cor text,
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null default now() + interval '24 hours'
);
create index if not exists stories_expira_idx on stories(expira_em);
create index if not exists stories_autor_idx on stories(autor_id);
create index if not exists stories_celula_idx on stories(celula_id);

alter table posts enable row level security;
alter table post_amens enable row level security;
alter table post_comentarios enable row level security;
alter table stories enable row level security;

create policy posts_ler on posts for select to authenticated using (true);
create policy posts_criar on posts for insert to authenticated
  with check (autor_id = auth.uid() and privado.is_lider() and (not como_igreja or privado.is_admin()));
create policy posts_editar on posts for update to authenticated
  using (autor_id = auth.uid() or privado.is_admin())
  with check (not como_igreja or privado.is_admin());
create policy posts_apagar on posts for delete to authenticated using (autor_id = auth.uid() or privado.is_admin());

create policy amens_ler on post_amens for select to authenticated using (true);
create policy amens_criar on post_amens for insert to authenticated with check (user_id = auth.uid());
create policy amens_apagar on post_amens for delete to authenticated using (user_id = auth.uid());

create policy coment_ler on post_comentarios for select to authenticated using (true);
create policy coment_criar on post_comentarios for insert to authenticated with check (user_id = auth.uid());
create policy coment_apagar on post_comentarios for delete to authenticated using (
  user_id = auth.uid() or privado.is_admin()
  or exists (select 1 from posts p where p.id = post_id and p.autor_id = auth.uid())
);

create policy stories_ler on stories for select to authenticated
  using (expira_em > now() or autor_id = auth.uid() or privado.is_admin());
create policy stories_criar on stories for insert to authenticated
  with check (autor_id = auth.uid() and privado.is_lider()
    and (celula_id is null or privado.is_admin() or privado.lidera_celula(celula_id)));
create policy stories_apagar on stories for delete to authenticated using (autor_id = auth.uid() or privado.is_admin());

-- Nome e foto de quem publica/comenta (sem expor o resto do perfil)
create or replace function public.perfis_publicos(ids uuid[])
returns table (id uuid, nome text, avatar_url text, papel papel)
language sql stable security definer set search_path = public as $$
  select p.id, p.nome, p.avatar_url, p.papel from profiles p
  where p.id = any(ids) and auth.uid() is not null;
$$;

-- Améns e comentários por post, e se eu disse amém
create or replace function public.contagens_posts(ids uuid[])
returns table (post_id uuid, amens bigint, comentarios bigint, meu_amem boolean)
language sql stable security definer set search_path = public as $$
  select p.id,
    (select count(*) from post_amens a where a.post_id = p.id),
    (select count(*) from post_comentarios c where c.post_id = p.id),
    exists (select 1 from post_amens a where a.post_id = p.id and a.user_id = auth.uid())
  from posts p where p.id = any(ids) and auth.uid() is not null;
$$;

-- Números do perfil da igreja
create or replace function public.estatisticas_igreja()
returns table (membros bigint, celulas bigint, posts bigint)
language sql stable security definer set search_path = public as $$
  select (select count(*) from profiles), (select count(*) from celulas where ativa), (select count(*) from posts)
  where auth.uid() is not null;
$$;

revoke execute on function public.perfis_publicos(uuid[]) from public, anon;
revoke execute on function public.contagens_posts(uuid[]) from public, anon;
revoke execute on function public.estatisticas_igreja() from public, anon;
grant execute on function public.perfis_publicos(uuid[]) to authenticated;
grant execute on function public.contagens_posts(uuid[]) to authenticated;
grant execute on function public.estatisticas_igreja() to authenticated;

-- Fotos e vídeos (público para leitura; até 50 MB por arquivo)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('midia', 'midia', true, 52428800,
  array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm'])
on conflict (id) do nothing;

create policy midia_enviar on storage.objects for insert to authenticated with check (
  bucket_id = 'midia' and (
    (privado.is_lider() and (storage.foldername(name))[1] in ('posts', 'stories'))
    or ((storage.foldername(name))[1] = 'avatars' and (storage.foldername(name))[2] = auth.uid()::text)
  )
);
create policy midia_apagar on storage.objects for delete to authenticated using (
  bucket_id = 'midia' and (owner_id = auth.uid()::text or privado.is_admin())
);
