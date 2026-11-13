// Repasse por Pix para contas fora do Asaas (Redes e Missões).
//
// Como o app sabe para quem é cada pagamento: toda cobrança criada pelo app leva na
// referência (externalReference) o destino — "app:rede_rosa:<membro>" numa doação, ou
// "insc:<evento>:<membro>" numa inscrição (a rede vem do evento). O Asaas manda um aviso
// separado para cada pagamento, com o id e a referência dele, então vários pagamentos ao
// mesmo tempo para redes diferentes não se misturam: cada aviso gera a sua transferência.
// A tabela `repasses` usa o id da cobrança como chave: um pagamento nunca é repassado duas vezes.

import type { SupabaseClient } from "@supabase/supabase-js";
import { chamarAsaas } from "./asaas-api.ts";

interface Pag { id?: string; value?: number; netValue?: number; externalReference?: string | null; description?: string; paymentDate?: string; clientPaymentDate?: string }

/** Destino (rede_rosa, missoes…) a partir da referência da cobrança. */
export async function destinoDaReferencia(db: SupabaseClient, ref?: string | null): Promise<string | null> {
  if (!ref) return null;
  const [origem, a] = ref.split(":");
  if (origem === "app" && a && a !== "dizimo" && a !== "oferta") return a;
  if (origem === "insc" && a) {
    const { data } = await db.from("eventos").select("rede").eq("id", a).maybeSingle();
    return (data as { rede?: string | null } | null)?.rede || null;
  }
  return null;
}

export async function processarRepassePix(db: SupabaseClient, payload: unknown): Promise<{ feito: boolean; motivo?: string; status?: string }> {
  const ev = payload as { event?: string; payment?: Pag };
  const p = ev?.payment;
  // Só quando o dinheiro está disponível na conta (Pix na hora; cartão quando o Asaas libera).
  if (ev?.event !== "PAYMENT_RECEIVED" || !p?.id || typeof p.value !== "number") return { feito: false, motivo: "não é recebimento" };
  const destino = await destinoDaReferencia(db, p.externalReference);
  if (!destino) return { feito: false, motivo: "sem destino" };

  // Se o destino tem subconta no Asaas, o split já levou o dinheiro: nada a transferir.
  const { data: cart } = await db.from("asaas_carteiras").select("tipo").eq("tipo", destino).maybeSingle();
  if (cart) return { feito: false, motivo: "split no Asaas" };
  const { data: d } = await db.from("destinos_pix").select("chave, tipo_chave, ativo, modo").eq("tipo", destino).maybeSingle();
  const dest = d as { chave: string; tipo_chave: string; ativo: boolean; modo?: string } | null;
  if (!dest?.ativo) return { feito: false, motivo: "destino sem chave Pix" };
  const modo = dest.modo || "ativo";
  if (modo === "desligado") return { feito: false, motivo: "repasse desligado para este destino" };

  const bruto = Math.round(p.value * 100);
  const liquido = Math.round((p.netValue ?? p.value) * 100);   // repassa o que de fato entrou (já sem a taxa do Asaas)
  const { error: dup } = await db.from("repasses").insert({
    cobranca_id: p.id, bruto_centavos: bruto, repasse_centavos: liquido, percentual: 100,
    destino, wallet_id: "", chave_pix: dest.chave, modo: modo === "ativo" ? "ativo" : "simulacao",
    status: modo === "ativo" ? "pendente" : "simulado",
    descricao: (p.description || "").slice(0, 200), pago_em: p.paymentDate || p.clientPaymentDate || null,
  });
  if (dup) {
    if (dup.code === "23505") return { feito: false, motivo: "já processado" };
    throw new Error(dup.message);
  }
  if (modo !== "ativo") return { feito: true, status: "simulado" };
  return transferirPix(db, p.id, liquido, dest.chave, dest.tipo_chave, p.description || destino);
}

export async function transferirPix(db: SupabaseClient, cobrancaId: string, centavos: number, chave: string, tipoChave: string, descricao: string) {
  try {
    const t = await chamarAsaas<{ id: string; status?: string }>("POST", "/transfers", {
      value: centavos / 100,
      operationType: "PIX",
      pixAddressKey: chave,
      pixAddressKeyType: tipoChave,
      description: `Repasse: ${descricao}`.slice(0, 140),
      externalReference: `repasse:${cobrancaId}`,
    });
    const status = t.status === "DONE" ? "transferido" : "aguardando";
    await db.from("repasses").update({ status, transferencia_id: t.id, erro: null }).eq("cobranca_id", cobrancaId);
    return { feito: true, status };
  } catch (e) {
    const erro = (e as Error).message.slice(0, 500);
    await db.from("repasses").update({ status: "erro", erro }).eq("cobranca_id", cobrancaId);
    return { feito: true, status: "erro" };
  }
}
