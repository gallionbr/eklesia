-- Cada destino do repasse (Redes e Missões) tem o próprio modo: desligado, simulação ou ligado.
-- Primícias continua usando repasse_regra.modo.
alter table destinos_pix add column if not exists modo text not null default 'ativo'
  check (modo in ('desligado', 'simulacao', 'ativo'));
create index if not exists repasses_destino_criado on repasses (destino, criado_em desc);
