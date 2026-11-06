-- Link do Google Maps da igreja (endereço e 'Como chegar')
alter table config add column if not exists maps_url text;
