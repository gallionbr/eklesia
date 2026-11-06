"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Pin, Download, Users } from "lucide-react";
import { sb, msgErro } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import type { Celula, Config, Papel, Pedido, Perfil } from "@/lib/types";
import { dataCurta, dataHora, relativo } from "@/lib/format";
import { gerarPix } from "@/lib/pix";
import Crud from "@/components/admin/Crud";
import { Carregando, Campo, Folha, Topo, Vazio, toast } from "@/components/ui";

const ABAS = ["Resumo", "Avisos", "Agenda", "Devocionais", "Células", "Membros", "Oração", "Igreja"] as const;
type Aba = (typeof ABAS)[number];

export default function Admin() {
  const { isAdmin, carregando } = useAuth();
  const [aba, setAba] = useState<Aba>("Resumo");

  if (carregando) return <Carregando />;
  if (!isAdmin) {
    return (
      <main className="pagina">
        <Topo titulo="Painel" voltar />
        <Vazio>Esta área é só para administradores. <Link href="/inicio" style={{ color: "var(--primaria)" }}>Voltar ao início</Link></Vazio>
      </main>
    );
  }

  return (
    <main className="pagina">
      <Topo titulo="Painel" sub="Administração da igreja" voltar />
      <div className="abas">
        {ABAS.map((a) => <button key={a} className={`aba ${aba === a ? "ativa" : ""}`} onClick={() => setAba(a)}>{a}</button>)}
      </div>
      {aba === "Resumo" && <Resumo ir={setAba} />}
      {aba === "Avisos" && <Avisos />}
      {aba === "Agenda" && <Agenda />}
      {aba === "Devocionais" && <Devocionais />}
      {aba === "Células" && <CelulasAdmin />}
      {aba === "Membros" && <Membros />}
      {aba === "Oração" && <PedidosAdmin />}
      {aba === "Igreja" && <Igreja />}
    </main>
  );
}

/* ───────── Resumo */
function Resumo({ ir }: { ir: (a: Aba) => void }) {
  const [n, setN] = useState<Record<string, number> | null>(null);
  useEffect(() => {
    const conta = (t: string, f?: (q: any) => any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      let q = sb().from(t).select("*", { count: "exact", head: true });
      if (f) q = f(q);
      return q.then((r: { count: number | null }) => r.count || 0);
    };
    const agora = new Date().toISOString();
    const mes = new Date(Date.now() - 30 * 86400e3).toISOString();
    Promise.all([
      conta("profiles"),
      conta("profiles", (q) => q.gte("criado_em", mes)),
      conta("profiles", (q) => q.is("celula_id", null)),
      conta("celulas", (q) => q.eq("ativa", true)),
      conta("eventos", (q) => q.gte("inicio", agora)),
      conta("pedidos_oracao", (q) => q.eq("respondido", false)),
    ]).then(([m, novos, sem, c, e, p]) => setN({ m, novos, sem, c, e, p }));
  }, []);
  if (!n) return <Carregando />;
  const Tile = ({ v, r, a }: { v: number; r: string; a: Aba }) => (
    <button className="card" style={{ textAlign: "left" }} onClick={() => ir(a)}>
      <b style={{ fontFamily: "var(--serif)", fontSize: 30, color: "var(--primaria)" }}>{v}</b>
      <p className="muted peq">{r}</p>
    </button>
  );
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
      <Tile v={n.m} r="membros cadastrados" a="Membros" />
      <Tile v={n.novos} r="novos nos últimos 30 dias" a="Membros" />
      <Tile v={n.sem} r="ainda sem célula" a="Membros" />
      <Tile v={n.c} r="células ativas" a="Células" />
      <Tile v={n.e} r="eventos futuros" a="Agenda" />
      <Tile v={n.p} r="pedidos de oração em aberto" a="Oração" />
    </div>
  );
}

