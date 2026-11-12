"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Plus, X, Trash2 } from "lucide-react";
import { sb, msgErro } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { apagarArquivos, perfisPublicos } from "@/lib/midia";
import { hojeISO, relativo } from "@/lib/format";
import type { Devocional, Story } from "@/lib/types";
import Avatar from "./Avatar";
import { toast } from "./ui";

export interface Slide {
  id: string;
  tipo: "imagem" | "video" | "texto";
  url?: string | null;
  texto?: string | null;
  rotulo?: string;
  cor?: string | null;
  criado_em?: string;
  story?: Story;
}
export interface Grupo { id: string; nome: string; avatar?: string | null; logo?: boolean; slides: Slide[] }

const CHAVE_VISTOS = "eklesia:vistos";
const lerVistos = (): Set<string> => { try { return new Set(JSON.parse(localStorage.getItem(CHAVE_VISTOS) || "[]")); } catch { return new Set(); } };
const salvarVistos = (s: Set<string>) => { try { localStorage.setItem(CHAVE_VISTOS, JSON.stringify([...s].slice(-400))); } catch {} };

export const CORES_STORY = [
  "linear-gradient(160deg,#f07a3a,#b8410f)",
  "linear-gradient(160deg,#0e9f47,#0b5e33)",
  "linear-gradient(160deg,#b48f4b,#6b4f1f)",
  "linear-gradient(160deg,#f7a24a,#d9541c)",
  "linear-gradient(160deg,#2b2b2b,#000)",
];

function slidesDevocional(d: Devocional): Slide[] {
  const base = { tipo: "texto" as const, cor: CORES_STORY[2] };
  const partes = d.reflexao.split(/\n{2,}/).flatMap((p) => (p.length > 320 ? p.match(/[^.!?]+[.!?]+|\S[^.!?]*$/g) || [p] : [p]));
  const blocos: string[] = [];
  for (const p of partes) {
    const ult = blocos[blocos.length - 1];
    if (ult && (ult + " " + p).length < 300) blocos[blocos.length - 1] = ult + " " + p.trim(); else blocos.push(p.trim());
  }
  return [
    { ...base, id: `devo-${d.data}-0`, texto: d.titulo, rotulo: "Devocional de hoje", cor: CORES_STORY[0] },
    { ...base, id: `devo-${d.data}-1`, texto: `“${d.texto_biblico}”`, rotulo: d.referencia },
    ...blocos.filter(Boolean).map((b, i) => ({ ...base, id: `devo-${d.data}-r${i}`, texto: b, rotulo: "Reflexão", cor: CORES_STORY[4] })),
    ...(d.oracao ? [{ ...base, id: `devo-${d.data}-o`, texto: d.oracao, rotulo: "Oração", cor: CORES_STORY[1] }] : []),
  ];
}

