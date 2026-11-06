"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search, Users, CalendarDays, MapPin, Clock } from "lucide-react";
import { sb } from "@/lib/supabase";
import type { Celula, Evento, Post } from "@/lib/types";
import { dataHora } from "@/lib/format";
import GradePosts from "@/components/GradePosts";
import MenuCards from "@/components/MenuCards";
import { Carregando, Vazio } from "@/components/ui";

const sem = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export default function Explorar() {
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [celulas, setCelulas] = useState<Celula[]>([]);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [busca, setBusca] = useState("");

  useEffect(() => {
    Promise.all([
      sb().from("posts").select("*").order("criado_em", { ascending: false }).limit(90),
      sb().from("celulas").select("*").eq("ativa", true).order("nome"),
      sb().from("eventos").select("*").gte("inicio", new Date().toISOString()).order("inicio").limit(30),
    ]).then(([p, c, e]) => {
      setPosts((p.data as Post[]) || []);
      setCelulas((c.data as Celula[]) || []);
      setEventos((e.data as Evento[]) || []);
    });
  }, []);

  const q = sem(busca.trim());
  const achados = useMemo(() => ({
    posts: (posts || []).filter((p) => !q || sem(p.legenda).includes(q)),
    celulas: q ? celulas.filter((c) => sem(`${c.nome} ${c.bairro || ""} ${c.dia_semana || ""} ${c.descricao || ""}`).includes(q)) : [],
    eventos: q ? eventos.filter((e) => sem(`${e.titulo} ${e.local || ""} ${e.descricao || ""}`).includes(q)) : [],
  }), [q, posts, celulas, eventos]);

  return (
    <main style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: "calc(12px + env(safe-area-inset-top))" }}>
      <label className="busca">
        <Search size={18} />
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Pesquisar posts, células, eventos" aria-label="Pesquisar" />
      </label>

      {!q && <MenuCards />}

      {achados.celulas.length > 0 && (
        <section className="secao" style={{ padding: "0 16px" }}>
          <h3>Células</h3>
          {achados.celulas.map((c) => (
            <Link key={c.id} href="/celulas" className="linha" style={{ padding: "4px 0" }}>
              <div className="av" style={{ width: 44, height: 44 }}><Users size={20} /></div>
              <div className="cresce"><b>{c.nome}</b><p className="muted peq"><Clock size={12} /> {[c.dia_semana, c.horario].filter(Boolean).join(" · ")} {c.bairro && <><MapPin size={12} /> {c.bairro}</>}</p></div>
            </Link>
          ))}
        </section>
      )}
      {achados.eventos.length > 0 && (
        <section className="secao" style={{ padding: "0 16px" }}>
          <h3>Eventos</h3>
          {achados.eventos.map((e) => (
            <Link key={e.id} href={`/agenda#${e.id}`} className="linha" style={{ padding: "4px 0" }}>
              <div className="av" style={{ width: 44, height: 44 }}><CalendarDays size={20} /></div>
              <div className="cresce"><b>{e.titulo}</b><p className="muted peq">{dataHora(e.inicio)}</p></div>
            </Link>
          ))}
        </section>
      )}

      {posts === null ? <Carregando /> : achados.posts.length === 0 ? (
        <div style={{ padding: "0 16px" }}><Vazio>{q ? "Nada encontrado." : "Ainda não há posts."}</Vazio></div>
      ) : (
        <>
          {q && <h3 style={{ padding: "0 16px" }}>Posts</h3>}
          <GradePosts posts={achados.posts} />
        </>
      )}
    </main>
  );
}
