// QR Code do dízimo. O QR aponta para HTTPS://EKLESIA.INTERNATIONAL/D/LED (curto, em
// maiúsculas = QR menor e mais fácil de ler no painel). O next.config reescreve /D e /d
// para esta rota, que conta o scan e manda a pessoa para o WhatsApp da igreja.

import { NextResponse } from "next/server";
import { linkWhatsapp, repoReal } from "@/lib/dizimo/servidor";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ codigo?: string[] }> }) {
  const { codigo } = await ctx.params;
  const cod = (codigo?.[0] || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);

  let texto = `Quero contribuir #${cod || "GERAL"}`;
  const repo = repoReal();
  if (repo) {
    try {
      texto = await repo.registrarScan(cod);
    } catch (e) {
      // Contar o scan nunca pode impedir a pessoa de chegar no WhatsApp.
      console.error("[dizimo] registrar_scan", (e as Error).message);
    }
  }

  const destino = linkWhatsapp(texto);
  if (!destino) {
    // WhatsApp ainda não configurado: leva para a tela de ofertas (Pix estático).
    return NextResponse.redirect(new URL("/ofertas", req.url), 302);
  }
  return NextResponse.redirect(destino, { status: 302, headers: { "Cache-Control": "no-store" } });
}