/* ───────── Avisos */
function Avisos() {
  return (
    <Crud tabela="avisos" nome="aviso"
      ordem={[{ col: "fixado", asc: false }, { col: "publicado_em", asc: false }]}
      campos={[
        { k: "titulo", rotulo: "Título", obrigatorio: true },
        { k: "corpo", rotulo: "Texto", tipo: "textarea" },
        { k: "link", rotulo: "Link (opcional)", tipo: "url", dica: "Inscrição externa, transmissão, etc." },
        { k: "fixado", rotulo: "Fixar no topo", tipo: "bool" },
        { k: "expira_em", rotulo: "Sai do ar em (opcional)", tipo: "datetime" },
      ]}
      resumo={(l) => (
        <>
          <div className="linha" style={{ gap: 6 }}>{l.fixado ? <Pin size={14} color="var(--ouro)" /> : null}<b>{l.titulo as string}</b></div>
          <p className="muted peq">{relativo(l.publicado_em as string)}{l.expira_em ? ` · expira ${dataCurta(l.expira_em as string)}` : ""}</p>
        </>
      )}
    />
  );
}

/* ───────── Agenda */
function Agenda() {
  const [ver, setVer] = useState<{ id: string; titulo: string } | null>(null);
  return (
    <>
      <Crud tabela="eventos" nome="evento"
        ordem={[{ col: "inicio", asc: false }]}
        campos={[
          { k: "titulo", rotulo: "Título", obrigatorio: true },
          { k: "inicio", rotulo: "Início", tipo: "datetime", obrigatorio: true },
          { k: "fim", rotulo: "Término", tipo: "datetime" },
          { k: "local", rotulo: "Local" },
          { k: "descricao", rotulo: "Descrição", tipo: "textarea" },
          { k: "inscricao_aberta", rotulo: "Aceitar inscrições pelo app", tipo: "bool" },
          { k: "vagas", rotulo: "Vagas", tipo: "number", dica: "Deixe vazio para ilimitado" },
        ]}
        resumo={(l) => (
          <>
            <b>{l.titulo as string}</b>
            <p className="muted peq">{dataHora(l.inicio as string)}{l.local ? ` · ${l.local}` : ""}</p>
          </>
        )}
        extra={(l) => l.inscricao_aberta ? (
          <button className="btn sec peq" style={{ marginTop: 10 }} onClick={() => setVer({ id: l.id, titulo: l.titulo as string })}>
            <Users size={16} />Ver inscritos
          </button>
        ) : null}
      />
      <Inscritos evento={ver} fechar={() => setVer(null)} />
    </>
  );
}

function Inscritos({ evento, fechar }: { evento: { id: string; titulo: string } | null; fechar: () => void }) {
  const [lista, setLista] = useState<{ nome: string; telefone: string | null; email: string | null }[] | null>(null);
  useEffect(() => {
    if (!evento) return;
    setLista(null);
    sb().from("inscricoes").select("criado_em, profiles(nome, telefone, email)").eq("evento_id", evento.id).order("criado_em")
      .then(({ data }) => setLista(((data || []) as unknown as { profiles: { nome: string; telefone: string | null; email: string | null } }[]).map((r) => r.profiles)));
  }, [evento]);
  return (
    <Folha aberta={!!evento} fechar={fechar} titulo={`Inscritos · ${evento?.titulo || ""}`}>
      {lista === null ? <Carregando /> : lista.length === 0 ? <Vazio>Ninguém inscrito ainda.</Vazio> : (
        <>
          <button className="btn sec peq" style={{ marginBottom: 12 }}
            onClick={() => baixarCSV(`inscritos-${evento!.titulo}.csv`, [["Nome", "Telefone", "E-mail"], ...lista.map((p) => [p.nome, p.telefone || "", p.email || ""])])}>
            <Download size={16} />Baixar planilha ({lista.length})
          </button>
          <table className="tabela"><tbody>
            {lista.map((p, i) => <tr key={i}><td>{i + 1}. {p.nome}</td><td className="muted">{p.telefone}</td></tr>)}
          </tbody></table>
        </>
      )}
    </Folha>
  );
}

/* ───────── Devocionais */
function Devocionais() {
  return (
    <Crud tabela="devocionais" nome="devocional"
      ordem={[{ col: "data", asc: false }]}
      campos={[
        { k: "data", rotulo: "Data", tipo: "date", obrigatorio: true, dica: "Um devocional por dia" },
        { k: "titulo", rotulo: "Título", obrigatorio: true },
        { k: "referencia", rotulo: "Referência bíblica", obrigatorio: true, dica: "Ex.: Salmos 23:1-3" },
        { k: "texto_biblico", rotulo: "Texto bíblico", tipo: "textarea", obrigatorio: true },
        { k: "reflexao", rotulo: "Reflexão", tipo: "textarea", obrigatorio: true },
        { k: "oracao", rotulo: "Oração (opcional)", tipo: "textarea" },
      ]}
      resumo={(l) => (
        <>
          <b>{l.titulo as string}</b>
          <p className="muted peq">{dataCurta((l.data as string) + "T12:00:00-03:00")} · {l.referencia as string}</p>
        </>
      )}
    />
  );
}

