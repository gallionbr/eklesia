// Painel → Dízimo → Repasse automático. Só administradores.
// GET:  ?destino=primicias|rede_rosa|… modo de cada destino, últimos repasses e totais do mês daquele destino.
// POST: { acao: "modo", destino, modo: "desligado" | "simulacao" | "ativo" }
//       { acao: "refazer", cobrancaId } tenta de novo um repasse que deu erro.

import { NextResponse } from "next/server";
import { TIPOS_CONTA, type TipoConta } from "@/lib/contas";
import { chamarAsaas, usuarioDaRequisicao } from "@/lib/dizimo/servidor/rotas";
import { refazerRepasse, registrarSplitNoPagamento } from "@/lib/dizimo/servidor/repasse";

export const dynamic = "force-dynamic";

const MODOS = ["desligado", "simulacao", "ativo"] as const;

export async function GET(req: Request) {
  const a = await usuarioDaRequisicao(req, "admin");
  if (a instanceof NextResponse) return a;
  // Confere no Asaas os repasses que esperavam aprovação (caso algum aviso tenha se perdido).
  const { data: esperando } = await a.db.from("repasses").select("cobranca_id, transferencia_id")
    .eq("status", "aguardando").not("transferencia_id", "is", null).limit(20);
  await Promise.all(((esperando || []) as { cobranca_id: string; transferencia_id: string }[]).map(async (r) => {
    try {
      const t = await chamarAsaas<{ status?: string; failReason?: string | null }>("GET", `/transfers/${r.transferencia_id}`);
      const novo = t.status === "DONE" ? { status: "transferido", erro: null }
        : t.status === "CANCELLED" ? { status: "erro", erro: "Transferência cancelada no Asaas" }
        : t.status === "FAILED" ? { status: "erro", erro: t.failReason || "Transferência falhou no Asaas" }
        : null;
      if (novo) await a.db.from("repasses").update(novo).eq("cobranca_id", r.cobranca_id);
    } catch { /* fica como está; tenta de novo na próxima abertura */ }
  }));

  // Doações do app com os 45% no pagamento cujo aviso tenha se perdido: busca no Asaas (últimos 10 dias).
  try {
    const desde = new Date(Date.now() - 10 * 86400e3).toLocaleDateString("en-CA", { timeZone: "America/Fortaleza" });
    const [rec, conf] = await Promise.all(["RECEIVED", "CONFIRMED"].map((st) =>
      chamarAsaas<{ data: { id: string; value: number; externalReference?: string | null; description?: string; paymentDate?: string }[] }>(
        "GET", `/payments?status=${st}&paymentDate[ge]=${desde}&limit=100`)));
    const comSplit = [...rec.data, ...conf.data].filter((p) => p.externalReference?.endsWith(":split"));
    if (comSplit.length) {
      const { data: ja } = await a.db.from("repasses").select("cobranca_id").in("cobranca_id", comSplit.map((p) => p.id));
      const tem = new Set(((ja || []) as { cobranca_id: string }[]).map((x) => x.cobranca_id));
      for (const p of comSplit.filter((p) => !tem.has(p.id))) await registrarSplitNoPagamento(a.db, p);
    }
  } catch { /* sem Asaas agora: segue com o que já está registrado */ }

  const pedido = new URL(req.url).searchParams.get("destino") || "primicias";
  const destino = (TIPOS_CONTA as string[]).includes(pedido) ? pedido : "primicias";
  const inicioMes = new Date().toLocaleDateString("en-CA", { timeZone: "America/Fortaleza" }).slice(0, 8) + "01";
  const [regra, pixR, cartR, ultimos, mes] = await Promise.all([
    a.db.from("repasse_regra").select("modo, percentual, destino, atualizado_em").maybeSingle(),
    a.db.from("destinos_pix").select("tipo, chave, ativo, modo"),
    a.db.from("asaas_carteiras").select("tipo"),
    a.db.from("repasses").select("cobranca_id, bruto_centavos, repasse_centavos, modo, status, erro, descricao, pago_em, criado_em, destino, chave_pix")
      .eq("destino", destino).order("criado_em", { ascending: false }).limit(30),
    a.db.from("repasses").select("bruto_centavos, repasse_centavos, status").eq("destino", destino).gte("criado_em", `${inicioMes}T03:00:00Z`),
  ]);
  if (regra.error || pixR.error || ultimos.error || mes.error) {
    return NextResponse.json({ erro: (regra.error || pixR.error || ultimos.error || mes.error)!.message }, { status: 500 });
  }
  const pix = (pixR.data || []) as { tipo: string; chave: string; ativo: boolean; modo: string }[];
  const carteiras = new Set(((cartR.data || []) as { tipo: string }[]).map((c) => c.tipo));
  // Como cada destino recebe: split no Asaas (subconta), Pix para a chave, ou ainda nada.
  const destinos = TIPOS_CONTA.map((t) => {
    if (t === "primicias") return { tipo: t, modo: (regra.data as { modo?: string } | null)?.modo || "desligado", via: carteiras.has(t) ? "subconta" : "nenhum" };
    if (carteiras.has(t)) return { tipo: t, modo: "ativo", via: "subconta" };
    const p = pix.find((x) => x.tipo === t && x.ativo);
    return p ? { tipo: t, modo: p.modo || "ativo", via: "pix", chave: p.chave } : { tipo: t, modo: "desligado", via: "nenhum" };
  });
  const linhas = (mes.data || []) as { bruto_centavos: number; repasse_centavos: number; status: string }[];
  const soma = (f: (l: (typeof linhas)[number]) => boolean, k: "bruto_centavos" | "repasse_centavos") =>
    linhas.filter(f).reduce((t, l) => t + Number(l[k]), 0);
  return NextResponse.json({
    regra: regra.data,
    destino,
    destinos,
    ultimos: ultimos.data,
    mes: {
      pix: linhas.length,
      bruto: soma(() => true, "bruto_centavos"),
      transferido: soma((l) => l.status === "transferido" || l.status === "no_pagamento", "repasse_centavos"),
      simulado: soma((l) => l.status === "simulado", "repasse_centavos"),
      aguardando: soma((l) => l.status === "aguardando" || l.status === "pendente", "repasse_centavos"),
      comErro: linhas.filter((l) => l.status === "erro").length,
    },
  });
}

