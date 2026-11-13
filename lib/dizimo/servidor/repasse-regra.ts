// Regras puras do repasse automático (sem rede nem banco), testadas em repasse.test.ts.

export interface PagamentoAsaas {
  id?: string; value?: number; billingType?: string; status?: string;
  description?: string; paymentDate?: string; clientPaymentDate?: string;
  externalReference?: string | null; split?: unknown[] | null;
}

/** Centavos a repassar: porcentagem do bruto, arredondada para baixo (nunca passa do valor). */
export function calcularRepasse(brutoCentavos: number, percentual: number): number {
  return Math.floor((brutoCentavos * percentual) / 100);
}

/** Diz se o evento é um Pix recebido que entra no repasse (sem olhar o banco). */
export function elegivel(evento: string | undefined, p: PagamentoAsaas | undefined): string | null {
  if (evento !== "PAYMENT_RECEIVED") return "evento não é de recebimento";
  if (!p?.id || typeof p.value !== "number" || p.value <= 0) return "cobrança sem valor";
  if (p.billingType !== "PIX") return "não é Pix";
  if (Array.isArray(p.split) && p.split.length > 0) return "cobrança já tem split";
  if (jaTemSplit(p.externalReference)) return "doação do app com split";
  return null;
}

/**
 * Doações pelo app que já saem com split no próprio checkout (o webhook nem sempre traz o
 * campo `split`, então a marca vai na referência): Missões, Primícias e as que levam os 45%.
 */
export function jaTemSplit(ref?: string | null): boolean {
  if (!ref) return false;
  return ref.startsWith("app:missoes:") || ref.startsWith("app:primicias:") || ref.startsWith("app:rede_")
    || ref.startsWith("insc:") || ref.endsWith(":split");
}
