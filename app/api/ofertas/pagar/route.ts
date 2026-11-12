// Doação direta: só nome e CPF (uma vez). Cria o cliente no Asaas, a cobrança com o split certo
// e devolve o Pix (QR + copia e cola) para pagar dentro do app, ou o link do cartão.

import { NextResponse } from "next/server";
import { chamarAsaas, usuarioDaRequisicao } from "@/lib/dizimo/servidor/rotas";
import { montarSplit, NOMES_DOACAO, type TipoDoacao } from "@/lib/dizimo/servidor/doacao";
import { dataLocal } from "@/lib/dizimo/servidor/asaas";
import { lerCpf } from "@/lib/dizimo/texto";

export const dynamic = "force-dynamic";

const MINIMO = 500, MAXIMO = 5_000_000;

export async function POST(req: Request) {
  const a = await usuarioDaRequisicao(req);
  if (a instanceof NextResponse) return a;
  const b = (await req.json().catch(() => ({}))) as { tipo?: string; valorCentavos?: number; forma?: string; nome?: string; cpf?: string; estrangeiro?: boolean };
  const tipo = b.tipo as TipoDoacao;
  if (!(tipo in NOMES_DOACAO)) return NextResponse.json({ erro: "Escolha o propósito da doação." }, { status: 400 });
  const forma = b.forma === "cartao" ? "CREDIT_CARD" : b.forma === "pix" ? "PIX" : null;
  if (!forma) return NextResponse.json({ erro: "Escolha Pix ou cartão." }, { status: 400 });
  const centavos = Math.round(Number(b.valorCentavos));
  if (!Number.isFinite(centavos) || centavos < MINIMO) return NextResponse.json({ erro: "O valor mínimo é R$ 5,00." }, { status: 400 });
  if (centavos > MAXIMO) return NextResponse.json({ erro: "Para valores acima de R$ 50.000, fale com a secretaria." }, { status: 400 });

  try {
    // Cliente no Asaas: criado uma única vez, só com nome e CPF (o CPF não fica no app).
    const { data: cli } = await a.db.from("asaas_clientes").select("customer_id").eq("user_id", a.u.id).maybeSingle();
    let customer = (cli as { customer_id?: string } | null)?.customer_id;
    if (!customer) {
      const nome = (b.nome || "").trim().replace(/\s+/g, " ");
      const cpf = b.estrangeiro ? null : lerCpf(b.cpf || "");
      if (!nome || (!b.estrangeiro && !cpf)) return NextResponse.json({ precisaDados: true, nome: a.u.nome || "" }, { status: 409 });
      if (nome.split(" ").length < 2) return NextResponse.json({ erro: "Informe nome e sobrenome.", precisaDados: true }, { status: 400 });
      // Estrangeiro sem CPF: o Asaas aceita "pagador estrangeiro" quando o recurso está liberado na conta.
      const c = await chamarAsaas<{ id: string }>("POST", "/customers", {
        name: nome, ...(cpf ? { cpfCnpj: cpf } : { foreignCustomer: true }),
        email: a.u.email || undefined, externalReference: `app:${a.u.id}`, notificationDisabled: true,
      }).catch((e: Error) => {
        if (b.estrangeiro) throw new Error("ESTRANGEIRO:" + e.message);
        throw e;
      });
      customer = c.id;
      await a.db.from("asaas_clientes").upsert({ user_id: a.u.id, customer_id: customer, nome });
    }

    const s = await montarSplit(a.db, tipo, centavos, a.u.id);
    if ("erro" in s) return NextResponse.json({ erro: s.erro }, { status: 503 });

    const pag = await chamarAsaas<{ id: string; invoiceUrl: string }>("POST", "/payments", {
      customer,
      billingType: forma,
      value: centavos / 100,
      dueDate: dataLocal(0),
      description: `${NOMES_DOACAO[tipo]} - Eklésia (app)`,
      externalReference: s.referencia,
      ...(s.split ? { split: [{ walletId: s.split.walletId, ...(s.split.fixo ? { fixedValue: s.split.fixo / 100 } : { percentualValue: s.split.percentual }) }] } : {}),
    });

    if (forma === "CREDIT_CARD") return NextResponse.json({ id: pag.id, url: pag.invoiceUrl });
    const qr = await chamarAsaas<{ encodedImage: string; payload: string; expirationDate?: string }>("GET", `/payments/${pag.id}/pixQrCode`);
    return NextResponse.json({ id: pag.id, pix: { imagem: `data:image/png;base64,${qr.encodedImage}`, copiaCola: qr.payload } });
  } catch (e) {
    const msg = (e as Error).message;
    if (msg.startsWith("ESTRANGEIRO:")) {
      return NextResponse.json({ erro: "Doação sem CPF ainda não está liberada. Use o Pix pela chave da igreja, logo abaixo do botão Continuar. / Please use the church Pix key below the Continue button. / Use la clave Pix de la iglesia, debajo del botón Continuar.", precisaDados: true }, { status: 502 });
    }
    const cpfRuim = /cpf|cnpj/i.test(msg);
    if (cpfRuim) await a.db.from("asaas_clientes").delete().eq("user_id", a.u.id);
    return NextResponse.json({ erro: cpfRuim ? "O Asaas não aceitou esse CPF. Confira e tente de novo." : `Não foi possível gerar o pagamento: ${msg}`, precisaDados: cpfRuim || undefined }, { status: 502 });
  }
}
