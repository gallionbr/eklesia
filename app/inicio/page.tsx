"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, HandHeart, MessageCircleHeart, BookOpen, Pin, Clock, MapPin, ExternalLink } from "lucide-react";
import { sb } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import type { Aviso, Devocional, Evento } from "@/lib/types";
import { diaMes, hora, hojeISO, primeiroNome, relativo, saudacao, diaSemana } from "@/lib/format";
import { Carregando, Vazio } from "@/components/ui";

export default function Inicio() {
  const { perfil, config } = useAuth();
  const [avisos, setAvisos] = useState<Aviso[] | null>(null);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [devo, setDevo] = useState<Devocional | null>(null);

  useEffect(() => {
    const agora = new Date().toISOString();
    Promise.all([
      sb().from("avisos").select("*").or(`expira_em.is.null,expira_em.gt.${agora}`)
        .order("fixado", { ascending: false }).order("publicado_em", { ascending: false }).limit(10),
      sb().from("eventos").select("*").gte("inicio", agora).order("inicio").limit(3),
      sb().from("devocionais").select("*").lte("data", hojeISO()).order("data", { ascending: false }).limit(1).maybeSingle(),
    ]).then(([a, e, d]) => {
      setAvisos((a.data as Aviso[]) || []);
      setEventos((e.data as Evento[]) || []);
      setDevo((d.data as Devocional) || null);
    });
  }, []);

  return (
    <main className="pagina">
      <header className="topo">
        <div>
          <p className="muted peq">{saudacao()}{perfil?.nome ? "," : ""}</p>
          <h1>{primeiroNome(perfil?.nome) || "Bem-vindo"}</h1>
        </div>
        <img src="/logo.svg" alt="Eklésia" width={44} height={71} style={{ height: 56, width: "auto" }} />
      </header>

      <Link href="/biblia#devocional" className="card destaque" style={{ display: "block" }}>
        <p className="peq" style={{ opacity: .8, fontWeight: 600, letterSpacing: ".04em", textTransform: "uppercase" }}>Devocional de hoje</p>
        {devo ? (
          <>
            <h2 style={{ marginTop: 6 }}>{devo.titulo}</h2>
            <p style={{ marginTop: 8, fontFamily: "var(--serif)", fontSize: 17, opacity: .95 }} className="quebra">
              “{devo.texto_biblico.length > 180 ? devo.texto_biblico.slice(0, 180) + "…" : devo.texto_biblico}”
            </p>
            <p className="muted peq" style={{ marginTop: 6 }}>{devo.referencia} · Ler reflexão →</p>
          </>
        ) : (
          <p style={{ marginTop: 6 }}>Abra a Bíblia e comece o dia na Palavra →</p>
        )}
      </Link>

      <nav className="atalhos" aria-label="Atalhos">
        <Link href="/celulas" className="atalho"><Users size={22} />Células</Link>
        <Link href="/oracao" className="atalho"><MessageCircleHeart size={22} />Oração</Link>
        <Link href="/ofertas" className="atalho"><HandHeart size={22} />Ofertar</Link>
        <Link href="/biblia" className="atalho"><BookOpen size={22} />Bíblia</Link>
      </nav>

      {config?.horarios_culto && (
        <div className="card ouro">
          <div className="linha"><Clock size={18} color="var(--ouro)" /><b>Nossos cultos</b></div>
          <p className="muted quebra" style={{ marginTop: 4 }}>{config.horarios_culto}</p>
          {config.endereco && (
            <a className="linha peq" style={{ marginTop: 8, color: "var(--primaria)", fontWeight: 600 }}
              href={`https://maps.google.com/?q=${encodeURIComponent(config.endereco)}`} target="_blank" rel="noreferrer">
              <MapPin size={14} />{config.endereco}
            </a>
          )}
        </div>
      )}

      <section className="secao">
        <div className="secao-tit"><h2>Próximos encontros</h2><Link href="/agenda">Ver agenda</Link></div>
        {eventos.length === 0 ? (
          <Vazio>Nenhum evento marcado por enquanto.</Vazio>
        ) : (
          <div className="lista">
            {eventos.map((e) => {
              const { dia, mes } = diaMes(e.inicio);
              return (
                <Link key={e.id} href={`/agenda#${e.id}`} className="card linha">
                  <div className="data-bloco"><b>{dia}</b><span>{mes}</span></div>
                  <div className="cresce">
                    <h3>{e.titulo}</h3>
                    <p className="muted peq">{diaSemana(e.inicio)} · {hora(e.inicio)}{e.local ? ` · ${e.local}` : ""}</p>
                  </div>
                  {e.inscricao_aberta && <span className="selo verde">Inscrições</span>}
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <section className="secao">
        <h2>Avisos</h2>
        {avisos === null ? <Carregando /> : avisos.length === 0 ? (
          <Vazio>Sem avisos no momento.</Vazio>
        ) : (
          <div className="lista">
            {avisos.map((a) => (
              <article key={a.id} className="card">
                <div className="linha entre">
                  <h3 className="cresce">{a.titulo}</h3>
                  {a.fixado && <Pin size={16} color="var(--ouro)" aria-label="Fixado" />}
                </div>
                {a.corpo && <p className="quebra" style={{ marginTop: 6 }}>{a.corpo}</p>}
                <div className="linha entre" style={{ marginTop: 10 }}>
                  <span className="muted peq">{relativo(a.publicado_em)}</span>
                  {a.link && (
                    <a href={a.link} target="_blank" rel="noreferrer" className="linha peq" style={{ color: "var(--primaria)", fontWeight: 600, gap: 4 }}>
                      Saiba mais <ExternalLink size={14} />
                    </a>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
