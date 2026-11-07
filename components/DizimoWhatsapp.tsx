"use client";
// Tela de Ofertas: contribuir pelo WhatsApp da igreja, ligar o WhatsApp à conta
// e ver as próprias contribuições (RLS: cada membro só lê as suas).

import { useEffect, useState } from "react";
import { MessageCircle, Link2, Receipt } from "lucide-react";
import { sb } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { dataCurta } from "@/lib/format";
import { reais } from "@/lib/dizimo/texto";
import { toast } from "@/components/ui";

const ATIVO = process.env.NEXT_PUBLIC_DIZIMO_WHATSAPP === "1";

interface Minha { id: string; tipo: string; valor_centavos: number; forma: string; status: string; paga_em: string | null; criado_em: string }

const ROTULO: Record<string, string> = { dizimo: "Dízimo", oferta: "Oferta", missoes: "Missões", campanha: "Campanha" };
const STATUS: Record<string, string> = { pendente: "Aguardando", paga: "Recebida", vencida: "Vencida", falhou: "Não gerada", estornada: "Estornada", chargeback: "Contestada" };

export default function DizimoWhatsapp() {
  const { session } = useAuth();
  const [minhas, setMinhas] = useState<Minha[] | null>(null);
  const [ligado, setLigado] = useState<boolean | null>(null);
  const [gerando, setGerando] = useState(false);

  useEffect(() => {
    if (!ATIVO || !session) return;
    Promise.all([
      sb().from("contatos_wa").select("id").eq("profile_id", session.user.id).maybeSingle(),
      sb().from("contribuicoes").select("id, tipo, valor_centavos, forma, status, paga_em, criado_em")
        .neq("status", "falhou").order("criado_em", { ascending: false }).limit(12),
    ]).then(([c, l]) => {
      // Se a migration ainda não rodou, as tabelas não existem: some sem erro.
      if (c.error || l.error) return;
      setLigado(Boolean(c.data));
      setMinhas((l.data as Minha[]) || []);
    });
  }, [session]);

  if (!ATIVO) return null;

  async function ligar() {
    if (!session) return;
    setGerando(true);
    try {
      const r = await fetch("/api/dizimo/vincular", { method: "POST", headers: { Authorization: `Bearer ${session.access_token}` } });
      const j = await r.json();
      if (!r.ok || !j.url) throw new Error(j.erro || "Não foi possível gerar o código.");
      window.location.href = j.url;
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setGerando(false);
    }
  }

  return (
    <>
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div className="linha">
          <MessageCircle size={22} aria-hidden style={{ color: "var(--primaria)", flex: "none" }} />
          <div className="cresce">
            <b>Pelo WhatsApp da igreja</b>
            <p className="muted peq">Pix ou cartão, dízimo mensal e comprovante na hora.</p>
          </div>
        </div>
        <a className="btn bloco" href="/D/APP">Contribuir pelo WhatsApp</a>
        {session && ligado === false && (
          <button className="btn sec bloco" onClick={ligar} disabled={gerando}>
            <Link2 size={16} aria-hidden /> {gerando ? "Gerando código…" : "Ligar meu WhatsApp à minha conta"}
          </button>
        )}
        {session && ligado === false && (
          <p className="muted peq">Ligando, suas contribuições pelo WhatsApp aparecem aqui embaixo.</p>
        )}
      </div>

      {minhas && minhas.length > 0 && (
        <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <h2 className="linha" style={{ fontSize: 16 }}><Receipt size={18} aria-hidden /> Minhas contribuições</h2>
          <ul className="lista" style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {minhas.map((m) => (
              <li key={m.id} className="card linha entre">
                <div className="cresce">
                  <b>{ROTULO[m.tipo] || m.tipo}</b>
                  <p className="muted peq">
                    {dataCurta(m.paga_em || m.criado_em)} · {m.forma === "pix" ? "Pix" : "Cartão"} · {STATUS[m.status] || m.status}
                  </p>
                </div>
                <b style={{ whiteSpace: "nowrap" }}>{reais(m.valor_centavos)}</b>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
