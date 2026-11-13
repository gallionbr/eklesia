"use client";
// "Como chegar" + Uber + 99, lado a lado.
import { useEffect, useState } from "react";
import { MapPin, Car } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { toast } from "./ui";

let cache: Promise<{ lat?: number; lng?: number }> | null = null;

export default function ComoChegar() {
  const { config } = useAuth();
  const [pos, setPos] = useState<{ lat?: number; lng?: number }>({});
  useEffect(() => {
    cache ??= fetch("/api/local").then((r) => r.json()).catch(() => ({}));
    cache.then(setPos);
  }, []);
  const endereco = config?.endereco || "";
  const nome = config?.nome_igreja || "Igreja Eklésia";
  const mapa = config?.maps_url || (endereco ? `https://maps.google.com/?q=${encodeURIComponent(endereco)}` : null);
  if (!mapa && !endereco) return null;

  const uber = new URL("https://m.uber.com/ul/");
  uber.searchParams.set("action", "setPickup");
  uber.searchParams.set("pickup", "my_location");
  uber.searchParams.set("dropoff[nickname]", nome);
  if (endereco) uber.searchParams.set("dropoff[formatted_address]", endereco);
  if (pos.lat && pos.lng) { uber.searchParams.set("dropoff[latitude]", String(pos.lat)); uber.searchParams.set("dropoff[longitude]", String(pos.lng)); }

  // A 99 não aceita destino por link: copia o endereço e abre o app (ou o site).
  async function chamar99() {
    try { await navigator.clipboard.writeText(endereco); toast("Endereço copiado. Cole no destino da 99."); } catch { /* sem área de transferência */ }
    const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    location.href = ios ? "https://apps.apple.com/br/app/99-corridas-e-entregas/id553663691" : "https://play.google.com/store/apps/details?id=com.taxis99";
  }

  return (
    <div className="como-chegar">
      {mapa && <a className="btn" href={mapa} target="_blank" rel="noreferrer"><MapPin size={16} />Como chegar</a>}
      <a className="btn sec" href={uber.toString()} target="_blank" rel="noreferrer"><Car size={16} />Uber</a>
      <button type="button" className="btn sec" onClick={chamar99}><Car size={16} />99</button>
    </div>
  );
}
