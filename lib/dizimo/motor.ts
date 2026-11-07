// Motor do dízimo: recebe eventos (mensagem do WhatsApp, aviso de pagamento do Asaas),
// roda o bot e executa as ações. Fala com o mundo só por três portas — Repo, Mensageiro
// e Gateway — para que os testes troquem tudo por versões em memória.

import { comprovante, passo, ROTULO, type Acao, type Contexto, type Entrada, type Estado, type Forma, type Saida, type TipoContribuicao } from "./bot.ts";
import { e164, reais } from "./texto.ts";

export interface Contato {
  id: string;
  telefone: string;
  profileId: string | null;
  nome: string | null;
  cpf: string | null;
  nascimento: string | null;
  asaasClienteId: string | null;
  aceitouEm: string | null;
  saiuEm: string | null;
}

export interface Conversa { estado: Estado; contexto: Contexto; versao: number }

export interface Contribuicao {
  id: string;
  contatoId: string;
  tipo: TipoContribuicao | "campanha";
  valor: number;
  forma: Forma;
  status: "pendente" | "paga" | "vencida" | "falhou" | "estornada" | "chargeback";
  asaasCobrancaId: string | null;
  reciboEnviadoEm: string | null;
}

export type StatusEvento = "novo" | "pendente" | "feito";

export interface Repo {
  /** Acha ou cria o contato pelo telefone E.164; liga ao membro do app se achar um. */
  obterContato(telefone: string, origem?: string): Promise<Contato>;
  contatoPorId(id: string): Promise<Contato | null>;
  atualizarContato(id: string, p: Partial<Pick<Contato, "nome" | "cpf" | "nascimento" | "asaasClienteId" | "aceitouEm" | "saiuEm" | "profileId">>): Promise<void>;
  nomePerfil(profileId: string): Promise<string | null>;
  /** false se a mensagem (wa_message_id) já foi registrada — webhook repetido. */
  registrarMensagem(m: { contatoId: string; direcao: "entrada" | "saida"; waMessageId: string | null; tipo: string; corpo: string; status: string; erro?: string }): Promise<boolean>;
  atualizarStatusMensagem(waMessageId: string, status: string, erro?: string): Promise<void>;
  obterConversa(contatoId: string): Promise<Conversa>;
  /** Grava só se a versão ainda for a lida (trava otimista). */
  salvarConversa(contatoId: string, c: { estado: Estado; contexto: Contexto }, versaoLida: number): Promise<boolean>;
  forcarConversa(contatoId: string, c: { estado: Estado; contexto?: Contexto }): Promise<void>;
  /** Usa o token de vínculo; devolve o profile_id ou null se inválido/expirado/usado. */
  usarVinculo(token: string): Promise<string | null>;
  criarContribuicao(c: { contatoId: string; tipo: TipoContribuicao; valor: number; forma: Forma; origem?: string }): Promise<string>;
  completarContribuicao(id: string, p: { asaasCobrancaId: string; pixCopiaCola?: string; link?: string; venceEm?: string }): Promise<void>;
  falharContribuicao(id: string, erro: string): Promise<void>;
  contribuicaoPorCobranca(asaasCobrancaId: string): Promise<Contribuicao | null>;
  atualizarContribuicao(id: string, p: { status?: Contribuicao["status"]; pagaEm?: string; taxa?: number; reciboEnviadoEm?: string }): Promise<void>;
  iniciarEvento(provedor: "whatsapp" | "asaas", eventoId: string): Promise<StatusEvento>;
  concluirEvento(provedor: "whatsapp" | "asaas", eventoId: string, erro?: string): Promise<void>;
}

export interface Mensageiro {
  /** Envia e devolve o wa_message_id. Lança erro se a Meta recusar. */
  enviar(telefone: string, s: Saida): Promise<string>;
}

export interface Cobranca { id: string; pixCopiaCola?: string; link: string; venceEm: string }

export interface Gateway {
  criarCliente(c: { nome: string; cpf: string; telefone: string; referencia: string }): Promise<string>;
  cobrar(c: { cliente: string; valor: number; forma: Forma; descricao: string; referencia: string }): Promise<Cobranca>;
}

export interface Deps { repo: Repo; whats: Mensageiro; gateway: Gateway; log?: (msg: string, extra?: unknown) => void }

export interface MensagemRecebida {
  waId: string;           // "5585999990001"
  waMessageId: string;    // "wamid...."
  texto: string;
  botao?: string;         // id do botão tocado
  tipo: string;           // text | interactive | image | ...
}

const corpoDe = (s: Saida) => (s.tipo === "link" ? `${s.texto}\n[${s.rotulo}] ${s.url}` : s.tipo === "botoes" ? `${s.texto}\n${s.botoes.map((b) => `[${b.titulo}]`).join(" ")}` : s.texto);

