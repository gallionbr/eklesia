-- Cliente do Asaas de cada membro (para doar só com nome e CPF uma vez).
-- O CPF não é guardado no app: fica só no Asaas. Só o servidor (service role) lê e grava.
create table if not exists asaas_clientes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  customer_id text not null,
  nome text not null default '',
  criado_em timestamptz not null default now()
);
alter table asaas_clientes enable row level security;
