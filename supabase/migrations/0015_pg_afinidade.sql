-- Pequenos Grupos (PGs): para quem é cada grupo.
alter table celulas add column if not exists afinidade text not null default 'todos'
  check (afinidade in ('todos', 'homens', 'mulheres', 'criancas', 'casais', 'estudantes'));
