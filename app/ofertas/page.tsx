"use client";
// Doações: teclado estilo calculadora → propósito → forma de pagamento → página segura do Asaas.
// Dízimo/Oferta levam o split de 45% (quando o repasse está Ligado); Missões/Primícias vão
// inteiras para as subcontas. Estrangeiros doam pelo PayPal da igreja.
import { useCallback, useEffect, useState } from "react";
import { Check, ChevronRight, Copy, CreditCard, Delete, Globe, MessageCircle, Pencil, QrCode } from "lucide-react";
import { sb } from "@/lib/supabase";
import { Folha, toast } from "@/components/ui";
import BarraTopo from "@/components/BarraTopo";
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
  const [txt, setTxt] = useState("");
  const [proposito, setProposito] = useState<Proposito>("oferta");
  const [comSplit, setComSplit] = useState<string[]>([]);
  const [ajustes, setAjustes] = useState(false);
  const [formas, setFormas] = useState(false);
  const [gerando, setGerando] = useState<"pix" | "cartao" | null>(null);
  const [whats, setWhats] = useState(false);
  const [exterior, setExterior] = useState(false);
  const [dados, setDados] = useState<null | { forma: "pix" | "cartao"; nome: string; cpf: string; estrangeiro: boolean; erro?: string }>(null);
  const [pix, setPix] = useState<null | { id: string; imagem: string; copiaCola: string; pago: boolean }>(null);

  useEffect(() => {
    sb().rpc("tipos_com_split").then(({ data }) => setComSplit((data as string[]) || []));
    const para = new URLSearchParams(location.search).get("para");
    if (para && ["dizimo", "oferta", "missoes", "primicias"].includes(para)) setProposito(para as Proposito);
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

  async function pagar(forma: "pix" | "cartao", extra?: { nome: string; cpf: string; estrangeiro: boolean }) {
    setGerando(forma);
    try {
      const { data } = await sb().auth.getSession();
      const r = await fetch("/api/ofertas/pagar", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token || ""}` },
        body: JSON.stringify({ tipo: proposito, valorCentavos: centavos, forma, ...extra }),
      });
      const j = await r.json().catch(() => ({}));
      if (j.precisaDados) {
        setFormas(false);
        setDados({ forma, nome: extra?.nome || j.nome || "", cpf: extra?.cpf || "", estrangeiro: !!extra?.estrangeiro, erro: j.erro });
        setGerando(null);
        return;
      }
      if (!r.ok) throw new Error(j.erro || "Não foi possível gerar o pagamento.");
      setDados(null);
      if (j.url) { location.href = j.url; return; }
      setFormas(false);
      setPix({ id: j.id, imagem: j.pix.imagem, copiaCola: j.pix.copiaCola, pago: false });
      setGerando(null);
    } catch (e) {
      toast((e as Error).message);
      setGerando(null);
    }
  }

  // Enquanto o Pix está aberto, confere a cada 4 s se já caiu.
  useEffect(() => {
    if (!pix || pix.pago) return;
    const t = setInterval(async () => {
      const { data } = await sb().auth.getSession();
      const r = await fetch(`/api/ofertas/status?id=${pix.id}`, { headers: { Authorization: `Bearer ${data.session?.access_token || ""}` } });
      const j = await r.json().catch(() => ({}));
      if (j.pago) { setPix((p) => (p ? { ...p, pago: true } : p)); setTxt(""); }
    }, 4000);
    return () => clearInterval(t);
  }, [pix]);

  const valorTxt = txt ? `R$ ${txt}` : "R$ 0";
  return (
    <main className="pagina doacao">
      <BarraTopo />
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
        <button type="button" className="link" onClick={() => setExterior(true)}><Globe size={16} /> I&apos;m a foreigner · Soy extranjero</button>
        {DIZIMO_WHATSAPP_ATIVO && <button type="button" className="link" onClick={() => setWhats((v) => !v)}><MessageCircle size={16} /> Pelo WhatsApp</button>}
      </div>
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
        <p className="muted peq" style={{ marginBottom: 12 }}>Como você quer doar?</p>
        <div className="opcoes">
          <button type="button" className="opcao" disabled={!!gerando} onClick={() => pagar("pix")}>
            <QrCode size={24} aria-hidden />
            <span className="cresce"><b>Pix</b><span className="muted peq">Na hora, aqui mesmo no app</span></span>
            {gerando === "pix" ? <span className="girando peq" /> : <ChevronRight size={20} aria-hidden />}
          </button>
          <button type="button" className="opcao" disabled={!!gerando} onClick={() => pagar("cartao")}>
            <CreditCard size={24} aria-hidden />
            <span className="cresce"><b>Cartão de crédito</b><span className="muted peq">Na página segura do Asaas</span></span>
            {gerando === "cartao" ? <span className="girando peq" /> : <ChevronRight size={20} aria-hidden />}
          </button>
        </div>
      </Folha>

      <Folha aberta={exterior} fechar={() => setExterior(false)} titulo="Donate from abroad · Done desde el exterior">
        <PayPal />
      </Folha>

      <Folha aberta={!!dados} fechar={() => !gerando && setDados(null)} titulo="Seus dados">
        {dados && (
          <form className="form" onSubmit={(e) => { e.preventDefault(); pagar(dados.forma, dados); }}>
            <p className="muted peq">Só na primeira doação. Fica guardado com segurança no Asaas, não no app.</p>
            {dados.erro && <p className="erro">{dados.erro}</p>}
            <label className="campo"><span>Nome completo</span>
              <input value={dados.nome} onChange={(e) => setDados({ ...dados, nome: e.target.value })} autoComplete="name" required />
            </label>
            {!dados.estrangeiro && (
              <label className="campo"><span>CPF</span>
                <input value={dados.cpf} inputMode="numeric" placeholder="000.000.000-00" autoComplete="off" required
                  onChange={(e) => setDados({ ...dados, cpf: e.target.value.replace(/[^\d.-]/g, "").slice(0, 14) })} />
              </label>
            )}
            <label className="linha" style={{ gap: 8 }}>
              <input type="checkbox" checked={dados.estrangeiro} onChange={(e) => setDados({ ...dados, estrangeiro: e.target.checked })} />
              <span className="peq">I&apos;m a foreigner · Soy extranjero</span>
            </label>
            {dados.estrangeiro ? <PayPal /> : (
              <button className="btn bloco doacao-continuar" disabled={!!gerando}>
                {gerando ? "Gerando…" : dados.forma === "pix" ? "Gerar Pix" : "Ir para o pagamento"}
              </button>
            )}
          </form>
        )}
      </Folha>

      <Folha aberta={!!pix} fechar={() => setPix(null)} titulo={pix?.pago ? "Doação recebida" : `Pix · ${reais(centavos)}`}>
        {pix && (pix.pago ? (
          <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: 12, padding: "12px 0" }}>
            <Check size={56} style={{ margin: "0 auto", color: "var(--verde)" }} />
            <b style={{ fontSize: 20 }}>Obrigado pela sua doação! 🙏</b>
            <p className="muted">Deus abençoe a sua vida.</p>
            <button className="btn bloco" onClick={() => setPix(null)}>Fechar</button>
          </div>
        ) : (
          <PixGerado imagem={pix.imagem} copiaCola={pix.copiaCola} />
        ))}
      </Folha>
    </main>
  );
}

function PixGerado({ imagem, copiaCola }: { imagem: string; copiaCola: string }) {
  const [copiado, setCopiado] = useState(false);
  async function copiar() {
    try { await navigator.clipboard.writeText(copiaCola); setCopiado(true); toast("Código Pix copiado"); setTimeout(() => setCopiado(false), 2000); }
    catch { toast("Não foi possível copiar. Selecione o código e copie manualmente."); }
  }
  return (
    <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: 12 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="qr" src={imagem} alt="QR Code Pix" style={{ background: "#fff", borderRadius: 16, padding: 8 }} />
      <button className="btn bloco doacao-continuar" onClick={copiar}>{copiado ? <Check size={18} /> : <Copy size={18} />} Copiar Pix Copia e Cola</button>
      <p className="muted peq">Pague no app do seu banco. Esta tela avisa assim que o Pix cair.</p>
      <p className="copia">{copiaCola}</p>
    </div>
  );
}

const PAYPAL = "call@eklesia.international";

/** Doação do exterior: e-mail do PayPal da igreja (em inglês e espanhol). */
function PayPal() {
  const [copiado, setCopiado] = useState(false);
  async function copiar() {
    try { await navigator.clipboard.writeText(PAYPAL); setCopiado(true); setTimeout(() => setCopiado(false), 2000); }
    catch { toast(PAYPAL); }
  }
  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: 10, textAlign: "center" }}>
      <p className="peq">Donate with <b>PayPal</b> to · Done con <b>PayPal</b> a:</p>
      <b style={{ fontSize: 18, wordBreak: "break-all" }}>{PAYPAL}</b>
      <button type="button" className="btn bloco" onClick={copiar}>{copiado ? <Check size={18} /> : <Copy size={18} />} {copiado ? "Copied · Copiado" : "Copy email · Copiar e-mail"}</button>
      <a className="btn sec bloco" href="https://www.paypal.com/myaccount/transfer/homepage/pay" target="_blank" rel="noreferrer">Open PayPal · Abrir PayPal</a>
      <p className="muted peq">Thank you! God bless you. · ¡Gracias! Dios le bendiga.</p>
    </div>
  );
}
