"use client";
import { useRef, useState } from "react";
import { Heart, MessageCircle, Send, Ellipsis, Link2, Trash2 } from "lucide-react";
import { sb, msgErro } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { apagarArquivos, plural, proporcao } from "@/lib/midia";
import { relativo } from "@/lib/format";
import type { Contagem, PerfilPublico, Post } from "@/lib/types";
import Avatar from "./Avatar";
import Comentarios from "./Comentarios";
import { Folha, toast } from "./ui";

const PAPEL = { admin: "Liderança", lider: "Líder", tesoureiro: "", membro: "" } as const;

export default function PostCard({ post, autor, contagem, aoApagar, comentariosAbertos = false }: {
  post: Post; autor?: PerfilPublico; contagem?: Contagem; aoApagar?: () => void; comentariosAbertos?: boolean;
}) {
  const { perfil, config, isAdmin } = useAuth();
  const [amem, setAmem] = useState(contagem?.meu_amem ?? false);
  const [amens, setAmens] = useState(contagem?.amens ?? 0);
  const [nComent, setNComent] = useState(contagem?.comentarios ?? 0);
  const [indice, setIndice] = useState(0);
  const [coracao, setCoracao] = useState(0);
  const [pop, setPop] = useState(false);
  const [menu, setMenu] = useState(false);
  const [coment, setComent] = useState(comentariosAbertos);
  const [legendaToda, setLegendaToda] = useState(false);
  const ultimoToque = useRef(0);

  const nome = post.como_igreja ? config?.nome_igreja || "Igreja Eklésia" : autor?.nome || "Liderança";
  const sub = post.como_igreja ? "" : autor ? PAPEL[autor.papel] : "";
  const podeApagar = post.autor_id === perfil?.id || isAdmin;
  const proporcaoBase = proporcao(post.midias[0]);
  const url = typeof window !== "undefined" ? `${location.origin}/post?id=${post.id}` : "";

  async function alternarAmem(forcar?: boolean) {
    if (forcar && amem) return;
    const novo = forcar ? true : !amem;
    setAmem(novo); setAmens((n) => n + (novo ? 1 : -1));
    if (novo) { setPop(true); setTimeout(() => setPop(false), 400); }
    const { error } = novo
      ? await sb().from("post_amens").insert({ post_id: post.id })
      : await sb().from("post_amens").delete().match({ post_id: post.id, user_id: perfil!.id });
    if (error && !/duplicate/i.test(error.message)) { setAmem(!novo); setAmens((n) => n + (novo ? -1 : 1)); toast(msgErro(error)); }
  }

  function toqueMidia() {
    const agora = Date.now();
    if (agora - ultimoToque.current < 300) { setCoracao((c) => c + 1); alternarAmem(true); }
    ultimoToque.current = agora;
  }

  async function compartilhar() {
    try {
      if (navigator.share) await navigator.share({ title: nome, text: post.legenda.slice(0, 120), url });
      else { await navigator.clipboard.writeText(url); toast("Link copiado"); }
    } catch {}
  }

  async function apagar() {
    if (!confirm("Apagar este post? Não dá para desfazer.")) return;
    const { error } = await sb().from("posts").delete().eq("id", post.id);
    if (error) return toast(msgErro(error));
    await apagarArquivos(post.midias.map((m) => m.url));
    setMenu(false);
    toast("Post apagado");
    aoApagar?.();
  }

  const legendaLonga = post.legenda.length > 125 || post.legenda.split("\n").length > 2;

  return (
    <article className="post">
      <header className="post-topo">
        <Avatar src={post.como_igreja ? null : autor?.avatar_url} nome={nome} logo={post.como_igreja} tam={34} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="nome">{nome}</div>
          {sub && <div className="sub">{sub}</div>}
        </div>
        <button className="icone-sim" onClick={() => setMenu(true)} aria-label="Opções do post"><Ellipsis size={20} /></button>
      </header>

      {post.midias.length > 0 && (
        <div className="post-midia" onClick={toqueMidia}>
          <div className="carrossel" style={{ aspectRatio: String(proporcaoBase) }}
            onScroll={(e) => { const el = e.currentTarget; setIndice(Math.round(el.scrollLeft / el.clientWidth)); }}>
            {post.midias.map((m, k) => (
              <div key={k} style={{ aspectRatio: String(proporcaoBase) }}>
                {m.tipo === "video"
                  ? <video src={m.url} controls playsInline preload="metadata" muted loop />
                  : <img src={m.url} alt="" loading={k === 0 ? "eager" : "lazy"} />}
              </div>
            ))}
          </div>
          {post.midias.length > 1 && <span className="contador-midia">{indice + 1}/{post.midias.length}</span>}
          {coracao > 0 && <div key={coracao} className="coracao-grande"><Heart size={96} fill="currentColor" /></div>}
        </div>
      )}

      <div className="post-acoes">
        <button onClick={() => alternarAmem()} className={amem ? "on" : ""} aria-label={amem ? "Tirar amém" : "Amém"} aria-pressed={amem}>
          <Heart size={26} className={pop ? "pop" : ""} fill={amem ? "currentColor" : "none"} strokeWidth={amem ? 2 : 1.8} />
        </button>
        <button onClick={() => setComent(true)} aria-label="Comentários"><MessageCircle size={25} strokeWidth={1.8} style={{ transform: "scaleX(-1)" }} /></button>
        <button onClick={compartilhar} aria-label="Compartilhar"><Send size={24} strokeWidth={1.8} /></button>
        {post.midias.length > 1 && (
          <div className="pontos" aria-hidden="true">
            {post.midias.map((_, k) => <i key={k} className={k === indice ? "on" : ""} />)}
          </div>
        )}
      </div>

      <div className="post-corpo">
        {amens > 0 && <b>{plural(amens, "amém", "améns")}</b>}
        {post.legenda && (
          <p className="quebra">
            <span className="quem">{nome}</span>
            {legendaLonga && !legendaToda ? (
              <>{post.legenda.split("\n").slice(0, 2).join(" ").slice(0, 125)}… <button className="ver" onClick={() => setLegendaToda(true)}>mais</button></>
            ) : post.legenda}
          </p>
        )}
        {nComent > 0 && <button className="ver" onClick={() => setComent(true)}>Ver {nComent === 1 ? "1 comentário" : `todos os ${nComent} comentários`}</button>}
        <time dateTime={post.criado_em}>{relativo(post.criado_em)}</time>
      </div>

      <Folha aberta={menu} fechar={() => setMenu(false)} titulo="Post">
        <div className="menu-acoes">
          <button onClick={async () => { try { await navigator.clipboard.writeText(url); toast("Link copiado"); } catch {} setMenu(false); }}><Link2 size={20} />Copiar link</button>
          {podeApagar && <button className="perigo" onClick={apagar}><Trash2 size={20} />Apagar post</button>}
        </div>
      </Folha>

      <Comentarios post={post} aberto={coment} fechar={() => setComent(false)} aoMudar={setNComent} />
    </article>
  );
}
