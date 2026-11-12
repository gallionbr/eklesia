// Painel → Dízimo → Repasse automático. Só administradores.
// GET:  regra atual, últimos repasses e totais do mês.
// POST: { acao: "modo", modo: "desligado" | "simulacao" | "ativo" }
//       { acao: "refazer", cobrancaId } tenta de novo um repasse que deu erro.

import { NextResponse } from "next/server";
import { chamarAsaas, usuarioDaRequisicao } from "@/lib/dizimo/servidor/rotas";
import { refazerRepasse } from "@/lib/dizimo/servidor/repasse";

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

  const inicioMes = new Date().toLocaleDateString("en-CA", { timeZone: "America/Fortaleza" }).slice(0, 8) + "01";
  const [regra, ultimos, mes] = await Promise.all([
    a.db.from("repasse_regra").select("modo, percentual, destino, atualizado_em").maybeSingle(),
    a.db.from("repasses").select("cobranca_id, bruto_centavos, repasse_centavos, modo, status, erro, descricao, pago_em, criado_em")
      .order("criado_em", { ascending: false }).limit(30),
    a.db.from("repasses").select("bruto_centavos, repasse_centavos, status").gte("criado_em", `${inicioMes}T03:00:00Z`),
  ]);
  if (regra.error || ultimos.error || mes.error) {
    return NextResponse.json({ erro: (regra.error || ultimos.error || mes.error)!.message }, { status: 500 });
  }
  const linhas = (mes.data || []) as { bruto_centavos: number; repasse_centavos: number; status: string }[];
  const soma = (f: (l: (typeof linhas)[number]) => boolean, k: "bruto_centavos" | "repasse_centavos") =>
    linhas.filter(f).reduce((t, l) => t + Number(l[k]), 0);
  return NextResponse.json({
    regra: regra.data,
    ultimos: ultimos.data,
    mes: {
      pix: linhas.length,
      bruto: soma(() => true, "bruto_centavos"),
      transferido: soma((l) => l.status === "transferido", "repasse_centavos"),
      simulado: soma((l) => l.status === "simulado", "repasse_centavos"),
      aguardando: soma((l) => l.status === "aguardando" || l.status === "pendente", "repasse_centavos"),
      comErro: linhas.filter((l) => l.status === "erro").length,
    },
  });
}

export async function POST(req: Request) {
  const a = await usuarioDaRequisicao(req, "admin");
  if (a instanceof NextResponse) return a;
  const b = (await req.json().catch(() => ({}))) as { acao?: string; modo?: string; cobrancaId?: string };

  if (b.acao === "modo") {
    if (!MODOS.includes(b.modo as (typeof MODOS)[number])) return NextResponse.json({ erro: "Modo inválido." }, { status: 400 });
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
