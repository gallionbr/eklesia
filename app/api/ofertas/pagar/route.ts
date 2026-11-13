// Doação direta: só nome e CPF (uma vez). Cria o cliente no Asaas, a cobrança com o split certo
// e devolve o Pix (QR + copia e cola) para pagar dentro do app, ou o link do cartão.

import { NextResponse } from "next/server";
import { usuarioDaRequisicao } from "@/lib/dizimo/servidor/rotas";
import { montarSplit, NOMES_DOACAO, type TipoDoacao } from "@/lib/dizimo/servidor/doacao";
import { criarCobranca, garantirCliente, PrecisaDados } from "@/lib/dizimo/servidor/cobranca";

export const dynamic = "force-dynamic";

const MINIMO = 500, MAXIMO = 5_000_000;

export async function POST(req: Request) {
  const a = await usuarioDaRequisicao(req);
  if (a instanceof NextResponse) return a;
  const b = (await req.json().catch(() => ({}))) as { tipo?: string; valorCentavos?: number; forma?: string; nome?: string; cpf?: string; estrangeiro?: boolean };
  const tipo = b.tipo as TipoDoacao;
  if (!(tipo in NOMES_DOACAO)) return NextResponse.json({ erro: "Escolha o propósito da doação." }, { status: 400 });
  if (b.forma !== "pix" && b.forma !== "cartao") return NextResponse.json({ erro: "Escolha Pix ou cartão." }, { status: 400 });
  const centavos = Math.round(Number(b.valorCentavos));
  if (!Number.isFinite(centavos) || centavos < MINIMO) return NextResponse.json({ erro: "O valor mínimo é R$ 5,00." }, { status: 400 });
  if (centavos > MAXIMO) return NextResponse.json({ erro: "Para valores acima de R$ 50.000, fale com a secretaria." }, { status: 400 });
  if (b.estrangeiro) return NextResponse.json({ erro: "Doações do exterior: PayPal call@eklesia.international", precisaDados: true }, { status: 400 });

  try {
    const customer = await garantirCliente(a.db, a.u, b);
    const s = await montarSplit(a.db, tipo, centavos, a.u.id);
    if ("erro" in s) return NextResponse.json({ erro: s.erro }, { status: 503 });
    return NextResponse.json(await criarCobranca({
      customer, forma: b.forma, centavos, descricao: `${NOMES_DOACAO[tipo]} - Eklésia (app)`, referencia: s.referencia, split: s.split,
    }));
  } catch (e) {
    if (e instanceof PrecisaDados) return NextResponse.json({ precisaDados: true, nome: e.nome, erro: e.message || undefined }, { status: e.message ? 400 : 409 });
    return NextResponse.json({ erro: `Não foi possível gerar o pagamento: ${(e as Error).message}` }, { status: 502 });
  }
}
