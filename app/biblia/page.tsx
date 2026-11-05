"use client";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, ChevronDown, Share2 } from "lucide-react";
import { sb } from "@/lib/supabase";
import { LIVROS, lerCapitulo, type Versiculo } from "@/lib/biblia";
import type { Devocional } from "@/lib/types";
import { dataCurta, hojeISO } from "@/lib/format";
import { Carregando, Folha, Topo, toast } from "@/components/ui";

const CHAVE = "eklesia:biblia";

export default function Biblia() {
  const [aba, setAba] = useState<"devocional" | "ler">("devocional");
  const [devos, setDevos] = useState<Devocional[] | null>(null);
  const [idx, setIdx] = useState(0);

  const [livroI, setLivroI] = useState(42); // João
  const [cap, setCap] = useState(1);
  const [versos, setVersos] = useState<Versiculo[] | null>(null);
  const [erro, setErro] = useState("");
  const [escolher, setEscolher] = useState<"livro" | "cap" | null>(null);

  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(CHAVE) || "null");
      if (s) { setLivroI(s.l); setCap(s.c); }
    } catch {}
    if (location.hash === "#ler") setAba("ler");
    sb().from("devocionais").select("*").lte("data", hojeISO()).order("data", { ascending: false }).limit(14)
      .then(({ data }) => setDevos((data as Devocional[]) || []));
  }, []);

  useEffect(() => {
    if (aba !== "ler") return;
    setVersos(null); setErro("");
    try { localStorage.setItem(CHAVE, JSON.stringify({ l: livroI, c: cap })); } catch {}
    lerCapitulo(LIVROS[livroI], cap).then(setVersos).catch((e) => setErro(e.message));
    window.scrollTo({ top: 0 });
  }, [aba, livroI, cap]);

  const livro = LIVROS[livroI];
  function mover(d: number) {
    if (cap + d >= 1 && cap + d <= livro.caps) return setCap(cap + d);
    const n = livroI + d;
    if (n < 0 || n >= LIVROS.length) return;
    setLivroI(n);
    setCap(d > 0 ? 1 : LIVROS[n].caps);
  }

  const devo = devos?.[idx];

  async function compartilhar(d: Devocional) {
    const texto = `“${d.texto_biblico}” — ${d.referencia}\n\n${d.titulo}\n\nEklésia · ${location.origin}`;
    try {
      if (navigator.share) await navigator.share({ title: d.titulo, text: texto });
      else { await navigator.clipboard.writeText(texto); toast("Texto copiado"); }
    } catch {}
  }

  return (
    <main className="pagina">
      <Topo titulo="Bíblia" sub="Palavra para cada dia" />
      <div className="abas">
        <button className={`aba ${aba === "devocional" ? "ativa" : ""}`} onClick={() => setAba("devocional")}>Devocional</button>
        <button className={`aba ${aba === "ler" ? "ativa" : ""}`} onClick={() => setAba("ler")}>Ler a Bíblia</button>
      </div>

      {aba === "devocional" && (
        devos === null ? <Carregando /> : !devo ? (
          <div className="vazio">
            Ainda não há devocional publicado.
            <br /><button className="btn sec peq" style={{ marginTop: 12 }} onClick={() => setAba("ler")}>Abrir a Bíblia</button>
          </div>
        ) : (
          <article className="card" id="devocional" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="linha entre">
              <span className="selo">{devo.data === hojeISO() ? "Hoje" : dataCurta(devo.data + "T12:00:00-03:00")}</span>
              <button className="icone-btn" onClick={() => compartilhar(devo)} aria-label="Compartilhar"><Share2 size={18} /></button>
            </div>
            <h2>{devo.titulo}</h2>
            <blockquote className="texto-biblico quebra" style={{ margin: 0, paddingLeft: 14, borderLeft: "3px solid var(--ouro)" }}>
              {devo.texto_biblico}
              <footer className="peq muted" style={{ fontFamily: "var(--sans)", marginTop: 6 }}>{devo.referencia}</footer>
            </blockquote>
            <p className="quebra" style={{ fontSize: 17, lineHeight: 1.7 }}>{devo.reflexao}</p>
            {devo.oracao && (
              <div className="card ouro" style={{ boxShadow: "none" }}>
                <b className="peq">Oração</b>
                <p className="quebra" style={{ fontStyle: "italic", marginTop: 4 }}>{devo.oracao}</p>
              </div>
            )}
            <div className="linha entre">
              <button className="btn sec peq" disabled={idx >= devos.length - 1} onClick={() => setIdx(idx + 1)}><ChevronLeft size={16} />Anterior</button>
              <button className="btn sec peq" disabled={idx === 0} onClick={() => setIdx(idx - 1)}>Próximo<ChevronRight size={16} /></button>
            </div>
          </article>
        )
      )}

      {aba === "ler" && (
        <>
          <div className="linha">
            <button className="btn sec cresce" onClick={() => setEscolher("livro")}>{livro.nome}<ChevronDown size={16} /></button>
            <button className="btn sec" onClick={() => setEscolher("cap")}>Cap. {cap}<ChevronDown size={16} /></button>
          </div>

          <article className="card">
            <h2 style={{ marginBottom: 12 }}>{livro.nome} {cap}</h2>
            {erro ? <p className="erro">{erro}</p> : versos === null ? <Carregando /> : (
              <p className="texto-biblico">
                {versos.map((v) => <span key={v.verse}><sup>{v.verse}</sup>{v.text} </span>)}
              </p>
            )}
            <p className="muted peq" style={{ marginTop: 16 }}>Tradução João Ferreira de Almeida (domínio público).</p>
          </article>

          <div className="linha entre">
            <button className="btn sec" onClick={() => mover(-1)} disabled={livroI === 0 && cap === 1}><ChevronLeft size={18} />Anterior</button>
            <button className="btn sec" onClick={() => mover(1)} disabled={livroI === LIVROS.length - 1 && cap === livro.caps}>Próximo<ChevronRight size={18} /></button>
          </div>
        </>
      )}

      <Folha aberta={escolher === "livro"} fechar={() => setEscolher(null)} titulo="Livro">
        {[true, false].map((at) => (
          <div key={String(at)} style={{ marginBottom: 16 }}>
            <p className="muted peq" style={{ fontWeight: 700, marginBottom: 8 }}>{at ? "ANTIGO TESTAMENTO" : "NOVO TESTAMENTO"}</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 6 }}>
              {LIVROS.map((l, i) => l.at === at && (
                <button key={l.api} className={`btn peq ${i === livroI ? "" : "sec"}`} style={{ justifyContent: "flex-start" }}
                  onClick={() => { setLivroI(i); setCap(1); setEscolher("cap"); }}>{l.nome}</button>
              ))}
            </div>
          </div>
        ))}
      </Folha>

      <Folha aberta={escolher === "cap"} fechar={() => setEscolher(null)} titulo={`${livro.nome} — capítulo`}>
        <div className="grade-caps">
          {Array.from({ length: livro.caps }, (_, i) => i + 1).map((c) => (
            <button key={c} style={c === cap ? { background: "var(--primaria)", color: "#fff" } : undefined}
              onClick={() => { setCap(c); setEscolher(null); }}>{c}</button>
          ))}
        </div>
      </Folha>
    </main>
  );
}
