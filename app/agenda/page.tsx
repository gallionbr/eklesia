"use client";
import { useCallback, useEffect, useState } from "react";
import { MapPin, Clock, Users, CalendarPlus } from "lucide-react";
import { sb, msgErro } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import type { Evento } from "@/lib/types";
import { diaMes, diaSemana, hora } from "@/lib/format";
import { Carregando, Topo, Vazio, toast } from "@/components/ui";

function linkCalendario(e: Evento) {
  const f = (iso: string) => iso.replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const fim = e.fim || new Date(new Date(e.inicio).getTime() + 2 * 3600e3).toISOString();
  const p = new URLSearchParams({ action: "TEMPLATE", text: e.titulo, dates: `${f(e.inicio)}/${f(fim)}`, details: e.descricao || "", location: e.local || "" });
  return `https://calendar.google.com/calendar/render?${p}`;
}

export default function Agenda() {
  const { session } = useAuth();
  const [eventos, setEventos] = useState<Evento[] | null>(null);
  const [inscritos, setInscritos] = useState<Record<string, number>>({});
  const [minhas, setMinhas] = useState<Set<string>>(new Set());
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [passados, setPassados] = useState(false);

  const carregar = useCallback(async () => {
    const agora = new Date().toISOString();
    let q = sb().from("eventos").select("*");
    q = passados ? q.lt("inicio", agora).order("inicio", { ascending: false }).limit(30) : q.gte("inicio", agora).order("inicio");
    const [e, c, m] = await Promise.all([
      q,
      sb().rpc("inscritos_por_evento"),
      sb().from("inscricoes").select("evento_id").eq("user_id", session!.user.id).eq("status", "confirmada"),
    ]);
    setEventos((e.data as Evento[]) || []);
    setInscritos(Object.fromEntries(((c.data as { evento_id: string; total: number }[]) || []).map((r) => [r.evento_id, Number(r.total)])));
    setMinhas(new Set(((m.data as { evento_id: string }[]) || []).map((r) => r.evento_id)));
  }, [session, passados]);

  useEffect(() => { carregar(); }, [carregar]);

  useEffect(() => {
    if (eventos && location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView({ block: "center" });
  }, [eventos]);

  async function alternar(e: Evento) {
    setOcupado(e.id);
    try {
      if (minhas.has(e.id)) {
        const { error } = await sb().from("inscricoes").delete().match({ evento_id: e.id, user_id: session!.user.id });
        if (error) throw error;
        toast("Inscrição cancelada");
      } else {
        const { error } = await sb().from("inscricoes").insert({ evento_id: e.id, user_id: session!.user.id });
        if (error) throw error;
        toast("Inscrição confirmada 🙌");
      }
      await carregar();
    } catch (err) {
      toast(msgErro(err));
    } finally {
      setOcupado(null);
    }
  }

  return (
    <main className="pagina">
      <Topo titulo="Agenda" sub="Cultos, encontros e eventos" />
      <div className="abas">
        <button className={`aba ${!passados ? "ativa" : ""}`} onClick={() => setPassados(false)}>Próximos</button>
        <button className={`aba ${passados ? "ativa" : ""}`} onClick={() => setPassados(true)}>Anteriores</button>
      </div>

      {eventos === null ? <Carregando /> : eventos.length === 0 ? (
        <Vazio>{passados ? "Nenhum evento anterior." : "Nenhum evento marcado por enquanto."}</Vazio>
      ) : (
        <div className="lista">
          {eventos.map((e) => {
            const { dia, mes } = diaMes(e.inicio);
            const total = inscritos[e.id] || 0;
            const restam = e.vagas != null ? Math.max(0, e.vagas - total) : null;
            const inscrito = minhas.has(e.id);
            return (
              <article key={e.id} id={e.id} className="card" style={{ cursor: "pointer" }}
                onClick={(ev) => { if (!(ev.target as HTMLElement).closest("button, a")) location.href = `/agenda/${e.id}`; }}>
                {e.banner_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={e.banner_url} alt="" className="agenda-banner" loading="lazy" />
                )}
                <div className="linha" style={{ alignItems: "flex-start" }}>
                  <div className="data-bloco"><b>{dia}</b><span>{mes}</span></div>
                  <div className="cresce">
                    <h3>{e.titulo}</h3>
                    <p className="muted peq linha" style={{ gap: 4, marginTop: 4 }}>
                      <Clock size={14} />{diaSemana(e.inicio)} · {hora(e.inicio)}{e.fim ? ` – ${hora(e.fim)}` : ""}
                    </p>
                    {e.local && <p className="muted peq linha" style={{ gap: 4 }}><MapPin size={14} />{e.local}</p>}
                  </div>
                </div>
                {e.descricao && <p className="quebra" style={{ marginTop: 10 }}>{e.descricao}</p>}

                {!passados && (
                  <div className="linha" style={{ marginTop: 12, flexWrap: "wrap" }}>
                    {e.inscricao_aberta && (e.valor_centavos ? (
                      <a className="btn peq" href={`/agenda/${e.id}`}>
                        {inscrito ? "Ver inscrição" : `Inscrever-se · R$ ${(e.valor_centavos / 100).toFixed(2).replace(".", ",")}`}
                      </a>
                    ) : (
                      <button className={`btn peq ${inscrito ? "sec" : ""}`} disabled={ocupado === e.id || (!inscrito && restam === 0)}
                        onClick={() => alternar(e)}>
                        {inscrito ? "Cancelar inscrição" : restam === 0 ? "Vagas esgotadas" : "Quero participar"}
                      </button>
                    ))}
                    <a className="btn peq sec" href={linkCalendario(e)} target="_blank" rel="noreferrer"><CalendarPlus size={16} />Agenda</a>
                    {e.inscricao_aberta && (
                      <span className="muted peq linha" style={{ gap: 4, marginLeft: "auto" }}>
                        <Users size={14} />{total}{e.vagas != null ? `/${e.vagas}` : ""} inscritos
                      </span>
                    )}
                  </div>
                )}
                {inscrito && <p className="selo verde" style={{ marginTop: 10 }}>Você está inscrito</p>}
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}
