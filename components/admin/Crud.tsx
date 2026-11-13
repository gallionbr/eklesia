"use client";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { sb, msgErro } from "@/lib/supabase";
import { isoParaLocal, localParaISO } from "@/lib/format";
import { Carregando, Folha, Vazio, toast } from "@/components/ui";
import { enviarMidia } from "@/lib/midia";

export type TipoCampo = "text" | "textarea" | "datetime" | "date" | "number" | "bool" | "select" | "url" | "dinheiro" | "imagem";
export interface CampoDef {
  k: string;
  rotulo: string;
  tipo?: TipoCampo;
  obrigatorio?: boolean;
  opcoes?: { v: string; r: string }[];
  dica?: string;
  padrao?: unknown;
  pasta?: string;          // imagem: pasta no Storage
}

type Linha = Record<string, unknown> & { id: string };

interface Props {
  tabela: string;
  nome: string;                       // ex.: "aviso"
  campos: CampoDef[];
  ordem: { col: string; asc: boolean }[];
  resumo: (l: Linha) => ReactNode;
  extra?: (l: Linha) => ReactNode;
}

function paraForm(campos: CampoDef[], l?: Linha) {
  const o: Record<string, string | boolean> = {};
  for (const c of campos) {
    const v = l ? l[c.k] : c.padrao;
    if (c.tipo === "bool") o[c.k] = Boolean(v);
    else if (c.tipo === "datetime") o[c.k] = isoParaLocal(v as string | null);
    else if (c.tipo === "dinheiro") o[c.k] = v ? (Number(v) / 100).toFixed(2).replace(".", ",") : "";
    else o[c.k] = v == null ? "" : String(v);
  }
  return o;
}

function paraBanco(campos: CampoDef[], f: Record<string, string | boolean>) {
  const o: Record<string, unknown> = {};
  for (const c of campos) {
    const v = f[c.k];
    if (c.tipo === "bool") o[c.k] = Boolean(v);
    else if (c.tipo === "datetime") o[c.k] = localParaISO(v as string);
    else if (c.tipo === "number") o[c.k] = v === "" ? null : Number(v);
    else if (c.tipo === "dinheiro") o[c.k] = v ? Math.round(Number(String(v).replace(/\./g, "").replace(",", ".")) * 100) || 0 : 0;
    else o[c.k] = typeof v === "string" && v.trim() === "" ? null : typeof v === "string" ? v.trim() : v;
  }
  return o;
}

