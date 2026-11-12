"use client";
// Doações: teclado estilo calculadora → propósito → forma de pagamento → página segura do Asaas.
// Dízimo/Oferta levam o split de 45% (quando o repasse está Ligado); Missões/Primícias vão
// inteiras para as subcontas. O Pix pela chave da igreja continua como alternativa.
import { useCallback, useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { Check, ChevronRight, Copy, CreditCard, Delete, MessageCircle, Pencil, QrCode } from "lucide-react";
import { sb } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { gerarPix } from "@/lib/pix";
import { Folha, toast } from "@/components/ui";
import { DIZIMO_WHATSAPP_ATIVO, MinhasContribuicoes, PeloWhatsapp } from "@/components/DizimoWhatsapp";

type Proposito = "dizimo" | "oferta" | "missoes" | "primicias";
const PROPOSITOS: { id: Proposito; nome: string; sub: string; split?: true }[] = [
  { id: "dizimo", nome: "Dízimo", sub: "A décima parte, entregue com gratidão" },
  { id: "oferta", nome: "Oferta", sub: "Para a obra e os projetos da Eklésia" },
  { id: "missoes", nome: "Missões", sub: "Evangelismo e ajuda social na Vila Apaco e no interior do Maranhão", split: true },
  { id: "primicias", nome: "Primícias", sub: "As primeiras porções, consagradas ao Senhor", split: true },
];
const MAX_CENTAVOS = 5_000_000;

const reais = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Texto digitado no teclado ("150,5") → centavos. */
function centavosDe(txt: string): number {
  if (!txt) return 0;
  const [i, d = ""] = txt.split(",");
  return Number(i || "0") * 100 + Number((d + "00").slice(0, 2));
}

export default function Doacoes() {
  const { config } = useAuth();
  const [txt, setTxt] = useState("");
  const [proposito, setProposito] = useState<Proposito>("oferta");
  const [comSplit, setComSplit] = useState<string[]>([]);
  const [ajustes, setAjustes] = useState(false);
  const [formas, setFormas] = useState(false);
  const [gerando, setGerando] = useState<"pix" | "cartao" | null>(null);
  const [chave, setChave] = useState(false);
  const [whats, setWhats] = useState(false);

  useEffect(() => {
    sb().rpc("tipos_com_split").then(({ data }) => setComSplit((data as string[]) || []));
    if (new URLSearchParams(location.search).get("pago")) toast("Obrigado pela sua doação! Assim que o pagamento for confirmado, ele chega à conta da igreja. 🙏");
  }, []);

  const centavos = centavosDe(txt);
  const disponiveis = PROPOSITOS.filter((p) => !p.split || comSplit.includes(p.id));
  const atual = PROPOSITOS.find((p) => p.id === proposito)!;

  const tecla = useCallback((k: string) => {
    setTxt((t) => {
      if (k === "apagar") return t.slice(0, -1);
      if (k === ",") return t.includes(",") ? t : (t || "0") + ",";
      if (t.includes(",") && t.split(",")[1].length >= 2) return t;
      const novo = t === "0" ? k : t + k;
      return centavosDe(novo) > MAX_CENTAVOS ? t : novo;
    });
  }, []);

  // Teclado físico também funciona (computador).
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if (ajustes || formas || (e.target as HTMLElement)?.closest?.("input, textarea")) return;
      if (/^\d$/.test(e.key)) tecla(e.key);
      else if (e.key === "," || e.key === ".") tecla(",");
      else if (e.key === "Backspace") tecla("apagar");
    };
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, [tecla, ajustes, formas]);

  async function pagar(forma: "pix" | "cartao") {
    setGerando(forma);
    try {
      const { data } = await sb().auth.getSession();
      const r = await fetch("/api/ofertas/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token || ""}` },
        body: JSON.stringify({ tipo: proposito, valorCentavos: centavos, forma }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.url) throw new Error(j.erro || "Não foi possível gerar o pagamento.");
      location.href = j.url;
    } catch (e) {
      toast((e as Error).message);
      setGerando(null);
    }
  }

  const valorTxt = txt ? `R$ ${txt}` : "R$ 0";
  return (
    <main className="pagina doacao">
      <header className="doacao-topo">
        <h1>Doações</h1>
        <p className="sub">Contribua com a obra e com os projetos da Eklésia</p>
      </header>

      <div className="doacao-valor" aria-live="polite">
        <span className={centavos ? "" : "vazio-valor"} style={{ fontSize: valorTxt.length > 11 ? 48 : valorTxt.length > 8 ? 60 : 72 }}>{valorTxt}</span>
        {centavos > 0 && centavos < 500 && <small>Valor mínimo R$ 5,00</small>}
      </div>

      <button type="button" className="doacao-ajustes" onClick={() => setAjustes(true)}>
        <span className="cresce">
          <b>{atual.nome}</b>
          <span className="muted">{atual.split ? "Vai direto para a conta de " + atual.nome : "Conta da Eklésia"}</span>
        </span>
        <Pencil size={20} aria-hidden />
        <span className="sr-only">Mudar o propósito</span>
      </button>

      <div className="teclado" role="group" aria-label="Teclado do valor">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", ",", "0", "apagar"].map((k) => (
          <button key={k} type="button" onClick={() => tecla(k)} aria-label={k === "apagar" ? "Apagar" : k === "," ? "Vírgula" : k}>
            {k === "apagar" ? <Delete size={26} /> : k}
          </button>
        ))}
      </div>

      <button className="btn bloco doacao-continuar" disabled={centavos < 500} onClick={() => setFormas(true)}>
        Continuar <ChevronRight size={18} />
      </button>

      <div className="doacao-outras">
        <button type="button" className="link" onClick={() => setChave((v) => !v)}><QrCode size={16} /> Pix pela chave da igreja</button>
        {DIZIMO_WHATSAPP_ATIVO && <button type="button" className="link" onClick={() => setWhats((v) => !v)}><MessageCircle size={16} /> Pelo WhatsApp</button>}
      </div>
      {chave && <PixPelaChave centavos={centavos} tipo={atual.nome} config={config} />}
      {whats && <PeloWhatsapp />}

      <MinhasContribuicoes />

      <p className="muted peq" style={{ textAlign: "center" }}>
        “Cada um contribua segundo propôs no seu coração; não com tristeza, ou por necessidade; porque Deus ama ao que dá com alegria.” — 2 Coríntios 9:7
      </p>

      <Folha aberta={ajustes} fechar={() => setAjustes(false)} titulo="Propósito da doação">
        <div className="opcoes">
          {disponiveis.map((p) => (
            <button key={p.id} type="button" className="opcao" aria-pressed={p.id === proposito}
              onClick={() => { setProposito(p.id); setAjustes(false); }}>
              <span className="cresce"><b>{p.nome}</b><span className="muted peq">{p.sub}</span></span>
              {p.id === proposito && <Check size={22} aria-hidden />}
            </button>
          ))}
        </div>
      </Folha>

      <Folha aberta={formas} fechar={() => !gerando && setFormas(false)} titulo={`${atual.nome} · ${reais(centavos)}`}>
        <p className="muted peq" style={{ marginBottom: 12 }}>Como você quer doar? Você termina na página segura do Asaas, onde informa nome e CPF.</p>
        <div className="opcoes">
          <button type="button" className="opcao" disabled={!!gerando} onClick={() => pagar("pix")}>
            <QrCode size={24} aria-hidden />
            <span className="cresce"><b>Pix</b><span className="muted peq">Na hora, pelo app do seu banco</span></span>
            {gerando === "pix" ? <span className="girando peq" /> : <ChevronRight size={20} aria-hidden />}
          </button>
          <button type="button" className="opcao" disabled={!!gerando} onClick={() => pagar("cartao")}>
            <CreditCard size={24} aria-hidden />
            <span className="cresce"><b>Cartão de crédito</b><span className="muted peq">Visa, Mastercard, Elo e outras bandeiras</span></span>
            {gerando === "cartao" ? <span className="girando peq" /> : <ChevronRight size={20} aria-hidden />}
          </button>
        </div>
      </Folha>
    </main>
  );
}

