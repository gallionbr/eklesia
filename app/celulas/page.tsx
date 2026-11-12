"use client";
import { useCallback, useEffect, useState } from "react";
import { MapPin, Clock, User, Phone, MessageCircle } from "lucide-react";
import { sb, msgErro } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import type { Celula, Perfil } from "@/lib/types";
import { Carregando, Topo, Vazio, toast } from "@/components/ui";
import BarraTopo from "@/components/BarraTopo";

export default function Celulas() {
  const { perfil, recarregar } = useAuth();
  const [celulas, setCelulas] = useState<Celula[] | null>(null);
  const [lideres, setLideres] = useState<Record<string, string>>({});
  const [membros, setMembros] = useState<Perfil[]>([]);
  const [busca, setBusca] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const minha = celulas?.find((c) => c.id === perfil?.celula_id) || null;
  const lidero = celulas?.filter((c) => c.lider_id === perfil?.id) || [];

  const carregar = useCallback(async () => {
    const [c, l] = await Promise.all([
      sb().from("celulas").select("*").eq("ativa", true).order("nome"),
      sb().rpc("lideres"),
    ]);
    setCelulas((c.data as Celula[]) || []);
    setLideres(Object.fromEntries(((l.data as { id: string; nome: string }[]) || []).map((r) => [r.id, r.nome])));
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  useEffect(() => {
    if (!lidero.length) return;
    sb().from("profiles").select("*").in("celula_id", lidero.map((c) => c.id)).order("nome")
      .then(({ data }) => setMembros((data as Perfil[]) || []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [celulas, perfil?.id]);

  async function participar(id: string | null) {
    setOcupado(true);
    try {
      const { error } = await sb().from("profiles").update({ celula_id: id }).eq("id", perfil!.id);
      if (error) throw error;
      await recarregar();
      toast(id ? "Bem-vindo à célula! 🙌" : "Você saiu da célula");
    } catch (e) {
      toast(msgErro(e));
    } finally {
      setOcupado(false);
    }
  }

  const filtradas = (celulas || []).filter((c) =>
    !busca || `${c.nome} ${c.bairro || ""} ${c.dia_semana || ""}`.toLowerCase().includes(busca.toLowerCase()));

  return (
    <main className="pagina">
      <BarraTopo />
      <Topo titulo="Grupos" sub="Células perto de você, durante a semana" />

      {celulas === null ? <Carregando /> : (
        <>
          {minha && (
            <section className="secao">
              <h2>Minha célula</h2>
              <CelulaCard c={minha} lider={minha.lider_id ? lideres[minha.lider_id] : undefined}>
                <button className="btn perigo peq" disabled={ocupado} onClick={() => participar(null)}>Sair da célula</button>
              </CelulaCard>
            </section>
          )}

          {lidero.length > 0 && (
            <section className="secao">
              <h2>Quem você lidera</h2>
              {lidero.map((c) => {
                const ms = membros.filter((m) => m.celula_id === c.id);
                return (
                  <div key={c.id} className="card">
                    <div className="linha entre"><h3>{c.nome}</h3><span className="selo azul">{ms.length} membros</span></div>
                    {ms.length === 0 ? <p className="muted peq" style={{ marginTop: 8 }}>Ninguém entrou ainda.</p> : (
                      <ul className="lista" style={{ listStyle: "none", padding: 0, margin: "10px 0 0" }}>
                        {ms.map((m) => (
                          <li key={m.id} className="linha entre">
                            <span>{m.nome}</span>
                            {m.telefone && (
                              <span className="linha" style={{ gap: 6 }}>
                                <a className="icone-btn" href={`tel:${m.telefone}`} aria-label={`Ligar para ${m.nome}`}><Phone size={16} /></a>
                                <a className="icone-btn" href={`https://wa.me/55${m.telefone.replace(/\D/g, "").replace(/^55/, "")}`} target="_blank" rel="noreferrer" aria-label={`WhatsApp de ${m.nome}`}><MessageCircle size={16} /></a>
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </section>
          )}

          <section className="secao">
            <h2>{minha ? "Outras células" : "Encontre uma célula"}</h2>
            <label className="campo">
              <span className="sr">Buscar</span>
              <input placeholder="Buscar por nome, bairro ou dia" value={busca} onChange={(e) => setBusca(e.target.value)} />
            </label>
            {filtradas.filter((c) => c.id !== minha?.id).length === 0 ? <Vazio>Nenhuma célula encontrada.</Vazio> : (
              <div className="lista">
                {filtradas.filter((c) => c.id !== minha?.id).map((c) => (
                  <CelulaCard key={c.id} c={c} lider={c.lider_id ? lideres[c.lider_id] : undefined}>
                    <button className="btn peq" disabled={ocupado} onClick={() => participar(c.id)}>
                      {minha ? "Mudar para esta" : "Quero participar"}
                    </button>
                  </CelulaCard>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}

function CelulaCard({ c, lider, children }: { c: Celula; lider?: string; children?: React.ReactNode }) {
  return (
    <article className="card">
      <h3>{c.nome}</h3>
      {c.descricao && <p className="muted quebra" style={{ marginTop: 4 }}>{c.descricao}</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 8 }} className="peq">
        {(c.dia_semana || c.horario) && <span className="linha" style={{ gap: 6 }}><Clock size={14} color="var(--ouro)" />{[c.dia_semana, c.horario].filter(Boolean).join(" · ")}</span>}
        {(c.bairro || c.endereco) && <span className="linha" style={{ gap: 6 }}><MapPin size={14} color="var(--ouro)" />{[c.bairro, c.endereco].filter(Boolean).join(" — ")}</span>}
        {lider && <span className="linha" style={{ gap: 6 }}><User size={14} color="var(--ouro)" />Líder: {lider}</span>}
      </div>
      {children && <div style={{ marginTop: 12 }}>{children}</div>}
    </article>
  );
}
