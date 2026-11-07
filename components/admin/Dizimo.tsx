"use client";
// Painel → Dízimo: resumo do mês, últimas contribuições e QR Codes (painel de LED, cartaz…).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { Download, Plus } from "lucide-react";
import { sb, msgErro } from "@/lib/supabase";
import { dataHora } from "@/lib/format";
import { reais } from "@/lib/dizimo/texto";
import { Carregando, Campo, Vazio, toast } from "@/components/ui";

interface Resumo { arrecadado_centavos: number; liquido_centavos: number; contribuicoes: number; contribuintes: number; recorrentes_ativos: number; ticket_medio_centavos: number }
interface Linha { id: string; tipo: string; valor_centavos: number; forma: string; status: string; criado_em: string; paga_em: string | null; contatos_wa: { nome: string | null } | null; qr_origens: { nome: string } | null }
interface Origem { id: string; codigo: string; nome: string; scans: number; ativo: boolean }

const ROTULO: Record<string, string> = { dizimo: "Dízimo", oferta: "Oferta", missoes: "Missões", campanha: "Campanha" };
const STATUS: Record<string, string> = { pendente: "Aguardando", paga: "Recebida", vencida: "Vencida", falhou: "Não gerada", estornada: "Estornada", chargeback: "Contestada" };

