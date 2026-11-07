import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { assinaturaValida, corpoEnvio, lerWebhook } from "./whatsapp.ts";
import { dataLocal, lerEventoAsaas, tokenValido } from "./asaas.ts";

test("assinatura do webhook da Meta: aceita a certa, recusa corpo alterado e cabeçalho ausente", () => {
  const corpo = '{"object":"whatsapp_business_account"}';
  const sig = "sha256=" + createHmac("sha256", "segredo").update(corpo).digest("hex");
  assert.equal(assinaturaValida(corpo, sig, "segredo"), true);
  assert.equal(assinaturaValida(corpo + " ", sig, "segredo"), false);
  assert.equal(assinaturaValida(corpo, null, "segredo"), false);
  assert.equal(assinaturaValida(corpo, "sha256=abc", "segredo"), false);
});

test("lerWebhook: texto, botão tocado, status com erro e número de outra igreja", () => {
  const payload = {
    object: "whatsapp_business_account",
    entry: [{
      changes: [
        {
          field: "messages",
          value: {
            metadata: { phone_number_id: "PN1" },
            messages: [
              { from: "5585999990001", id: "wamid.1", type: "text", text: { body: "Quero contribuir #LED" } },
              { from: "5585999990001", id: "wamid.2", type: "interactive", interactive: { type: "button_reply", button_reply: { id: "forma:pix", title: "Pix" } } },
            ],
            statuses: [{ id: "wamid.out.1", status: "failed", errors: [{ code: 131047, title: "Re-engagement message" }] }],
          },
        },
        { field: "messages", value: { metadata: { phone_number_id: "OUTRO" }, messages: [{ from: "1", id: "x", type: "text", text: { body: "não é nosso" } }] } },
      ],
    }],
  };
  const r = lerWebhook(payload, "PN1");
  assert.equal(r.mensagens.length, 2);
  assert.deepEqual(r.mensagens[1], { waId: "5585999990001", waMessageId: "wamid.2", tipo: "interactive", texto: "Pix", botao: "forma:pix" });
  assert.deepEqual(r.status[0], { waMessageId: "wamid.out.1", status: "falhou", erro: "(#131047) Re-engagement message" });
  assert.deepEqual(lerWebhook({}, "PN1"), { mensagens: [], status: [] });
});

test("corpoEnvio: botões cortam título em 20 e no máximo 3; link vira cta_url", () => {
  const b = corpoEnvio("+5585999990001", { tipo: "botoes", texto: "Escolha", botoes: [
    { id: "a", titulo: "Um título grande demais aqui" }, { id: "b", titulo: "B" }, { id: "c", titulo: "C" }, { id: "d", titulo: "D" },
  ] }) as { to: string; interactive: { action: { buttons: { reply: { title: string } }[] } } };
  assert.equal(b.to, "5585999990001");
  assert.equal(b.interactive.action.buttons.length, 3);
  assert.equal(b.interactive.action.buttons[0].reply.title.length, 20);
  const l = corpoEnvio("+55", { tipo: "link", texto: "Pague", rotulo: "Pagar com cartão", url: "https://x" }) as { interactive: { type: string } };
  assert.equal(l.interactive.type, "cta_url");
});

test("webhook do Asaas: token, evento de cobrança e valores em centavos", () => {
  assert.equal(tokenValido("abc", "abc"), true);
  assert.equal(tokenValido("abd", "abc"), false);
  assert.equal(tokenValido(null, "abc"), false);
  const ev = lerEventoAsaas({ id: "evt_1", event: "PAYMENT_RECEIVED", payment: { id: "pay_1", value: 100.0, netValue: 99.01 } });
  assert.deepEqual(ev, { eventoId: "evt_1", evento: "PAYMENT_RECEIVED", cobrancaId: "pay_1", valor: 10000, liquido: 9901 });
  assert.equal(lerEventoAsaas({ event: "PAYMENT_RECEIVED", payment: { id: "pay_2" } })!.eventoId, "PAYMENT_RECEIVED:pay_2");
  assert.equal(lerEventoAsaas({ event: "TRANSFER_DONE", transfer: {} }), null);
});

test("vencimento do Pix é amanhã no fuso de Fortaleza, mesmo perto da meia-noite UTC", () => {
  // 23:30 em Fortaleza = 02:30 UTC do dia seguinte
  assert.equal(dataLocal(1, new Date("2026-11-08T02:30:00Z")), "2026-11-08");
});