async function enviarTodas(d: Deps, contato: Contato, saidas: Saida[]): Promise<boolean> {
  for (const s of saidas) {
    try {
      const wamid = await d.whats.enviar(contato.telefone, s);
      await d.repo.registrarMensagem({ contatoId: contato.id, direcao: "saida", waMessageId: wamid, tipo: s.tipo === "texto" ? "texto" : s.tipo === "botoes" ? "botao" : "botao", corpo: corpoDe(s), status: "enviada" });
    } catch (e) {
      const erro = (e as Error).message;
      d.log?.("falha ao enviar WhatsApp", { telefone: contato.telefone, erro });
      await d.repo.registrarMensagem({ contatoId: contato.id, direcao: "saida", waMessageId: null, tipo: "texto", corpo: corpoDe(s), status: "falhou", erro });
      return false; // não manda as próximas fora de ordem
    }
  }
  return true;
}

/** Mensagem nova chegou no WhatsApp da igreja. */
export async function receberMensagem(d: Deps, m: MensagemRecebida): Promise<"ok" | "duplicada"> {
  const telefone = e164(m.waId);
  const origem = m.texto.toUpperCase().match(/#([A-Z0-9]{1,6})\b/)?.[1];
  let contato = await d.repo.obterContato(telefone, origem);

  const nova = await d.repo.registrarMensagem({
    contatoId: contato.id, direcao: "entrada", waMessageId: m.waMessageId,
    tipo: m.tipo === "interactive" ? "botao" : m.tipo === "text" ? "texto" : "outro",
    corpo: m.texto, status: "recebida",
  });
  if (!nova) return "duplicada";

  const entrada: Entrada = { texto: m.texto, botao: m.botao };
  if (m.tipo !== "text" && m.tipo !== "interactive") {
    entrada.texto = "";  // foto, áudio, figurinha: o bot responde como mensagem não entendida
  }

  // Roda o bot com trava otimista: se outra mensagem do mesmo contato mudou a conversa
  // no meio do caminho, relê e roda de novo.
  let resultado: ReturnType<typeof passo> | null = null;
  for (let tentativa = 0; tentativa < 3 && !resultado; tentativa++) {
    const conv = await d.repo.obterConversa(contato.id);
    const nomeApp = contato.profileId ? await d.repo.nomePerfil(contato.profileId) : null;
    const p = passo(conv.estado, conv.contexto, entrada, {
      nome: contato.nome, cpf: contato.cpf, nascimento: contato.nascimento,
      aceitou: Boolean(contato.aceitouEm), saiu: Boolean(contato.saiuEm), nomeApp,
    });
    if (await d.repo.salvarConversa(contato.id, { estado: p.estado, contexto: p.contexto }, conv.versao)) resultado = p;
    else contato = (await d.repo.contatoPorId(contato.id)) || contato;
  }
  if (!resultado) throw new Error(`conversa travada: ${contato.id}`);

  const saidas: Saida[] = [...resultado.saidas];
  for (const acao of resultado.acoes) {
    saidas.push(...(await executar(d, contato, acao)));
    contato = (await d.repo.contatoPorId(contato.id)) || contato;
  }
  await enviarTodas(d, contato, saidas);
  return "ok";
}

async function executar(d: Deps, contato: Contato, a: Acao): Promise<Saida[]> {
  const agora = new Date().toISOString();
  switch (a.tipo) {
    case "salvar":
      await d.repo.atualizarContato(contato.id, {
        ...(a.nome !== undefined ? { nome: a.nome } : {}),
        ...(a.cpf !== undefined ? { cpf: a.cpf } : {}),
        ...(a.nascimento !== undefined ? { nascimento: a.nascimento } : {}),
        ...(a.aceite ? { aceitouEm: agora } : {}),
      });
      return [];

    case "parar":
      await d.repo.atualizarContato(contato.id, { saiuEm: agora });
      return [];

    case "voltar":
      await d.repo.atualizarContato(contato.id, { saiuEm: null });
      return [];

    case "vincular": {
      const profileId = await d.repo.usarVinculo(a.token);
      if (!profileId) {
        return [{ tipo: "texto", texto: "Esse código de vínculo não vale mais (ele expira em 15 minutos). Gere outro no app, em Perfil." }];
      }
      await d.repo.atualizarContato(contato.id, { profileId });
      const nome = await d.repo.nomePerfil(profileId);
      return [{ tipo: "texto", texto: `Pronto${nome ? `, ${nome.split(" ")[0]}` : ""}! Seu WhatsApp agora está ligado à sua conta no app. Suas contribuições vão aparecer lá em Ofertas. Escreva *menu* para contribuir.` }];
    }

    case "cobrar":
      return cobrar(d, contato, a);
  }
}

async function cobrar(d: Deps, contato: Contato, a: Extract<Acao, { tipo: "cobrar" }>): Promise<Saida[]> {
  const id = await d.repo.criarContribuicao({ contatoId: contato.id, tipo: a.contribuicao, valor: a.valor, forma: a.forma, origem: a.origem });
  try {
    let cliente = contato.asaasClienteId;
    if (!cliente) {
      cliente = await d.gateway.criarCliente({ nome: contato.nome!, cpf: contato.cpf!, telefone: contato.telefone, referencia: contato.id });
      await d.repo.atualizarContato(contato.id, { asaasClienteId: cliente });
    }
    const cob = await d.gateway.cobrar({
      cliente, valor: a.valor, forma: a.forma, referencia: id,
      descricao: `${ROTULO[a.contribuicao]} - Igreja Eklésia`,
    });
    await d.repo.completarContribuicao(id, { asaasCobrancaId: cob.id, pixCopiaCola: cob.pixCopiaCola, link: cob.link, venceEm: cob.venceEm });

    if (a.forma === "pix" && cob.pixCopiaCola) {
      return [
        { tipo: "texto", texto: `Seu Pix de *${reais(a.valor)}* está pronto. Copie o código da próxima mensagem e cole no app do seu banco, em *Pix Copia e Cola*.\n\nSe preferir ler o QR Code, abra este link: ${cob.link}` },
        { tipo: "texto", texto: cob.pixCopiaCola },
      ];
    }
    return [{
      tipo: "link", rotulo: "Pagar com cartão", url: cob.link,
      texto: `Toque no botão para pagar *${reais(a.valor)}* com cartão de crédito na página segura do nosso banco. Os dados do cartão não passam por esta conversa.`,
    }];
  } catch (e) {
    const erro = (e as Error).message;
    d.log?.("falha ao criar cobrança", { contribuicao: id, erro });
    await d.repo.falharContribuicao(id, erro);
    await d.repo.forcarConversa(contato.id, { estado: "escolher_forma", contexto: { tipo: a.contribuicao, valor: a.valor, origem: a.origem } });
    return [{
      tipo: "botoes", texto: "Não consegui gerar a cobrança agora 😕 Tente de novo em instantes:",
      botoes: [{ id: "forma:pix", titulo: "Pix" }, { id: "forma:cartao", titulo: "Cartão de crédito" }],
    }];
  }
}

/** Aviso do Asaas sobre uma cobrança. */
export interface EventoPagamento {
  eventoId: string;
  evento: string;          // PAYMENT_RECEIVED, PAYMENT_CONFIRMED, ...
  cobrancaId: string;
  valor?: number;          // centavos
  liquido?: number;        // centavos
  pagoEm?: string;         // ISO
}

const STATUS_POR_EVENTO: Record<string, Contribuicao["status"]> = {
  PAYMENT_RECEIVED: "paga",
  PAYMENT_CONFIRMED: "paga",
  PAYMENT_OVERDUE: "vencida",
  PAYMENT_DELETED: "falhou",
  PAYMENT_REFUNDED: "estornada",
  PAYMENT_CHARGEBACK_REQUESTED: "chargeback",
};

export async function receberPagamento(d: Deps, ev: EventoPagamento): Promise<"ok" | "duplicado" | "ignorado"> {
  const status = STATUS_POR_EVENTO[ev.evento];
  if (!status) return "ignorado";

  if ((await d.repo.iniciarEvento("asaas", ev.eventoId)) === "feito") return "duplicado";

  const c = await d.repo.contribuicaoPorCobranca(ev.cobrancaId);
  if (!c) {
    // Cobrança criada fora do bot (no painel do Asaas, por exemplo): não é nossa.
    await d.repo.concluirEvento("asaas", ev.eventoId, "cobrança não encontrada");
    return "ignorado";
  }

  // Cartão manda CONFIRMED e, semanas depois, RECEIVED: não volta status nem repete comprovante.
  if (status === "paga" && c.status === "paga" && c.reciboEnviadoEm) {
    await d.repo.concluirEvento("asaas", ev.eventoId);
    return "ok";
  }

  const pagaEm = ev.pagoEm || new Date().toISOString();
  await d.repo.atualizarContribuicao(c.id, {
    status,
    ...(status === "paga" ? { pagaEm } : {}),
    ...(ev.valor !== undefined && ev.liquido !== undefined ? { taxa: Math.max(0, ev.valor - ev.liquido) } : {}),
  });

  if (status === "paga" && !c.reciboEnviadoEm) {
    const contato = await d.repo.contatoPorId(c.contatoId);
    if (contato) {
      const enviado = await enviarTodas(d, contato, comprovante({
        nome: contato.nome, tipo: c.tipo, valor: c.valor, forma: c.forma,
        pagoEm: new Date(pagaEm), codigo: c.id.slice(0, 8).toUpperCase(),
      }));
      // Se a Meta recusou (ex.: janela de 24h fechada), o recibo fica pendente e
      // aparece no app; o envio por template entra na próxima etapa.
      if (enviado) await d.repo.atualizarContribuicao(c.id, { reciboEnviadoEm: new Date().toISOString() });
      // Só sai do "aguardando pagamento" se ainda estiver nele (pode já ter começado outra).
      if ((await d.repo.obterConversa(contato.id)).estado === "aguardando_pagamento") {
        await d.repo.forcarConversa(contato.id, { estado: "menu", contexto: {} });
      }
    }
  }

  await d.repo.concluirEvento("asaas", ev.eventoId);
  return "ok";
}