/* ───────── Células */
function CelulasAdmin() {
  const [lideres, setLideres] = useState<{ v: string; r: string }[] | null>(null);
  useEffect(() => {
    sb().from("profiles").select("id,nome").in("papel", ["lider", "admin"]).order("nome")
      .then(({ data }) => setLideres(((data as { id: string; nome: string }[]) || []).map((p) => ({ v: p.id, r: p.nome }))));
  }, []);
  if (!lideres) return <Carregando />;
  return (
    <>
      {lideres.length === 0 && <p className="muted peq">Dica: na aba Membros, mude o papel de alguém para “Líder” para poder escolher como líder de célula.</p>}
      <Crud tabela="celulas" nome="célula"
        ordem={[{ col: "ativa", asc: false }, { col: "nome", asc: true }]}
        campos={[
          { k: "nome", rotulo: "Nome", obrigatorio: true },
          { k: "lider_id", rotulo: "Líder", tipo: "select", opcoes: lideres },
          { k: "dia_semana", rotulo: "Dia da semana", tipo: "select", opcoes: ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"].map((d) => ({ v: d, r: d })) },
          { k: "horario", rotulo: "Horário", dica: "Ex.: 19h30" },
          { k: "bairro", rotulo: "Bairro" },
          { k: "endereco", rotulo: "Endereço" },
          { k: "descricao", rotulo: "Descrição", tipo: "textarea" },
          { k: "ativa", rotulo: "Ativa (aparece para os membros)", tipo: "bool", padrao: true },
        ]}
        resumo={(l) => (
          <>
            <b>{l.nome as string}</b>{!l.ativa && <span className="selo" style={{ marginLeft: 6 }}>Inativa</span>}
            <p className="muted peq">{[l.dia_semana, l.horario, l.bairro].filter(Boolean).join(" · ")}
              {l.lider_id ? ` · Líder: ${lideres.find((x) => x.v === l.lider_id)?.r || "—"}` : ""}</p>
          </>
        )}
      />
    </>
  );
}

/* ───────── Membros */
function Membros() {
  const { perfil: eu } = useAuth();
  const [membros, setMembros] = useState<Perfil[] | null>(null);
  const [celulas, setCelulas] = useState<Celula[]>([]);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<"todos" | "sem" | "lider">("todos");

  const carregar = useCallback(async () => {
    const [m, c] = await Promise.all([
      sb().from("profiles").select("*").order("nome"),
      sb().from("celulas").select("*").order("nome"),
    ]);
    setMembros((m.data as Perfil[]) || []);
    setCelulas((c.data as Celula[]) || []);
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  async function mudar(p: Perfil, dados: Partial<Perfil>) {
    if (p.id === eu?.id && dados.papel && dados.papel !== "admin" && !confirm("Você vai perder o acesso ao painel. Continuar?")) return;
    const { error } = await sb().from("profiles").update(dados).eq("id", p.id);
    if (error) return toast(msgErro(error));
    toast("Atualizado");
    carregar();
  }

  if (!membros) return <Carregando />;
  const nomeCel = (id: string | null) => celulas.find((c) => c.id === id)?.nome || "";
  const lista = membros.filter((m) =>
    (filtro === "todos" || (filtro === "sem" && !m.celula_id) || (filtro === "lider" && m.papel !== "membro")) &&
    (!busca || `${m.nome} ${m.email} ${m.telefone} ${m.bairro}`.toLowerCase().includes(busca.toLowerCase())));

  return (
    <div className="secao">
      <label className="campo"><span className="sr">Buscar</span>
        <input placeholder="Buscar por nome, e-mail, telefone ou bairro" value={busca} onChange={(e) => setBusca(e.target.value)} />
      </label>
      <div className="linha" style={{ flexWrap: "wrap" }}>
        {([["todos", "Todos"], ["sem", "Sem célula"], ["lider", "Líderes e admins"]] as const).map(([v, r]) => (
          <button key={v} className={`aba ${filtro === v ? "ativa" : ""}`} onClick={() => setFiltro(v)}>{r}</button>
        ))}
        <button className="btn sec peq" style={{ marginLeft: "auto" }} onClick={() => baixarCSV("membros-eklesia.csv", [
          ["Nome", "E-mail", "Telefone", "Nascimento", "Bairro", "Papel", "Célula", "Membro desde", "Cadastro"],
          ...lista.map((m) => [m.nome, m.email || "", m.telefone || "", m.nascimento || "", m.bairro || "", m.papel, nomeCel(m.celula_id), m.membro_desde || "", m.criado_em.slice(0, 10)]),
        ])}><Download size={16} />Planilha</button>
      </div>
      <p className="muted peq">{lista.length} de {membros.length} pessoas</p>
      <div className="lista">
        {lista.map((m) => (
          <div key={m.id} className="card">
            <b>{m.nome || "(sem nome)"}</b>
            <p className="muted peq">{[m.email, m.telefone, m.bairro].filter(Boolean).join(" · ")}</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 8, marginTop: 10 }}>
              <select className="btn sec peq" value={m.papel} onChange={(e) => mudar(m, { papel: e.target.value as Papel })} aria-label="Papel">
                <option value="membro">Membro</option><option value="lider">Líder</option><option value="admin">Admin</option>
              </select>
              <select className="btn sec peq" value={m.celula_id || ""} onChange={(e) => mudar(m, { celula_id: e.target.value || null })} aria-label="Célula">
                <option value="">Sem célula</option>
                {celulas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ───────── Pedidos de oração */
function PedidosAdmin() {
  const [pedidos, setPedidos] = useState<Pedido[] | null>(null);
  const [soAbertos, setSoAbertos] = useState(true);
  const carregar = useCallback(async () => {
    let q = sb().from("pedidos_oracao").select("*").order("criado_em", { ascending: false }).limit(200);
    if (soAbertos) q = q.eq("respondido", false);
    const { data } = await q;
    setPedidos((data as Pedido[]) || []);
  }, [soAbertos]);
  useEffect(() => { carregar(); }, [carregar]);

  async function acao(p: Pedido, tipo: "respondido" | "ocultar" | "apagar") {
    const r = tipo === "apagar"
      ? (confirm("Apagar este pedido?") ? await sb().from("pedidos_oracao").delete().eq("id", p.id) : null)
      : await sb().from("pedidos_oracao").update(tipo === "respondido" ? { respondido: true } : { publico: false }).eq("id", p.id);
    if (!r) return;
    if (r.error) return toast(msgErro(r.error));
    carregar();
  }

  return (
    <div className="secao">
      <label className="check"><input type="checkbox" checked={soAbertos} onChange={(e) => setSoAbertos(e.target.checked)} />Só pedidos em aberto</label>
      {pedidos === null ? <Carregando /> : pedidos.length === 0 ? <Vazio>Nenhum pedido.</Vazio> : (
        <div className="lista">
          {pedidos.map((p) => (
            <div key={p.id} className="card">
              <div className="linha entre peq">
                <b>{p.autor_nome || "Anônimo"}</b>
                <span className="linha" style={{ gap: 6 }}>
                  <span className={`selo ${p.publico ? "azul" : ""}`}>{p.publico ? "Mural" : "Só liderança"}</span>
                  <span className="muted">{relativo(p.criado_em)}</span>
                </span>
              </div>
              <p className="quebra" style={{ marginTop: 6 }}>{p.pedido}</p>
              {p.testemunho && <p className="ok quebra" style={{ marginTop: 6 }}>Testemunho: {p.testemunho}</p>}
              <div className="linha" style={{ marginTop: 10, flexWrap: "wrap" }}>
                {!p.respondido && <button className="btn sec peq" onClick={() => acao(p, "respondido")}>Marcar respondido</button>}
                {p.publico && <button className="btn sec peq" onClick={() => acao(p, "ocultar")}>Tirar do mural</button>}
                <button className="btn perigo peq" onClick={() => acao(p, "apagar")}>Apagar</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ───────── Dados da igreja + Pix */
function Igreja() {
  const { config, recarregar } = useAuth();
  const [f, setF] = useState<Partial<Config>>({});
  const [salvando, setSalvando] = useState(false);
  useEffect(() => { if (config) setF(config); }, [config]);

  const set = (k: keyof Config) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const v = (k: keyof Config) => (f[k] as string) ?? "";

  let pixTeste = "";
  try { if (f.pix_chave) pixTeste = gerarPix({ chave: f.pix_chave, recebedor: f.pix_recebedor || f.nome_igreja || "", cidade: f.pix_cidade || "" }); } catch {}

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    const { id: _id, ...resto } = f as Config; // eslint-disable-line @typescript-eslint/no-unused-vars
    const dados = Object.fromEntries(Object.entries(resto).map(([k, val]) => [k, typeof val === "string" ? val.trim() || null : val]));
    const { error } = await sb().from("config").update({ ...dados, nome_igreja: f.nome_igreja?.trim() || "Igreja Eklésia", atualizado_em: new Date().toISOString() }).eq("id", 1);
    setSalvando(false);
    if (error) return toast(msgErro(error));
    await recarregar();
    toast("Dados da igreja salvos");
  }

  return (
    <form className="form" onSubmit={salvar}>
      <div className="card form">
        <h3>Igreja</h3>
        <Campo rotulo="Nome"><input value={v("nome_igreja")} onChange={set("nome_igreja")} required /></Campo>
        <Campo rotulo="Slogan"><input value={v("slogan")} onChange={set("slogan")} /></Campo>
        <Campo rotulo="Endereço"><input value={v("endereco")} onChange={set("endereco")} /></Campo>
        <Campo rotulo="Horários dos cultos"><textarea value={v("horarios_culto")} onChange={set("horarios_culto")} rows={3} /></Campo>
        <Campo rotulo="Quem somos (aparece no perfil da igreja)"><textarea value={v("bio")} onChange={set("bio")} rows={4} maxLength={1500} /></Campo>
      </div>
      <div className="card form">
        <h3>Transmissão ao vivo</h3>
        <Campo rotulo="Link da transmissão (YouTube)"><input value={v("ao_vivo_url")} onChange={set("ao_vivo_url")} type="url" placeholder="https://youtube.com/live/…" /></Campo>
        <label className="check">
          <input type="checkbox" checked={!!f.ao_vivo} onChange={(e) => setF({ ...f, ao_vivo: e.target.checked })} />
          Estamos ao vivo agora (mostra a bolinha “Ao vivo” nos stories)
        </label>
        <p className="muted peq">Lembre de desmarcar quando o culto terminar.</p>
      </div>
      <div className="card form">
        <h3>Redes</h3>
        <Campo rotulo="Instagram"><input value={v("instagram")} onChange={set("instagram")} placeholder="@igrejaeklesia" /></Campo>
        <Campo rotulo="YouTube (link)"><input value={v("youtube")} onChange={set("youtube")} type="url" /></Campo>
        <Campo rotulo="WhatsApp da secretaria"><input value={v("whatsapp")} onChange={set("whatsapp")} inputMode="tel" placeholder="5585999999999" /></Campo>
      </div>
      <div className="card form">
        <h3>Pix para dízimos e ofertas</h3>
        <Campo rotulo="Chave Pix"><input value={v("pix_chave")} onChange={set("pix_chave")} placeholder="CNPJ, e-mail, telefone (+55…) ou chave aleatória" /></Campo>
        <Campo rotulo="Nome do recebedor (até 25 letras)"><input value={v("pix_recebedor")} onChange={set("pix_recebedor")} maxLength={25} /></Campo>
        <Campo rotulo="Cidade (até 15 letras)"><input value={v("pix_cidade")} onChange={set("pix_cidade")} maxLength={15} /></Campo>
        {pixTeste && <p className="copia">{pixTeste}</p>}
        <p className="muted peq">Telefone como chave precisa do +55 (ex.: +5585999999999). CNPJ só com números. Teste pagando R$ 1 antes de divulgar.</p>
      </div>
      <button className="btn bloco" disabled={salvando}>{salvando ? "Salvando…" : "Salvar"}</button>
    </form>
  );
}

/* ───────── util */
function baixarCSV(nome: string, linhas: string[][]) {
  const csv = "﻿" + linhas.map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = nome.replace(/[^\w.\-]+/g, "-");
  a.click();
  URL.revokeObjectURL(a.href);
}