export async function POST(req: Request) {
  const a = await usuarioDaRequisicao(req, "admin");
  if (a instanceof NextResponse) return a;
  const b = (await req.json().catch(() => ({}))) as { acao?: string; modo?: string; cobrancaId?: string; destino?: string };

  if (b.acao === "modo") {
    if (!MODOS.includes(b.modo as (typeof MODOS)[number])) return NextResponse.json({ erro: "Modo inválido." }, { status: 400 });
    const destino = (b.destino || "primicias") as TipoConta;
    if (!TIPOS_CONTA.includes(destino)) return NextResponse.json({ erro: "Destino inválido." }, { status: 400 });
    if (destino !== "primicias") {
      const { data: d } = await a.db.from("destinos_pix").update({ modo: b.modo }).eq("tipo", destino).eq("ativo", true).select("tipo");
      if (!d?.length) return NextResponse.json({ erro: "Cadastre antes a chave Pix deste destino (em Subcontas, acima)." }, { status: 400 });
      return NextResponse.json({ ok: true });
    }
    const { data: dest } = await a.db.from("asaas_carteiras").select("tipo").eq("tipo", "primicias").maybeSingle();
    if (!dest) return NextResponse.json({ erro: "Configure antes a subconta de Primícias." }, { status: 400 });
    const { error } = await a.db.from("repasse_regra")
      .upsert({ id: true, modo: b.modo, atualizado_por: a.u.id }, { onConflict: "id" });
    if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (b.acao === "refazer" && b.cobrancaId) {
    try {
      return NextResponse.json(await refazerRepasse(a.db, b.cobrancaId));
    } catch (e) {
      return NextResponse.json({ erro: (e as Error).message }, { status: 502 });
    }
  }
  return NextResponse.json({ erro: "Ação inválida." }, { status: 400 });
}
