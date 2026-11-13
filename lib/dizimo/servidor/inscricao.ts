// Webhook do Asaas → inscrições pagas (referência "insc:<evento>:<membro>").
import type { SupabaseClient } from "@supabase/supabase-js";

export async function atualizarInscricao(db: SupabaseClient, payload: unknown): Promise<boolean> {
  const ev = payload as { event?: string; payment?: { id?: string; externalReference?: string | null } };
  const ref = ev?.payment?.externalReference || "";
  if (!ref.startsWith("insc:")) return false;
  const [, eventoId, userId] = ref.split(":");
  if (!eventoId || !userId) return true;
  const alvo = db.from("inscricoes");
  if (ev.event === "PAYMENT_RECEIVED" || ev.event === "PAYMENT_CONFIRMED") {
    await alvo.update({ status: "confirmada", pago_em: new Date().toISOString(), cobranca_id: ev.payment!.id })
      .match({ evento_id: eventoId, user_id: userId });
  } else if (["PAYMENT_REFUNDED", "PAYMENT_DELETED", "PAYMENT_CHARGEBACK_REQUESTED"].includes(ev.event || "")) {
    await alvo.update({ status: "cancelada" }).match({ evento_id: eventoId, user_id: userId, cobranca_id: ev.payment!.id });
  }
  return true;
}
