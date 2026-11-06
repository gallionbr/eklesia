"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Menu, Grid3x3, CalendarCheck, HandHeart, Pencil, ShieldCheck, KeyRound, Shield, LogOut, Camera, CheckCircle2 } from "lucide-react";
import { sb, msgErro } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { apagarArquivos, enviarMidia } from "@/lib/midia";
import { dataHora, relativo } from "@/lib/format";
import type { Evento, Pedido, Post } from "@/lib/types";
import Avatar from "@/components/Avatar";
import GradePosts from "@/components/GradePosts";
import { Carregando, Folha, Vazio, toast } from "@/components/ui";

const PAPEL = { membro: "Membro", lider: "Líder", admin: "Liderança" } as const;

export default function Perfil() {
  const { perfil, isLider, isAdmin, sair, recarregar } = useAuth();
  const [aba, setAba] = useState<"posts" | "eventos" | "pedidos">("eventos");
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [eventos, setEventos] = useState<Evento[] | null>(null);
  const [pedidos, setPedidos] = useState<Pedido[] | null>(null);
  const [celula, setCelula] = useState("");
  const [menu, setMenu] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const foto = useRef<HTMLInputElement>(null);

  useEffect(() => { if (isLider) setAba("posts"); }, [isLider]);

  useEffect(() => {
    if (!perfil) return;
    sb().from("posts").select("*").eq("autor_id", perfil.id).order("criado_em", { ascending: false }).then(({ data }) => setPosts((data as Post[]) || []));
    sb().from("inscricoes").select("eventos(*)").eq("user_id", perfil.id).then(({ data }) =>
      setEventos((((data || []) as unknown as { eventos: Evento }[]).map((r) => r.eventos).filter(Boolean)).sort((a, b) => (a.inicio < b.inicio ? 1 : -1))));
    sb().from("pedidos_oracao").select("*").eq("user_id", perfil.id).order("criado_em", { ascending: false }).then(({ data }) => setPedidos((data as Pedido[]) || []));
    if (perfil.celula_id) sb().from("celulas").select("nome").eq("id", perfil.celula_id).maybeSingle().then(({ data }) => setCelula((data as { nome: string } | null)?.nome || ""));
  }, [perfil]);

  async function trocarFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f || !perfil) return;
    if (!f.type.startsWith("image/")) return toast("Escolha uma foto.");
    setEnviando(true);
    try {
      const m = await enviarMidia(f, `avatars/${perfil.id}`);
      const antiga = perfil.avatar_url;
      const { error } = await sb().from("profiles").update({ avatar_url: m.url }).eq("id", perfil.id);
      if (error) throw error;
      await apagarArquivos([antiga]);
      await recarregar();
      toast("Foto atualizada");
    } catch (err) {
      toast(msgErro(err));
    } finally {
      setEnviando(false);
    }
  }

  if (!perfil) return null;
  const abas = [...(isLider ? [{ k: "posts" as const, Icone: Grid3x3, r: "Meus posts" }] : []), { k: "eventos" as const, Icone: CalendarCheck, r: "Meus eventos" }, { k: "pedidos" as const, Icone: HandHeart, r: "Meus pedidos" }];

  return (
    <main>
      <header className="barra-topo">
        <span style={{ fontWeight: 700, fontSize: 20 }}>{perfil.nome.split(" ")[0] || "Perfil"}</span>
        <button className="icone-sim" onClick={() => setMenu(true)} aria-label="Menu"><Menu size={26} strokeWidth={1.8} /></button>
      </header>

      <div className="perfil-cab">
        <button onClick={() => foto.current?.click()} style={{ position: "relative", background: "none", border: 0, padding: 0 }} aria-label="Trocar foto" disabled={enviando}>
          <Avatar src={perfil.avatar_url} nome={perfil.nome} tam={86} />
          <span className="mais-story" style={{ width: 26, height: 26 }}>{enviando ? <span className="girando" style={{ width: 12, height: 12, borderWidth: 2 }} /> : <Camera size={14} />}</span>
        </button>
        <input ref={foto} type="file" accept="image/*" hidden onChange={trocarFoto} />
        <div className="perfil-num">
          {isLider && <div><b>{posts?.length ?? "–"}</b><span>posts</span></div>}
          <div><b>{eventos?.length ?? "–"}</b><span>eventos</span></div>
          <div><b>{pedidos?.length ?? "–"}</b><span>pedidos</span></div>
        </div>
      </div>

      <div className="perfil-bio">
        <span className="nome">{perfil.nome}</span>
        <span className="muted">{PAPEL[perfil.papel]}{celula ? ` · Célula ${celula}` : ""}</span>
        {perfil.bairro && <span>{perfil.bairro}</span>}
      </div>

      <div className="perfil-botoes">
        <Link href="/perfil/editar" className="btn sec">Editar perfil</Link>
        <Link href="/celulas" className="btn sec">{celula ? "Minha célula" : "Encontrar célula"}</Link>
      </div>

      <div className="abas-perfil" style={{ gridTemplateColumns: `repeat(${abas.length}, 1fr)` }}>
        {abas.map(({ k, Icone, r }) => (
          <button key={k} className={aba === k ? "on" : ""} onClick={() => setAba(k)} aria-label={r} aria-pressed={aba === k}><Icone size={22} /></button>
        ))}
      </div>

      {aba === "posts" && (posts === null ? <Carregando /> : posts.length === 0
        ? <div style={{ padding: 16 }}><Vazio>Você ainda não publicou. Toque no + para criar o primeiro post.</Vazio></div>
        : <GradePosts posts={posts} />)}

      {aba === "eventos" && (eventos === null ? <Carregando /> : eventos.length === 0
        ? <div style={{ padding: 16 }}><Vazio>Nenhuma inscrição ainda. <Link href="/agenda" style={{ color: "var(--primaria)", fontWeight: 600 }}>Ver agenda</Link></Vazio></div>
        : <div className="lista" style={{ padding: 16 }}>
            {eventos.map((e) => (
              <Link key={e.id} href={`/agenda#${e.id}`} className="linha">
                <div className="av" style={{ width: 44, height: 44 }}><CalendarCheck size={20} /></div>
                <div className="cresce"><b>{e.titulo}</b><p className="muted peq">{dataHora(e.inicio)}</p></div>
              </Link>
            ))}
          </div>)}

      {aba === "pedidos" && (pedidos === null ? <Carregando /> : pedidos.length === 0
        ? <div style={{ padding: 16 }}><Vazio>Nenhum pedido de oração. <Link href="/oracao?novo=1" style={{ color: "var(--primaria)", fontWeight: 600 }}>Fazer um pedido</Link></Vazio></div>
        : <div className="lista" style={{ padding: 16 }}>
            {pedidos.map((p) => (
              <Link key={p.id} href="/oracao" className="card" style={{ display: "block" }}>
                <p className="quebra">{p.pedido.length > 160 ? p.pedido.slice(0, 160) + "…" : p.pedido}</p>
                <p className="muted peq" style={{ marginTop: 6 }}>
                  {relativo(p.criado_em)} · {p.publico ? "No mural" : "Só liderança"}
                  {p.respondido && <span className="selo verde" style={{ marginLeft: 6 }}><CheckCircle2 size={12} />Respondida</span>}
                </p>
              </Link>
            ))}
          </div>)}

      <Folha aberta={menu} fechar={() => setMenu(false)} titulo="Menu">
        <div className="menu-acoes">
          <Link href="/perfil/editar" onClick={() => setMenu(false)}><Pencil size={20} />Editar perfil</Link>
          {isAdmin && <Link href="/admin" onClick={() => setMenu(false)}><ShieldCheck size={20} />Painel administrativo</Link>}
          <Link href="/perfil/editar?senha=1" onClick={() => setMenu(false)}><KeyRound size={20} />Alterar senha</Link>
          <Link href="/privacidade" onClick={() => setMenu(false)}><Shield size={20} />Privacidade</Link>
          <button className="perigo" onClick={sair}><LogOut size={20} />Sair</button>
        </div>
      </Folha>
    </main>
  );
}
