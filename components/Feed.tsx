"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Pin, Megaphone, CalendarDays, MapPin, HandHeart, ExternalLink } from "lucide-react";
import { sb } from "@/lib/supabase";
import { contagensPosts, perfisPublicos } from "@/lib/midia";
import { dataHora, relativo } from "@/lib/format";
import type { Aviso, Contagem, Evento, Pedido, PerfilPublico, Post } from "@/lib/types";
import PostCard from "./PostCard";
import { Carregando } from "./ui";

type Item =
  | { k: "post"; t: string; id: string; d: Post }
  | { k: "aviso"; t: string; id: string; d: Aviso }
  | { k: "evento"; t: string; id: string; d: Evento }
  | { k: "pedido"; t: string; id: string; d: Pedido };

const LOTE = 10;

export default function Feed() {
  const [itens, setItens] = useState<Item[]>([]);
  const [fixados, setFixados] = useState<Aviso[]>([]);
  const [perfis, setPerfis] = useState<Record<string, PerfilPublico>>({});
  const [contagens, setContagens] = useState<Record<string, Contagem>>({});
  const [cursor, setCursor] = useState<string | null>(null);
  const [fim, setFim] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const sentinela = useRef<HTMLDivElement>(null);
  const ocupado = useRef(false);

  const carregarLote = useCallback(async (antes: string | null) => {
    if (ocupado.current) return;
    ocupado.current = true;
    setCarregando(true);
    const agora = new Date().toISOString();
    const lim = antes || new Date(Date.now() + 60_000).toISOString();
    const [p, a, e, o] = await Promise.all([
      sb().from("posts").select("*").lt("criado_em", lim).order("criado_em", { ascending: false }).limit(LOTE),
      sb().from("avisos").select("*").eq("fixado", false).lt("publicado_em", lim).or(`expira_em.is.null,expira_em.gt.${agora}`).order("publicado_em", { ascending: false }).limit(LOTE),
      sb().from("eventos").select("*").gte("inicio", agora).lt("criado_em", lim).order("criado_em", { ascending: false }).limit(LOTE),
      sb().from("pedidos_oracao").select("*").eq("publico", true).lt("criado_em", lim).order("criado_em", { ascending: false }).limit(LOTE),
    ]);
    const todos: Item[] = [
      ...((p.data as Post[]) || []).map((d) => ({ k: "post" as const, t: d.criado_em, id: `p${d.id}`, d })),
      ...((a.data as Aviso[]) || []).map((d) => ({ k: "aviso" as const, t: d.publicado_em, id: `a${d.id}`, d })),
      ...((e.data as Evento[]) || []).map((d) => ({ k: "evento" as const, t: d.criado_em, id: `e${d.id}`, d })),
      ...((o.data as Pedido[]) || []).map((d) => ({ k: "pedido" as const, t: d.criado_em, id: `o${d.id}`, d })),
    ].sort((x, y) => (x.t < y.t ? 1 : -1));
    const lote = todos.slice(0, LOTE);
    const posts = lote.filter((i): i is Extract<Item, { k: "post" }> => i.k === "post").map((i) => i.d);
    const [pf, ct] = await Promise.all([perfisPublicos(posts.map((x) => x.autor_id)), contagensPosts(posts.map((x) => x.id))]);
    setPerfis((v) => ({ ...v, ...pf }));
    setContagens((v) => ({ ...v, ...ct }));
    setItens((v) => {
      const vistos = new Set(v.map((i) => i.id));
      return [...v, ...lote.filter((i) => !vistos.has(i.id))];
    });
    setCursor(lote.length ? lote[lote.length - 1].t : antes);
    const cheia = [p, a, e, o].some((r) => (r.data?.length || 0) >= LOTE);
    setFim(!cheia && todos.length <= LOTE);
    setCarregando(false);
    ocupado.current = false;
  }, []);

  const recomecar = useCallback(() => {
    setItens([]); setFim(false); setCursor(null);
    const agora = new Date().toISOString();
    sb().from("avisos").select("*").eq("fixado", true).or(`expira_em.is.null,expira_em.gt.${agora}`).order("publicado_em", { ascending: false })
      .then(({ data }) => setFixados((data as Aviso[]) || []));
    carregarLote(null);
  }, [carregarLote]);

  useEffect(() => { recomecar(); }, [recomecar]);

  useEffect(() => {
    const el = sentinela.current;
    if (!el || fim) return;
    const ob = new IntersectionObserver((es) => { if (es[0].isIntersecting && cursor && !ocupado.current) carregarLote(cursor); }, { rootMargin: "600px" });
    ob.observe(el);
    return () => ob.disconnect();
  }, [cursor, fim, carregarLote]);

  const remover = (id: string) => setItens((v) => v.filter((i) => i.id !== id));
  const vazio = !carregando && itens.length === 0 && fixados.length === 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingTop: 10 }}>
      {fixados.map((a) => <CartaoAviso key={a.id} a={a} fixado />)}
      {itens.map((i) =>
        i.k === "post" ? <PostCard key={i.id} post={i.d} autor={perfis[i.d.autor_id]} contagem={contagens[i.d.id]} aoApagar={() => remover(i.id)} />
        : i.k === "aviso" ? <CartaoAviso key={i.id} a={i.d} />
        : i.k === "evento" ? <CartaoEvento key={i.id} e={i.d} />
        : <CartaoPedido key={i.id} p={i.d} />
      )}
      {vazio && (
        <div className="vazio" style={{ margin: "24px 16px" }}>
          Ainda não há publicações. Os posts da liderança, avisos e eventos aparecem aqui.
        </div>
      )}
      <div ref={sentinela} />
      {carregando && <Carregando />}
      {fim && itens.length > 0 && <p className="muted peq" style={{ textAlign: "center", padding: "8px 0 20px" }}>Você está em dia 🙌</p>}
    </div>
  );
}

