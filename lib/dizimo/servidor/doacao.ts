// Split de cada doação pelo app (usado no pagamento direto e no checkout).
//  · Missões / Primícias → 100% para a subconta.
//  · Dízimo / Oferta     → % do repasse (45%) do bruto para a subconta de destino, se Ligado.

import type { SupabaseClient } from "@supabase/supabase-js";
import { calcularRepasse } from "./repasse-regra.ts";

export const NOMES_DOACAO = {
  dizimo: "Dízimo", oferta: "Oferta", missoes: "Oferta de Missões", primicias: "Primícias",
  rede_rosa: "Doação Rede Rosa", rede_azul: "Doação Rede Azul", rede_santa: "Doação Rede Santa", rede_familia: "Doação Rede da Família",
} as const;
export type TipoDoacao = keyof typeof NOMES_DOACAO;

export async function montarSplit(db: SupabaseClient, tipo: TipoDoacao, centavos: number, userId: string):
  Promise<{ split: { walletId: string; percentual?: number; fixo?: number } | null; referencia: string } | { erro: string }> {
  let referencia = `app:${tipo}:${userId}`;
  if (tipo !== "dizimo" && tipo !== "oferta") {  // Missões, Primícias e Redes: 100% na subconta
    const { data } = await db.from("asaas_carteiras").select("wallet_id, percentual").eq("tipo", tipo).maybeSingle();
    const c = data as { wallet_id: string; percentual: number } | null;
    if (c) return { split: { walletId: c.wallet_id, percentual: Number(c.percentual) }, referencia };
    // Sem subconta: entra na conta da Eklésia e o app repassa por Pix assim que cair.
    const { data: d } = await db.from("destinos_pix").select("ativo").eq("tipo", tipo).maybeSingle();
    if ((d as { ativo?: boolean } | null)?.ativo) return { split: null, referencia };
    return { erro: "Esta doação ainda não está disponível pelo app." };
  }
  const { data: r } = await db.from("repasse_regra").select("modo, percentual, destino").maybeSingle();
  const regra = r as { modo: string; percentual: number; destino: string } | null;
  if (regra?.modo === "ativo") {
    const { data: d } = await db.from("asaas_carteiras").select("wallet_id").eq("tipo", regra.destino).maybeSingle();
    const w = (d as { wallet_id?: string } | null)?.wallet_id;
    const parte = calcularRepasse(centavos, Number(regra.percentual));
    if (w && parte > 0) return { split: { walletId: w, fixo: parte }, referencia: referencia + ":split" };
  }
  return { split: null, referencia };
}
