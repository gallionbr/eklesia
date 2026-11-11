"use client";
import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { Copy, Check, QrCode, MessageCircle } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { gerarPix } from "@/lib/pix";
import { Topo, Vazio, toast } from "@/components/ui";
import { DIZIMO_WHATSAPP_ATIVO, MinhasContribuicoes, PeloWhatsapp } from "@/components/DizimoWhatsapp";

const TIPOS = [
  { id: "DIZIMO", rotulo: "Dízimo" },
  { id: "OFERTA", rotulo: "Oferta" },
  { id: "MISSOES", rotulo: "Missões" },
];
const SUGESTOES = [20, 50, 100, 200];

type Modo = "pix" | "whatsapp";
const CHAVE_MODO = "eklesia:ofertas-modo";

const MODOS: { id: Modo; titulo: string; sub: string; Icone: typeof QrCode }[] = [
  { id: "pix", titulo: "Pix direto", sub: "Código ou QR para o app do seu banco", Icone: QrCode },
  { id: "whatsapp", titulo: "Pelo WhatsApp", sub: "Pix ou cartão, com comprovante", Icone: MessageCircle },
];

export default function Ofertas() {
  const { config } = useAuth();
  const [tipo, setTipo] = useState("OFERTA");
  const [valorTxt, setValorTxt] = useState("");
  const [qr, setQr] = useState("");
  const [copiado, setCopiado] = useState(false);
  const [modo, setModo] = useState<Modo>("pix");

  // Lembra a última escolha neste aparelho.
  useEffect(() => {
    try {
      const salvo = localStorage.getItem(CHAVE_MODO);
      if (salvo === "pix" || salvo === "whatsapp") setModo(salvo);
    } catch { /* navegação privada */ }
  }, []);
  function escolher(m: Modo) {
    setModo(m);
    try { localStorage.setItem(CHAVE_MODO, m); } catch { /* navegação privada */ }
  }

  const valor = useMemo(() => {
    const n = Number(valorTxt.replace(/\./g, "").replace(",", "."));
    return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : undefined;
  }, [valorTxt]);

  const payload = useMemo(() => {
    if (!config?.pix_chave) return "";
    return gerarPix({
      chave: config.pix_chave,
      recebedor: config.pix_recebedor || config.nome_igreja,
      cidade: config.pix_cidade || "BRASIL",
      valor,
      txid: tipo,
    });
  }, [config, valor, tipo]);

  useEffect(() => {
    if (!payload) return;
    QRCode.toDataURL(payload, { margin: 1, width: 520, color: { dark: "#06397a", light: "#ffffff" } }).then(setQr);
  }, [payload]);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(payload);
      setCopiado(true);
      toast("Código Pix copiado");
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      toast("Não foi possível copiar. Selecione o código e copie manualmente.");
    }
  }

  return (
    <main className="pagina">
      <Topo titulo="Dízimos e ofertas" sub={DIZIMO_WHATSAPP_ATIVO ? "Contribua com a obra" : "Contribua com a obra pelo Pix"} />

      {DIZIMO_WHATSAPP_ATIVO && (
        <div role="radiogroup" aria-label="Como você quer contribuir" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {MODOS.map(({ id, titulo, sub, Icone }) => {
            const ativo = modo === id;
            return (
              <button key={id} type="button" role="radio" aria-checked={ativo} onClick={() => escolher(id)}
                className="card"
                style={{
                  textAlign: "left", display: "flex", flexDirection: "column", gap: 6, cursor: "pointer",
                  borderColor: ativo ? "var(--primaria)" : undefined,
                  boxShadow: ativo ? "0 0 0 2px var(--primaria)" : undefined,
                }}>
                <Icone size={22} aria-hidden style={{ color: "var(--primaria)" }} />
                <b>{titulo}</b>
                <span className="muted peq">{sub}</span>
              </button>
            );
          })}
        </div>
      )}

      {DIZIMO_WHATSAPP_ATIVO && modo === "whatsapp" ? (
        <PeloWhatsapp />
      ) : !config?.pix_chave ? (
        <Vazio>A chave Pix da igreja ainda não foi cadastrada. Avise a liderança.</Vazio>
      ) : (
        <>
          <div className="abas">
            {TIPOS.map((t) => (
              <button key={t.id} className={`aba ${tipo === t.id ? "ativa" : ""}`} onClick={() => setTipo(t.id)}>{t.rotulo}</button>
            ))}
          </div>

          <div className="card form">
            <label className="campo">
              <span>Valor (opcional)</span>
              <input inputMode="decimal" placeholder="R$ 0,00" value={valorTxt}
                onChange={(e) => setValorTxt(e.target.value.replace(/[^\d.,]/g, ""))} />
            </label>
            <div className="valores">
              {SUGESTOES.map((v) => (
                <button key={v} className={valor === v ? "ativo" : ""} onClick={() => setValorTxt(String(v))}>R$ {v}</button>
              ))}
            </div>
            <p className="muted peq">Sem valor, você digita a quantia no app do banco.</p>
          </div>

          <div className="card" style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: 12 }}>
            {qr && <img className="qr" src={qr} alt="QR Code Pix" />}
            <div>
              <b>{config.pix_recebedor || config.nome_igreja}</b>
              <p className="muted peq">Chave: {config.pix_chave}</p>
              {valor && <p style={{ fontWeight: 700, marginTop: 4 }}>R$ {valor.toFixed(2).replace(".", ",")}</p>}
            </div>
            <button className="btn bloco" onClick={copiar}>
              {copiado ? <Check size={18} /> : <Copy size={18} />} Copiar Pix Copia e Cola
            </button>
            <p className="copia">{payload}</p>
          </div>

        </>
      )}

      <MinhasContribuicoes />

      <p className="muted peq" style={{ textAlign: "center" }}>
        “Cada um contribua segundo propôs no seu coração; não com tristeza, ou por necessidade; porque Deus ama ao que dá com alegria.” — 2 Coríntios 9:7
      </p>
    </main>
  );
}
