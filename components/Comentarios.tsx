"use client";
import { useCallback, useEffect, useState } from "react";
import { sb, msgErro } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { perfisPublicos } from "@/lib/midia";
import { relativo } from "@/lib/format";
import type { Comentario, PerfilPublico, Post } from "@/lib/types";
import Avatar from "./Avatar";
import { Carregando, Folha, toast } from "./ui";

export default function Comentarios({ post, aberto, fechar, aoMudar }: {
  post: Post; aberto: boolean; fechar: () => void; aoMudar: (n: number) => void;
}) {
  const { perfil, isAdmin } = useAuth();
  const [lista, setLista] = useState<Comentario[] | null>(null);
  const [perfis, setPerfis] = useState<Record<string, PerfilPublico>>({});
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);

  const carregar = useCallback(async () => {
    const { data } = await sb().from("post_comentarios").select("*").eq("post_id", post.id).order("criado_em").limit(300);
    const cs = (data as Comentario[]) || [];
    setPerfis(await perfisPublicos(cs.map((c) => c.user_id)));
    setLista(cs);
    aoMudar(cs.length);
  }, [post.id, aoMudar]);

  useEffect(() => { if (aberto) carregar(); }, [aberto, carregar]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const t = texto.trim();
    if (!t) return;
    setEnviando(true);
    const { error } = await sb().from("post_comentarios").insert({ post_id: post.id, texto: t });
    setEnviando(false);
    if (error) return toast(msgErro(error));
    setTexto("");
    carregar();
  }

  async function apagar(c: Comentario) {
    if (!confirm("Apagar este comentário?")) return;
    const { error } = await sb().from("post_comentarios").delete().eq("id", c.id);
    if (error) return toast(msgErro(error));
    carregar();
  }

  return (
    <Folha aberta={aberto} fechar={fechar} titulo="Comentários">
      {lista === null ? <Carregando /> : (
        <div className="lista" style={{ gap: 16 }}>
          {lista.length === 0 && <p className="muted" style={{ textAlign: "center", padding: "16px 0" }}>Seja o primeiro a comentar.</p>}
          {lista.map((c) => {
            const p = perfis[c.user_id];
            const pode = c.user_id === perfil?.id || isAdmin || post.autor_id === perfil?.id;
            return (
              <div key={c.id} className="comentario">
                <Avatar src={p?.avatar_url} nome={p?.nome} tam={32} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className="quebra"><b style={{ marginRight: 6 }}>{p?.nome || "Membro"}</b>{c.texto}</p>
                  <div className="meta">
                    <span>{relativo(c.criado_em).replace("há ", "")}</span>
                    {pode && <button onClick={() => apagar(c)}>Apagar</button>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <form className="enviar-coment" onSubmit={enviar}>
        <Avatar src={perfil?.avatar_url} nome={perfil?.nome} tam={32} />
        <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Adicione um comentário…" maxLength={1000} aria-label="Comentário" />
        <button disabled={enviando || !texto.trim()}>Publicar</button>
      </form>
    </Folha>
  );
}
