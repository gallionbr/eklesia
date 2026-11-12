// Ofertas → Missões / Primícias: cria um Checkout do Asaas com split para a subconta.
// O membro paga com Pix ou cartão na página segura do Asaas e informa ali os próprios dados.

import { NextResponse } from "next/server";
import { env } from "@/lib/dizimo/servidor/env";
import { chamarAsaas, SITE, usuarioDaRequisicao } from "@/lib/dizimo/servidor/rotas";

export const dynamic = "force-dynamic";

const NOMES = { missoes: "Oferta de Missões", primicias: "Primícias" } as const;
const MINIMO = 500;          // R$ 5,00
const MAXIMO = 5_000_000;    // R$ 50.000,00

export async function POST(req: Request) {
  const a = await usuarioDaRequisicao(req);
  if (a instanceof NextResponse) return a;
  const b = (await req.json().catch(() => ({}))) as { tipo?: string; valorCentavos?: number };
  const tipo = b.tipo as keyof typeof NOMES;
  if (!(tipo in NOMES)) return NextResponse.json({ erro: "Tipo inválido." }, { status: 400 });
  const centavos = Math.round(Number(b.valorCentavos));
  if (!Number.isFinite(centavos) || centavos < MINIMO) return NextResponse.json({ erro: "O valor mínimo é R$ 5,00." }, { status: 400 });
  if (centavos > MAXIMO) return NextResponse.json({ erro: "Para valores acima de R$ 50.000, fale com a secretaria." }, { status: 400 });

  const { data: c } = await a.db.from("asaas_carteiras").select("wallet_id, percentual").eq("tipo", tipo).maybeSingle();
  const carteira = c as { wallet_id: string; percentual: number } | null;
  if (!carteira) return NextResponse.json({ erro: "Esta oferta ainda não está disponível pelo app." }, { status: 503 });

  try {
    const r = await chamarAsaas<{ id: string; link?: string }>("POST", "/checkouts", {
      billingTypes: ["PIX", "CREDIT_CARD"],
      chargeTypes: ["DETACHED"],
      minutesToExpire: 60,
      externalReference: `app:${tipo}:${a.u.id}`,
      callback: { successUrl: `${SITE}/ofertas?pago=1`, cancelUrl: `${SITE}/ofertas`, expiredUrl: `${SITE}/ofertas` },
      items: [{ name: `${NOMES[tipo]} - Eklésia`, quantity: 1, value: centavos / 100 }],
      splits: [{ walletId: carteira.wallet_id, percentageValue: Number(carteira.percentual) }],
    });
    const base = env.asaasUrl.includes("sandbox") ? "https://sandbox.asaas.com" : "https://asaas.com";
    return NextResponse.json({ url: r.link || `${base}/checkoutSession/show?id=${r.id}` });
  } catch (e) {
    return NextResponse.json({ erro: `Não foi possível gerar o pagamento: ${(e as Error).message}` }, { status: 502 });
  }
}