export default function StoriesBar() {
  const { perfil, config, isLider } = useAuth();
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [vistos, setVistos] = useState<Set<string>>(new Set());
  const [aberto, setAberto] = useState<number | null>(null);

  const carregar = useCallback(async () => {
    const agora = new Date().toISOString();
    const [s, c, d] = await Promise.all([
      sb().from("stories").select("*").or(`expira_em.is.null,expira_em.gt.${agora}`).order("criado_em"),
      sb().from("celulas").select("id,nome"),
      sb().from("devocionais").select("*").eq("data", hojeISO()).maybeSingle(),
    ]);
    const stories = (s.data as Story[]) || [];
    const celulas = Object.fromEntries(((c.data as { id: string; nome: string }[]) || []).map((x) => [x.id, x.nome]));
    const autores = await perfisPublicos(stories.map((x) => x.autor_id));
    const gs: Grupo[] = [];
    if (d.data) gs.push({ id: "devocional", nome: "Devocional", logo: true, slides: slidesDevocional(d.data as Devocional) });
    const porGrupo = new Map<string, Story[]>();
    for (const st of stories) {
      const k = st.celula_id || "igreja";
      porGrupo.set(k, [...(porGrupo.get(k) || []), st]);
    }
    const ordem = [...porGrupo.keys()].sort((a, b) =>
      a === "igreja" ? -1 : b === "igreja" ? 1 : a === perfil?.celula_id ? -1 : b === perfil?.celula_id ? 1 : 0);
    for (const k of ordem) {
      const lista = porGrupo.get(k)!;
      const ultimoAutor = autores[lista[lista.length - 1].autor_id];
      gs.push({
        id: k,
        nome: k === "igreja" ? config?.nome_igreja?.replace(/^Igreja\s+/i, "") || "Eklésia" : celulas[k] || "Célula",
        logo: k === "igreja",
        avatar: k === "igreja" ? null : ultimoAutor?.avatar_url,
        slides: lista.map((st) => ({ id: st.id, tipo: st.tipo, url: st.midia_url, texto: st.texto, cor: st.cor, criado_em: st.criado_em, story: st })),
      });
    }
    setGrupos(gs);
  }, [perfil?.celula_id, config?.nome_igreja]);

  useEffect(() => { setVistos(lerVistos()); carregar(); }, [carregar]);

  const marcarVisto = useCallback((id: string) => {
    setVistos((v) => { if (v.has(id)) return v; const n = new Set(v); n.add(id); salvarVistos(n); return n; });
  }, []);

  const tudoVisto = (g: Grupo) => g.slides.every((s) => vistos.has(s.id));
  const ordenados = [...grupos].sort((a, b) => Number(tudoVisto(a)) - Number(tudoVisto(b)));

  if (!isLider && !config?.ao_vivo && ordenados.length === 0) return null;

  return (
    <>
      <div className="stories" role="list" aria-label="Stories">
        {isLider && (
          <Link href="/criar?tipo=story" className="story-bolha" role="listitem">
            <div style={{ position: "relative", padding: 4 }}>
              <Avatar src={perfil?.avatar_url} nome={perfil?.nome} tam={62} />
              <span className="mais-story"><Plus size={14} strokeWidth={3} /></span>
            </div>
            <span>Seu story</span>
          </Link>
        )}
        {config?.ao_vivo && config.ao_vivo_url && (
          <a href={config.ao_vivo_url} target="_blank" rel="noreferrer" className="story-bolha" role="listitem">
            <Avatar logo tam={62} anel aovivo />
            <span className="selo-vivo">AO VIVO</span>
          </a>
        )}
        {ordenados.map((g) => (
          <button key={g.id} className="story-bolha" role="listitem" onClick={() => setAberto(ordenados.indexOf(g))}>
            <Avatar src={g.avatar} nome={g.nome} logo={g.logo} tam={62} anel visto={tudoVisto(g)} />
            <span>{g.nome}</span>
          </button>
        ))}
      </div>
      {aberto !== null && (
        <VisualizadorStories grupos={ordenados} inicio={aberto} vistos={vistos} aoVer={marcarVisto}
          fechar={() => setAberto(null)} aoApagar={() => { setAberto(null); carregar(); }} />
      )}
    </>
  );
}

function duracao(s: Slide) {
  if (s.tipo === "texto") return Math.min(12000, 4000 + (s.texto?.length || 0) * 35);
  return 5000;
}

