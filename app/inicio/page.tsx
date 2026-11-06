"use client";
import Link from "next/link";
import { CalendarDays, MessageCircleHeart } from "lucide-react";
import { useAuth } from "@/lib/auth";
import StoriesBar from "@/components/Stories";
import Feed from "@/components/Feed";
import MenuCards from "@/components/MenuCards";

export default function Inicio() {
  const { config } = useAuth();
  const nome = config?.nome_igreja?.replace(/^Igreja\s+/i, "") || "Eklésia";
  return (
    <main>
      <header className="barra-topo">
        <Link href="/igreja" className="marca" aria-label={`Perfil da ${config?.nome_igreja || "igreja"}`}>
          <img src="/logo.svg" alt="" width={19} height={30} />
          {nome}
        </Link>
        <div className="acoes">
          <Link href="/agenda" className="icone-sim" aria-label="Agenda"><CalendarDays size={24} strokeWidth={1.8} /></Link>
          <Link href="/oracao" className="icone-sim" aria-label="Pedidos de oração"><MessageCircleHeart size={24} strokeWidth={1.8} /></Link>
        </div>
      </header>
      <StoriesBar />
      <MenuCards />
      <Feed />
    </main>
  );
}
