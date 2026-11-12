// Repasse automático: a cada Pix recebido na conta da Eklésia, separa uma porcentagem do
// valor bruto e transfere para a subconta de destino (Primícias) no mesmo instante.
//
// Entra:  evento PAYMENT_RECEIVED de cobrança Pix (o Asaas cria uma cobrança até para Pix
//         recebido direto na chave ou em QR estático).
// Fica de fora: cobranças que já têm split (Missões/Primícias pelo app) e pagamentos que não
//         são Pix.
// Segurança: a tabela `repasses` tem a cobrança como chave, então o mesmo Pix nunca é
//         repassado duas vezes, mesmo que o Asaas reenvie o aviso.

import type { SupabaseClient } from "@supabase/supabase-js";
import { chamarAsaas } from "./rotas.ts";

import { calcularRepasse, elegivel, type PagamentoAsaas } from "./repasse-regra.ts";
export { calcularRepasse, elegivel };

export type ResultadoRepasse =
  | { feito: false; motivo: string }
  | { feito: true; status: "simulado" | "aguardando" | "transferido" | "erro"; centavos: number; erro?: string };

export async function processarRepasse(db: SupabaseClient, payload: unknown): Promise<ResultadoRepasse> {
  const ev = payload as { event?: string; payment?: PagamentoAsaas };
  const motivo = elegivel(ev?.event, ev?.payment);
  if (motivo) return { feito: false, motivo };
  const p = ev.payment!;

  const { data: regra } = await db.from("repasse_regra").select("modo, percentual, destino").maybeSingle();
  const r = regra as { modo: string; percentual: number; destino: string } | null;
  if (!r || r.modo === "desligado") return { feito: false, motivo: "repasse desligado" };

  const { data: cart } = await db.from("asaas_carteiras").select("wallet_id").eq("tipo", r.destino).maybeSingle();
  const walletId = (cart as { wallet_id?: string } | null)?.wallet_id;
  if (!walletId) return { feito: false, motivo: "subconta de destino não configurada" };

  const bruto = Math.round(p.value! * 100);
  const centavos = calcularRepasse(bruto, Number(r.percentual));
  const modo = r.modo === "ativo" ? "ativo" : "simulacao";

  // Reserva a cobrança antes de transferir. Se já existe, outro aviso igual chegou antes.
  const { error: dup } = await db.from("repasses").insert({
    cobranca_id: p.id, bruto_centavos: bruto, repasse_centavos: centavos, percentual: r.percentual,
    destino: r.destino, wallet_id: walletId, modo,
    status: modo === "ativo" ? "pendente" : "simulado",
    descricao: (p.description || "").slice(0, 200),
    pago_em: p.paymentDate || p.clientPaymentDate || null,
  });
  if (dup) {
    if (dup.code === "23505") return { feito: false, motivo: "já processado" };
    throw new Error(dup.message);
  }
  if (modo === "simulacao" || centavos === 0) return { feito: true, status: "simulado", centavos };

  try {
    const t = await chamarAsaas<{ id: string; status?: string }>("POST", "/transfers", {
      value: centavos / 100,
      walletId,
      externalReference: `repasse:${p.id}`,
    });
    const status = statusDaTransferencia(t.status);
    await db.from("repasses").update({ status, transferencia_id: t.id }).eq("cobranca_id", p.id);
    return { feito: true, status, centavos };
  } catch (e) {
    const erro = (e as Error).message.slice(0, 500);
    await db.from("repasses").update({ status: "erro", erro }).eq("cobranca_id", p.id);
    return { feito: true, status: "erro", centavos, erro };
  }
}

/** Tenta de novo um repasse que deu erro (botão no Painel). */
export async function refazerRepasse(db: SupabaseClient, cobrancaId: string): Promise<ResultadoRepasse> {
  const { data } = await db.from("repasses").select("*").eq("cobranca_id", cobrancaId).maybeSingle();
  const r = data as { status: string; repasse_centavos: number; wallet_id: string } | null;
  if (!r) return { feito: false, motivo: "não encontrado" };
  if (r.status !== "erro") return { feito: false, motivo: `status atual: ${r.status}` };
  // Trava contra dois cliques: só um consegue mudar erro → pendente.
  const { data: trava } = await db.from("repasses").update({ status: "pendente", erro: null })
    .eq("cobranca_id", cobrancaId).eq("status", "erro").select("cobranca_id");
  if (!trava?.length) return { feito: false, motivo: "já está sendo refeito" };
  try {
    const t = await chamarAsaas<{ id: string; status?: string }>("POST", "/transfers", {
      value: r.repasse_centavos / 100, walletId: r.wallet_id, externalReference: `repasse:${cobrancaId}`,
    });
    const status = statusDaTransferencia(t.status);
    await db.from("repasses").update({ status, transferencia_id: t.id, modo: "ativo" }).eq("cobranca_id", cobrancaId);
    return { feito: true, status, centavos: r.repasse_centavos };
  } catch (e) {
    const erro = (e as Error).message.slice(0, 500);
    await db.from("repasses").update({ status: "erro", erro }).eq("cobranca_id", cobrancaId);
    return { feito: true, status: "erro", centavos: r.repasse_centavos, erro };
  }
}

/** Transferência entre contas Asaas: DONE na hora, ou PENDING esperando a aprovação do evento crítico. */
function statusDaTransferencia(s?: string): "transferido" | "aguardando" {
  return s === "DONE" ? "transferido" : "aguardando";
}

/**
 * Eventos TRANSFER_* do webhook: atualiza o repasse quando a transferência é aprovada
 * (TRANSFER_DONE) ou cancelada/recusada/bloqueada. Devolve true se o evento era de um repasse.
 */
export async function atualizarPorTransferencia(db: SupabaseClient, payload: unknown): Promise<boolean> {
  const ev = payload as { event?: string; transfer?: { id?: string; externalReference?: string | null; failReason?: string | null } };
  if (!ev?.event?.startsWith("TRANSFER_") || !ev.transfer?.id) return false;
  const ref = ev.transfer.externalReference || "";
  if (!ref.startsWith("repasse:")) return false;
  const cobrancaId = ref.slice("repasse:".length);
  const novo: Record<string, unknown> | null =
    ev.event === "TRANSFER_DONE" ? { status: "transferido", erro: null } :
    ev.event === "TRANSFER_CANCELLED" ? { status: "erro", erro: "Transferência cancelada no Asaas" } :
    ev.event === "TRANSFER_FAILED" ? { status: "erro", erro: ev.transfer.failReason || "Transferência falhou no Asaas" } :
    ev.event === "TRANSFER_BLOCKED" ? { status: "erro", erro: "Transferência bloqueada no Asaas" } :
    null;
  if (!novo) return true;
  await db.from("repasses").update({ ...novo, transferencia_id: ev.transfer.id }).eq("cobranca_id", cobrancaId);
  return true;
}
