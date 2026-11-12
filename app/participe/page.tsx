"use client";
// Participe: os próximos passos na igreja e os projetos sociais da Eklésia.
import Link from "next/link";
import { ChevronRight, HandHeart, MessageCircle } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { PASSOS, PROJETOS, linkZap } from "@/lib/passos";
import BarraTopo from "@/components/BarraTopo";

export default function Participe() {
  const { config } = useAuth();
  return (
    <main className="el-pagina">
      <BarraTopo />
      <div className="saudacao">
        <h1>Participe</h1>
        <p>Encontre o seu próximo passo na Eklésia</p>
      </div>

      <section className="lista-passos">
        {PASSOS.map((p) => {
          const href = p.href || linkZap(config?.whatsapp, p.zap || "") || "#";
          const externo = !p.href;
          return (
            <a key={p.id} href={href} target={externo ? "_blank" : undefined} rel={externo ? "noreferrer" : undefined} className="passo-linha">
              <span className="passo-ico" style={{ background: p.fundo }}><p.Icone size={24} strokeWidth={1.8} aria-hidden /></span>
              <span className="cresce"><b>{p.titulo}</b><span className="muted peq">{p.sub}</span></span>
              <ChevronRight size={20} aria-hidden />
            </a>
          );
        })}
      </section>

      <div className="saudacao" id="projetos" style={{ marginTop: 8 }}>
        <h1 style={{ fontSize: 26 }}>Projetos da Eklésia</h1>
        <p>Servimos a comunidade com amor e ações práticas</p>
      </div>

      {PROJETOS.map((p) => {
        const zap = linkZap(config?.whatsapp, p.zap);
        return (
          <article key={p.id} id={p.id} className="projeto">
            <div className="projeto-capa" style={{ background: p.fundo }}>
              <p.Icone size={56} strokeWidth={1.2} aria-hidden />
              <span className="hero-veu" />
              <span className="projeto-tit"><b>{p.titulo}</b><span>{p.curto}</span></span>
            </div>
            <div className="projeto-corpo">
              <p>{p.texto}</p>
              <div className="linha" style={{ gap: 8, flexWrap: "wrap" }}>
                {zap && <a className="btn" href={zap} target="_blank" rel="noreferrer"><MessageCircle size={16} />Quero ajudar</a>}
                <Link className="btn sec" href={p.doar ? `/ofertas?para=${p.doar}` : "/ofertas"}><HandHeart size={16} />Doar</Link>
              </div>
            </div>
          </article>
        );
      })}
    </main>
  );
}
