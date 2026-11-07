// Versões em memória das portas do motor — usadas nos testes e no modo demonstração.

import type { Saida } from "./bot.ts";
import type { Cobranca, Contato, Contribuicao, Conversa, Gateway, Mensageiro, Repo, StatusEvento } from "./motor.ts";

let seq = 0;
const uuid = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;

export class RepoMemoria implements Repo {
  contatos = new Map<string, Contato>();
  conversas = new Map<string, Conversa>();
  mensagens: { contatoId: string; direcao: string; waMessageId: string | null; corpo: string; status: string; erro?: string }[] = [];
  contribuicoes = new Map<string, Contribuicao & { pixCopiaCola?: string; link?: string; origem?: string; pagaEm?: string; taxa?: number; erro?: string }>();
  eventos = new Map<string, StatusEvento>();
  perfis = new Map<string, { nome: string; telefone: string }>();
  vinculos = new Map<string, { profileId: string; expira: number; usado: boolean }>();

  async obterContato(telefone: string): Promise<Contato> {
    for (const c of this.contatos.values()) if (c.telefone === telefone) return { ...c };
    const fim = (t: string) => { const d = t.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, ""); return d.slice(0, 2) + d.slice(-8); };
    const achados = [...this.perfis.entries()].filter(([, p]) => fim(p.telefone) === fim(telefone));
    const c: Contato = {
      id: uuid(), telefone, profileId: achados.length === 1 ? achados[0][0] : null,
      nome: null, cpf: null, nascimento: null, asaasClienteId: null, aceitouEm: null, saiuEm: null,
    };
    this.contatos.set(c.id, c);
    return { ...c };
  }
  async contatoPorId(id: string) { const c = this.contatos.get(id); return c ? { ...c } : null; }
  async atualizarContato(id: string, p: Partial<Contato>) { Object.assign(this.contatos.get(id)!, p); }
  async nomePerfil(id: string) { return this.perfis.get(id)?.nome ?? null; }

  async registrarMensagem(m: { contatoId: string; direcao: "entrada" | "saida"; waMessageId: string | null; tipo: string; corpo: string; status: string; erro?: string }) {
    if (m.waMessageId && this.mensagens.some((x) => x.waMessageId === m.waMessageId)) return false;
    this.mensagens.push(m);
    return true;
  }
  async atualizarStatusMensagem(waMessageId: string, status: string) {
    const m = this.mensagens.find((x) => x.waMessageId === waMessageId);
    if (m) m.status = status;
  }

  async obterConversa(contatoId: string): Promise<Conversa> {
    return structuredClone(this.conversas.get(contatoId) || { estado: "inicio", contexto: {}, versao: 0 });
  }
  async salvarConversa(contatoId: string, c: Pick<Conversa, "estado" | "contexto">, versaoLida: number) {
    const atual = this.conversas.get(contatoId);
    if ((atual?.versao ?? 0) !== versaoLida) return false;
    this.conversas.set(contatoId, { ...structuredClone(c), versao: versaoLida + 1 });
    return true;
  }
  async forcarConversa(contatoId: string, c: Partial<Conversa> & Pick<Conversa, "estado">) {
    const atual = this.conversas.get(contatoId);
    this.conversas.set(contatoId, { estado: c.estado, contexto: c.contexto ?? atual?.contexto ?? {}, versao: (atual?.versao ?? 0) + 1 });
  }

  async usarVinculo(token: string) {
    const v = this.vinculos.get(token);
    if (!v || v.usado || v.expira < Date.now()) return null;
    v.usado = true;
    return v.profileId;
  }

  async criarContribuicao(c: { contatoId: string; tipo: Contribuicao["tipo"]; valor: number; forma: Contribuicao["forma"]; origem?: string }) {
    const id = uuid();
    this.contribuicoes.set(id, { id, ...c, status: "pendente", asaasCobrancaId: null, reciboEnviadoEm: null });
    return id;
  }
  async completarContribuicao(id: string, p: { asaasCobrancaId: string; pixCopiaCola?: string; link?: string }) {
    Object.assign(this.contribuicoes.get(id)!, p);
  }
  async falharContribuicao(id: string, erro: string) { Object.assign(this.contribuicoes.get(id)!, { status: "falhou", erro }); }
  async contribuicaoPorCobranca(cobId: string) {
    for (const c of this.contribuicoes.values()) if (c.asaasCobrancaId === cobId) return { ...c };
    return null;
  }
  async atualizarContribuicao(id: string, p: { status?: Contribuicao["status"]; pagaEm?: string; taxa?: number; reciboEnviadoEm?: string }) {
    Object.assign(this.contribuicoes.get(id)!, p);
  }

  async iniciarEvento(provedor: string, id: string): Promise<StatusEvento> {
    const k = `${provedor}:${id}`;
    const s = this.eventos.get(k);
    if (!s) { this.eventos.set(k, "pendente"); return "novo"; }
    return s;
  }
  async concluirEvento(provedor: string, id: string) { this.eventos.set(`${provedor}:${id}`, "feito"); }
}

/** Guarda o que seria enviado pelo WhatsApp. */
export class WhatsMemoria implements Mensageiro {
  enviadas: { telefone: string; saida: Saida }[] = [];
  falhar = false;
  async enviar(telefone: string, saida: Saida) {
    if (this.falhar) throw new Error("(#131047) Re-engagement message");
    this.enviadas.push({ telefone, saida });
    return `wamid.out.${this.enviadas.length}`;
  }
  /** Textos enviados para um telefone, na ordem. */
  textos(telefone: string) {
    return this.enviadas.filter((e) => e.telefone === telefone).map((e) => e.saida.texto);
  }
  ultima(telefone: string) { return this.enviadas.filter((e) => e.telefone === telefone).at(-1)?.saida; }
}

/** Finge o Asaas. */
export class GatewayMemoria implements Gateway {
  clientes: { id: string; nome: string; cpf: string }[] = [];
  cobrancas: (Cobranca & { valor: number; cliente: string; referencia: string })[] = [];
  falhar = false;
  async criarCliente(c: { nome: string; cpf: string }) {
    const id = `cus_${this.clientes.length + 1}`;
    this.clientes.push({ id, ...c });
    return id;
  }
  async cobrar(c: { cliente: string; valor: number; forma: "pix" | "cartao"; referencia: string }) {
    if (this.falhar) throw new Error("Asaas fora do ar");
    const id = `pay_${this.cobrancas.length + 1}`;
    const cob = {
      id, link: `https://sandbox.asaas.com/i/${id}`, venceEm: "2026-11-08",
      pixCopiaCola: c.forma === "pix" ? `00020101021226PIX${id}6304ABCD` : undefined,
      valor: c.valor, cliente: c.cliente, referencia: c.referencia,
    };
    this.cobrancas.push(cob);
    return cob;
  }
}