/** Alternativa: QR e Pix Copia e Cola da chave da igreja (sem passar pelo Asaas Checkout). */
function PixPelaChave({ centavos, tipo, config }: { centavos: number; tipo: string; config: ReturnType<typeof useAuth>["config"] }) {
  const [qr, setQr] = useState("");
  const [copiado, setCopiado] = useState(false);
  const payload = useMemo(() => {
    if (!config?.pix_chave) return "";
    return gerarPix({
      chave: config.pix_chave, recebedor: config.pix_recebedor || config.nome_igreja,
      cidade: config.pix_cidade || "BRASIL", valor: centavos ? centavos / 100 : undefined,
      txid: tipo.normalize("NFD").replace(/[^\w]/g, "").toUpperCase(),
    });
  }, [config, centavos, tipo]);
  useEffect(() => {
    if (payload) QRCode.toDataURL(payload, { margin: 1, width: 520, color: { dark: "#06397a", light: "#ffffff" } }).then(setQr);
  }, [payload]);
  if (!config?.pix_chave) return <p className="muted peq">A chave Pix da igreja ainda não foi cadastrada.</p>;
  async function copiar() {
    try { await navigator.clipboard.writeText(payload); setCopiado(true); toast("Código Pix copiado"); setTimeout(() => setCopiado(false), 2000); }
    catch { toast("Não foi possível copiar. Selecione o código e copie manualmente."); }
  }
  return (
    <div className="card" style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: 12 }}>
      {qr && <img className="qr" src={qr} alt="QR Code Pix" />}
      <div>
        <b>{config.pix_recebedor || config.nome_igreja}</b>
        <p className="muted peq">Chave: {config.pix_chave}</p>
        {centavos > 0 && <p style={{ fontWeight: 700, marginTop: 4 }}>{reais(centavos)}</p>}
      </div>
      <button className="btn bloco" onClick={copiar}>{copiado ? <Check size={18} /> : <Copy size={18} />} Copiar Pix Copia e Cola</button>
      <p className="copia">{payload}</p>
    </div>
  );
}