export default function DizimoAdmin() {
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [linhas, setLinhas] = useState<Linha[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      sb().rpc("resumo_dizimo"),
      sb().from("contribuicoes")
        .select("id, tipo, valor_centavos, forma, status, criado_em, paga_em, contatos_wa(nome), qr_origens(nome)")
        .order("criado_em", { ascending: false }).limit(30),
    ]).then(([r, l]) => {
      if (r.error || l.error) { setErro(msgErro(r.error || l.error)); return; }
      setResumo((r.data as Resumo[])[0]);
      setLinhas(l.data as unknown as Linha[]);
    });
  }, []);

  if (erro) {
    return <Vazio>O módulo de dízimo ainda não foi instalado no banco (migration 0007). Detalhe: {erro}</Vazio>;
  }
  if (!resumo || !linhas) return <Carregando />;

  const Tile = ({ v, r }: { v: string | number; r: string }) => (
    <div className="card">
      <b style={{ fontFamily: "var(--serif)", fontSize: 24, color: "var(--primaria)" }}>{v}</b>
      <p className="muted peq">{r}</p>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
        <Tile v={reais(resumo.arrecadado_centavos)} r="recebido neste mês" />
        <Tile v={reais(resumo.liquido_centavos)} r="líquido (após taxas)" />
        <Tile v={resumo.contribuintes} r="pessoas contribuíram" />
        <Tile v={reais(resumo.ticket_medio_centavos)} r="valor médio" />
      </div>

      <QrCodes />

      <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <h2 style={{ fontSize: 16 }}>Últimas contribuições</h2>
        {linhas.length === 0 ? (
          <Vazio>Nenhuma contribuição pelo WhatsApp ainda.</Vazio>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="tabela">
              <thead><tr><th>Quando</th><th>Quem</th><th>Tipo</th><th>Valor</th><th>Forma</th><th>Status</th><th>Origem</th></tr></thead>
              <tbody>
                {linhas.map((l) => (
                  <tr key={l.id}>
                    <td>{dataHora(l.paga_em || l.criado_em)}</td>
                    <td>{l.contatos_wa?.nome || "—"}</td>
                    <td>{ROTULO[l.tipo] || l.tipo}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{reais(l.valor_centavos)}</td>
                    <td>{l.forma === "pix" ? "Pix" : "Cartão"}</td>
                    <td>{STATUS[l.status] || l.status}</td>
                    <td>{l.qr_origens?.nome || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

/* ───────── QR Codes */

/** Texto do QR: tudo em maiúsculas para o leitor usar o modo alfanumérico (QR menor). */
function urlQr(codigo: string) {
  const host = typeof window === "undefined" ? "EKLESIA.INTERNATIONAL" : window.location.host.toUpperCase();
  return `HTTPS://${host}/D${codigo ? `/${codigo}` : ""}`;
}

const MARGEM = 4; // zona silenciosa, em módulos

function QrCodes() {
  const [origens, setOrigens] = useState<Origem[] | null>(null);
  const [novo, setNovo] = useState({ codigo: "", nome: "" });

  const carregar = useCallback(() => {
    sb().from("qr_origens").select("id, codigo, nome, scans, ativo").order("criado_em").then(({ data, error }) => {
      if (error) toast(msgErro(error)); else setOrigens(data as Origem[]);
    });
  }, []);
  useEffect(carregar, [carregar]);

  async function criar() {
    const codigo = novo.codigo.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
    if (!codigo || !novo.nome.trim()) { toast("Preencha o código e o nome do lugar."); return; }
    const { error } = await sb().from("qr_origens").insert({ codigo, nome: novo.nome.trim() });
    if (error) { toast(/duplicate|23505/.test(error.message) ? "Esse código já existe." : msgErro(error)); return; }
    setNovo({ codigo: "", nome: "" });
    carregar();
  }

  if (!origens) return <Carregando />;
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <h2 style={{ fontSize: 16 }}>QR Codes</h2>
      <p className="muted peq">
        Cada lugar tem seu QR. Quem escaneia cai no WhatsApp da igreja já com a mensagem pronta, e aqui você vê quantos vieram de cada lugar.
      </p>
      {origens.map((o) => <CardQr key={o.id} o={o} />)}
      <div className="card form">
        <b>Novo lugar</b>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 8 }}>
          <Campo rotulo="Código (até 6)">
            <input value={novo.codigo} maxLength={6} autoCapitalize="characters" placeholder="TELAO"
              onChange={(e) => setNovo({ ...novo, codigo: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") })} />
          </Campo>
          <Campo rotulo="Onde fica">
            <input value={novo.nome} maxLength={60} placeholder="Telão do templo" onChange={(e) => setNovo({ ...novo, nome: e.target.value })} />
          </Campo>
        </div>
        <button className="btn sec" onClick={criar}><Plus size={16} aria-hidden /> Criar QR</button>
      </div>
    </section>
  );
}

function CardQr({ o }: { o: Origem }) {
  const texto = urlQr(o.codigo);
  const qr = useMemo(() => QRCode.create(texto, { errorCorrectionLevel: "M" }), [texto]);
  const modulos = qr.modules.size;           // 25 para HTTPS://EKLESIA.INTERNATIONAL/D/LED
  const total = modulos + MARGEM * 2;
  const [painel, setPainel] = useState("192");  // largura útil do painel, em LEDs
  const pxModulo = Math.max(1, Math.floor(Number(painel || 0) / total));
  const lado = total * pxModulo;
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    c.width = lado; c.height = lado;
    const g = c.getContext("2d")!;
    g.imageSmoothingEnabled = false;
    g.fillStyle = "#ffffff"; g.fillRect(0, 0, lado, lado);
    g.fillStyle = "#000000";
    for (let y = 0; y < modulos; y++) {
      for (let x = 0; x < modulos; x++) {
        if (qr.modules.get(x, y)) g.fillRect((x + MARGEM) * pxModulo, (y + MARGEM) * pxModulo, pxModulo, pxModulo);
      }
    }
  }, [qr, modulos, pxModulo, lado]);

  function baixarPng() {
    const a = document.createElement("a");
    a.href = canvas.current!.toDataURL("image/png");
    a.download = `qr-${o.codigo || "geral"}-${lado}px.png`.toLowerCase();
    a.click();
  }
  async function baixarSvg() {
    const svg = await QRCode.toString(texto, { type: "svg", errorCorrectionLevel: "M", margin: MARGEM, color: { dark: "#000000", light: "#ffffff" } });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    a.download = `qr-${o.codigo || "geral"}.svg`.toLowerCase();
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const pouco = pxModulo < 3;
  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div className="linha entre">
        <div className="cresce">
          <b>{o.nome}</b>
          <p className="muted peq" style={{ wordBreak: "break-all" }}>{texto}</p>
        </div>
        <span className="selo azul">{o.scans} scans</span>
      </div>
      <div className="linha" style={{ alignItems: "flex-start", flexWrap: "wrap" }}>
        <canvas ref={canvas} aria-label={`QR Code de ${o.nome}`} role="img"
          style={{ width: 140, height: 140, imageRendering: "pixelated", border: "1px solid var(--linha)", flex: "none" }} />
        <div className="cresce" style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 180 }}>
          <Campo rotulo="Largura do painel (em LEDs)">
            <input inputMode="numeric" value={painel} onChange={(e) => setPainel(e.target.value.replace(/\D/g, "").slice(0, 4))} />
          </Campo>
          <p className="peq" style={{ color: pouco ? "var(--perigo)" : undefined }}>
            {modulos}×{modulos} módulos + margem = {total}. Cada módulo com <b>{pxModulo} LED{pxModulo > 1 ? "s" : ""}</b> → imagem de {lado}×{lado} px.
            {pouco ? " Pouco: use pelo menos 3 LEDs por módulo (painel maior ou QR em mais espaço)." : ""}
          </p>
          <div className="linha" style={{ flexWrap: "wrap", gap: 8 }}>
            <button className="btn peq" onClick={baixarPng}><Download size={14} aria-hidden /> PNG p/ painel</button>
            <button className="btn sec peq" onClick={baixarSvg}><Download size={14} aria-hidden /> SVG p/ gráfica</button>
          </div>
        </div>
      </div>
      <details className="peq muted">
        <summary>Dicas para o painel de LED</summary>
        <ul style={{ paddingLeft: 18, marginTop: 6 }}>
          <li>Fundo aceso (branco) e quadradinhos apagados (preto). Invertido, muitos Androids não leem.</li>
          <li>Não corte a margem branca em volta.</li>
          <li>Mostre a imagem parada por pelo menos 10 segundos, sem animação por cima.</li>
          <li>Brilho entre 40% e 60%: brilho máximo estoura na câmera.</li>
          <li>Lê de longe até cerca de 10× o tamanho do QR (QR de 1 m → uns 10 m).</li>
          <li>Escreva junto: “Aponte a câmera · Dízimo e ofertas pelo WhatsApp”.</li>
          <li>Teste do fundo da igreja com iPhone e Android antes do culto.</li>
        </ul>
      </details>
    </div>
  );
}
