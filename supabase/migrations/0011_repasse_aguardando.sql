-- Repasse com transferência criada mas esperando a aprovação do evento crítico no Asaas.
alter table repasses drop constraint if exists repasses_status_check;
alter table repasses add constraint repasses_status_check
  check (status in ('simulado', 'pendente', 'aguardando', 'transferido', 'erro'));
update repasses set status = 'aguardando' where status = 'transferido' and modo = 'ativo';
