"use client";
// Página do evento: banner 4:5, informações e inscrição (gratuita ou paga pelo app).
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { CalendarPlus, ChevronLeft, Clock, MapPin, Users, Ticket } from "lucide-react";
import { sb, msgErro } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import type { Evento } from "@/lib/types";
import { diaSemana, hora } from "@/lib/format";
import { nomeConta, COR_REDE } from "@/lib/contas";
import { Carregando, Vazio, toast } from "@/components/ui";
import Pagamento from "@/components/Pagamento";

const reais = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataLonga = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "numeric", month: "long", timeZone: "America/Fortaleza" });

function linkCalendario(e: Evento) {
  const f = (iso: string) => iso.replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const fim = e.fim || new Date(new Date(e.inicio).getTime() + 2 * 3600e3).toISOString();
  const p = new URLSearchParams({ action: "TEMPLATE", text: e.titulo, dates: `${f(e.inicio)}/${f(fim)}`, details: e.descricao || "", location: e.local || "" });
  return `https://calendar.google.com/calendar/render?${p}`;
}

export default function EventoPagina() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const [e, setE] = useState<Evento | null | undefined>(undefined);
  const [total, setTotal] = useState(0);
  const [minha, setMinha] = useState<{ status: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [pagar, setPagar] = useState(false);

  const carregar = useCallback(async () => {
    const [ev, c, m] = await Promise.all([
      sb().from("eventos").select("*").eq("id", id).maybeSingle(),
      sb().rpc("inscritos_por_evento"),
      session ? sb().from("inscricoes").select("status").match({ evento_id: id, user_id: session.user.id }).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    setE((ev.data as Evento) || null);
    setTotal(Number(((c.data as { evento_id: string; total: number }[]) || []).find((r) => r.evento_id === id)?.total || 0));
    setMinha((m.data as { status: string } | null) || null);
  }, [id, session]);
  useEffect(() => { carregar(); }, [carregar]);

  if (e === undefined) return <main className="pagina"><Carregando /></main>;
  if (!e) return <main className="pagina"><Vazio>Evento não encontrado.</Vazio></main>;

  const valor = e.valor_centavos || 0;
  const passou = new Date(e.inicio) < new Date();
  const restam = e.vagas != null ? Math.max(0, e.vagas - total) : null;
  const confirmado = minha?.status === "confirmada";
  const aguardando = minha?.status === "aguardando_pagamento";

  async function inscreverGratis() {
    setOcupado(true);
    try {
      const { error } = await sb().from("inscricoes").insert({ evento_id: e!.id, user_id: session!.user.id });
      if (error) throw error;
      toast("Inscrição confirmada 🙌"); await carregar();
    } catch (err) { toast(msgErro(err)); } finally { setOcupado(false); }
  }
  async function cancelar() {
    if (valor && !confirm("Cancelar a inscrição? Para reembolso, fale com a liderança.")) return;
    setOcupado(true);
    try {
      const { error } = await sb().from("inscricoes").delete().match({ evento_id: e!.id, user_id: session!.user.id });
      if (error) throw error;
      toast("Inscrição cancelada"); await carregar();
    } catch (err) { toast(msgErro(err)); } finally { setOcupado(false); }
  }

  return (
    <main className="pagina evento">
      <div className="evento-banner" style={{ background: e.rede ? COR_REDE[e.rede] : undefined }}>
        {e.banner_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={e.banner_url} alt={`Banner: ${e.titulo}`} />
        )}
        <button className="redondo voltar" aria-label="Voltar" onClick={() => (history.length > 1 ? router.back() : router.push("/agenda"))}><ChevronLeft size={24} /></button>
      </div>

      <h1 className="pg-tit">{e.titulo}</h1>
      <div className="pg-tags">
        <span>{valor ? reais(valor) : "Gratuito"}</span>
        {e.rede && <span>{nomeConta(e.rede)}</span>}
        {confirmado && <span className="on">Você está inscrito</span>}
        {aguardando && <span className="on">Aguardando pagamento</span>}
      </div>

      <ul className="pg-info">
        <li><Clock size={20} />{diaSemana(e.inicio)}, {dataLonga(e.inicio)} · {hora(e.inicio)}{e.fim ? ` – ${hora(e.fim)}` : ""}</li>
        {e.local && <li><MapPin size={20} />{e.local}</li>}
        {e.inscricao_aberta && <li><Users size={20} />{total} inscritos{e.vagas != null ? ` · ${restam} ${restam === 1 ? "vaga" : "vagas"}` : ""}</li>}
      </ul>

      {e.descricao && <section className="secao"><h2>Sobre o evento</h2><p className="pg-sobre quebra">{e.descricao}</p></section>}

      <a className="btn sec bloco" href={linkCalendario(e)} target="_blank" rel="noreferrer"><CalendarPlus size={16} />Adicionar à minha agenda</a>

      {e.inscricao_aberta && !passou && (
        <div className="pg-acao">
          {confirmado ? (
            <button className="btn bloco contorno" disabled={ocupado} onClick={cancelar}>Cancelar inscrição</button>
          ) : restam === 0 ? (
            <button className="btn bloco" disabled>Vagas esgotadas</button>
          ) : valor ? (
            <button className="btn bloco pg-entrar" onClick={() => setPagar(true)}><Ticket size={18} />{aguardando ? "Concluir pagamento" : `Inscrever-se · ${reais(valor)}`}</button>
          ) : (
            <button className="btn bloco pg-entrar" disabled={ocupado} onClick={inscreverGratis}>Quero participar</button>
          )}
        </div>
      )}

      {valor > 0 && (
        <Pagamento aberto={pagar} fechar={() => { setPagar(false); carregar(); }} titulo="Inscrição" centavos={valor}
          endpoint="/api/eventos/inscrever" corpo={{ eventoId: e.id }} aoPagar={() => setTimeout(carregar, 1500)}
          textoPago="Inscrição confirmada! Nos vemos lá 🙌" />
      )}
    </main>
  );
}
