# Eklésia — app da igreja (PWA)

Next.js + Supabase. Instala pelo navegador (Adicionar à tela inicial).

## Funções
- **Início**: devocional do dia, atalhos, horários de culto, próximos eventos, avisos (fixados no topo).
- **Agenda**: eventos com inscrição e limite de vagas, botão "adicionar à agenda".
- **Células**: buscar e entrar numa célula; o líder vê os membros com telefone/WhatsApp.
- **Ofertas**: QR Code e Pix Copia e Cola (dízimo, oferta, missões), com ou sem valor.
- **Bíblia**: devocionais publicados pela igreja + leitor completo (Almeida, domínio público).
- **Oração**: pedidos no mural (com ou sem nome) ou só para a liderança; "Vou orar"; testemunho de resposta.
- **Dízimo pelo WhatsApp** (opcional): QR Code (painel de LED, telão, cartaz) abre o WhatsApp da igreja; o bot cadastra, gera Pix ou link de cartão (Asaas) e manda o comprovante. Contribuições aparecem em Ofertas e no painel.
- **Painel admin**: resumo, dízimo (resumo do mês, contribuições, QR Codes para o painel de LED), avisos, agenda (lista de inscritos + planilha), devocionais, células, membros (papel, célula, planilha), pedidos, dados da igreja e Pix.

O **primeiro cadastro vira administrador**; os demais entram como membro.

## Configurar
1. Supabase → SQL Editor → rode `supabase/migrations/0001_eklesia.sql`.
2. `.env.local` (e na Vercel): `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. Supabase → Authentication → URL Configuration: Site URL `https://eklesia.international`, redirect `https://eklesia.international/**`.
4. (Opcional) Login com Google: Authentication → Providers → Google.
5. `npm install && npm run dev` · testes do Pix: `npm test`.

## Dízimo pelo WhatsApp

Como funciona: o QR aponta para `HTTPS://EKLESIA.INTERNATIONAL/D/LED` (curto e em maiúsculas, o QR fica 25×25 e lê de mais longe). A rota conta o scan e redireciona para `wa.me/<igreja>` com "Quero contribuir #LED". O bot responde pelo webhook da Meta; o Asaas avisa quando o pagamento cai e o bot manda o comprovante.

1. Rode `supabase/migrations/0007_dizimo_whatsapp.sql`.
2. **Asaas** (conta no CNPJ da igreja; comece pelo sandbox): gere a chave de API. Em Integrações → Webhooks, cadastre `https://eklesia.international/api/asaas/webhook` com o token de autenticação = `ASAAS_WEBHOOK_TOKEN` e os eventos de **Cobranças**.
3. **Meta**: crie um app em developers.facebook.com com o produto WhatsApp, ligue o número da igreja e verifique a empresa. Em WhatsApp → Configuration, webhook `https://eklesia.international/api/whatsapp/webhook`, verify token = `WA_VERIFY_TOKEN`, assine o campo **messages**.
4. Preencha as variáveis do `.env.example` na Vercel e faça um novo deploy. `NEXT_PUBLIC_DIZIMO_WHATSAPP=1` liga o cartão em Ofertas.
5. Painel → Dízimo → QR Codes: informe a largura do painel em LEDs e baixe o PNG em pixel exato (ou o SVG para a gráfica).

Testes: `npm test` (bot, motor ponta a ponta com WhatsApp e Asaas falsos, leitura dos webhooks).

## Deploy
Vercel, domínio `eklesia.international` (registro A `76.76.21.21` ou os nameservers da Vercel).
