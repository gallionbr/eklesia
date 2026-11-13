// Painel → Dízimo → Asaas → Split. Só administradores.
// GET:    carteiras cadastradas (Missões, Primícias e Redes).
// POST:   { acao: "criar", tipo, dados } cria a subconta no Asaas e guarda o Wallet ID;
//         { acao: "vincular", tipo, walletId, titular } usa uma conta Asaas que já existe.
// DELETE: ?tipo=missoes desliga o split desse tipo (a subconta continua no Asaas).

import { NextResponse } from "next/server";
import { chamarAsaas, usuarioDaRequisicao } from "@/lib/dizimo/servidor/rotas";

export const dynamic = "force-dynamic";

import { TIPOS_CONTA, type TipoConta } from "@/lib/contas";

const TIPOS = TIPOS_CONTA;
type Tipo = TipoConta;
const so = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const digitos = (v: unknown) => so(v).replace(/\D/g, "");

export async function GET(req: Request) {
  const a = await usuarioDaRequisicao(req, "admin");
  if (a instanceof NextResponse) return a;
  const { data, error } = await a.db.from("asaas_carteiras").select("tipo, wallet_id, titular, percentual, atualizado_em");
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  const { data: pix } = await a.db.from("destinos_pix").select("tipo, chave, tipo_chave, ativo");
  return NextResponse.json({ carteiras: data, pix: pix || [] });
}

export async function POST(req: Request) {
  const a = await usuarioDaRequisicao(req, "admin");
  if (a instanceof NextResponse) return a;
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const tipo = so(b.tipo) as Tipo;
  if (!TIPOS.includes(tipo)) return NextResponse.json({ erro: "Tipo inválido." }, { status: 400 });

  // Chave Pix fora do Asaas: o app transfere cada pagamento recebido para ela.
  if (b.acao === "pix") {
    const chave = so(b.chave);
    const tipoChave = tipoDaChave(chave);
    if (!tipoChave) return NextResponse.json({ erro: "Chave Pix inválida (e-mail, CPF, CNPJ, celular ou aleatória)." }, { status: 400 });
    const { error } = await a.db.from("destinos_pix").upsert({
      tipo, chave: tipoChave === "PHONE" ? "+55" + digitos(chave).replace(/^55/, "") : tipoChave === "EMAIL" || tipoChave === "EVP" ? chave.toLowerCase() : digitos(chave),
      tipo_chave: tipoChave, ativo: b.ativo !== false, atualizado_em: new Date().toISOString(),
    });
    if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  try {
    let walletId: string, contaId: string | null = null, titular: string;
    if (b.acao === "vincular") {
      walletId = so(b.walletId);
      titular = so(b.titular);
      if (!/^[0-9a-fA-F-]{36}$/.test(walletId)) return NextResponse.json({ erro: "Wallet ID inválido (36 caracteres, com hífens)." }, { status: 400 });
    } else {
      const d = (b.dados || {}) as Record<string, unknown>;
      const doc = digitos(d.cpfCnpj);
      const pj = doc.length === 14;
      if (doc.length !== 11 && !pj) return NextResponse.json({ erro: "CPF ou CNPJ inválido." }, { status: 400 });
      const renda = Number(so(d.incomeValue).replace(/\./g, "").replace(",", "."));
      const corpo: Record<string, unknown> = {
        name: so(d.name), email: so(d.email), cpfCnpj: doc,
        mobilePhone: digitos(d.mobilePhone), postalCode: digitos(d.postalCode),
        address: so(d.address), addressNumber: so(d.addressNumber),
        complement: so(d.complement) || undefined, province: so(d.province),
        incomeValue: Number.isFinite(renda) && renda > 0 ? renda : undefined,
      };
      if (pj) corpo.companyType = so(d.companyType) || "ASSOCIATION";
      else corpo.birthDate = so(d.birthDate);
      const faltam = ["name", "email", "mobilePhone", "postalCode", "address", "addressNumber", "province", "incomeValue", ...(pj ? [] : ["birthDate"])]
        .filter((k) => !corpo[k]);
      if (faltam.length) return NextResponse.json({ erro: `Preencha: ${faltam.join(", ")}.` }, { status: 400 });

      // A chave de API da subconta vem só nesta resposta; o app não precisa dela e não guarda.
      const r = await chamarAsaas<{ id: string; walletId: string }>("POST", "/accounts", corpo);
      walletId = r.walletId; contaId = r.id; titular = so(d.name);
    }
    const { error } = await a.db.from("asaas_carteiras").upsert({ tipo, wallet_id: walletId, conta_id: contaId, titular, percentual: 100 });
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, tipo, walletId });
  } catch (e) {
    return NextResponse.json({ erro: (e as Error).message }, { status: 502 });
  }
}

function tipoDaChave(c: string): "EMAIL" | "CPF" | "CNPJ" | "PHONE" | "EVP" | null {
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c)) return "EMAIL";
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(c)) return "EVP";
  const d = c.replace(/\D/g, "");
  if (/^\+|\(/.test(c.trim()) || (d.length === 13 && d.startsWith("55"))) return d.length >= 12 ? "PHONE" : null;
  if (d.length === 14) return "CNPJ";
  if (d.length === 11) return /[.-]/.test(c) ? "CPF" : null;   // 11 dígitos sem pontuação: ambíguo (CPF ou celular)
  return null;
}

export async function DELETE(req: Request) {
  const a = await usuarioDaRequisicao(req, "admin");
  if (a instanceof NextResponse) return a;
  const u = new URL(req.url);
  const tipo = u.searchParams.get("tipo") as Tipo;
  if (!TIPOS.includes(tipo)) return NextResponse.json({ erro: "Tipo inválido." }, { status: 400 });
  const { error } = u.searchParams.get("pix")
    ? await a.db.from("destinos_pix").update({ ativo: false }).eq("tipo", tipo)
    : await a.db.from("asaas_carteiras").delete().eq("tipo", tipo);
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
