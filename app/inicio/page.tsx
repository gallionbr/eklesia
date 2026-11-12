"use client";
// Início em vitrine: destaque grande (ao vivo ou última mensagem) e faixas horizontais
// com agenda, próximos passos, mensagens, novidades da liderança e projetos.
import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, MapPin, Play, Radio, Clock } from "lucide-react";
import { sb } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import type { Evento, Post } from "@/lib/types";
import { useYoutube, capaGrande, capaMedia } from "@/lib/youtube";
import { PASSOS, PROJETOS, linkZap } from "@/lib/passos";
import BarraTopo from "@/components/BarraTopo";

const dia = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", timeZone: "America/Fortaleza" });
const mes = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { month: "short", timeZone: "America/Fortaleza" }).replace(".", "");
const hora = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Fortaleza" });

function Faixa({ titulo, href, children }: { titulo: string; href?: string; children: React.ReactNode }) {
  return (
    <section className="faixa">
      <div className="faixa-tit">
        <h2>{titulo}</h2>
        {href && <Link href={href} aria-label={`Ver tudo: ${titulo}`}>Ver tudo <ChevronRight size={16} /></Link>}
      </div>
      <div className="faixa-rolo">{children}</div>
    </section>
  );
}

export default function Inicio() {
  const { config, perfil } = useAuth();
  const yt = useYoutube();
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);

  useEffect(() => {
    sb().from("eventos").select("*").gte("inicio", new Date().toISOString()).order("inicio").limit(10)
      .then(({ data }) => setEventos((data as Evento[]) || []));
    sb().from("posts").select("*").order("criado_em", { ascending: false }).limit(12)
      .then(({ data }) => setPosts((data as Post[]) || []));
  }, []);

  const aoVivo = yt?.aoVivo || (config?.ao_vivo ? "url" : null);
  const ultimo = yt?.videos?.[0];
  const heroId = yt?.aoVivo || ultimo?.id;
  const primeiroNome = perfil?.nome?.split(" ")[0];
  const mapa = config?.maps_url || (config?.endereco ? `https://maps.google.com/?q=${encodeURIComponent(config.endereco)}` : null);

  return (
    <main className="el-pagina">
      <BarraTopo />

      <div className="saudacao">
        <p>{primeiroNome ? `Olá, ${primeiroNome}` : "Bem-vindo"}</p>
        <h1>{config?.nome_igreja || "Eklésia"}</h1>
      </div>

      <Link href="/assistir" className="hero">
        {heroId ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={capaGrande(heroId)} alt="" onError={(e) => { (e.target as HTMLImageElement).src = capaMedia(heroId); }} />
        ) : config?.capas?.igreja ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={config.capas.igreja} alt="" />
        ) : null}
        <span className="hero-veu" />
        <span className="hero-txt">
          {aoVivo ? <span className="selo-aovivo"><Radio size={14} /> AO VIVO AGORA</span> : <span className="hero-rot">Mensagem mais recente</span>}
          <b>{aoVivo ? "Culto ao vivo" : ultimo?.titulo || config?.slogan || "Bem-vindo à Eklésia"}</b>
          <span className="hero-btn"><Play size={16} fill="currentColor" /> Assistir</span>
        </span>
      </Link>

      {eventos.length > 0 && (
        <Faixa titulo="Esta semana" href="/agenda">
          {eventos.map((e) => (
            <Link key={e.id} href="/agenda" className="cartao-ev">
              <span className="data"><b>{dia(e.inicio)}</b>{mes(e.inicio)}</span>
              <b className="tit">{e.titulo}</b>
              <span className="muted peq"><Clock size={12} /> {hora(e.inicio)}{e.local ? ` · ${e.local}` : ""}</span>
            </Link>
          ))}
        </Faixa>
      )}

      <Faixa titulo="Seu próximo passo" href="/participe">
        {PASSOS.map((p) => {
          const href = p.href || linkZap(config?.whatsapp, p.zap || "") || "/participe";
          const externo = !p.href && href.startsWith("http");
          return (
            <a key={p.id} href={href} target={externo ? "_blank" : undefined} rel={externo ? "noreferrer" : undefined}
              className="cartao-passo" style={{ background: p.fundo }}>
              <p.Icone size={30} strokeWidth={1.6} aria-hidden />
              <b>{p.titulo}</b>
              <span>{p.sub}</span>
            </a>
          );
        })}
      </Faixa>

      {!!yt?.videos?.length && (
        <Faixa titulo="Mensagens" href="/assistir">
          {yt.videos.slice(0, 8).map((v) => (
            <Link key={v.id} href={`/assistir?v=${v.id}`} className="cartao-video">
              <span className="capa">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={v.capa || capaMedia(v.id)} alt="" loading="lazy" />
                <Play size={20} fill="currentColor" aria-hidden />
              </span>
              <b>{v.titulo}</b>
            </Link>
          ))}
        </Faixa>
      )}

      {posts.length > 0 && (
        <Faixa titulo="Novidades">
          {posts.map((p) => {
            const m = p.midias?.[0];
            return (
              <Link key={p.id} href={`/post/${p.id}`} className="cartao-novo">
                {m ? (
                  m.tipo === "video"
                    ? <video src={m.url} muted playsInline preload="metadata" />
                    // eslint-disable-next-line @next/next/no-img-element
                    : <img src={m.url} alt="" loading="lazy" />
                ) : <span className="sem-foto" />}
                <span className="hero-veu" />
                <span className="legenda">{p.legenda || "Ver publicação"}</span>
              </Link>
            );
          })}
        </Faixa>
      )}

      <Faixa titulo="Projetos da Eklésia" href="/participe#projetos">
        {PROJETOS.map((p) => (
          <Link key={p.id} href={`/participe#${p.id}`} className="cartao-passo largo" style={{ background: p.fundo }}>
            <p.Icone size={30} strokeWidth={1.6} aria-hidden />
            <b>{p.titulo}</b>
            <span>{p.curto}</span>
          </Link>
        ))}
      </Faixa>

      <section className="visite">
        <h2>Visite-nos</h2>
        <p className="quebra">{config?.horarios_culto || "Horários dos cultos em breve."}</p>
        {config?.endereco && <p className="muted">{config.endereco}</p>}
        <div className="linha" style={{ gap: 8, flexWrap: "wrap" }}>
          {mapa && <a className="btn" href={mapa} target="_blank" rel="noreferrer"><MapPin size={16} />Como chegar</a>}
          <Link className="btn contorno" href="/ofertas">Doar</Link>
        </div>
      </section>
    </main>
  );
}
