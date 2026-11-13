"use client";
// Mural de aniversariantes do mês (Início): foto, primeiro nome e dia. Nunca mostra o ano.
import { useEffect, useState } from "react";
import Link from "next/link";
import { Cake } from "lucide-react";
import { sb } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import Avatar from "./Avatar";

interface Aniver { id: string; nome: string; avatar_url: string | null; dia: number }

const agora = () => new Date(new Date().toLocaleString("en-US", { timeZone: "America/Fortaleza" }));

export default function Aniversariantes() {
  const { perfil } = useAuth();
  const [lista, setLista] = useState<Aniver[] | null>(null);
  useEffect(() => {
    sb().rpc("aniversariantes_do_mes").then(({ data }) => setLista((data as Aniver[]) || []));
  }, []);
  if (lista === null) return null;

  const hoje = agora();
  const mes = hoje.toLocaleDateString("pt-BR", { month: "long" });
  const mm = String(hoje.getMonth() + 1).padStart(2, "0");
  const semData = perfil && !perfil.nascimento;

  if (!lista.length && !semData) return null;
  return (
    <section className="faixa">
      <div className="faixa-tit"><h2>Aniversariantes de {mes} 🎂</h2></div>
      <div className="faixa-rolo aniver">
        {lista.map((a) => {
          const ehHoje = a.dia === hoje.getDate();
          const passou = a.dia < hoje.getDate();
          return (
            <div key={a.id} className={`aniver-item ${ehHoje ? "hoje" : ""} ${passou ? "passou" : ""}`}>
              <span className="aniver-foto"><Avatar src={a.avatar_url} nome={a.nome} tam={76} /></span>
              <b>{a.nome.split(" ")[0]}</b>
              <span>{ehHoje ? "Hoje! 🎉" : `${String(a.dia).padStart(2, "0")}/${mm}`}</span>
            </div>
          );
        })}
        {semData && (
          <Link href="/perfil/editar" className="aniver-item convite">
            <span className="aniver-foto"><span className="aniver-mais"><Cake size={30} /></span></span>
            <b>Seu aniversário</b>
            <span>Cadastre a data</span>
          </Link>
        )}
      </div>
    </section>
  );
}
