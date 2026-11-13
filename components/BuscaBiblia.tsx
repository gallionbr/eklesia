"use client";
// Barra "Livro | Capítulo | Versículo" no topo: abre a busca e leva direto ao texto.
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, ChevronRight } from "lucide-react";
import { LIVROS, lerReferencia, livrosQueCombinam } from "@/lib/biblia";
import { Folha } from "./ui";

const ATALHOS = ["João 3:16", "Salmos 23", "Romanos 8:28", "Filipenses 4:13", "Isaías 41:10", "Mateus 5"];

export default function BuscaBiblia() {
  const router = useRouter();
  const [aberta, setAberta] = useState(false);
  const [txt, setTxt] = useState("");
  const ref = useMemo(() => lerReferencia(txt), [txt]);
  const sugestoes = useMemo(() => (/\d\s*[:.,\s]?\s*\d*$/.test(txt.replace(/^[1-3]\s*/, "")) ? [] : livrosQueCombinam(txt).slice(0, 8)), [txt]);

  function ir(r = ref) {
    if (!r) return;
    setAberta(false); setTxt("");
    const url = `/biblia?ref=${r.livro}.${r.cap}${r.vers ? "." + r.vers : ""}`;
    // Já na Bíblia: recarrega para abrir a nova referência.
    if (location.pathname === "/biblia") location.href = url; else router.push(url);
  }

  return (
    <>
      <button type="button" className="busca-biblia" onClick={() => setAberta(true)} aria-label="Abrir a Bíblia: buscar livro, capítulo e versículo">
        <BookOpen size={17} aria-hidden />
        <span>Livro <i>|</i> Capítulo <i>|</i> Versículo</span>
      </button>
      <Folha aberta={aberta} fechar={() => setAberta(false)} titulo="Bíblia">
        <form onSubmit={(e) => { e.preventDefault(); ir(); }} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label className="busca" style={{ margin: 0 }}>
            <BookOpen size={18} />
            <input autoFocus value={txt} onChange={(e) => setTxt(e.target.value)} placeholder="Ex.: João 3:16, Sl 23, 1Co 13" aria-label="Livro, capítulo e versículo" enterKeyHint="go" />
          </label>
          {ref && (
            <button className="btn bloco doacao-continuar" type="submit">
              Abrir {LIVROS[ref.livro].nome} {ref.cap}{ref.vers ? `:${ref.vers}` : ""} <ChevronRight size={18} />
            </button>
          )}
        </form>
        {sugestoes.length > 0 && txt && (
          <div className="opcoes" style={{ marginTop: 12 }}>
            {sugestoes.map((i) => (
              <button key={i} type="button" className="opcao" onClick={() => setTxt(LIVROS[i].nome + " ")}>
                <span className="cresce"><b>{LIVROS[i].nome}</b><span className="muted peq">{LIVROS[i].caps} capítulos</span></span>
                <ChevronRight size={18} aria-hidden />
              </button>
            ))}
          </div>
        )}
        {!txt && (
          <>
            <p className="muted peq" style={{ margin: "14px 0 8px" }}>Sugestões</p>
            <div className="linha" style={{ flexWrap: "wrap", gap: 8 }}>
              {ATALHOS.map((a) => <button key={a} type="button" className="btn sec peq" onClick={() => ir(lerReferencia(a))}>{a}</button>)}
            </div>
            <button type="button" className="btn contorno bloco" style={{ marginTop: 16 }} onClick={() => { setAberta(false); router.push("/biblia"); }}>Devocional do dia</button>
          </>
        )}
      </Folha>
    </>
  );
}
