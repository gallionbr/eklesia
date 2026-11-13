// Ponto aproximado de um bairro (OpenStreetMap), para o mapa da tela do PG. Cache de 30 dias.
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get("q") || "").trim().slice(0, 160);
  if (q.length < 3) return NextResponse.json({}, { status: 400 });
  const p = new URLSearchParams({ q, format: "json", limit: "1", countrycodes: "br" });
  const r = await fetch(`https://nominatim.openstreetmap.org/search?${p}`, {
    headers: { "User-Agent": "EklesiaApp/1.0 (https://eklesia.international)", "Accept-Language": "pt-BR" },
  }).then((x) => x.json()).catch(() => []) as { lat: string; lon: string }[];
  if (!r[0]) return NextResponse.json({}, { headers: { "Cache-Control": "public, s-maxage=3600" } });
  return NextResponse.json({ lat: Number(r[0].lat), lng: Number(r[0].lon) }, { headers: { "Cache-Control": "public, s-maxage=2592000" } });
}
