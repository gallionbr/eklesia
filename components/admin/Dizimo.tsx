"use client";
// Painel → Dízimo: resumo do mês, últimas contribuições e QR Codes (painel de LED, cartaz…).

import { CONTAS, TIPOS_CONTA, type TipoConta } from "@/lib/contas";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { Download, FileSpreadsheet, FileText, Plus, Search } from "lucide-react";
import { sb, msgErro } from "@/lib/supabase";
import { dataHora } from "@/lib/format";
import { reais } from "@/lib/dizimo/texto";
import { baixarCSV } from "@/lib/planilha";
import { Carregando, Campo, Folha, Vazio, toast } from "@/components/ui";

interface Resumo { arrecadado_centavos: number; liquido_centavos: number; contribuicoes: number; contribuintes: number; recorrentes_ativos: number; ticket_medio_centavos: number }
interface Linha { id: string; tipo: string; valor_centavos: number; forma: string; status: string; criado_em: string; paga_em: string | null; contatos_wa: { nome: string | null } | null; qr_origens: { nome: string } | null }
interface Pessoa { contato_id: string; nome: string; membro_app: boolean; contribuicoes: number; total_centavos: number; dizimo_centavos: number; ofertas_centavos: number; ultima: string | null }
interface Origem { id: string; codigo: string; nome: string; scans: number; ativo: boolean }

const ROTULO: Record<string, string> = { dizimo: "Dízimo", oferta: "Oferta", missoes: "Missões", campanha: "Campanha" };
const STATUS: Record<string, string> = { pendente: "Aguardando", paga: "Recebida", vencida: "Vencida", falhou: "Não gerada", estornada: "Estornada", chargeback: "Contestada" };

