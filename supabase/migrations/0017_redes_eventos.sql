-- Redes (Rosa, Azul, Santa, Família) com subconta própria no Asaas, banner dos eventos
-- e inscrição paga direto pelo app.

-- 1) Subcontas das redes
alter table asaas_carteiras drop constraint if exists asaas_carteiras_tipo_check;
alter table asaas_carteiras add constraint asaas_carteiras_tipo_check
  check (tipo in ('missoes', 'primicias', 'rede_rosa', 'rede_azul', 'rede_santa', 'rede_familia'));

-- 2) Eventos: banner (1080x1350), rede responsável e valor da inscrição
alter table eventos add column if not exists banner_url text;
alter table eventos add column if not exists rede text
  check (rede in ('rede_rosa', 'rede_azul', 'rede_santa', 'rede_familia'));
alter table eventos add column if not exists valor_centavos integer not null default 0
  check (valor_centavos = 0 or valor_centavos >= 500);

-- 3) Inscrições: situação do pagamento
alter table inscricoes add column if not exists status text not null default 'confirmada'
  check (status in ('confirmada', 'aguardando_pagamento', 'cancelada'));
alter table inscricoes add column if not exists cobranca_id text;
alter table inscricoes add column if not exists valor_centavos integer not null default 0;
alter table inscricoes add column if not exists pago_em timestamptz;

-- Membro só se inscreve sozinho em evento gratuito; inscrição paga é criada pelo servidor.
drop policy if exists inscricoes_criar on inscricoes;
create policy inscricoes_criar on inscricoes for insert to authenticated
  with check (
    user_id = auth.uid() and status = 'confirmada' and valor_centavos = 0
    and exists (select 1 from eventos e where e.id = evento_id and e.inscricao_aberta and e.valor_centavos = 0)
  );

-- Contagem pública só das inscrições confirmadas
create or replace function public.inscritos_por_evento()
returns table (evento_id uuid, total bigint)
language sql stable security definer set search_path = public
as $$ select i.evento_id, count(*) from inscricoes i where i.status = 'confirmada' group by i.evento_id $$;
