"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, X, Type } from "lucide-react";
import { sb, msgErro } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { enviarMidia } from "@/lib/midia";
import type { Celula, Midia } from "@/lib/types";
import { CORES_STORY } from "@/components/Stories";
import { Topo, Vazio, toast } from "@/components/ui";

interface Arquivo { file: File; url: string; video: boolean }
const MAX_FOTOS = 10;

export default function Criar() {
  const { perfil, isLider, isAdmin, carregando } = useAuth();
  const router = useRouter();
  const [tipo, setTipo] = useState<"post" | "story">("post");
  const [arquivos, setArquivos] = useState<Arquivo[]>([]);
  const [legenda, setLegenda] = useState("");
  const [comoIgreja, setComoIgreja] = useState(false);
  const [textoStory, setTextoStory] = useState(false);
  const [cor, setCor] = useState(CORES_STORY[0]);
  const [destino, setDestino] = useState("");
  const [celulas, setCelulas] = useState<Celula[]>([]);
  const [enviando, setEnviando] = useState("");
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = new URLSearchParams(location.search).get("tipo");
    if (t === "story") setTipo("story");
  }, []);
  useEffect(() => { setComoIgreja(isAdmin); }, [isAdmin]);

  useEffect(() => {
    if (!perfil) return;
    let q = sb().from("celulas").select("*").eq("ativa", true).order("nome");
    if (!isAdmin) q = q.eq("lider_id", perfil.id);
    q.then(({ data }) => setCelulas((data as Celula[]) || []));
  }, [perfil, isAdmin]);

  const todasUrls = useRef<string[]>([]);
  useEffect(() => () => todasUrls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  const destinos = useMemo(() => [{ v: "", r: "Stories da igreja" }, ...celulas.map((c) => ({ v: c.id, r: `Stories do PG ${c.nome}` }))], [celulas]);

  function escolher(e: React.ChangeEvent<HTMLInputElement>) {
    const novos = [...(e.target.files || [])].map((file) => ({ file, url: URL.createObjectURL(file), video: file.type.startsWith("video/") }));
    e.target.value = "";
    todasUrls.current.push(...novos.map((n) => n.url));
    if (tipo === "story") { setArquivos(novos.slice(0, 1)); setTextoStory(false); return; }
    setArquivos((v) => [...v, ...novos].slice(0, MAX_FOTOS));
  }

  async function publicar() {
    if (!perfil) return;
    try {
      if (tipo === "post") {
        if (!arquivos.length && !legenda.trim()) return toast("Escolha uma foto ou escreva algo.");
        const midias: Midia[] = [];
        for (const [k, a] of arquivos.entries()) {
          setEnviando(`Enviando ${k + 1} de ${arquivos.length}…`);
          midias.push(await enviarMidia(a.file, `posts/${perfil.id}`));
        }
        setEnviando("Publicando…");
        const { error } = await sb().from("posts").insert({ legenda: legenda.trim(), midias, como_igreja: isAdmin && comoIgreja });
        if (error) throw error;
        toast("Post publicado 🙌");
        router.replace("/inicio");
      } else {
        if (!arquivos.length && !(textoStory && legenda.trim())) return toast("Escolha uma foto/vídeo ou escreva um texto.");
        let dados: Record<string, unknown>;
        if (arquivos.length) {
          setEnviando("Enviando…");
          const m = await enviarMidia(arquivos[0].file, `stories/${perfil.id}`);
          dados = { tipo: m.tipo, midia_url: m.url, texto: legenda.trim() || null };
        } else {
          dados = { tipo: "texto", texto: legenda.trim(), cor };
        }
        setEnviando("Publicando…");
        const { error } = await sb().from("stories").insert({ ...dados, celula_id: destino || null });
        if (error) throw error;
        toast("Story publicado");
        router.replace("/inicio");
      }
    } catch (e) {
      toast(msgErro(e));
    } finally {
      setEnviando("");
    }
  }

  if (carregando) return null;
  if (!isLider) {
    return (
      <main className="pagina">
        <Topo titulo="Criar" voltar />
        <Vazio>Posts e stories são publicados pela liderança da igreja.</Vazio>
      </main>
    );
  }

  const podePublicar = !enviando && (arquivos.length > 0 || legenda.trim().length > 0);

  return (
    <main className="pagina">
      <Topo titulo={tipo === "post" ? "Novo post" : "Novo story"} voltar
        acao={<button className="btn peq" disabled={!podePublicar} onClick={publicar}>{enviando || "Publicar"}</button>} />

      <div className="abas">
        <button className={`aba ${tipo === "post" ? "ativa" : ""}`} onClick={() => { setTipo("post"); setTextoStory(false); }}>Post</button>
        <button className={`aba ${tipo === "story" ? "ativa" : ""}`} onClick={() => { setTipo("story"); setArquivos((v) => v.slice(0, 1)); }}>Story</button>
      </div>

      <input ref={input} type="file" hidden multiple={tipo === "post"}
        accept="image/*,video/mp4,video/quicktime,video/webm" onChange={escolher} />

      {tipo === "post" ? (
        <>
          {arquivos.length === 0 ? (
            <button className="seletor-midia" onClick={() => input.current?.click()}>
              <div><ImagePlus size={40} strokeWidth={1.4} /><p style={{ marginTop: 8, fontWeight: 600 }}>Escolher fotos ou vídeo</p><p className="peq">Até {MAX_FOTOS} arquivos · vídeo até 50 MB</p></div>
            </button>
          ) : (
            <div className="miniaturas">
              {arquivos.map((a, k) => (
                <div key={a.url}>
                  {a.video ? <video src={a.url} muted playsInline /> : <img src={a.url} alt="" />}
                  <button onClick={() => setArquivos((v) => v.filter((_, j) => j !== k))} aria-label="Remover"><X size={14} /></button>
                </div>
              ))}
              {arquivos.length < MAX_FOTOS && (
                <div style={{ display: "grid", placeItems: "center", border: "2px dashed var(--linha)", background: "none" }}>
                  <button style={{ position: "static", background: "none", color: "var(--ink-2)", width: "100%", height: "100%", borderRadius: 0 }} onClick={() => input.current?.click()} aria-label="Adicionar mais"><ImagePlus size={24} /></button>
                </div>
              )}
            </div>
          )}
          <label className="campo">
            <span>Legenda</span>
            <textarea value={legenda} onChange={(e) => setLegenda(e.target.value)} maxLength={2200} rows={4} placeholder="Escreva uma legenda…" />
          </label>
          {isAdmin && (
            <label className="check"><input type="checkbox" checked={comoIgreja} onChange={(e) => setComoIgreja(e.target.checked)} />Publicar como a igreja (em vez do meu nome)</label>
          )}
        </>
      ) : (
        <>
          <div className="previa-story" style={{ background: textoStory || !arquivos.length ? cor : "#000", width: "min(100%, 300px)" }}>
            {arquivos[0] ? (arquivos[0].video ? <video src={arquivos[0].url} muted autoPlay loop playsInline /> : <img src={arquivos[0].url} alt="" />)
              : textoStory ? (legenda || "Escreva seu texto…")
              : <span style={{ fontFamily: "var(--sans)", fontSize: 15, opacity: .85 }}>Escolha uma foto/vídeo ou crie um story só com texto</span>}
          </div>
          <div className="linha" style={{ justifyContent: "center" }}>
            <button className="btn sec peq" onClick={() => input.current?.click()}><ImagePlus size={16} />Foto ou vídeo</button>
            <button className={`btn peq ${textoStory ? "" : "sec"}`} onClick={() => { setTextoStory(true); setArquivos([]); }}><Type size={16} />Só texto</button>
          </div>
          {textoStory && (
            <div className="cores" style={{ justifyContent: "center" }}>
              {CORES_STORY.map((c) => <button key={c} className={c === cor ? "on" : ""} style={{ background: c }} onClick={() => setCor(c)} aria-label="Cor de fundo" />)}
            </div>
          )}
          <label className="campo">
            <span>{textoStory ? "Texto" : "Legenda (opcional)"}</span>
            <textarea value={legenda} onChange={(e) => setLegenda(e.target.value)} maxLength={500} rows={3} />
          </label>
          <label className="campo">
            <span>Publicar em</span>
            <select value={destino} onChange={(e) => setDestino(e.target.value)}>
              {destinos.map((d) => <option key={d.v} value={d.v}>{d.r}</option>)}
            </select>
          </label>
          <p className="muted peq">Stories aparecem no topo do Início e ficam no ar até um admin apagar.</p>
        </>
      )}
    </main>
  );
}
