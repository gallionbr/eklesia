// Webhook do Asaas (cobranças). Confere o token, grava o evento e responde 200 rápido.
// Se o processamento falhar, responde 500 e o Asaas tenta de novo (o evento não fica "feito").

import { NextResponse } from "next/server";
import { env } from "@/lib/dizimo/servidor/env";
import { motorReal } from "@/lib/dizimo/servidor";
import { lerEventoAsaas, tokenValido } from "@/lib/dizimo/servidor/asaas";
import { receberPagamento } from "@/lib/dizimo/motor";
import { dbServico } from "@/lib/dizimo/servidor/rotas";
import { processarRepasse } from "@/lib/dizimo/servidor/repasse";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: Request) {
  if (!env.asaasWebhookToken || !tokenValido(req.headers.get("asaas-access-token"), env.asaasWebhookToken)) {
    return new Response("token inválido", { status: 401 });
  }
  const corpo = await req.json().catch(() => null);

  // Repasse automático (% de cada Pix recebido para a subconta). Independe do bot do WhatsApp.
  // Se falhar antes de reservar a cobrança, responde 500 para o Asaas reenviar o aviso.
  const db = dbServico();
  if (db) {
    try {
      const r = await processarRepasse(db, corpo);
      if (r.feito) console.log("repasse", JSON.stringify(r));
    } catch (e) {
      console.error("erro no repasse", (e as Error).message);
      return new Response("erro", { status: 500 });
    }
  }

  const d = motorReal();
  // Sem o WhatsApp configurado não há contribuições do bot para atualizar. Responder 200
  // evita que o Asaas conte falhas e pause a fila de avisos (pagamentos do Checkout de
  // Missões/Primícias também chegam aqui e são acompanhados pelo próprio Asaas).
  if (!d) return NextResponse.json({ ok: true, ignorado: "bot do WhatsApp ainda não configurado" });

  const ev = lerEventoAsaas(corpo);
  if (!ev) return NextResponse.json({ ok: true, ignorado: true });

  try {
    const r = await receberPagamento(d, ev);
    return NextResponse.json({ ok: true, resultado: r });
  } catch (e) {
    d.log?.("erro ao processar evento do Asaas", { evento: ev.eventoId, erro: (e as Error).message });
    return new Response("erro", { status: 500 });
  }
}