export default function Crud({ tabela, nome, campos, ordem, resumo, extra }: Props) {
  const [linhas, setLinhas] = useState<Linha[] | null>(null);
  const [editando, setEditando] = useState<Linha | "novo" | null>(null);
  const [form, setForm] = useState<Record<string, string | boolean>>({});
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    let q = sb().from(tabela).select("*");
    for (const o of ordem) q = q.order(o.col, { ascending: o.asc });
    const { data, error } = await q.limit(300);
    if (error) toast(msgErro(error));
    setLinhas((data as Linha[]) || []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabela]);

  useEffect(() => { carregar(); }, [carregar]);

  function abrir(l: Linha | "novo") {
    setForm(paraForm(campos, l === "novo" ? undefined : l));
    setEditando(l);
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    const dados = paraBanco(campos, form);
    const r = editando === "novo"
      ? await sb().from(tabela).insert(dados)
      : await sb().from(tabela).update(dados).eq("id", (editando as Linha).id);
    setSalvando(false);
    if (r.error) return toast(msgErro(r.error));
    toast(editando === "novo" ? `${cap(nome)} criado` : "Alterações salvas");
    setEditando(null);
    carregar();
  }

  async function apagar(l: Linha) {
    if (!confirm(`Apagar este ${nome}? Não dá para desfazer.`)) return;
    const { error } = await sb().from(tabela).delete().eq("id", l.id);
    if (error) return toast(msgErro(error));
    toast(`${cap(nome)} apagado`);
    carregar();
  }

  return (
    <div className="secao">
      <button className="btn" onClick={() => abrir("novo")}><Plus size={18} />Novo {nome}</button>
      {linhas === null ? <Carregando /> : linhas.length === 0 ? <Vazio>Nada cadastrado ainda.</Vazio> : (
        <div className="lista">
          {linhas.map((l) => (
            <div key={l.id} className="card">
              <div className="linha" style={{ alignItems: "flex-start" }}>
                <div className="cresce">{resumo(l)}</div>
                <button className="icone-btn" onClick={() => abrir(l)} aria-label="Editar"><Pencil size={16} /></button>
                <button className="icone-btn" onClick={() => apagar(l)} aria-label="Apagar"><Trash2 size={16} /></button>
              </div>
              {extra && extra(l)}
            </div>
          ))}
        </div>
      )}

      <Folha aberta={editando !== null} fechar={() => setEditando(null)} titulo={editando === "novo" ? `Novo ${nome}` : `Editar ${nome}`}>
        <form className="form" onSubmit={salvar}>
          {campos.map((c) => {
            const v = form[c.k];
            const muda = (val: string | boolean) => setForm((f) => ({ ...f, [c.k]: val }));
            if (c.tipo === "imagem") {
              return <CampoImagem key={c.k} c={c} url={(v as string) || ""} muda={(u) => muda(u)} />;
            }
            if (c.tipo === "bool") {
              return <label key={c.k} className="check"><input type="checkbox" checked={Boolean(v)} onChange={(e) => muda(e.target.checked)} />{c.rotulo}</label>;
            }
            return (
              <label key={c.k} className="campo">
                <span>{c.rotulo}{c.obrigatorio ? " *" : ""}</span>
                {c.tipo === "textarea" ? (
                  <textarea value={v as string} onChange={(e) => muda(e.target.value)} required={c.obrigatorio} rows={5} />
                ) : c.tipo === "select" ? (
                  <select value={v as string} onChange={(e) => muda(e.target.value)} required={c.obrigatorio}>
                    <option value="">—</option>
                    {c.opcoes?.map((o) => <option key={o.v} value={o.v}>{o.r}</option>)}
                  </select>
                ) : (
                  <input
                    type={c.tipo === "datetime" ? "datetime-local" : c.tipo === "date" ? "date" : c.tipo === "number" ? "number" : c.tipo === "url" ? "url" : "text"}
                    inputMode={c.tipo === "dinheiro" ? "decimal" : undefined} placeholder={c.tipo === "dinheiro" ? "0,00" : undefined}
                    value={v as string} onChange={(e) => muda(e.target.value)} required={c.obrigatorio} min={c.tipo === "number" ? 0 : undefined}
                  />
                )}
                {c.dica && <small className="muted">{c.dica}</small>}
              </label>
            );
          })}
          <button className="btn bloco" disabled={salvando}>{salvando ? "Salvando…" : "Salvar"}</button>
        </form>
      </Folha>
    </div>
  );
}

/** Imagem enviada para o Storage (reduzida no celular antes de subir). */
function CampoImagem({ c, url, muda }: { c: CampoDef; url: string; muda: (u: string) => void }) {
  const [enviando, setEnviando] = useState(false);
  async function escolher(f?: File) {
    if (!f) return;
    setEnviando(true);
    try { const m = await enviarMidia(f, c.pasta || "posts/eventos"); muda(m.url); }
    catch (e) { toast(msgErro(e)); }
    finally { setEnviando(false); }
  }
  return (
    <div className="campo">
      <span>{c.rotulo}</span>
      {url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" style={{ width: 160, aspectRatio: "4 / 5", objectFit: "cover", borderRadius: 14, border: "1px solid var(--linha)" }} />
      )}
      <div className="linha" style={{ gap: 8, flexWrap: "wrap" }}>
        <label className="btn sec peq" style={{ cursor: "pointer" }}>
          {enviando ? "Enviando…" : url ? "Trocar imagem" : "Escolher imagem"}
          <input type="file" accept="image/*" hidden disabled={enviando} onChange={(e) => escolher(e.target.files?.[0])} />
        </label>
        {url && <button type="button" className="btn sec peq" onClick={() => muda("")}>Remover</button>}
      </div>
      {c.dica && <small className="muted">{c.dica}</small>}
    </div>
  );
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
