// Coordenadas da igreja a partir do link do Google Maps cadastrado no Painel
// (para o botão do Uber já abrir com o destino certo). Cache de 1 dia.
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/dizimo/servidor/env";

export const revalidate = 86400;

function coordenadas(url: string): { lat: number; lng: number } | null {
  const m = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) || url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) || url.match(/[?&](?:q|ll|query)=(-?\d+\.\d+),(-?\d+\.\d+)/);
  return m ? { lat: Number(m[1]), lng: Number(m[2]) } : null;
}

export async function GET() {
  if (!env.supabaseUrl || !env.supabaseServiceKey) return NextResponse.json({});
  const db = createClient(env.supabaseUrl, env.supabaseServiceKey, { auth: { persistSession: false } });
  const { data } = await db.from("config").select("maps_url, endereco").maybeSingle();
  const c = data as { maps_url?: string | null; endereco?: string | null } | null;
  let pos = c?.maps_url ? coordenadas(c.maps_url) : null;
  if (!pos && c?.maps_url) {
    // Link curto (maps.app.goo.gl): segue os redirecionamentos e lê as coordenadas do endereço final.
    let url = c.maps_url;
    for (let i = 0; i < 5 && !pos; i++) {
      const r = await fetch(url, { redirect: "manual", headers: { "User-Agent": "Mozilla/5.0" } }).catch(() => null);
      const prox = r?.headers.get("location");
      if (!prox) {
        const html = r ? await r.text().catch(() => "") : "";
        pos = coordenadas(html.match(/https:\/\/www\.google\.com\/maps[^"'\s]+/)?.[0] || "");
        break;
      }
      url = new URL(prox, url).toString();
      pos = coordenadas(decodeURIComponent(url));
    }
  }
  return NextResponse.json({ endereco: c?.endereco || null, ...(pos || {}) });
}
