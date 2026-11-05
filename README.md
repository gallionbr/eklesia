# Eklésia — app da igreja (PWA)

Next.js + Supabase. Instala pelo navegador (Adicionar à tela inicial).

## Funções
- **Início**: devocional do dia, atalhos, horários de culto, próximos eventos, avisos (fixados no topo).
- **Agenda**: eventos com inscrição e limite de vagas, botão "adicionar à agenda".
- **Células**: buscar e entrar numa célula; o líder vê os membros com telefone/WhatsApp.
- **Ofertas**: QR Code e Pix Copia e Cola (dízimo, oferta, missões), com ou sem valor.
- **Bíblia**: devocionais publicados pela igreja + leitor completo (Almeida, domínio público).
- **Oração**: pedidos no mural (com ou sem nome) ou só para a liderança; "Vou orar"; testemunho de resposta.
- **Painel admin**: resumo, avisos, agenda (lista de inscritos + planilha), devocionais, células, membros (papel, célula, planilha), pedidos, dados da igreja e Pix.

O **primeiro cadastro vira administrador**; os demais entram como membro.

## Configurar
1. Supabase → SQL Editor → rode `supabase/migrations/0001_eklesia.sql`.
2. `.env.local` (e na Vercel): `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. Supabase → Authentication → URL Configuration: Site URL `https://eklesia.international`, redirect `https://eklesia.international/**`.
4. (Opcional) Login com Google: Authentication → Providers → Google.
5. `npm install && npm run dev` · testes do Pix: `npm test`.

## Deploy
Vercel, domínio `eklesia.international` (registro A `76.76.21.21` ou os nameservers da Vercel).
