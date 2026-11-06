"use client";
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { Clock, Users, CalendarDays, HandHeart, Info, MapPin, Grid3x3, MessageCircle, Camera, CirclePlay, ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { sb } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import type { Post } from "@/lib/types";
import Avatar from "@/components/Avatar";
import GradePosts from "@/components/GradePosts";
import { Carregando, Folha, Vazio } from "@/components/ui";

export default function PerfilIgreja() {
  const { config } = useAuth();
  const router = useRouter();
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [num, setNum] = useState({ membros: 0, celulas: 0, posts: 0 });
  const [folha, setFolha] = useState<"cultos" | "sobre" | null>(null);

  useEffect(() => {
    sb().from("posts").select("*").order("criado_em", { ascending: false }).limit(90).then(({ data }) => setPosts((data as Post[]) || []));
    sb().rpc("estatisticas_igreja").then(({ data }) => {
      const r = (data as { membros: number; celulas: number; posts: number }[])?.[0];
      if (r) setNum({ membros: Number(r.membros), celulas: Number(r.celulas), posts: Number(r.posts) });
    });
  }, []);

  const nome = config?.nome_igreja || "Igreja Eklésia";
  const insta = config?.instagram ? (config.instagram.startsWith("http") ? config.instagram : `https://instagram.com/${config.instagram.replace("@", "")}`) : null;
  const zap = config?.whatsapp ? `https://wa.me/${config.whatsapp.replace(/\D/g, "")}` : null;

  return (
    <main>
      <header className="barra-topo">
        <button className="icone-sim" onClick={() => router.back()} aria-label="Voltar"><ChevronLeft size={26} /></button>
        <span className="titulo-topo">{nome}</span>
        <span style={{ width: 40 }} />
      </header>

      <div className="perfil-cab">
        <Avatar logo tam={86} anel={!!config?.ao_vivo} aovivo={!!config?.ao_vivo} />
        <div className="perfil-num">
          <div><b>{num.posts}</b><span>posts</span></div>
          <div><b>{num.membros}</b><span>membros</span></div>
          <div><b>{num.celulas}</b><span>células</span></div>
        </div>
      </div>
      <div className="perfil-bio">
        <span className="nome">{nome}</span>
        <span className="muted">Igreja</span>
        {config?.slogan && <span>{config.slogan}</span>}
        {config?.bio && <span className="quebra">{config.bio.length > 150 ? config.bio.slice(0, 150) + "…" : config.bio}</span>}
        {config?.endereco && (
          <a href={`https://maps.google.com/?q=${encodeURIComponent(config.endereco)}`} target="_blank" rel="noreferrer" style={{ color: "var(--primaria)", fontWeight: 600 }}>
            <MapPin size={13} style={{ verticalAlign: -2 }} /> {config.endereco}
          </a>
        )}
        {config?.ao_vivo && config.ao_vivo_url && (
          <a href={config.ao_vivo_url} target="_blank" rel="noreferrer" style={{ color: "var(--amem)", fontWeight: 700 }}>● Ao vivo agora — assistir</a>
        )}
      </div>

      <div className="perfil-botoes">
        <Link href="/ofertas" className="btn">Ofertar</Link>
        {zap && <a href={zap} target="_blank" rel="noreferrer" className="btn sec"><MessageCircle size={16} />Mensagem</a>}
        {insta && <a href={insta} target="_blank" rel="noreferrer" className="btn sec" style={{ flex: "0 0 40px" }} aria-label="Instagram"><Camera size={18} /></a>}
        {config?.youtube && <a href={config.youtube} target="_blank" rel="noreferrer" className="btn sec" style={{ flex: "0 0 40px" }} aria-label="YouTube"><CirclePlay size={18} /></a>}
      </div>

      <nav className="destaques" aria-label="Destaques">
        <Destaque rotulo="Cultos" onClick={() => setFolha("cultos")}><Clock size={24} /></Destaque>
        <Destaque rotulo="Células" href="/celulas"><Users size={24} /></Destaque>
        <Destaque rotulo="Agenda" href="/agenda"><CalendarDays size={24} /></Destaque>
        <Destaque rotulo="Ofertas" href="/ofertas"><HandHeart size={24} /></Destaque>
        <Destaque rotulo="Sobre" onClick={() => setFolha("sobre")}><Info size={24} /></Destaque>
      </nav>

      <div className="abas-perfil" style={{ gridTemplateColumns: "1fr" }}>
        <button className="on" aria-label="Posts"><Grid3x3 size={22} /></button>
      </div>
      {posts === null ? <Carregando /> : posts.length === 0 ? <div style={{ padding: 16 }}><Vazio>Nenhum post ainda.</Vazio></div> : <GradePosts posts={posts} />}

      <Folha aberta={folha === "cultos"} fechar={() => setFolha(null)} titulo="Cultos">
        <p className="quebra" style={{ fontSize: 17 }}>{config?.horarios_culto || "Horários ainda não cadastrados."}</p>
        {config?.endereco && (
          <a className="btn sec bloco" style={{ marginTop: 16 }} href={`https://maps.google.com/?q=${encodeURIComponent(config.endereco)}`} target="_blank" rel="noreferrer">
            <MapPin size={16} />Como chegar
          </a>
        )}
      </Folha>
      <Folha aberta={folha === "sobre"} fechar={() => setFolha(null)} titulo="Quem somos">
        <div style={{ textAlign: "center", marginBottom: 16 }}><img src="/logo.svg" alt="" width={62} height={100} /></div>
        <p className="quebra" style={{ fontSize: 16, lineHeight: 1.6 }}>{config?.bio || config?.slogan || "Em breve."}</p>
      </Folha>
    </main>
  );
}

function Destaque({ rotulo, href, onClick, children }: { rotulo: string; href?: string; onClick?: () => void; children: ReactNode }) {
  const conteudo = <><span className="circ"><div>{children}</div></span>{rotulo}</>;
  return href ? <Link href={href} className="destaque">{conteudo}</Link> : <button className="destaque" onClick={onClick}>{conteudo}</button>;
}
