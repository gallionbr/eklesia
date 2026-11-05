"use client";
import Link from "next/link";
import { Users, MessageCircleHeart, UserRound, ShieldCheck, Camera, CirclePlay, MessageCircle, ChevronRight, LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Topo } from "@/components/ui";

export default function Mais() {
  const { perfil, config, isAdmin, sair } = useAuth();

  const itens = [
    { href: "/celulas", rotulo: "Células", sub: "Encontre ou acompanhe sua célula", Icone: Users },
    { href: "/oracao", rotulo: "Pedidos de oração", sub: "Peça oração e ore pelos irmãos", Icone: MessageCircleHeart },
    { href: "/perfil", rotulo: "Meu perfil", sub: perfil?.email || "", Icone: UserRound },
    ...(isAdmin ? [{ href: "/admin", rotulo: "Painel administrativo", sub: "Avisos, agenda, membros e mais", Icone: ShieldCheck }] : []),
  ];

  const redes = [
    config?.instagram && { href: config.instagram.startsWith("http") ? config.instagram : `https://instagram.com/${config.instagram.replace("@", "")}`, rotulo: "Instagram", Icone: Camera },
    config?.youtube && { href: config.youtube, rotulo: "YouTube", Icone: CirclePlay },
    config?.whatsapp && { href: `https://wa.me/${config.whatsapp.replace(/\D/g, "")}`, rotulo: "WhatsApp", Icone: MessageCircle },
  ].filter(Boolean) as { href: string; rotulo: string; Icone: typeof Users }[];

  return (
    <main className="pagina">
      <Topo titulo="Mais" />
      <div className="lista">
        {itens.map(({ href, rotulo, sub, Icone }) => (
          <Link key={href} href={href} className="card linha">
            <Icone size={22} color="var(--ouro)" />
            <div className="cresce"><b>{rotulo}</b>{sub && <p className="muted peq">{sub}</p>}</div>
            <ChevronRight size={18} className="muted" />
          </Link>
        ))}
      </div>

      {redes.length > 0 && (
        <section className="secao">
          <h2>Acompanhe a igreja</h2>
          <div className="linha" style={{ flexWrap: "wrap" }}>
            {redes.map(({ href, rotulo, Icone }) => (
              <a key={rotulo} href={href} target="_blank" rel="noreferrer" className="btn sec peq"><Icone size={16} />{rotulo}</a>
            ))}
          </div>
        </section>
      )}

      <button className="btn perigo bloco" onClick={sair}><LogOut size={18} />Sair</button>

      <div style={{ textAlign: "center", marginTop: 8 }}>
        <img src="/logo.svg" alt="" width={30} height={48} style={{ filter: "grayscale(1)", opacity: .45 }} />
        <p className="muted peq">{config?.nome_igreja || "Igreja Eklésia"}</p>
      </div>
    </main>
  );
}
