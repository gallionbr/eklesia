// Webhook do WhatsApp (Meta Cloud API).
// GET: verificação ao cadastrar a URL no painel da Meta.
// POST: mensagens e status. Responde 200 na hora e processa depois (after),
// porque a Meta reenvia se demorar.

import { after, NextResponse } from "next/server";
import { env } from "@/lib/dizimo/servidor/env";
import { motorReal } from "@/lib/dizimo/servidor";
import { assinaturaValida, lerWebhook } from "@/lib/dizimo/servidor/whatsapp";
import { receberMensagem } from "@/lib/dizimo/motor";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  if (env.waVerifyToken && q.get("hub.mode") === "subscribe" && q.get("hub.verify_token") === env.waVerifyToken) {
    return new Response(q.get("hub.challenge") ?? "", { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return new Response("forbidden", { status: 403 });
}

export async function POST(req: Request) {
  const corpo = await req.text();
  if (!env.waAppSecret || !assinaturaValida(corpo, req.headers.get("x-hub-signature-256"), env.waAppSecret)) {
    return new Response("assinatura inválida", { status: 401 });
  }
  const d = motorReal();
  if (!d) {
    console.error("[dizimo] webhook do WhatsApp recebido, mas o módulo não está configurado");
    return new Response("não configurado", { status: 503 });
  }

  let payload: unknown;
  try { payload = JSON.parse(corpo); } catch { return new Response("json inválido", { status: 400 }); }
  const { mensagens, status } = lerWebhook(payload, env.waPhoneNumberId);

  after(async () => {
    for (const s of status) {
      await d.repo.atualizarStatusMensagem(s.waMessageId, s.status, s.erro).catch(() => {});
      if (s.erro) d.log?.("mensagem não entregue", s);
    }
    // Em ordem: duas mensagens seguidas da mesma pessoa não podem se atropelar.
    for (const m of mensagens) {
      try {
        await receberMensagem(d, m);
      } catch (e) {
        d.log?.("erro ao processar mensagem", { waMessageId: m.waMessageId, erro: (e as Error).message });
      }
    }
  });

  return NextResponse.json({ ok: true });
}
