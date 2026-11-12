"use client";
// Assistir: pregações, louvor e cultos do canal da Eklésia no YouTube, tocando dentro do app.
import { useEffect, useMemo, useState } from "react";
import { Play, Radio, ExternalLink } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Carregando, Vazio } from "@/components/ui";

interface Video { id: string; titulo: string; publicado: string; capa: string; descricao: string; views: number; tipo: "pregacao" | "louvor" | "outro" }
interface Dados { url?: string; aoVivo?: string | null; videos: Video[]; erro?: string }

const ABAS = [
  { id: "tudo", rotulo: "Tudo" },
  { id: "pregacao", rotulo: "Pregações" },
  { id: "louvor", rotulo: "Louvor" },
] as const;

const quando = (iso: string) => {
  const d = (Date.now() - new Date(iso).getTime()) / 86400e3;
  if (d < 1) return "hoje";
  if (d < 2) return "ontem";
  if (d < 30) return `há ${Math.floor(d)} dias`;
  return new Date(iso).toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" });
};
const vistos = (n: number) => (n >= 1000 ? `${(n / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil` : String(n)) + " visualizações";

function Player({ id, titulo, auto }: { id: string; titulo: string; auto?: boolean }) {
  return (
    <div className="player">
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${id}?rel=0&playsinline=1${auto ? "&autoplay=1" : ""}`}
        title={titulo} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen loading="lazy" referrerPolicy="strict-origin-when-cross-origin" />
    </div>
  );
}

export default function Assistir() {
  const { config } = useAuth();
  const [d, setD] = useState<Dados | null>(null);
  const [aba, setAba] = useState<(typeof ABAS)[number]["id"]>("tudo");
  const [tocando, setTocando] = useState<Video | null>(null);

  useEffect(() => {
    fetch("/api/youtube").then((r) => r.json()).then(setD).catch(() => setD({ videos: [], erro: "Sem conexão." }));
  }, []);

  const lista = useMemo(() => (d?.videos || []).filter((v) => aba === "tudo" || v.tipo === aba), [d, aba]);
  const destaque = tocando || (d?.videos || [])[0] || null;
  const canal = d?.url || config?.youtube || "https://www.youtube.com/@eklesiainternational";

  return (
    <main className="pagina assistir">
      <header className="doacao-topo">
        <h1>Assistir</h1>
        <p className="sub">Cultos, pregações e louvor da Eklésia</p>
      </header>

      {!d && <Carregando />}
      {d?.erro && !d.videos.length && <Vazio>Não foi possível carregar os vídeos agora. <a href={canal} target="_blank" rel="noreferrer">Abrir o canal no YouTube</a></Vazio>}

      {d?.aoVivo && (
        <section className="secao">
          <span className="selo-aovivo"><Radio size={14} /> AO VIVO AGORA</span>
          <Player id={d.aoVivo} titulo="Culto ao vivo" />
        </section>
      )}

      {!d?.aoVivo && destaque && (
        <section className="secao" id="player">
          <Player id={destaque.id} titulo={destaque.titulo} auto={!!tocando} />
          <div>
            <h2 className="video-titulo">{destaque.titulo}</h2>
            <p className="muted peq">{quando(destaque.publicado)}{destaque.views ? ` · ${vistos(destaque.views)}` : ""}</p>
          </div>
        </section>
      )}

      {d && d.videos.length > 0 && (
        <>
          <div className="abas">
            {ABAS.map((a) => <button key={a.id} className={`aba ${aba === a.id ? "ativa" : ""}`} onClick={() => setAba(a.id)}>{a.rotulo}</button>)}
          </div>
          {lista.length === 0 ? <p className="muted peq">Nenhum vídeo recente nessa categoria.</p> : (
            <ul className="videos">
              {lista.map((v) => (
                <li key={v.id}>
                  <button type="button" className={`video ${destaque?.id === v.id && !d.aoVivo ? "atual" : ""}`}
                    onClick={() => { setTocando(v); document.getElementById("player")?.scrollIntoView({ behavior: "smooth" }); }}>
                    <span className="video-capa">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={v.capa || `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`} alt="" loading="lazy" />
                      <Play size={22} fill="currentColor" aria-hidden />
                    </span>
                    <span className="cresce">
                      <b>{v.titulo}</b>
                      <span className="muted peq">{quando(v.publicado)}{v.views ? ` · ${vistos(v.views)}` : ""}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <a className="btn sec bloco" href={canal} target="_blank" rel="noreferrer"><ExternalLink size={16} /> Ver todos os vídeos no YouTube</a>
        </>
      )}
    </main>
  );
}
