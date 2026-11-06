-- Fotos de capa dos cards do menu (igreja, celulas, agenda, oracao, ofertas)
alter table config add column if not exists capas jsonb not null default '{}'::jsonb;
