-- Doações de dízimo/oferta pelo app levam os 45% como split no próprio checkout:
-- ficam no histórico do repasse como "separado no pagamento".
alter table repasses drop constraint if exists repasses_status_check;
alter table repasses add constraint repasses_status_check
  check (status in ('simulado', 'pendente', 'aguardando', 'transferido', 'no_pagamento', 'erro'));