/** gerenciarQr: só admin cria e baixa QR Codes; o tesoureiro vê o financeiro. */
export default function DizimoAdmin({ gerenciarQr }: { gerenciarQr: boolean }) {
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

      <RelatorioRecebimentos />

      <PorPessoa />

      {gerenciarQr && <ConexaoAsaas />}

      {gerenciarQr && <CarteirasSplit />}

      {gerenciarQr && <RepasseAutomatico />}

      {gerenciarQr && <QrCodes />}

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

/* ───────── Conexão com o Asaas (conta, Wallet ID e webhook de pagamentos) */
interface EstadoAsaas { conta: { nome: string; documentoFinal: string } | null; walletId: string | null; producao: boolean; webhook: { ativo: boolean; interrompido: boolean; desatualizado?: boolean } | null }

async function chamarAsaas(metodo: "GET" | "POST"): Promise<EstadoAsaas> {
  const { data } = await sb().auth.getSession();
  const r = await fetch("/api/admin/asaas", { method: metodo, headers: { Authorization: `Bearer ${data.session?.access_token || ""}` } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.erro || "Não foi possível falar com o Asaas.");
  return j as EstadoAsaas;
}

function ConexaoAsaas() {
  const [st, setSt] = useState<EstadoAsaas | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => { chamarAsaas("GET").then(setSt).catch((e) => setErro(e.message)); }, []);

  async function conectar() {
    setOcupado(true); setErro(null);
    try { setSt(await chamarAsaas("POST")); toast("Webhook do Asaas configurado"); }
    catch (e) { setErro((e as Error).message); }
    finally { setOcupado(false); }
  }

  async function copiar(t: string) {
    try { await navigator.clipboard.writeText(t); toast("Wallet ID copiado"); } catch {}
  }

  return (
    <section className="card" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <h2 style={{ fontSize: 16 }}>Asaas</h2>
      {erro && <p className="erro">{erro}</p>}
      {!st && !erro && <Carregando />}
      {st && (
        <>
          <p className="peq">
            <b>Conta:</b> {st.conta ? `${st.conta.nome}${st.conta.documentoFinal ? ` (final ${st.conta.documentoFinal})` : ""}` : "—"}
            {" · "}{st.producao ? "produção" : "sandbox (teste)"}
          </p>
          {st.walletId && (
            <p className="peq linha" style={{ gap: 6, flexWrap: "wrap" }}>
              <b>Wallet ID:</b> <code style={{ fontSize: 12 }}>{st.walletId}</code>
              <button className="btn sec peq" onClick={() => copiar(st.walletId!)}>Copiar</button>
            </p>
          )}
          <p className="peq">
            <b>Avisos de pagamento:</b>{" "}
            {st.webhook?.ativo && st.webhook.desatualizado ? <span className="erro">ativos, mas faltam os avisos de transferência — atualize</span>
              : st.webhook?.ativo ? <span className="ok">ativos ✓</span>
              : st.webhook?.interrompido ? <span className="erro">interrompidos — reconecte</span>
              : <span className="muted">não configurados</span>}
          </p>
          {(!st.webhook?.ativo || st.webhook.desatualizado) && (
            <button className="btn" disabled={ocupado} onClick={conectar}>{ocupado ? "Configurando…" : st.webhook?.ativo ? "Atualizar avisos" : "Ativar avisos de pagamento"}</button>
          )}
          <p className="muted peq">O Asaas avisa o app quando um Pix ou cartão é pago, e a contribuição muda para “Recebida” sozinha.</p>
        </>
      )}
    </section>
  );
}

/* ───────── Split: subcontas que recebem Missões e Primícias */
type TipoSplit = TipoConta;
interface Carteira { tipo: TipoSplit; wallet_id: string; titular: string; percentual: number }
const NOME_SPLIT = Object.fromEntries(TIPOS_CONTA.map((t) => [t, CONTAS[t].nome])) as Record<TipoSplit, string>;

async function api(metodo: string, caminho: string, corpo?: unknown) {
  const { data } = await sb().auth.getSession();
  const r = await fetch(caminho, {
    method: metodo,
    headers: { Authorization: `Bearer ${data.session?.access_token || ""}`, "Content-Type": "application/json" },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.erro || "Algo deu errado.");
  return j;
}

const VAZIO_FORM = { name: "", cpfCnpj: "", birthDate: "", companyType: "ASSOCIATION", email: "", mobilePhone: "", postalCode: "", address: "", addressNumber: "", complement: "", province: "", incomeValue: "" };

function CarteirasSplit() {
  const [lista, setLista] = useState<Carteira[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aberto, setAberto] = useState<TipoSplit | null>(null);
  const [modo, setModo] = useState<"criar" | "vincular">("criar");
  const [f, setF] = useState(VAZIO_FORM);
  const [vinc, setVinc] = useState({ walletId: "", titular: "" });
  const [enviando, setEnviando] = useState(false);
  const [erroForm, setErroForm] = useState<string | null>(null);

  const carregar = useCallback(() => {
    api("GET", "/api/admin/asaas/subcontas").then((j) => setLista(j.carteiras)).catch((e) => setErro(e.message));
  }, []);
  useEffect(carregar, [carregar]);

  const pj = f.cpfCnpj.replace(/\D/g, "").length === 14;
  const set = (k: keyof typeof VAZIO_FORM) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  function abrir(t: TipoSplit) { setAberto(t); setModo("criar"); setF(VAZIO_FORM); setVinc({ walletId: "", titular: "" }); setErroForm(null); }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!aberto) return;
    setEnviando(true); setErroForm(null);
    try {
      await api("POST", "/api/admin/asaas/subcontas", modo === "criar"
        ? { acao: "criar", tipo: aberto, dados: f }
        : { acao: "vincular", tipo: aberto, ...vinc });
      toast(modo === "criar" ? "Subconta criada no Asaas" : "Conta vinculada");
      setAberto(null); carregar();
    } catch (err) { setErroForm((err as Error).message); }
    finally { setEnviando(false); }
  }

  async function desligar(t: TipoSplit) {
    if (!confirm(`Desligar o split de ${NOME_SPLIT[t]}? A subconta continua existindo no Asaas.`)) return;
    try { await api("DELETE", `/api/admin/asaas/subcontas?tipo=${t}`); carregar(); } catch (err) { toast((err as Error).message); }
  }

  return (
    <section className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <h2 style={{ fontSize: 16 }}>Subcontas: Missões, Primícias e Redes</h2>
      <p className="muted peq">Cada doação ou inscrição desse destino vai inteira para a subconta escolhida, direto pelo Asaas. As Redes (Rosa, Azul, Santa e da Família) recebem as doações para a rede e as inscrições dos eventos ligados a elas.</p>
      {erro && <p className="erro">{erro}</p>}
      {!lista && !erro && <Carregando />}
      {lista && TIPOS_CONTA.map((t) => {
        const c = lista.find((x) => x.tipo === t);
        return (
          <div key={t} className="linha entre" style={{ gap: 8, flexWrap: "wrap", borderTop: "1px solid var(--linha)", paddingTop: 10 }}>
            <div className="cresce">
              <b>{NOME_SPLIT[t]}</b>
              <p className="muted peq">{c ? `${Number(c.percentual)}% para ${c.titular || "subconta"} · ${c.wallet_id.slice(0, 8)}…` : "Ainda sem subconta — o Pix vai para a conta da igreja"}</p>
            </div>
            {c ? <button className="btn perigo peq" onClick={() => desligar(t)}>Desligar</button>
               : <button className="btn peq" onClick={() => abrir(t)}>Configurar</button>}
          </div>
        );
      })}

      <Folha aberta={!!aberto} fechar={() => setAberto(null)} titulo={aberto ? `Subconta de ${NOME_SPLIT[aberto]}` : ""}>
        <div className="abas" style={{ marginBottom: 12 }}>
          <button type="button" className={`aba ${modo === "criar" ? "ativa" : ""}`} onClick={() => setModo("criar")}>Criar subconta</button>
          <button type="button" className={`aba ${modo === "vincular" ? "ativa" : ""}`} onClick={() => setModo("vincular")}>Já tem conta no Asaas</button>
        </div>
        <form className="form" onSubmit={salvar}>
          {modo === "criar" ? (
            <>
              <Campo rotulo="Titular (nome completo ou razão social)"><input value={f.name} onChange={set("name")} required /></Campo>
              <Campo rotulo="CPF ou CNPJ"><input value={f.cpfCnpj} onChange={set("cpfCnpj")} inputMode="numeric" required /></Campo>
              {pj ? (
                <Campo rotulo="Tipo de empresa">
                  <select value={f.companyType} onChange={set("companyType")}>
                    <option value="ASSOCIATION">Associação / igreja</option>
                    <option value="LIMITED">Limitada</option>
                    <option value="INDIVIDUAL">Individual</option>
                    <option value="MEI">MEI</option>
                  </select>
                </Campo>
              ) : (
                <Campo rotulo="Data de nascimento"><input type="date" value={f.birthDate} onChange={set("birthDate")} required /></Campo>
              )}
              <Campo rotulo="E-mail (não pode ser o mesmo de outra conta Asaas)"><input type="email" value={f.email} onChange={set("email")} required /></Campo>
              <Campo rotulo="Celular"><input value={f.mobilePhone} onChange={set("mobilePhone")} inputMode="tel" required /></Campo>
              <Campo rotulo="CEP"><input value={f.postalCode} onChange={set("postalCode")} inputMode="numeric" required /></Campo>
              <Campo rotulo="Endereço"><input value={f.address} onChange={set("address")} required /></Campo>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <Campo rotulo="Número"><input value={f.addressNumber} onChange={set("addressNumber")} required /></Campo>
                <Campo rotulo="Complemento"><input value={f.complement} onChange={set("complement")} /></Campo>
              </div>
              <Campo rotulo="Bairro"><input value={f.province} onChange={set("province")} required /></Campo>
              <Campo rotulo="Faturamento / renda mensal estimada (R$)"><input value={f.incomeValue} onChange={set("incomeValue")} inputMode="decimal" required /></Campo>
              <p className="muted peq">O Asaas manda um e-mail para o titular definir a senha e enviar os documentos. O split só funciona depois da aprovação.</p>
            </>
          ) : (
            <>
              <Campo rotulo="Wallet ID (Asaas → Integrações → Início)"><input value={vinc.walletId} onChange={(e) => setVinc({ ...vinc, walletId: e.target.value.trim() })} required /></Campo>
              <Campo rotulo="Titular"><input value={vinc.titular} onChange={(e) => setVinc({ ...vinc, titular: e.target.value })} required /></Campo>
            </>
          )}
          {erroForm && <p className="erro">{erroForm}</p>}
          <button className="btn bloco" disabled={enviando}>{enviando ? "Enviando…" : modo === "criar" ? "Criar subconta no Asaas" : "Vincular"}</button>
        </form>
      </Folha>
    </section>
  );
}

