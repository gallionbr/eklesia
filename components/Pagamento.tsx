"use client";
// Pagamento dentro do app (Pix com QR ou cartão no Asaas): escolha da forma → nome e CPF
// (só na primeira vez) → Pix com aviso automático quando cair.
import { useEffect, useState } from "react";
import { Check, ChevronRight, Copy, CreditCard, QrCode } from "lucide-react";
import { sb } from "@/lib/supabase";
import { Folha, toast } from "./ui";

const reais = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

async function token() {
  const { data } = await sb().auth.getSession();
  return data.session?.access_token || "";
}

export default function Pagamento({ aberto, fechar, titulo, centavos, endpoint, corpo, aoPagar, textoPago }: {
  aberto: boolean; fechar: () => void; titulo: string; centavos: number;
  endpoint: string; corpo: Record<string, unknown>; aoPagar?: () => void; textoPago?: string;
}) {
  const [etapa, setEtapa] = useState<"forma" | "dados" | "pix" | "pago">("forma");
  const [forma, setForma] = useState<"pix" | "cartao">("pix");
  const [dados, setDados] = useState({ nome: "", cpf: "", erro: "" });
  const [pix, setPix] = useState<{ id: string; imagem: string; copiaCola: string } | null>(null);
  const [gerando, setGerando] = useState(false);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => { if (aberto) { setEtapa("forma"); setPix(null); } }, [aberto]);

  async function pagar(f: "pix" | "cartao", extra?: { nome: string; cpf: string }) {
    setForma(f); setGerando(true);
    try {
      const r = await fetch(endpoint, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${await token()}` },
        body: JSON.stringify({ ...corpo, forma: f, ...extra }),
      });
      const j = await r.json().catch(() => ({}));
      if (j.precisaDados) { setDados({ nome: extra?.nome || j.nome || "", cpf: extra?.cpf || "", erro: j.erro || "" }); setEtapa("dados"); return; }
      if (!r.ok) throw new Error(j.erro || "Não foi possível gerar o pagamento.");
      if (j.url) { location.href = j.url; return; }
      setPix({ id: j.id, ...j.pix }); setEtapa("pix");
    } catch (e) { toast((e as Error).message); } finally { setGerando(false); }
  }

  useEffect(() => {
    if (etapa !== "pix" || !pix) return;
    const t = setInterval(async () => {
      const r = await fetch(`/api/ofertas/status?id=${pix.id}`, { headers: { Authorization: `Bearer ${await token()}` } });
      const j = await r.json().catch(() => ({}));
      if (j.pago) { setEtapa("pago"); aoPagar?.(); }
    }, 4000);
    return () => clearInterval(t);
  }, [etapa, pix, aoPagar]);

  async function copiar() {
    if (!pix) return;
    try { await navigator.clipboard.writeText(pix.copiaCola); setCopiado(true); toast("Código Pix copiado"); setTimeout(() => setCopiado(false), 2000); }
    catch { toast("Não foi possível copiar. Selecione o código e copie manualmente."); }
  }

  return (
    <Folha aberta={aberto} fechar={() => !gerando && fechar()} titulo={etapa === "pago" ? "Pagamento recebido" : `${titulo} · ${reais(centavos)}`}>
      {etapa === "forma" && (
        <>
          <p className="muted peq" style={{ marginBottom: 12 }}>Como você quer pagar?</p>
          <div className="opcoes">
            <button type="button" className="opcao" disabled={gerando} onClick={() => pagar("pix")}>
              <QrCode size={24} aria-hidden /><span className="cresce"><b>Pix</b><span className="muted peq">Na hora, aqui mesmo no app</span></span>
              {gerando && forma === "pix" ? <span className="girando peq" /> : <ChevronRight size={20} aria-hidden />}
            </button>
            <button type="button" className="opcao" disabled={gerando} onClick={() => pagar("cartao")}>
              <CreditCard size={24} aria-hidden /><span className="cresce"><b>Cartão de crédito</b><span className="muted peq">Na página segura do Asaas</span></span>
              {gerando && forma === "cartao" ? <span className="girando peq" /> : <ChevronRight size={20} aria-hidden />}
            </button>
          </div>
        </>
      )}
      {etapa === "dados" && (
        <form className="form" onSubmit={(e) => { e.preventDefault(); pagar(forma, dados); }}>
          <p className="muted peq">Só na primeira vez. Fica guardado com segurança no Asaas, não no app.</p>
          {dados.erro && <p className="erro">{dados.erro}</p>}
          <label className="campo"><span>Nome completo</span>
            <input value={dados.nome} onChange={(e) => setDados({ ...dados, nome: e.target.value })} autoComplete="name" required /></label>
          <label className="campo"><span>CPF</span>
            <input value={dados.cpf} inputMode="numeric" placeholder="000.000.000-00" autoComplete="off" required
              onChange={(e) => setDados({ ...dados, cpf: e.target.value.replace(/[^\d.-]/g, "").slice(0, 14) })} /></label>
          <button className="btn bloco doacao-continuar" disabled={gerando}>{gerando ? "Gerando…" : forma === "pix" ? "Gerar Pix" : "Ir para o pagamento"}</button>
        </form>
      )}
      {etapa === "pix" && pix && (
        <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: 12 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="qr" src={pix.imagem} alt="QR Code Pix" style={{ background: "#fff", borderRadius: 16, padding: 8 }} />
          <button className="btn bloco doacao-continuar" onClick={copiar}>{copiado ? <Check size={18} /> : <Copy size={18} />} Copiar Pix Copia e Cola</button>
          <p className="muted peq">Pague no app do seu banco. Esta tela avisa assim que o Pix cair.</p>
          <p className="copia">{pix.copiaCola}</p>
        </div>
      )}
      {etapa === "pago" && (
        <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: 12, padding: "12px 0" }}>
          <Check size={56} style={{ margin: "0 auto", color: "var(--verde)" }} />
          <b style={{ fontSize: 20 }}>{textoPago || "Pagamento confirmado! 🙏"}</b>
          <button className="btn bloco" onClick={fechar}>Fechar</button>
        </div>
      )}
    </Folha>
  );
}
