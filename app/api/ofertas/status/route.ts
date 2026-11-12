// Situação de uma doação feita pelo app (para mostrar "Recebido!" depois do Pix).
import { NextResponse } from "next/server";
import { chamarAsaas, usuarioDaRequisicao } from "@/lib/dizimo/servidor/rotas";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const a = await usuarioDaRequisicao(req);
  if (a instanceof NextResponse) return a;
  const id = new URL(req.url).searchParams.get("id") || "";
  if (!/^pay_[\w]+$/.test(id)) return NextResponse.json({ erro: "Pagamento inválido." }, { status: 400 });
  try {
    const p = await chamarAsaas<{ status: string; externalReference?: string | null }>("GET", `/payments/${id}`);
    if (!p.externalReference?.includes(`:${a.u.id}`)) return NextResponse.json({ erro: "Pagamento não encontrado." }, { status: 404 });
    return NextResponse.json({ pago: ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"].includes(p.status), status: p.status });
  } catch (e) {
    return NextResponse.json({ erro: (e as Error).message }, { status: 502 });
  }
}