export function VisualizadorStories({ grupos, inicio, vistos, aoVer, fechar, aoApagar }: {
  grupos: Grupo[]; inicio: number; vistos: Set<string>; aoVer: (id: string) => void; fechar: () => void; aoApagar?: () => void;
}) {
  const { isAdmin } = useAuth();
  const [g, setG] = useState(inicio);
  const [i, setI] = useState(() => Math.max(0, grupos[inicio].slides.findIndex((s) => !vistos.has(s.id))));
  const [prog, setProg] = useState(0);
  const pausado = useRef(false);
  const dur = useRef(5000);
  const videoRef = useRef<HTMLVideoElement>(null);
  const grupo = grupos[g];
  const slide = grupo?.slides[i];

  const avancar = useCallback(() => {
    if (i < grupo.slides.length - 1) { setI(i + 1); return; }
    if (g < grupos.length - 1) { setG(g + 1); setI(0); return; }
    fechar();
  }, [i, g, grupo, grupos.length, fechar]);

  const avancarRef = useRef(avancar);
  avancarRef.current = avancar;

  const voltar = () => {
    if (i > 0) return setI(i - 1);
    if (g > 0) { setG(g - 1); setI(grupos[g - 1].slides.length - 1); }
  };

  useEffect(() => {
    if (!slide) return;
    aoVer(slide.id);
    setProg(0);
    dur.current = duracao(slide);
    let ultimo = performance.now();
    let decorrido = 0;
    let raf = 0;
    const passo = (t: number) => {
      const dt = t - ultimo; ultimo = t;
      if (slide.tipo === "video" && videoRef.current) {
        const v = videoRef.current;
        if (v.duration) { setProg(v.currentTime / v.duration); if (v.ended) return avancarRef.current(); }
      } else if (!pausado.current) {
        decorrido += dt;
        setProg(Math.min(1, decorrido / dur.current));
        if (decorrido >= dur.current) return avancarRef.current();
      }
      raf = requestAnimationFrame(passo);
    };
    raf = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(raf);
  }, [slide, aoVer]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") fechar(); if (e.key === "ArrowRight") avancar(); if (e.key === "ArrowLeft") voltar(); };
    document.addEventListener("keydown", k);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", k); document.body.style.overflow = ""; };
  });

  if (!slide) return null;
  const podeApagar = !!slide.story && isAdmin;

  async function apagar() {
    if (!slide.story || !confirm("Apagar este story?")) return;
    const { error } = await sb().from("stories").delete().eq("id", slide.story.id);
    if (error) return toast(msgErro(error));
    await apagarArquivos([slide.story.midia_url]);
    toast("Story apagado");
    aoApagar?.();
  }

  const segurar = (v: boolean) => { pausado.current = v; if (videoRef.current) v ? videoRef.current.pause() : videoRef.current.play().catch(() => {}); };

  return (
    <div className="sv" role="dialog" aria-modal="true" aria-label={`Story de ${grupo.nome}`}>
      <div className="sv-in" onPointerDown={() => segurar(true)} onPointerUp={() => segurar(false)} onPointerLeave={() => segurar(false)}>
        <div className="sv-barras">
          {grupo.slides.map((s, k) => <i key={s.id}><b style={{ width: `${(k < i ? 1 : k === i ? prog : 0) * 100}%` }} /></i>)}
        </div>
        <div className="sv-topo">
          <Avatar src={grupo.avatar} nome={grupo.nome} logo={grupo.logo} tam={32} />
          <span>{grupo.nome}</span>
          {slide.criado_em && <span className="tempo">{relativo(slide.criado_em).replace("há ", "")}</span>}
          {podeApagar && <button onPointerDown={(e) => e.stopPropagation()} onClick={apagar} aria-label="Apagar story" style={{ marginLeft: "auto" }}><Trash2 size={20} /></button>}
          <button onPointerDown={(e) => e.stopPropagation()} onClick={fechar} aria-label="Fechar" style={podeApagar ? { marginLeft: 0 } : undefined}><X size={26} /></button>
        </div>

        {slide.tipo === "texto" ? (
          <div className="sv-texto" style={{ background: slide.cor || CORES_STORY[0] }}>
            {slide.rotulo && <small>{slide.rotulo}</small>}
            <p>{slide.texto}</p>
          </div>
        ) : (
          <div className="sv-midia">
            {slide.tipo === "video"
              ? <video ref={videoRef} key={slide.id} src={slide.url || ""} autoPlay playsInline />
              : <img key={slide.id} src={slide.url || ""} alt="" />}
            {slide.texto && <div className="sv-legenda">{slide.texto}</div>}
          </div>
        )}

        <button className="sv-toque" style={{ left: 0 }} aria-label="Anterior" onClick={voltar} />
        <button className="sv-toque" style={{ right: 0 }} aria-label="Próximo" onClick={avancar} />
      </div>
    </div>
  );
}
