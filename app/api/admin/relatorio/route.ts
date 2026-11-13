// Relatório de recebimentos (Painel → Dízimo). Administradores e tesoureiros.
// GET ?inicio=AAAA-MM-DD&fim=AAAA-MM-DD → entradas do Asaas, splits de Missões/Primícias
// e repasses automáticos (45%) do período, já somados. O Excel e o PDF são montados no navegador.

import { nomeConta, REDES } from "@/lib/contas";
import { NextResponse } from "next/server";
import { chamarAsaas, usuarioDaRequisicao } from "@/lib/dizimo/servidor/rotas";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface PagAsaas {
  id: string; value: number; netValue?: number; billingType: string; status: string;
  description?: string | null; paymentDate?: string | null; clientPaymentDate?: string | null;
  confirmedDate?: string | null; customer?: string; externalReference?: string | null;
}
interface SplitAsaas {
  id: string; walletId: string; totalValue: number; status: string; creditDate?: string | null;
  payment?: { id?: string; paymentDate?: string | null; confirmedDate?: string | null };
}
interface Lista<T> { data: T[]; hasMore: boolean }

const DATA = /^\d{4}-\d{2}-\d{2}$/;
const FORMAS: Record<string, string> = { PIX: "Pix", CREDIT_CARD: "Cartão de crédito", DEBIT_CARD: "Cartão de débito", BOLETO: "Boleto", UNDEFINED: "Outro" };
const c = (v?: number | null) => Math.round((v || 0) * 100);

async function todas<T>(caminho: string, maximo = 2000): Promise<T[]> {
  const out: T[] = [];
  for (let offset = 0; offset < maximo; offset += 100) {
    const sep = caminho.includes("?") ? "&" : "?";
    const r = await chamarAsaas<Lista<T>>("GET", `${caminho}${sep}limit=100&offset=${offset}`);
    out.push(...(r.data || []));
    if (!r.hasMore) break;
  }
  return out;
}

