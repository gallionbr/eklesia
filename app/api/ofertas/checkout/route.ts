// Doações pelo app: cria um Checkout do Asaas (Pix ou cartão) já com o split certo.
//  · Missões / Primícias → 100% para a subconta configurada no Painel.
//  · Dízimo / Oferta     → a porcentagem do repasse automático (45%) do valor bruto vai
//                          para a subconta de destino (Primícias) no próprio pagamento,
//                          sem transferência depois e sem "evento crítico" para aprovar.
// O membro informa nome e CPF na página segura do Asaas.

import { NextResponse } from "next/server";
import { env } from "@/lib/dizimo/servidor/env";
import { chamarAsaas, SITE, usuarioDaRequisicao } from "@/lib/dizimo/servidor/rotas";
import { calcularRepasse } from "@/lib/dizimo/servidor/repasse-regra";

export const dynamic = "force-dynamic";

const NOMES = { dizimo: "Dízimo", oferta: "Oferta", missoes: "Oferta de Missões", primicias: "Primícias" } as const;
type Tipo = keyof typeof NOMES;
const FORMAS = { pix: "PIX", cartao: "CREDIT_CARD" } as const;
const MINIMO = 500;          // R$ 5,00
const MAXIMO = 5_000_000;    // R$ 50.000,00

export async function POST(req: Request) {
  const a = await usuarioDaRequisicao(req);
  if (a instanceof NextResponse) return a;
  const b = (await req.json().catch(() => ({}))) as { tipo?: string; valorCentavos?: number; forma?: string };
  const tipo = b.tipo as Tipo;
  if (!(tipo in NOMES)) return NextResponse.json({ erro: "Escolha o propósito da doação." }, { status: 400 });
  const forma = (b.forma && b.forma in FORMAS ? b.forma : null) as keyof typeof FORMAS | null;
  const centavos = Math.round(Number(b.valorCentavos));
  if (!Number.isFinite(centavos) || centavos < MINIMO) return NextResponse.json({ erro: "O valor mínimo é R$ 5,00." }, { status: 400 });
  if (centavos > MAXIMO) return NextResponse.json({ erro: "Para valores acima de R$ 50.000, fale com a secretaria." }, { status: 400 });

  let splits: Record<string, unknown>[] = [];
  let referencia = `app:${tipo}:${a.u.id}`;

  if (tipo === "missoes" || tipo === "primicias") {
    const { data } = await a.db.from("asaas_carteiras").select("wallet_id, percentual").eq("tipo", tipo).maybeSingle();
    const c = data as { wallet_id: string; percentual: number } | null;
    if (!c) return NextResponse.json({ erro: "Esta doação ainda não está disponível pelo app." }, { status: 503 });
    splits = [{ walletId: c.wallet_id, percentageValue: Number(c.percentual) }];
  } else {
    // Dízimo e oferta: aplica o repasse automático só quando ele está Ligado no Painel.
    const { data: r } = await a.db.from("repasse_regra").select("modo, percentual, destino").maybeSingle();
    const regra = r as { modo: string; percentual: number; destino: string } | null;
    if (regra?.modo === "ativo") {
      const { data: d } = await a.db.from("asaas_carteiras").select("wallet_id").eq("tipo", regra.destino).maybeSingle();
      const w = (d as { wallet_id?: string } | null)?.wallet_id;
      const parte = calcularRepasse(centavos, Number(regra.percentual));
      if (w && parte > 0) {
        splits = [{ walletId: w, fixedValue: parte / 100 }];  // % do bruto, como no repasse
        referencia += ":split";
      }
    }
  }

  try {
    const r = await chamarAsaas<{ id: string; link?: string }>("POST", "/checkouts", {
      billingTypes: forma ? [FORMAS[forma]] : ["PIX", "CREDIT_CARD"],
      chargeTypes: ["DETACHED"],
      minutesToExpire: 60,
      externalReference: referencia,
      callback: { successUrl: `${SITE}/ofertas?pago=1`, cancelUrl: `${SITE}/ofertas`, expiredUrl: `${SITE}/ofertas` },
      items: [{ name: `${NOMES[tipo]} - Eklésia`, quantity: 1, value: centavos / 100 }],
      ...(splits.length ? { splits } : {}),
    });
    const base = env.asaasUrl.includes("sandbox") ? "https://sandbox.asaas.com" : "https://asaas.com";
    return NextResponse.json({ url: r.link || `${base}/checkoutSession/show?id=${r.id}` });
  } catch (e) {
    return NextResponse.json({ erro: `Não foi possível gerar o pagamento: ${(e as Error).message}` }, { status: 502 });
  }
}
