"use client";
// Destaque da Início: carrossel automático com as 3 últimas mensagens (e o culto, quando ao vivo).
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Play, Radio } from "lucide-react";
import { capaGrande, capaMedia, type Video } from "@/lib/youtube";

interface Slide { id: string | null; titulo: string; rotulo: string; aoVivo?: boolean; href: string }

export default function HeroCarrossel({ videos, aoVivo, reserva, capa }: { videos: Video[]; aoVivo: string | null; reserva: string; capa?: string | null }) {
  const sermoes = videos.filter((v) => v.tipo !== "culto").slice(0, 3);
  const slides: Slide[] = [
    ...(aoVivo ? [{ id: aoVivo === "url" ? null : aoVivo, titulo: "Culto ao vivo", rotulo: "", aoVivo: true, href: "/assistir" }] : []),
    ...sermoes.map((v, i) => ({ id: v.id, titulo: v.titulo, rotulo: i === 0 ? "Mensagem mais recente" : "Mensagem", href: `/assistir?v=${v.id}` })),
  ];
  if (!slides.length) slides.push({ id: null, titulo: reserva, rotulo: "Bem-vindo", href: "/assistir" });

  const rolo = useRef<HTMLDivElement>(null);
  const [atual, setAtual] = useState(0);
  const [pausa, setPausa] = useState(false);

  // Marca o slide visível conforme a pessoa arrasta.
  useEffect(() => {
    const el = rolo.current;
    if (!el) return;
    const f = () => setAtual(Math.round(el.scrollLeft / el.clientWidth));
    el.addEventListener("scroll", f, { passive: true });
    return () => el.removeEventListener("scroll", f);
  }, []);

  // Passa sozinho a cada 6 s (para enquanto a pessoa toca).
  useEffect(() => {
    if (slides.length < 2 || pausa) return;
    const t = setInterval(() => {
      const el = rolo.current;
      if (!el) return;
      const prox = (Math.round(el.scrollLeft / el.clientWidth) + 1) % slides.length;
      el.scrollTo({ left: prox * el.clientWidth, behavior: "smooth" });
    }, 6000);
    return () => clearInterval(t);
  }, [slides.length, pausa]);

  return (
    <div className="hero-carrossel" onTouchStart={() => setPausa(true)} onTouchEnd={() => setTimeout(() => setPausa(false), 4000)}
      onMouseEnter={() => setPausa(true)} onMouseLeave={() => setPausa(false)}>
      <div className="hero-rolo" ref={rolo}>
        {slides.map((s, i) => (
          <Link key={(s.id || "x") + i} href={s.href} className="hero" aria-label={`${s.titulo} — assistir`}>
            {s.id ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={capaGrande(s.id)} alt="" onError={(e) => {
                const img = e.target as HTMLImageElement;
                if (img.src.includes("hqdefault")) img.style.display = "none"; else img.src = capaMedia(s.id!);
              }} />
            ) : capa ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={capa} alt="" />
            ) : null}
            <span className="hero-veu" />
            <span className="hero-txt">
              {s.aoVivo ? <span className="selo-aovivo"><Radio size={14} /> AO VIVO AGORA</span> : <span className="hero-rot">{s.rotulo}</span>}
              <b>{s.titulo}</b>
              <span className="hero-btn"><Play size={16} fill="currentColor" /> Assistir</span>
            </span>
          </Link>
        ))}
      </div>
      {slides.length > 1 && (
        <div className="hero-pontos" role="tablist" aria-label="Destaques">
          {slides.map((s, i) => (
            <button key={i} role="tab" aria-selected={i === atual} aria-label={`Destaque ${i + 1}`}
              onClick={() => rolo.current?.scrollTo({ left: i * rolo.current.clientWidth, behavior: "smooth" })}>
              <span className={i === atual ? "on" : ""} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
