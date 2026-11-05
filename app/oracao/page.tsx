"use client";
import { useCallback, useEffect, useState } from "react";
import { HandHeart, Plus, Trash2, CheckCircle2 } from "lucide-react";
import { sb, msgErro } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import type { Pedido } from "@/lib/types";
import { relativo } from "@/lib/format";
import { Carregando, Folha, Topo, Vazio, toast } from "@/components/ui";

export default function Oracao() {
  const { perfil } = useAuth();
  const [aba, setAba] = useState<"mural" | "meus">("mural");
  const [pedidos, setPedidos] = useState<Pedido[] | null>(null);
  const [contagem, setContagem] = useState<Record<string, number>>({});
  const [orando, setOrando] = useState<Set<string>>(new Set());
  const [novo, setNovo] = useState(false);

  const carregar = useCallback(async () => {
    let q = sb().from("pedidos_oracao").select("*").order("criado_em", { ascending: false }).limit(60);
    q = aba === "mural" ? q.eq("publico", true) : q.eq("user_id", perfil!.id);
    const [p, c, o] = await Promise.all([q, sb().rpc("oracoes_por_pedido"), sb().from("oracoes").select("pedido_id").eq("user_id", perfil!.id)]);
    setPedidos((p.data as Pedido[]) || []);
    setContagem(Object.fromEntries(((c.data as { pedido_id: string; total: number }[]) || []).map((r) => [r.pedido_id, Number(r.total)])));
    setOrando(new Set(((o.data as { pedido_id: string }[]) || []).map((r) => r.pedido_id)));
  }, [aba, perfil]);

  useEffect(() => { setPedidos(null); carregar(); }, [carregar]);

  async function alternarOrando(id: string) {
    const ja = orando.has(id);
    const n = new Set(orando); ja ? n.delete(id) : n.add(id); setOrando(n);
    setContagem({ ...contagem, [id]: (contagem[id] || 0) + (ja ? -1 : 1) });
    const { error } = ja
      ? await sb().from("oracoes").delete().match({ pedido_id: id, user_id: perfil!.id })
      : await sb().from("oracoes").insert({ pedido_id: id });
    if (error) { toast(msgErro(error)); carregar(); }
    else if (!ja) toast("Obrigado por orar 🙏");
  }

  async function marcarRespondido(p: Pedido) {
    const testemunho = prompt("Quer contar como Deus respondeu? (opcional)") ?? undefined;
    const { error } = await sb().from("pedidos_oracao").update({ respondido: true, testemunho: testemunho || null }).eq("id", p.id);
    if (error) return toast(msgErro(error));
    toast("Glória a Deus! 🙌"); carregar();
  }

  async function apagar(p: Pedido) {
    if (!confirm("Apagar este pedido?")) return;
    const { error } = await sb().from("pedidos_oracao").delete().eq("id", p.id);
    if (error) return toast(msgErro(error));
    carregar();
  }

  return (
    <main className="pagina">
      <Topo titulo="Oração" sub="Levai as cargas uns dos outros" voltar
        acao={<button className="btn peq" onClick={() => setNovo(true)}><Plus size={16} />Pedido</button>} />
      <div className="abas">
        <button className={`aba ${aba === "mural" ? "ativa" : ""}`} onClick={() => setAba("mural")}>Mural da igreja</button>
        <button className={`aba ${aba === "meus" ? "ativa" : ""}`} onClick={() => setAba("meus")}>Meus pedidos</button>
      </div>

      {pedidos === null ? <Carregando /> : pedidos.length === 0 ? (
        <Vazio>{aba === "mural" ? "Nenhum pedido no mural ainda." : "Você ainda não fez pedidos de oração."}</Vazio>
      ) : (
        <div className="lista">
          {pedidos.map((p) => {
            const meu = p.user_id === perfil?.id;
            return (
              <article key={p.id} className="card">
                <div className="linha entre peq">
                  <b>{p.anonimo ? "Anônimo" : p.autor_nome || "Irmão(ã)"}</b>
                  <span className="muted">{relativo(p.criado_em)}</span>
                </div>
                <p className="quebra" style={{ marginTop: 6 }}>{p.pedido}</p>
                {p.respondido && (
                  <div className="card ouro" style={{ marginTop: 10, boxShadow: "none" }}>
                    <span className="selo verde"><CheckCircle2 size={12} />Oração respondida</span>
                    {p.testemunho && <p className="quebra" style={{ marginTop: 6 }}>{p.testemunho}</p>}
                  </div>
                )}
                <div className="linha" style={{ marginTop: 12, flexWrap: "wrap" }}>
                  {!meu && p.publico && (
                    <button className={`btn peq ${orando.has(p.id) ? "" : "sec"}`} onClick={() => alternarOrando(p.id)}>
                      <HandHeart size={16} />{orando.has(p.id) ? "Orando" : "Vou orar"}
                    </button>
                  )}
                  {(contagem[p.id] || 0) > 0 && <span className="muted peq">{contagem[p.id]} orando</span>}
                  {meu && (
                    <span className="linha" style={{ marginLeft: "auto", gap: 6 }}>
                      {!p.publico && <span className="selo">Só liderança</span>}
                      {!p.respondido && <button className="btn sec peq" onClick={() => marcarRespondido(p)}>Foi respondida</button>}
                      <button className="icone-btn" onClick={() => apagar(p)} aria-label="Apagar"><Trash2 size={16} /></button>
                    </span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <NovoPedido aberto={novo} fechar={() => setNovo(false)} nome={perfil?.nome || ""} aoSalvar={() => { setNovo(false); carregar(); }} />
    </main>
  );
}

function NovoPedido({ aberto, fechar, nome, aoSalvar }: { aberto: boolean; fechar: () => void; nome: string; aoSalvar: () => void }) {
  const [texto, setTexto] = useState("");
  const [publico, setPublico] = useState(true);
  const [anonimo, setAnonimo] = useState(false);
  const [salvando, setSalvando] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    const { error } = await sb().from("pedidos_oracao").insert({ pedido: texto.trim(), publico, anonimo, autor_nome: anonimo ? null : nome });
    setSalvando(false);
    if (error) return toast(msgErro(error));
    setTexto(""); toast("Pedido enviado. Estamos com você 🙏"); aoSalvar();
  }

  return (
    <Folha aberta={aberto} fechar={fechar} titulo="Pedido de oração">
      <form className="form" onSubmit={salvar}>
        <label className="campo">
          <span>Pelo que podemos orar?</span>
          <textarea value={texto} onChange={(e) => setTexto(e.target.value)} required minLength={3} maxLength={1000} rows={5} />
        </label>
        <label className="check"><input type="checkbox" checked={publico} onChange={(e) => setPublico(e.target.checked)} />Mostrar no mural da igreja</label>
        {publico && <label className="check"><input type="checkbox" checked={anonimo} onChange={(e) => setAnonimo(e.target.checked)} />Publicar sem meu nome</label>}
        <p className="muted peq">{publico ? "Os irmãos verão o pedido e poderão orar por você." : "Só a liderança pastoral verá este pedido."}</p>
        <button className="btn bloco" disabled={salvando || texto.trim().length < 3}>{salvando ? "Enviando…" : "Enviar pedido"}</button>
      </form>
    </Folha>
  );
}
