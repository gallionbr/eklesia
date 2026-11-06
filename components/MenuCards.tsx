"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Church, Users, CalendarDays, MessageCircleHeart, HandHeart, type LucideIcon } from "lucide-react";
import { sb } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { diaMes } from "@/lib/format";

export type ChaveMenu = "igreja" | "celulas" | "agenda" | "oracao" | "ofertas";

export const ITENS_MENU: { k: ChaveMenu; titulo: string; href: string; Icone: LucideIcon; fundo: string }[] = [
  { k: "igreja", titulo: "Igreja", href: "/igreja", Icone: Church, fundo: "linear-gradient(160deg,#084f9b,#06397a)" },
  { k: "celulas", titulo: "Células", href: "/celulas", Icone: Users, fundo: "linear-gradient(160deg,#0e9f47,#0b5e33)" },
  { k: "agenda", titulo: "Agenda", href: "/agenda", Icone: CalendarDays, fundo: "linear-gradient(160deg,#1dcdda,#084f9b)" },
  { k: "oracao", titulo: "Oração", href: "/oracao", Icone: MessageCircleHeart, fundo: "linear-gradient(160deg,#b48f4b,#6b4f1f)" },
  { k: "ofertas", titulo: "Ofertas", href: "/ofertas", Icone: HandHeart, fundo: "linear-gradient(160deg,#2b2b2b,#000)" },
];

/** Atalhos do app em cards com foto, no estilo dos posts. */
export default function MenuCards() {
  const { config } = useAuth();
  const [sub, setSub] = useState<Partial<Record<ChaveMenu, string>>>({});

  useEffect(() => {
    const agora = new Date().toISOString();
    Promise.all([
      sb().from("celulas").select("id", { count: "exact", head: true }).eq("ativa", true),
      sb().from("eventos").select("titulo,inicio").gte("inicio", agora).order("inicio").limit(1).maybeSingle(),
      sb().from("pedidos_oracao").select("id", { count: "exact", head: true }).eq("publico", true).eq("respondido", false),
    ]).then(([c, e, o]) => {
      const ev = e.data as { titulo: string; inicio: string } | null;
      setSub({
        celulas: c.count ? `${c.count} ${c.count === 1 ? "célula" : "células"} nas casas` : "Encontre uma perto de você",
        agenda: ev ? `${diaMes(ev.inicio).dia} ${diaMes(ev.inicio).mes} · ${ev.titulo}` : "Cultos e eventos",
        oracao: o.count ? `${o.count} ${o.count === 1 ? "pedido" : "pedidos"} no mural` : "Peça e ore pelos irmãos",
      });
    });
  }, []);

  const subtitulo = (k: ChaveMenu) =>
    k === "igreja" ? (config?.ao_vivo ? "● Ao vivo agora" : config?.horarios_culto?.split(/\n|·/)[0]?.trim() || "Quem somos")
    : k === "ofertas" ? "Dízimos e ofertas via Pix"
    : sub[k] || "";

  return (
    <nav className="menu-cards" aria-label="Menu">
      {ITENS_MENU.map(({ k, titulo, href, Icone, fundo }) => {
        const capa = config?.capas?.[k];
        return (
          <Link key={k} href={href} className="menu-card" style={{ background: fundo }}>
            {capa ? <img src={capa} alt="" loading="lazy" /> : <Icone className="menu-card-icone" size={64} strokeWidth={1.2} aria-hidden="true" />}
            <div className="menu-card-texto">
              <b><Icone size={16} strokeWidth={2.2} />{titulo}</b>
              <span className={k === "igreja" && config?.ao_vivo ? "vivo" : ""}>{subtitulo(k)}</span>
            </div>
          </Link>
        );
      })}
    </nav>
  );
}
