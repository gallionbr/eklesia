-- Última resposta boa de serviços externos (ex.: vídeos do YouTube), para quando eles falham.
-- Só o servidor (service role) lê e grava.
create table if not exists cache_json (
  chave text primary key,
  dados jsonb not null,
  atualizado_em timestamptz not null default now()
);
alter table cache_json enable row level security;
