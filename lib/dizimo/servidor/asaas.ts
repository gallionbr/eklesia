// Cliente do Asaas: clientes, cobranças Pix/cartão e leitura do webhook.
// A conta é da igreja (CNPJ da Eklésia): o dinheiro cai direto lá.

import { timingSafeEqual } from "node:crypto";
import type { Forma } from "../bot.ts";
import type { Cobranca, EventoPagamento, Gateway } from "../motor.ts";

/** Data de hoje (+dias) no fuso da igreja, "AAAA-MM-DD". */
export function dataLocal(dias = 0, agora = new Date()): string {
  const d = new Date(agora.getTime() + dias * 86400e3);
  return d.toLocaleDateString("en-CA", { timeZone: "America/Fortaleza" });
}

export class AsaasApi implements Gateway {
  private cfg: { url: string; chave: string };
  constructor(cfg: { url: string; chave: string }) { this.cfg = cfg; }

  private async chamar<T>(metodo: "GET" | "POST", caminho: string, corpo?: unknown): Promise<T> {
    const r = await fetch(`${this.cfg.url}${caminho}`, {
      method: metodo,
      headers: { access_token: this.cfg.chave, "Content-Type": "application/json", "User-Agent": "eklesia-dizimo" },
      body: corpo ? JSON.stringify(corpo) : undefined,
    });
    const j = (await r.json().catch(() => ({}))) as T & { errors?: { code?: string; description?: string }[] };
    if (!r.ok) {
      const e = j.errors?.[0];
      throw new Error(`Asaas ${r.status}${e ? `: ${e.description || e.code}` : ""}`);
    }
    return j;
  }

  async criarCliente(c: { nome: string; cpf: string; telefone: string; referencia: string }): Promise<string> {
    const celular = c.telefone.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
    const r = await this.chamar<{ id: string }>("POST", "/customers", {
      name: c.nome, cpfCnpj: c.cpf, mobilePhone: celular, externalReference: c.referencia,
      notificationDisabled: true,  // quem avisa é o bot, não o e-mail/SMS do Asaas
    });
    return r.id;
  }

  async cobrar(c: { cliente: string; valor: number; forma: Forma; descricao: string; referencia: string }): Promise<Cobranca> {
    const venceEm = dataLocal(1);
    const pag = await this.chamar<{ id: string; invoiceUrl: string }>("POST", "/payments", {
      customer: c.cliente,
      billingType: c.forma === "pix" ? "PIX" : "CREDIT_CARD",
      value: c.valor / 100,
      dueDate: venceEm,
      description: c.descricao,
      externalReference: c.referencia,
    });
    if (c.forma !== "pix") return { id: pag.id, link: pag.invoiceUrl, venceEm };
    const qr = await this.chamar<{ payload: string }>("GET", `/payments/${pag.id}/pixQrCode`);
    return { id: pag.id, link: pag.invoiceUrl, venceEm, pixCopiaCola: qr.payload };
  }
}

/** Confere o token que o Asaas manda no cabeçalho asaas-access-token. */
export function tokenValido(recebido: string | null, esperado: string): boolean {
  if (!recebido) return false;
  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Converte o payload do webhook do Asaas no evento do motor. Null se não for de cobrança. */
export function lerEventoAsaas(payload: unknown): EventoPagamento | null {
  const p = payload as {
    id?: string; event?: string;
    payment?: { id?: string; value?: number; netValue?: number };
  };
  if (!p?.event?.startsWith("PAYMENT_") || !p.payment?.id) return null;
  const centavos = (v?: number) => (typeof v === "number" ? Math.round(v * 100) : undefined);
  return {
    // O Asaas manda um id único por evento; se faltar, evento+cobrança serve de chave.
    eventoId: p.id || `${p.event}:${p.payment.id}`,
    evento: p.event,
    cobrancaId: p.payment.id,
    valor: centavos(p.payment.value),
    liquido: centavos(p.payment.netValue),
    // O Asaas manda só a data do pagamento, sem hora; o aviso chega segundos depois,
    // então o motor usa a hora em que recebeu.
  };
}
