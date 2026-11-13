// Coordenadas da igreja a partir do link do Google Maps cadastrado no Painel
// (para o botão do Uber já abrir com o destino certo). Cache de 1 dia.
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/dizimo/servidor/env";

export const dynamic = "force-dynamic";

function coordenadas(url: string): { lat: number; lng: number } | null {
  const m = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) || url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) || url.match(/[?&](?:q|ll|query)=(-?\d+\.\d+),(-?\d+\.\d+)/);
  return m ? { lat: Number(m[1]), lng: Number(m[2]) } : null;
}

export async function GET(req: Request) {
  const debug = new URL(req.url).searchParams.has("debug");
  const passos: string[] = [];
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
      passos.push(`${r?.status} ${url.slice(0, 160)} -> ${(prox || "").slice(0, 300)}`);
      if (!prox) {
        const html = r ? await r.text().catch(() => "") : "";
        // A página do Maps traz o centro do mapa em APP_INITIALIZATION_STATE=[[[altitude, lng, lat]...
        const ini = html.match(/APP_INITIALIZATION_STATE=\[\[\[(-?[\d.]+),(-?[\d.]+),(-?[\d.]+)\]/);
        // Só vale se o mapa estiver de perto (altitude baixa); de longe é o centro do Brasil.
        pos = ini && Number(ini[1]) < 20000 ? { lat: Number(ini[3]), lng: Number(ini[2]) } : null;
        if (debug) passos.push(`html ${html.length} ini=${ini?.[0]?.slice(0, 80) || "-"}`);
        break;
      }
      url = new URL(prox, url).toString();
      pos = coordenadas(decodeURIComponent(url));
    }
  }
  // Sem coordenadas no link: procura o endereço no OpenStreetMap (gratuito, com cache de 1 dia).
  if (!pos && c?.endereco) {
    const q = new URLSearchParams({ q: c.endereco.replace(/\b(Qd|Quadra)\s*\d+,?/i, ""), format: "json", limit: "1", countrycodes: "br" });
    const r = await fetch(`https://nominatim.openstreetmap.org/search?${q}`, {
      headers: { "User-Agent": "EklesiaApp/1.0 (https://eklesia.international)", "Accept-Language": "pt-BR" },
    }).then((x) => x.json()).catch(() => []) as { lat: string; lon: string; display_name?: string }[];
    if (r[0]) pos = { lat: Number(r[0].lat), lng: Number(r[0].lon) };
    if (debug) passos.push(`osm ${r[0]?.display_name || "nada"}`);
  }
  return NextResponse.json({ endereco: c?.endereco || null, ...(pos || {}), ...(debug ? { passos } : {}) },
    { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } });
}