/* ───────── Total por pessoa no ano */

function PorPessoa() {
  const anoAtual = new Date().getFullYear();
  const [ano, setAno] = useState(anoAtual);
  const [pessoas, setPessoas] = useState<Pessoa[] | null>(null);
  const [busca, setBusca] = useState("");

  useEffect(() => {
    setPessoas(null);
    sb().rpc("totais_por_pessoa", { ano }).then(({ data, error }) => {
      if (error) { toast(msgErro(error)); setPessoas([]); } else setPessoas(data as Pessoa[]);
    });
  }, [ano]);

  const lista = (pessoas || []).filter((p) => !busca || p.nome.toLowerCase().includes(busca.toLowerCase()));
  const total = lista.reduce((t, p) => t + Number(p.total_centavos), 0);
  const csvReais = (c: number) => (Number(c) / 100).toFixed(2).replace(".", ",");

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div className="linha entre" style={{ flexWrap: "wrap", gap: 8 }}>
        <h2 style={{ fontSize: 16 }}>Por pessoa</h2>
        <div className="linha" style={{ gap: 8 }}>
          <select className="btn sec peq" value={ano} onChange={(e) => setAno(Number(e.target.value))} aria-label="Ano">
            {[anoAtual, anoAtual - 1, anoAtual - 2].map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <button className="btn sec peq" disabled={!lista.length} onClick={() => baixarCSV(`contribuicoes-por-pessoa-${ano}.csv`, [
            ["Nome", "Membro do app", "Contribuições", "Total (R$)", "Dízimo (R$)", "Ofertas e missões (R$)", "Última"],
            ...lista.map((p) => [p.nome, p.membro_app ? "sim" : "não", String(p.contribuicoes), csvReais(p.total_centavos),
              csvReais(p.dizimo_centavos), csvReais(p.ofertas_centavos), p.ultima ? p.ultima.slice(0, 10) : ""]),
          ])}><Download size={14} aria-hidden /> Planilha</button>
        </div>
      </div>
      <label className="campo"><span className="sr">Buscar pessoa</span>
        <div style={{ position: "relative" }}>
          <Search size={16} aria-hidden style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--ink-2)" }} />
          <input style={{ paddingLeft: 36 }} placeholder="Buscar pelo nome" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
      </label>
      {pessoas === null ? <Carregando /> : lista.length === 0 ? (
        <Vazio>{busca ? "Ninguém com esse nome." : `Nenhuma contribuição recebida em ${ano}.`}</Vazio>
      ) : (
        <>
          <p className="muted peq">{lista.length} pessoa{lista.length > 1 ? "s" : ""} · {reais(total)} em {ano}</p>
          <div style={{ overflowX: "auto" }}>
            <table className="tabela">
              <thead><tr><th>Nome</th><th>Total</th><th>Dízimo</th><th>Ofertas e missões</th><th>Vezes</th><th>Última</th></tr></thead>
              <tbody>
                {lista.map((p) => (
                  <tr key={p.contato_id}>
                    <td>{p.nome}{!p.membro_app && <span className="muted peq"> · só WhatsApp</span>}</td>
                    <td style={{ whiteSpace: "nowrap" }}><b>{reais(Number(p.total_centavos))}</b></td>
                    <td style={{ whiteSpace: "nowrap" }}>{reais(Number(p.dizimo_centavos))}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{reais(Number(p.ofertas_centavos))}</td>
                    <td>{p.contribuicoes}</td>
                    <td>{p.ultima ? dataHora(p.ultima) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
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

/* ───────── Repasse automático: % de cada Pix recebido vai para a subconta de Primícias */
type ModoRepasse = "desligado" | "simulacao" | "ativo";
interface LinhaRepasse {
  cobranca_id: string; bruto_centavos: number; repasse_centavos: number; modo: string;
  status: "simulado" | "pendente" | "aguardando" | "transferido" | "no_pagamento" | "erro"; erro: string | null; descricao: string | null; criado_em: string;
}
interface EstadoRepasse {
  regra: { modo: ModoRepasse; percentual: number; destino: string } | null;
  ultimos: LinhaRepasse[];
  mes: { pix: number; bruto: number; transferido: number; simulado: number; aguardando: number; comErro: number };
}
const MODOS_REPASSE: { id: ModoRepasse; rotulo: string; sub: string }[] = [
  { id: "desligado", rotulo: "Desligado", sub: "Nada é calculado." },
  { id: "simulacao", rotulo: "Simulação", sub: "Calcula e registra, sem transferir." },
  { id: "ativo", rotulo: "Ligado", sub: "Transfere na hora, a cada Pix." },
];
const ROTULO_STATUS: Record<LinhaRepasse["status"], string> = {
  simulado: "simulado", pendente: "transferindo…", aguardando: "aguardando sua aprovação no Asaas", transferido: "transferido ✓", no_pagamento: "separado no pagamento ✓", erro: "recusado / erro",
};
const COR_STATUS: Record<LinhaRepasse["status"], string> = {
  simulado: "azul", pendente: "amarelo", aguardando: "amarelo", transferido: "verde", no_pagamento: "verde", erro: "vermelho",
};

function RepasseAutomatico() {
  const [e, setE] = useState<EstadoRepasse | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(() => {
    api("GET", "/api/admin/asaas/repasse").then(setE).catch((x) => setErro(x.message));
  }, []);
  useEffect(carregar, [carregar]);

  async function mudar(modo: ModoRepasse) {
    if (modo === "ativo" && !confirm(`Ligar o repasse? A cada Pix recebido, ${Number(e?.regra?.percentual ?? 45)}% do valor bruto será transferido na hora para a subconta de Primícias.`)) return;
    setSalvando(true);
    try { await api("POST", "/api/admin/asaas/repasse", { acao: "modo", modo }); toast("Repasse atualizado"); carregar(); }
    catch (x) { toast((x as Error).message); }
    finally { setSalvando(false); }
  }
  async function refazer(id: string) {
    try {
      const r = await api("POST", "/api/admin/asaas/repasse", { acao: "refazer", cobrancaId: id });
      toast(r.status === "transferido" ? "Repasse feito" : r.erro || r.motivo || "Não foi possível");
      carregar();
    } catch (x) { toast((x as Error).message); }
  }

  const modo = e?.regra?.modo ?? "desligado";
  const pct = Number(e?.regra?.percentual ?? 45);
  return (
    <section className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <h2 style={{ fontSize: 16 }}>Repasse automático para Primícias</h2>
      <p className="muted peq">A cada Pix que cair na conta da Eklésia, {pct}% do valor bruto vai para a subconta de Primícias. Nas doações de dízimo e oferta pelo app, os {pct}% já saem separados no próprio pagamento. Missões e Primícias pelo app vão inteiras para as subcontas.</p>
      {erro && <p className="erro">{erro}</p>}
      {!e && !erro && <Carregando />}
      {e && !e.regra && <Vazio>Configure antes a subconta de Primícias (acima).</Vazio>}
      {e?.regra && (
        <>
          <div role="radiogroup" aria-label="Modo do repasse" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            {MODOS_REPASSE.map((m) => (
              <button key={m.id} type="button" role="radio" aria-checked={modo === m.id} disabled={salvando}
                onClick={() => modo !== m.id && mudar(m.id)} className="card"
                style={{ textAlign: "left", padding: 10, cursor: "pointer", borderColor: modo === m.id ? "var(--primaria)" : undefined, boxShadow: modo === m.id ? "0 0 0 2px var(--primaria)" : undefined }}>
                <b className="peq">{m.rotulo}</b>
                <p className="muted peq">{m.sub}</p>
              </button>
            ))}
          </div>
          <div className="peq" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            <span>Pix no mês: <b>{e.mes.pix}</b></span>
            <span>Recebido (bruto): <b>{reais(e.mes.bruto)}</b></span>
            <span>Transferido: <b className="ok">{reais(e.mes.transferido)}</b></span>
            <span>Simulado: <b style={{ color: "var(--primaria)" }}>{reais(e.mes.simulado)}</b></span>
            {e.mes.aguardando > 0 && <span>Aguardando aprovação: <b className="selo amarelo">{reais(e.mes.aguardando)}</b></span>}
            {e.mes.comErro > 0 && <span className="erro">Com erro: {e.mes.comErro}</span>}
          </div>
          {e.ultimos.length === 0 ? <p className="muted peq">Nenhum Pix registrado ainda.</p> : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
              {e.ultimos.map((l) => (
                <li key={l.cobranca_id} className="linha entre" style={{ gap: 8, borderTop: "1px solid var(--linha)", paddingTop: 6 }}>
                  <div className="cresce">
                    <span className="peq">{reais(l.bruto_centavos)} → <b>{reais(l.repasse_centavos)}</b></span>
                    <p className="muted peq" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, marginTop: 2 }}>
                      {dataHora(l.criado_em)}
                      <span className={`selo ${COR_STATUS[l.status]}`}>{ROTULO_STATUS[l.status]}</span>
                      {l.erro && <span className="erro peq">{l.erro}</span>}
                    </p>
                  </div>
                  {l.status === "erro" && <button className="btn peq" onClick={() => refazer(l.cobranca_id)}>Tentar de novo</button>}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

/* ───────── Relatório de recebimentos (Excel e PDF): entradas, splits e repasse de 45% */
function hojeLocal(dias = 0) {
  return new Date(Date.now() + dias * 86400e3).toLocaleDateString("en-CA", { timeZone: "America/Fortaleza" });
}
const PERIODOS: { rotulo: string; datas: () => [string, string] }[] = [
  { rotulo: "Este mês", datas: () => [hojeLocal().slice(0, 8) + "01", hojeLocal()] },
  { rotulo: "Mês passado", datas: () => {
    const [a, m] = hojeLocal().split("-").map(Number);
    const ini = new Date(Date.UTC(m === 1 ? a - 1 : a, m === 1 ? 11 : m - 2, 1));
    const fim = new Date(Date.UTC(a, m - 1, 0));
    return [ini.toISOString().slice(0, 10), fim.toISOString().slice(0, 10)];
  } },
  { rotulo: "Últimos 7 dias", datas: () => [hojeLocal(-6), hojeLocal()] },
  { rotulo: "Este ano", datas: () => [hojeLocal().slice(0, 4) + "-01-01", hojeLocal()] },
];

function RelatorioRecebimentos() {
  const [[inicio, fim], setPeriodo] = useState<[string, string]>(PERIODOS[0].datas());
  const [gerando, setGerando] = useState<"xlsx" | "pdf" | null>(null);

  async function gerar(tipo: "xlsx" | "pdf") {
    if (!inicio || !fim || inicio > fim) return toast("Confira as datas do período.");
    setGerando(tipo);
    try {
      const r = await api("GET", `/api/admin/relatorio?inicio=${inicio}&fim=${fim}`);
      const m = await import("@/lib/relatorio");
      await (tipo === "xlsx" ? m.baixarExcel(r) : m.baixarPDF(r));
    } catch (e) { toast((e as Error).message); }
    finally { setGerando(null); }
  }

  return (
    <section className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <h2 style={{ fontSize: 16 }}>Relatório de recebimentos</h2>
      <p className="muted peq">Entrada geral, taxas, splits de Missões e Primícias e o repasse de 45%, direto do Asaas.</p>
      <div className="abas" style={{ flexWrap: "wrap" }}>
        {PERIODOS.map((p) => {
          const [a, b] = p.datas();
          return <button key={p.rotulo} className={`aba ${a === inicio && b === fim ? "ativa" : ""}`} onClick={() => setPeriodo([a, b])}>{p.rotulo}</button>;
        })}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <label className="campo"><span>De</span><input type="date" value={inicio} max={fim} onChange={(e) => setPeriodo([e.target.value, fim])} /></label>
        <label className="campo"><span>Até</span><input type="date" value={fim} min={inicio} onChange={(e) => setPeriodo([inicio, e.target.value])} /></label>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <button className="btn" disabled={!!gerando} onClick={() => gerar("xlsx")}>
          <FileSpreadsheet size={18} />{gerando === "xlsx" ? "Gerando…" : "Excel"}
        </button>
        <button className="btn sec" disabled={!!gerando} onClick={() => gerar("pdf")}>
          <FileText size={18} />{gerando === "pdf" ? "Gerando…" : "PDF"}
        </button>
      </div>
    </section>
  );
}
