// Cliente do Asaas (nome + CPF, uma vez por membro) e cobrança Pix/cartão com split.
// Usado nas doações e nas inscrições pagas de eventos.

import type { SupabaseClient } from "@supabase/supabase-js";
import { chamarAsaas, type Usuario } from "./rotas.ts";
import { dataLocal } from "./asaas.ts";
import { lerCpf } from "../texto.ts";

export class PrecisaDados extends Error {
  constructor(public nome: string, msg = "") { super(msg); }
}

/** Devolve o customer do Asaas do membro; cria só com nome e CPF na primeira vez. */
export async function garantirCliente(db: SupabaseClient, u: Usuario, dados: { nome?: string; cpf?: string }): Promise<string> {
  const { data: cli } = await db.from("asaas_clientes").select("customer_id").eq("user_id", u.id).maybeSingle();
  const atual = (cli as { customer_id?: string } | null)?.customer_id;
  if (atual) return atual;
  const nome = (dados.nome || "").trim().replace(/\s+/g, " ");
  const cpf = lerCpf(dados.cpf || "");
  if (!nome || !cpf) throw new PrecisaDados(u.nome || "");
  if (nome.split(" ").length < 2) throw new PrecisaDados(nome, "Informe nome e sobrenome.");
  try {
    const c = await chamarAsaas<{ id: string }>("POST", "/customers", {
      name: nome, cpfCnpj: cpf, email: u.email || undefined, externalReference: `app:${u.id}`, notificationDisabled: true,
    });
    await db.from("asaas_clientes").upsert({ user_id: u.id, customer_id: c.id, nome });
    return c.id;
  } catch (e) {
    if (/cpf|cnpj/i.test((e as Error).message)) throw new PrecisaDados(nome, "O Asaas não aceitou esse CPF. Confira e tente de novo.");
    throw e;
  }
}

export interface Split { walletId: string; percentual?: number; fixo?: number }

/** Cria a cobrança e devolve o Pix (QR + copia e cola) ou o link do cartão. */
export async function criarCobranca(p: {
  customer: string; forma: "pix" | "cartao"; centavos: number; descricao: string; referencia: string; split?: Split | null;
}): Promise<{ id: string; url?: string; pix?: { imagem: string; copiaCola: string } }> {
  const pag = await chamarAsaas<{ id: string; invoiceUrl: string }>("POST", "/payments", {
    customer: p.customer,
    billingType: p.forma === "cartao" ? "CREDIT_CARD" : "PIX",
    value: p.centavos / 100,
    dueDate: dataLocal(0),
    description: p.descricao,
    externalReference: p.referencia,
    ...(p.split ? { split: [{ walletId: p.split.walletId, ...(p.split.fixo ? { fixedValue: p.split.fixo / 100 } : { percentualValue: p.split.percentual }) }] } : {}),
  });
  if (p.forma === "cartao") return { id: pag.id, url: pag.invoiceUrl };
  const qr = await chamarAsaas<{ encodedImage: string; payload: string }>("GET", `/payments/${pag.id}/pixQrCode`);
  return { id: pag.id, pix: { imagem: `data:image/png;base64,${qr.encodedImage}`, copiaCola: qr.payload } };
}
