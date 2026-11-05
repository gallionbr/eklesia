"use client";
import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { Copy, Check } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { gerarPix } from "@/lib/pix";
import { Topo, Vazio, toast } from "@/components/ui";

const TIPOS = [
  { id: "DIZIMO", rotulo: "Dízimo" },
  { id: "OFERTA", rotulo: "Oferta" },
  { id: "MISSOES", rotulo: "Missões" },
];
const SUGESTOES = [20, 50, 100, 200];

export default function Ofertas() {
  const { config } = useAuth();
  const [tipo, setTipo] = useState("OFERTA");
  const [valorTxt, setValorTxt] = useState("");
  const [qr, setQr] = useState("");
  const [copiado, setCopiado] = useState(false);

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
      <Topo titulo="Dízimos e ofertas" sub="Contribua com a obra pelo Pix" />

      {!config?.pix_chave ? (
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

          <p className="muted peq" style={{ textAlign: "center" }}>
            “Cada um contribua segundo propôs no seu coração; não com tristeza, ou por necessidade; porque Deus ama ao que dá com alegria.” — 2 Coríntios 9:7
          </p>
        </>
      )}
    </main>
  );
}
