// Webhook do Asaas (cobranças). Confere o token, grava o evento e responde 200 rápido.
// Se o processamento falhar, responde 500 e o Asaas tenta de novo (o evento não fica "feito").

import { NextResponse } from "next/server";
import { env } from "@/lib/dizimo/servidor/env";
import { motorReal } from "@/lib/dizimo/servidor";
import { lerEventoAsaas, tokenValido } from "@/lib/dizimo/servidor/asaas";
import { receberPagamento } from "@/lib/dizimo/motor";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: Request) {
  if (!env.asaasWebhookToken || !tokenValido(req.headers.get("asaas-access-token"), env.asaasWebhookToken)) {
    return new Response("token inválido", { status: 401 });
  }
  const d = motorReal();
  if (!d) return new Response("não configurado", { status: 503 });

  const ev = lerEventoAsaas(await req.json().catch(() => null));
  if (!ev) return NextResponse.json({ ok: true, ignorado: true });

  try {
    const r = await receberPagamento(d, ev);
    return NextResponse.json({ ok: true, resultado: r });
  } catch (e) {
    d.log?.("erro ao processar evento do Asaas", { evento: ev.eventoId, erro: (e as Error).message });
    return new Response("erro", { status: 500 });
  }
}