function CartaoAviso({ a, fixado }: { a: Aviso; fixado?: boolean }) {
  return (
    <article className="cartao-feed aviso">
      <span className="rot">{fixado ? <Pin size={14} /> : <Megaphone size={14} />}{fixado ? "Aviso fixado" : "Aviso"} · {relativo(a.publicado_em)}</span>
      <h3>{a.titulo}</h3>
      {a.corpo && <p>{a.corpo}</p>}
      {a.link && <a className="btn peq" href={a.link} target="_blank" rel="noreferrer">Saiba mais <ExternalLink size={14} /></a>}
    </article>
  );
}

function CartaoEvento({ e }: { e: Evento }) {
  return (
    <article className="cartao-feed evento">
      <span className="rot"><CalendarDays size={14} />Evento</span>
      <h3>{e.titulo}</h3>
      <p style={{ opacity: .9 }}>{dataHora(e.inicio)}{e.local ? <><br /><MapPin size={13} style={{ verticalAlign: -2 }} /> {e.local}</> : null}</p>
      {e.descricao && <p style={{ opacity: .9 }}>{e.descricao.length > 160 ? e.descricao.slice(0, 160) + "…" : e.descricao}</p>}
      <Link className="btn peq" href={`/agenda#${e.id}`}>{e.inscricao_aberta ? "Quero participar" : "Ver na agenda"}</Link>
    </article>
  );
}

function CartaoPedido({ p }: { p: Pedido }) {
  return (
    <article className="cartao-feed oracao">
      <span className="rot" style={{ color: "var(--ouro)" }}><HandHeart size={14} />Pedido de oração · {relativo(p.criado_em)}</span>
      <p><b>{p.anonimo ? "Anônimo" : p.autor_nome || "Irmão(ã)"}</b> {p.pedido.length > 220 ? p.pedido.slice(0, 220) + "…" : p.pedido}</p>
      {p.respondido && <span className="selo verde">Oração respondida 🙌</span>}
      <Link className="btn peq sec" href="/oracao" style={{ background: "var(--bg)", color: "var(--ink)" }}><HandHeart size={16} />Vou orar</Link>
    </article>
  );
}
