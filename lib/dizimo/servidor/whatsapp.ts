// Cliente da WhatsApp Cloud API (Meta): enviar mensagens, validar e ler webhooks.

import { createHmac, timingSafeEqual } from "node:crypto";
import type { Saida } from "../bot.ts";
import type { Mensageiro, MensagemRecebida } from "../motor.ts";

/** Confere o X-Hub-Signature-256 (HMAC-SHA256 do corpo cru com o App Secret). */
export function assinaturaValida(corpoCru: string, cabecalho: string | null, appSecret: string): boolean {
  if (!cabecalho?.startsWith("sha256=")) return false;
  const esperado = Buffer.from("sha256=" + createHmac("sha256", appSecret).update(corpoCru, "utf8").digest("hex"));
  const recebido = Buffer.from(cabecalho);
  return esperado.length === recebido.length && timingSafeEqual(esperado, recebido);
}

const corta = (t: string, n: number) => (t.length > n ? t.slice(0, n - 1) + "…" : t);

/** Corpo da chamada POST /{phone-number-id}/messages para cada tipo de saída. */
export function corpoEnvio(para: string, s: Saida): Record<string, unknown> {
  const base = { messaging_product: "whatsapp", recipient_type: "individual", to: para.replace(/\D/g, "") };
  switch (s.tipo) {
    case "texto":
      return { ...base, type: "text", text: { body: corta(s.texto, 4096), preview_url: false } };
    case "botoes":
      return {
        ...base, type: "interactive",
        interactive: {
          type: "button",
          body: { text: corta(s.texto, 1024) },
          action: { buttons: s.botoes.slice(0, 3).map((b) => ({ type: "reply", reply: { id: b.id, title: corta(b.titulo, 20) } })) },
        },
      };
    case "link":
      return {
        ...base, type: "interactive",
        interactive: {
          type: "cta_url",
          body: { text: corta(s.texto, 1024) },
          action: { name: "cta_url", parameters: { display_text: corta(s.rotulo, 20), url: s.url } },
        },
      };
  }
}

export class WhatsCloud implements Mensageiro {
  private cfg: { phoneNumberId: string; token: string; versao: string };
  constructor(cfg: { phoneNumberId: string; token: string; versao: string }) { this.cfg = cfg; }

  async enviar(telefone: string, s: Saida): Promise<string> {
    const r = await fetch(`https://graph.facebook.com/${this.cfg.versao}/${this.cfg.phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.cfg.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(corpoEnvio(telefone, s)),
    });
    const j = (await r.json().catch(() => ({}))) as { messages?: { id: string }[]; error?: { code?: number; message?: string } };
    if (!r.ok || !j.messages?.[0]?.id) {
      throw new Error(`(#${j.error?.code ?? r.status}) ${j.error?.message ?? "falha ao enviar"}`);
    }
    return j.messages[0].id;
  }
}

// ── leitura do webhook

interface MsgMeta {
  from: string;
  id: string;
  type: string;
  text?: { body: string };
  button?: { text: string; payload?: string };
  interactive?: { type: string; button_reply?: { id: string; title: string }; list_reply?: { id: string; title: string } };
}
interface StatusMeta { id: string; status: string; errors?: { code: number; title?: string; message?: string }[] }

export interface WebhookLido {
  mensagens: MensagemRecebida[];
  status: { waMessageId: string; status: string; erro?: string }[];
}

const STATUS: Record<string, string> = { sent: "enviada", delivered: "entregue", read: "lida", failed: "falhou" };

/** Extrai mensagens e status do payload da Meta, ignorando o resto. */
export function lerWebhook(payload: unknown, phoneNumberId?: string): WebhookLido {
  const saida: WebhookLido = { mensagens: [], status: [] };
  const p = payload as { entry?: { changes?: { field?: string; value?: { metadata?: { phone_number_id?: string }; messages?: MsgMeta[]; statuses?: StatusMeta[] } }[] }[] };
  for (const entry of p?.entry ?? []) {
    for (const ch of entry.changes ?? []) {
      if (ch.field !== "messages" || !ch.value) continue;
      // Só o número da igreja (um app da Meta pode ter vários números).
      if (phoneNumberId && ch.value.metadata?.phone_number_id && ch.value.metadata.phone_number_id !== phoneNumberId) continue;
      for (const m of ch.value.messages ?? []) {
        const resp = m.interactive?.button_reply || m.interactive?.list_reply;
        saida.mensagens.push({
          waId: m.from,
          waMessageId: m.id,
          tipo: m.type === "button" ? "interactive" : m.type,
          texto: m.text?.body ?? resp?.title ?? m.button?.text ?? "",
          botao: resp?.id ?? m.button?.payload,
        });
      }
      for (const s of ch.value.statuses ?? []) {
        const e = s.errors?.[0];
        saida.status.push({ waMessageId: s.id, status: STATUS[s.status] ?? s.status, erro: e ? `(#${e.code}) ${e.message || e.title || ""}`.trim() : undefined });
      }
    }
  }
  return saida;
}
