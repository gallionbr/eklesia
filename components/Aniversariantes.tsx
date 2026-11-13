"use client";
// Mural de aniversariantes do mês (Início): foto, primeiro nome e dia. Nunca mostra o ano.
import { useEffect, useState } from "react";
import Link from "next/link";
import { Cake, Check, Copy, Gift } from "lucide-react";
import QRCode from "qrcode";
import { gerarPix, normalizarChave } from "@/lib/pix";
import { Folha, toast } from "./ui";
import { sb } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import Avatar from "./Avatar";

interface Aniver { id: string; nome: string; avatar_url: string | null; dia: number; tem_pix?: boolean }

const agora = () => new Date(new Date().toLocaleString("en-US", { timeZone: "America/Fortaleza" }));

export default function Aniversariantes() {
  const { perfil } = useAuth();
  const [lista, setLista] = useState<Aniver[] | null>(null);
  const [presente, setPresente] = useState<Aniver | null>(null);
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
              <span className="quando">{ehHoje ? "Hoje! 🎉" : `${String(a.dia).padStart(2, "0")}/${mm}`}</span>
              {ehHoje && a.tem_pix && a.id !== perfil?.id && (
                <button type="button" className="btn-presente" onClick={() => setPresente(a)}><Gift size={13} />Dê um presente</button>
              )}
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
      <Folha aberta={!!presente} fechar={() => setPresente(null)} titulo={presente ? `Presente para ${presente.nome.split(" ")[0]} 🎁` : ""}>
        {presente && <PixPresente a={presente} />}
      </Folha>
    </section>
  );
}

/** Chave Pix do aniversariante (o servidor só entrega no dia do aniversário). */
function PixPresente({ a }: { a: Aniver }) {
  const [chave, setChave] = useState<string | null | undefined>(undefined);
  const [qr, setQr] = useState("");
  const [copiado, setCopiado] = useState<"chave" | "codigo" | null>(null);
  useEffect(() => {
    sb().rpc("pix_do_aniversariante", { alvo: a.id }).then(({ data }) => setChave((data as string) || null));
  }, [a.id]);
  const codigo = chave ? gerarPix({ chave: normalizarChave(chave), recebedor: a.nome, cidade: "SAO LUIS", descricao: "Presente de aniversario" }) : "";
  useEffect(() => { if (codigo) QRCode.toDataURL(codigo, { margin: 1, width: 440 }).then(setQr); }, [codigo]);
  async function copiar(txt: string, o: "chave" | "codigo") {
    try { await navigator.clipboard.writeText(txt); setCopiado(o); toast("Copiado"); setTimeout(() => setCopiado(null), 2000); }
    catch { toast("Não foi possível copiar."); }
  }
  if (chave === undefined) return <p className="muted">Carregando…</p>;
  if (!chave) return <p className="muted">A chave Pix não está disponível agora.</p>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, textAlign: "center" }}>
      <p>Faça um Pix de presente para <b>{a.nome}</b>. O valor vai direto para a conta dele(a) — o app e a igreja não participam.</p>
      {qr && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="qr" src={qr} alt="QR Code Pix do presente" style={{ background: "#fff", borderRadius: 16, padding: 8 }} />
      )}
      <div className="opcoes"><div className="opcao"><span className="cresce" style={{ textAlign: "left" }}><span className="muted peq">Chave Pix</span><b style={{ wordBreak: "break-all" }}>{chave}</b></span>
        <button type="button" className="redondo" aria-label="Copiar chave" onClick={() => copiar(chave, "chave")}>{copiado === "chave" ? <Check size={18} /> : <Copy size={18} />}</button></div></div>
      <button className="btn bloco doacao-continuar" onClick={() => copiar(codigo, "codigo")}>{copiado === "codigo" ? <Check size={18} /> : <Copy size={18} />} Copiar Pix Copia e Cola</button>
      <p className="muted peq">Confira o nome do recebedor no app do seu banco antes de confirmar.</p>
    </div>
  );
}