export async function GET(req: Request) {
  const a = await usuarioDaRequisicao(req, "financeiro");
  if (a instanceof NextResponse) return a;
  const q = new URL(req.url).searchParams;
  const inicio = q.get("inicio") || "", fim = q.get("fim") || "";
  if (!DATA.test(inicio) || !DATA.test(fim) || inicio > fim) {
    return NextResponse.json({ erro: "Período inválido." }, { status: 400 });
  }

  try {
    const filtro = `paymentDate[ge]=${inicio}&paymentDate[le]=${fim}`;
    const [recebidas, confirmadas, splits, carteirasR, repassesR, conta] = await Promise.all([
      todas<PagAsaas>(`/payments?status=RECEIVED&${filtro}`),
      todas<PagAsaas>(`/payments?status=CONFIRMED&${filtro}`),
      todas<SplitAsaas>(`/payments/splits/paid?paymentConfirmedDate[ge]=${inicio}&paymentConfirmedDate[le]=${fim}`),
      a.db.from("asaas_carteiras").select("tipo, wallet_id, titular"),
      a.db.from("repasses").select("cobranca_id, bruto_centavos, repasse_centavos, percentual, status, modo, erro, pago_em, criado_em, destino, chave_pix")
        .gte("pago_em", inicio).lte("pago_em", fim).order("pago_em"),
      chamarAsaas<{ companyName?: string; name?: string }>("GET", "/myAccount/commercialInfo").catch(() => null),
    ]);
    if (carteirasR.error || repassesR.error) throw new Error((carteirasR.error || repassesR.error)!.message);

    const carteiras = (carteirasR.data || []) as { tipo: string; wallet_id: string; titular: string }[];
    const nomeCarteira = (w: string) => {
      const k = carteiras.find((x) => x.wallet_id === w);
      return k ? nomeConta(k.tipo) : "Outra conta";
    };

    // Nome de quem pagou (o Asaas guarda o pagador como cliente). Busca cada cliente uma vez.
    const pagamentos = [...recebidas, ...confirmadas];
    const ids = [...new Set(pagamentos.map((p) => p.customer).filter(Boolean))] as string[];
    const nomes = new Map<string, string>();
    for (let i = 0; i < ids.length && i < 300; i += 10) {
      await Promise.all(ids.slice(i, i + 10).map(async (id) => {
        const cli = await chamarAsaas<{ name?: string }>("GET", `/customers/${id}`).catch(() => null);
        if (cli?.name) nomes.set(id, cli.name);
      }));
    }

    const splitsPorCobranca = new Map<string, SplitAsaas[]>();
    for (const s of splits) {
      const pid = s.payment?.id;
      if (pid) splitsPorCobranca.set(pid, [...(splitsPorCobranca.get(pid) || []), s]);
    }

    const entradas = pagamentos.map((p) => {
      const sp = splitsPorCobranca.get(p.id) || [];
      return {
        id: p.id,
        data: p.paymentDate || p.clientPaymentDate || p.confirmedDate || "",
        pagador: (p.customer && nomes.get(p.customer)) || "",
        descricao: p.description || "",
        forma: FORMAS[p.billingType] || p.billingType,
        situacao: p.status === "RECEIVED" ? "Recebido" : "Confirmado (a receber)",
        bruto: c(p.value),
        taxa: c(p.value) - c(p.netValue ?? p.value),
        liquido: c(p.netValue ?? p.value),
        split: sp.reduce((t, s) => t + c(s.totalValue), 0),
        destinoSplit: [...new Set(sp.map((s) => nomeCarteira(s.walletId)))].join(", ") + (p.externalReference?.endsWith(":split") ? " (45%)" : ""),
      };
    }).sort((x, y) => x.data.localeCompare(y.data));

    // Os 45% de dízimo/oferta pelo app também chegam como split para Primícias, mas entram
    // no relatório como repasse (para não contar duas vezes).
    const { data: np } = await a.db.from("repasses").select("cobranca_id").eq("status", "no_pagamento");
    const repasseNoPagamento = new Set(((np || []) as { cobranca_id: string }[]).map((x) => x.cobranca_id));
    const listaSplits = splits.map((s) => ({
      id: s.id,
      cobranca: s.payment?.id || "",
      data: s.payment?.paymentDate || s.payment?.confirmedDate || s.creditDate || "",
      destino: repasseNoPagamento.has(s.payment?.id || "") ? "Repasse 45% (no pagamento)" : nomeCarteira(s.walletId),
      valor: c(s.totalValue),
      status: s.status,
      creditado: s.creditDate || "",
    })).sort((x, y) => x.data.localeCompare(y.data));

    const repasses = ((repassesR.data || []) as {
      cobranca_id: string; bruto_centavos: number; repasse_centavos: number; percentual: number;
      status: string; modo: string; erro: string | null; pago_em: string | null; criado_em: string;
      destino: string; chave_pix: string | null;
    }[]).map((r) => ({
      cobranca: r.cobranca_id, data: r.pago_em || r.criado_em.slice(0, 10),
      bruto: Number(r.bruto_centavos), valor: Number(r.repasse_centavos), percentual: Number(r.percentual),
      status: r.status, erro: r.erro || "", destino: nomeConta(r.destino) + (r.chave_pix ? " (Pix)" : ""), pix: !!r.chave_pix, tipo: r.destino,
    }));
    const rep45 = repasses.filter((r) => !r.pix);
    const repPix = repasses.filter((r) => r.pix);

    const soma = <T,>(l: T[], f: (x: T) => number) => l.reduce((t, x) => t + f(x), 0);
    const splitValido = listaSplits.filter((s) => !["CANCELLED", "REFUNDED"].includes(s.status));
    const resumo = {
      entradas: entradas.length,
      bruto: soma(entradas, (e) => e.bruto),
      taxas: soma(entradas, (e) => e.taxa),
      liquido: soma(entradas, (e) => e.liquido),
      porForma: Object.entries(entradas.reduce<Record<string, number>>((m, e) => ({ ...m, [e.forma]: (m[e.forma] || 0) + e.bruto }), {}))
        .map(([forma, valor]) => ({ forma, valor })),
      splitMissoes: soma(splitValido.filter((s) => s.destino === "Missões"), (s) => s.valor),
      splitPrimicias: soma(splitValido.filter((s) => s.destino === "Primícias"), (s) => s.valor),
      splitRedes: REDES.map((r) => ({ nome: nomeConta(r), valor: soma(splitValido.filter((s) => s.destino === nomeConta(r)), (s) => s.valor) })).filter((r) => r.valor),
      splitOutros: soma(splitValido.filter((s) => s.destino === "Outra conta"), (s) => s.valor),
      repasseTransferido: soma(rep45.filter((r) => r.status === "transferido" || r.status === "no_pagamento"), (r) => r.valor),
      repasseAguardando: soma(rep45.filter((r) => r.status === "aguardando" || r.status === "pendente"), (r) => r.valor),
      repasseSimulado: soma(rep45.filter((r) => r.status === "simulado"), (r) => r.valor),
      pixRedes: [...new Set(repPix.map((r) => r.tipo))].map((t) => {
        const l = repPix.filter((r) => r.tipo === t);
        return { nome: nomeConta(t), transferido: soma(l.filter((r) => r.status === "transferido"), (r) => r.valor),
          aguardando: soma(l.filter((r) => r.status === "aguardando" || r.status === "pendente"), (r) => r.valor),
          erro: soma(l.filter((r) => r.status === "erro"), (r) => r.valor) };
      }),
      repasseErro: soma(rep45.filter((r) => r.status === "erro"), (r) => r.valor),
    };
    const ficaNaIgreja = resumo.liquido - resumo.splitMissoes - resumo.splitPrimicias - resumo.splitOutros
      - resumo.splitRedes.reduce((t, r) => t + r.valor, 0)
      - resumo.repasseTransferido - resumo.repasseAguardando
      - resumo.pixRedes.reduce((t, r) => t + r.transferido + r.aguardando, 0);

    return NextResponse.json({
      igreja: conta?.companyName || conta?.name || "Eklésia",
      periodo: { inicio, fim },
      geradoEm: new Date().toISOString(),
      geradoPor: a.u.nome || a.u.email,
      resumo: { ...resumo, ficaNaIgreja },
      entradas, splits: listaSplits, repasses,
    });
  } catch (e) {
    return NextResponse.json({ erro: `Não foi possível montar o relatório: ${(e as Error).message}` }, { status: 502 });
  }
}
