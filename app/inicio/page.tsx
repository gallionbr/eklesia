"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MapPin, Grid3x3, Rows3, MessageCircle, Camera, CirclePlay, Pin, Clock } from "lucide-react";
import { sb } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import type { Post } from "@/lib/types";
import Avatar from "@/components/Avatar";
import GradePosts from "@/components/GradePosts";
import StoriesBar from "@/components/Stories";
import Feed from "@/components/Feed";
import { ITENS_MENU, useResumoMenu } from "@/components/MenuCards";
import { Carregando, Folha } from "@/components/ui";

/** Home = perfil da igreja: cabeçalho, stories, cards fixados e posts. */
export default function Inicio() {
  const { config } = useAuth();
  const router = useRouter();
  const subtitulo = useResumoMenu();
  const [aba, setAba] = useState<"grade" | "feed">("grade");
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [num, setNum] = useState({ membros: 0, celulas: 0, posts: 0 });
  const [sobre, setSobre] = useState(false);

  useEffect(() => {
    sb().from("posts").select("*").order("criado_em", { ascending: false }).limit(90).then(({ data }) => setPosts((data as Post[]) || []));
    sb().rpc("estatisticas_igreja").then(({ data }) => {
      const r = (data as { membros: number; celulas: number; posts: number }[])?.[0];
      if (r) setNum({ membros: Number(r.membros), celulas: Number(r.celulas), posts: Number(r.posts) });
    });
    if (new URLSearchParams(location.search).get("sobre")) setSobre(true);
  }, []);

  function fecharSobre() {
    setSobre(false);
    if (location.search.includes("sobre")) router.replace("/inicio");
  }

  const nome = config?.nome_igreja || "Igreja Eklésia";
  const insta = config?.instagram ? (config.instagram.startsWith("http") ? config.instagram : `https://instagram.com/${config.instagram.replace("@", "")}`) : null;
  const zap = config?.whatsapp ? `https://wa.me/${config.whatsapp.replace(/\D/g, "")}` : null;
  const mapa = config?.maps_url || (config?.endereco ? `https://maps.google.com/?q=${encodeURIComponent(config.endereco)}` : null);

  const fixados = ITENS_MENU.map(({ k, titulo, href, Icone, fundo }) => {
    const capa = config?.capas?.[k];
    const sub = subtitulo(k);
    const conteudo = (
      <>
        {capa ? <img src={capa} alt="" loading="lazy" /> : <Icone className="fixado-icone" size={52} strokeWidth={1.2} aria-hidden="true" />}
        <Pin className="alfinete" size={16} fill="currentColor" aria-label="Fixado" />
        <span className="fixado-texto">
          <b><Icone size={15} strokeWidth={2.2} />{titulo}</b>
          {sub && <span className={k === "igreja" && config?.ao_vivo ? "vivo" : ""}>{sub}</span>}
        </span>
      </>
    );
    return k === "igreja" ? (
      <a key={k} href="#sobre" className="fixado" style={{ background: fundo }} onClick={(e) => { e.preventDefault(); setSobre(true); }}>{conteudo}</a>
    ) : (
      <Link key={k} href={href} className="fixado" style={{ background: fundo }}>{conteudo}</Link>
    );
  });

  return (
    <main>
      <header className="barra-topo">
        <span style={{ fontWeight: 700, fontSize: 20, flex: 1, textAlign: "center", paddingLeft: 40 }}>{nome}</span>
        <span style={{ width: 40 }} />
      </header>

      <div className="perfil-cab">
        {config?.ao_vivo && config.ao_vivo_url ? (
          <a href={config.ao_vivo_url} target="_blank" rel="noreferrer" aria-label="Assistir ao vivo"><Avatar logo tam={86} anel aovivo /></a>
        ) : (
          <Avatar logo tam={86} />
        )}
        <div className="perfil-num">
          <div><b>{num.posts}</b><span>posts</span></div>
          <div><b>{num.membros}</b><span>membros</span></div>
          <Link href="/celulas"><b>{num.celulas}</b><span>células</span></Link>
        </div>
      </div>
      <div className="perfil-bio">
        <span className="nome">{nome}</span>
        <span className="muted">Igreja</span>
        {config?.slogan && <span>{config.slogan}</span>}
        {mapa && (
          <a href={mapa} target="_blank" rel="noreferrer" style={{ color: "var(--primaria)", fontWeight: 600 }}>
            <MapPin size={13} style={{ verticalAlign: -2 }} /> {config?.endereco || "Ver no mapa"}
          </a>
        )}
        {config?.ao_vivo && config.ao_vivo_url && (
          <a href={config.ao_vivo_url} target="_blank" rel="noreferrer" style={{ color: "var(--amem)", fontWeight: 700 }}>● Ao vivo agora — assistir</a>
        )}
      </div>

      <div className="perfil-botoes">
        <Link href="/ofertas" className="btn">Doar</Link>
        {zap && <a href={zap} target="_blank" rel="noreferrer" className="btn sec"><MessageCircle size={16} />Mensagem</a>}
        {insta && <a href={insta} target="_blank" rel="noreferrer" className="btn sec" style={{ flex: "0 0 40px" }} aria-label="Instagram"><Camera size={18} /></a>}
        {config?.youtube && <a href={config.youtube} target="_blank" rel="noreferrer" className="btn sec" style={{ flex: "0 0 40px" }} aria-label="YouTube"><CirclePlay size={18} /></a>}
      </div>

      <div className="perfil-stories"><StoriesBar /></div>

      <div className="abas-perfil">
        <button className={aba === "grade" ? "on" : ""} onClick={() => setAba("grade")} aria-label="Grade" aria-pressed={aba === "grade"}><Grid3x3 size={22} /></button>
        <button className={aba === "feed" ? "on" : ""} onClick={() => setAba("feed")} aria-label="Feed com avisos, eventos e pedidos" aria-pressed={aba === "feed"}><Rows3 size={22} /></button>
      </div>

      {aba === "grade" ? (
        <>
          <GradePosts posts={posts || []} fixados={fixados} />
          {posts === null && <Carregando />}
        </>
      ) : (
        <Feed />
      )}

      <Folha aberta={sobre} fechar={fecharSobre} titulo={nome}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ textAlign: "center" }}><img src="/logo.svg" alt="" width={62} height={100} /></div>
          {(config?.bio || config?.slogan) && <p className="quebra" style={{ fontSize: 16, lineHeight: 1.6 }}>{config?.bio || config?.slogan}</p>}
          <div className="card ouro" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <b className="linha" style={{ gap: 6 }}><Clock size={16} color="var(--ouro)" />Cultos</b>
            <p className="quebra">{config?.horarios_culto || "Horários ainda não cadastrados."}</p>
            {config?.endereco && <p className="muted peq">{config.endereco}</p>}
          </div>
          {mapa && <a className="btn sec bloco" href={mapa} target="_blank" rel="noreferrer"><MapPin size={16} />Como chegar</a>}
        </div>
      </Folha>
    </main>
  );
}
