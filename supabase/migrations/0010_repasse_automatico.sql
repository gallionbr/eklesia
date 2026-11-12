-- Repasse automático: a cada Pix recebido na conta da igreja, transfere uma porcentagem
-- do valor bruto para uma subconta (hoje: 45% para Primícias). Quem grava é o servidor
-- (service role) a partir do webhook do Asaas; a tesouraria só lê.

-- Regra (uma linha só). modo: desligado | simulacao (só registra) | ativo (transfere).
create table if not exists repasse_regra (
  id boolean primary key default true check (id),
  modo text not null default 'simulacao' check (modo in ('desligado', 'simulacao', 'ativo')),
  percentual numeric(7,4) not null default 45 check (percentual > 0 and percentual < 100),
  destino text not null default 'primicias' references asaas_carteiras(tipo) on delete restrict,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references auth.users(id) on delete set null
);
create trigger repasse_regra_tocar before update on repasse_regra
  for each row execute function privado.tocar_atualizado();
alter table repasse_regra enable row level security;
create policy repasse_regra_financeiro on repasse_regra for select to authenticated using (privado.ve_financeiro());

insert into repasse_regra (id) select true where exists (select 1 from asaas_carteiras where tipo = 'primicias')
on conflict do nothing;

-- Um registro por cobrança Pix recebida (a chave impede repassar o mesmo Pix duas vezes).
create table if not exists repasses (
  cobranca_id text primary key,
  bruto_centavos bigint not null check (bruto_centavos > 0),
  repasse_centavos bigint not null check (repasse_centavos >= 0),
  percentual numeric(7,4) not null,
  destino text not null,
  wallet_id text not null,
  modo text not null check (modo in ('simulacao', 'ativo')),
  status text not null check (status in ('simulado', 'pendente', 'transferido', 'erro')),
  transferencia_id text,
  erro text,
  descricao text,
  pago_em date,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists repasses_criado_idx on repasses (criado_em desc);
create trigger repasses_tocar before update on repasses
  for each row execute function privado.tocar_atualizado();
alter table repasses enable row level security;
create policy repasses_financeiro on repasses for select to authenticated using (privado.ve_financeiro());
