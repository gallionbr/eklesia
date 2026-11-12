"use client";
// Barra do topo no estilo das abas principais: ajuda à esquerda; busca, criar (liderança) e perfil à direita.
import { useState } from "react";
import Link from "next/link";
import { CircleHelp, Search, Plus, MapPin, Clock, MessageCircle } from "lucide-react";
import { useAuth } from "@/lib/auth";
import Avatar from "./Avatar";
import { Folha } from "./ui";

export default function BarraTopo({ titulo }: { titulo?: string }) {
  const { perfil, isLider, config } = useAuth();
  const [ajuda, setAjuda] = useState(false);
  const zap = config?.whatsapp ? `https://wa.me/${config.whatsapp.replace(/\D/g, "")}` : null;
  const mapa = config?.maps_url || (config?.endereco ? `https://maps.google.com/?q=${encodeURIComponent(config.endereco)}` : null);
  return (
    <>
      <header className="barra-el">
        <button className="redondo" aria-label="Ajuda e informações" onClick={() => setAjuda(true)}><CircleHelp size={22} /></button>
        {titulo ? <span className="barra-el-tit">{titulo}</span> : <span className="cresce" />}
        <div className="linha" style={{ gap: 8 }}>
          {isLider && <button className="redondo" aria-label="Criar" onClick={() => window.dispatchEvent(new Event("eklesia:criar"))}><Plus size={22} /></button>}
          <Link className="redondo" href="/explorar" aria-label="Pesquisar"><Search size={21} /></Link>
          <Link className="redondo av-redondo" href="/perfil" aria-label="Meu perfil"><Avatar src={perfil?.avatar_url} nome={perfil?.nome} tam={34} /></Link>
        </div>
      </header>
      <Folha aberta={ajuda} fechar={() => setAjuda(false)} titulo={config?.nome_igreja || "Eklésia"}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {(config?.bio || config?.slogan) && <p className="quebra" style={{ fontSize: 16, lineHeight: 1.6 }}>{config?.bio || config?.slogan}</p>}
          <div className="opcoes">
            <div className="opcao"><Clock size={22} aria-hidden /><span className="cresce"><b>Cultos</b><span className="muted peq quebra">{config?.horarios_culto || "Horários ainda não cadastrados."}</span></span></div>
            {config?.endereco && <div className="opcao"><MapPin size={22} aria-hidden /><span className="cresce"><b>Endereço</b><span className="muted peq">{config.endereco}</span></span></div>}
          </div>
          {mapa && <a className="btn bloco" href={mapa} target="_blank" rel="noreferrer"><MapPin size={16} />Como chegar</a>}
          {zap && <a className="btn sec bloco" href={zap} target="_blank" rel="noreferrer"><MessageCircle size={16} />Falar com a igreja</a>}
        </div>
      </Folha>
    </>
  );
}
