"use client";
// Tela de um Pequeno Grupo (PG): sobre, quando, onde (aproximado), líder e botão para participar.
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, Clock, Repeat, Users, MapPin, MessageCircle } from "lucide-react";
import { sb, msgErro } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import type { Celula } from "@/lib/types";
import { nomeAfinidade } from "@/lib/afinidades";
import { Carregando, Vazio, toast } from "@/components/ui";

const iniciais = (n: string) => n.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
const cidade = "São Luís, MA";

export default function PG() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { perfil, recarregar, config } = useAuth();
  const [c, setC] = useState<Celula | null | undefined>(undefined);
  const [lider, setLider] = useState<string>("");
  const [mais, setMais] = useState(false);
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    sb().from("celulas").select("*").eq("id", id).maybeSingle().then(({ data }) => setC((data as Celula) || null));
  }, [id]);

  useEffect(() => {
    if (!c) return;
    if (c.lider_id) sb().rpc("lideres").then(({ data }) => setLider(((data as { id: string; nome: string }[]) || []).find((l) => l.id === c.lider_id)?.nome || ""));
    const q = [c.bairro, cidade].filter(Boolean).join(", ");
    if (c.bairro) fetch(`/api/geo?q=${encodeURIComponent(q)}`).then((r) => r.json()).then((j) => j.lat && setPos(j)).catch(() => {});
  }, [c]);

  const membro = !!c && perfil?.celula_id === c.id;

  async function participar(sim: boolean) {
    if (!perfil) return router.push("/entrar");
    setOcupado(true);
    try {
      const { error } = await sb().from("profiles").update({ celula_id: sim ? c!.id : null }).eq("id", perfil.id);
      if (error) throw error;
      await recarregar();
      toast(sim ? "Bem-vindo ao PG! 🙌" : "Você saiu do PG");
    } catch (e) { toast(msgErro(e)); } finally { setOcupado(false); }
  }

  if (c === undefined) return <main className="pagina"><Carregando /></main>;
  if (!c) return <main className="pagina"><Vazio>Este PG não foi encontrado.</Vazio></main>;

  const d = 0.012; // ~1 km: mostra só a região, não o endereço
  const mapa = pos ? `https://www.openstreetmap.org/export/embed.html?bbox=${pos.lng - d * 1.6},${pos.lat - d},${pos.lng + d * 1.6},${pos.lat + d}&layer=mapnik` : null;
  const zapLider = config?.whatsapp ? `https://wa.me/${config.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(`Olá! Quero saber mais sobre o ${c.nome}.`)}` : null;
  const descricao = c.descricao || "Um Pequeno Grupo para comunhão, oração e estudo da Palavra durante a semana.";

  return (
    <main className="pagina pg">
      <button className="redondo" aria-label="Voltar" onClick={() => (history.length > 1 ? router.back() : router.push("/celulas"))}><ChevronLeft size={24} /></button>

      <h1 className="pg-tit">{c.nome}</h1>
      <div className="pg-tags">
        <span>{nomeAfinidade(c.afinidade)}</span>
        {c.dia_semana && <span>{c.dia_semana}</span>}
        <span>Presencial</span>
        {membro && <span className="on">Seu PG</span>}
      </div>

      <section className="secao">
        <h2>Sobre este grupo</h2>
        <p className={`pg-sobre ${mais ? "" : "curto"}`}>{descricao}</p>
        {descricao.length > 110 && <button className="link" onClick={() => setMais(!mais)}>{mais ? "MENOS" : "MAIS"}</button>}
      </section>

      <ul className="pg-info">
        {(c.dia_semana || c.horario) && <li><Clock size={20} />{[c.dia_semana, c.horario].filter(Boolean).join(" às ")}</li>}
        <li><Repeat size={20} />Encontros semanais</li>
        <li><Users size={20} />Presencial, nas casas</li>
        {c.bairro && <li><MapPin size={20} />{c.bairro}</li>}
      </ul>

      {lider && (
        <section className="secao">
          <h2>Líder</h2>
          <div className="linha" style={{ gap: 14 }}>
            <span className="pg-av">{iniciais(lider)}</span>
            <span className="cresce"><b style={{ fontSize: 17 }}>{lider.split(" ").slice(0, 2).map((p, i) => (i ? p[0] + "." : p)).join(" ")}</b><span className="muted" style={{ display: "block" }}>Líder</span></span>
            {zapLider && <a className="redondo" href={zapLider} target="_blank" rel="noreferrer" aria-label="Falar sobre este PG"><MessageCircle size={20} /></a>}
          </div>
        </section>
      )}

      {membro && c.endereco && (
        <div className="opcoes"><div className="opcao"><MapPin size={22} /><span className="cresce"><b>Endereço</b><span className="muted peq">{c.endereco}{c.bairro ? ` — ${c.bairro}` : ""}</span></span></div></div>
      )}

      {mapa && (
        <section className="secao">
          <h2>Localização aproximada</h2>
          <div className="pg-mapa">
            <iframe src={mapa} title={`Região do ${c.nome}`} loading="lazy" />
            <span className="pg-circulo" aria-hidden />
          </div>
          {!membro && <p className="muted peq">O endereço exato aparece quando você participa do PG.</p>}
        </section>
      )}

      <div className="pg-acao">
        {membro
          ? <button className="btn bloco contorno" disabled={ocupado} onClick={() => participar(false)}>Sair do PG</button>
          : <button className="btn bloco pg-entrar" disabled={ocupado} onClick={() => participar(true)}>{perfil?.celula_id ? "Mudar para este PG" : "Participar do PG"}</button>}
      </div>
    </main>
  );
}
