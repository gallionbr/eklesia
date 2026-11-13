// Inscrição paga em evento: cobrança no Asaas que vai inteira para a subconta da rede do evento
// (ou para a conta da Eklésia, se o evento não tiver rede). A inscrição fica "aguardando pagamento"
// e o webhook do Asaas confirma quando o Pix/cartão cair.

import { NextResponse } from "next/server";
import { usuarioDaRequisicao } from "@/lib/dizimo/servidor/rotas";
import { criarCobranca, garantirCliente, PrecisaDados } from "@/lib/dizimo/servidor/cobranca";

export const dynamic = "force-dynamic";

interface Ev { id: string; titulo: string; inicio: string; vagas: number | null; inscricao_aberta: boolean; valor_centavos: number; rede: string | null }

export async function POST(req: Request) {
  const a = await usuarioDaRequisicao(req);
  if (a instanceof NextResponse) return a;
  const b = (await req.json().catch(() => ({}))) as { eventoId?: string; forma?: string; nome?: string; cpf?: string };
  if (b.forma !== "pix" && b.forma !== "cartao") return NextResponse.json({ erro: "Escolha Pix ou cartão." }, { status: 400 });

  const { data } = await a.db.from("eventos").select("id, titulo, inicio, vagas, inscricao_aberta, valor_centavos, rede").eq("id", b.eventoId || "").maybeSingle();
  const ev = data as Ev | null;
  if (!ev || !ev.inscricao_aberta) return NextResponse.json({ erro: "Inscrições fechadas para este evento." }, { status: 400 });
  if (!ev.valor_centavos) return NextResponse.json({ erro: "Este evento é gratuito." }, { status: 400 });
  if (new Date(ev.inicio) < new Date()) return NextResponse.json({ erro: "Este evento já começou." }, { status: 400 });

  const { data: ja } = await a.db.from("inscricoes").select("status").match({ evento_id: ev.id, user_id: a.u.id }).maybeSingle();
  if ((ja as { status?: string } | null)?.status === "confirmada") return NextResponse.json({ erro: "Você já está inscrito." }, { status: 400 });
  if (ev.vagas != null) {
    const { count } = await a.db.from("inscricoes").select("*", { count: "exact", head: true }).eq("evento_id", ev.id).eq("status", "confirmada");
    if ((count || 0) >= ev.vagas) return NextResponse.json({ erro: "Vagas esgotadas." }, { status: 400 });
  }

  let split = null;
  if (ev.rede) {
    const { data: c } = await a.db.from("asaas_carteiras").select("wallet_id").eq("tipo", ev.rede).maybeSingle();
    const w = (c as { wallet_id?: string } | null)?.wallet_id;
    if (!w) return NextResponse.json({ erro: "A conta desta rede ainda não foi ligada ao app. Avise a liderança." }, { status: 503 });
    split = { walletId: w, percentual: 100 };
  }

  try {
    const customer = await garantirCliente(a.db, a.u, b);
    const r = await criarCobranca({
      customer, forma: b.forma, centavos: ev.valor_centavos, split,
      descricao: `Inscrição: ${ev.titulo}`.slice(0, 200), referencia: `insc:${ev.id}:${a.u.id}`,
    });
    const { error } = await a.db.from("inscricoes").upsert({
      evento_id: ev.id, user_id: a.u.id, status: "aguardando_pagamento", cobranca_id: r.id, valor_centavos: ev.valor_centavos,
    });
    if (error) throw new Error(error.message);
    return NextResponse.json(r);
  } catch (e) {
    if (e instanceof PrecisaDados) return NextResponse.json({ precisaDados: true, nome: e.nome, erro: e.message || undefined }, { status: e.message ? 400 : 409 });
    return NextResponse.json({ erro: `Não foi possível gerar o pagamento: ${(e as Error).message}` }, { status: 502 });
  }
}
