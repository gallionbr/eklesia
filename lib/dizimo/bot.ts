// O bot do dízimo como uma função pura: (estado, contexto, mensagem, contato) → resposta.
// Não fala com WhatsApp nem com o banco. Quem executa as ações é o motor (motor.ts).

import { cpfMascarado, lerCpf, lerData, lerValor, normalizar, primeiroNome, reais } from "./texto.ts";

export type Estado =
  | "inicio" | "cad_nome" | "cad_cpf" | "cad_nascimento"
  | "escolher_tipo" | "escolher_valor" | "valor_livre" | "escolher_forma"
  | "aguardando_pagamento" | "menu";

export type TipoContribuicao = "dizimo" | "oferta" | "missoes";
export type Forma = "pix" | "cartao";

export interface Contexto {
  origem?: string;               // código do QR (#LED)
  tipo?: TipoContribuicao;
  valor?: number;                // centavos
  tentativas?: number;           // respostas inválidas seguidas no mesmo passo
}

export interface ContatoBot {
  nome: string | null;
  cpf: string | null;
  nascimento: string | null;
  aceitou: boolean;              // já viu o aviso de privacidade
  saiu: boolean;                 // pediu PARAR
  nomeApp: string | null;        // nome no perfil do app, se for membro vinculado
}

export interface Entrada {
  texto: string;                 // texto digitado ou título do botão
  botao?: string;                // id do botão tocado, se foi botão
}

export interface Botao { id: string; titulo: string }    // título: até 20 caracteres

export type Saida =
  | { tipo: "texto"; texto: string }
  | { tipo: "botoes"; texto: string; botoes: Botao[] }   // até 3 botões
  | { tipo: "link"; texto: string; rotulo: string; url: string };  // botão que abre um site

export type Acao =
  | { tipo: "salvar"; nome?: string; cpf?: string; nascimento?: string | null; aceite?: true }
  | { tipo: "cobrar"; contribuicao: TipoContribuicao; valor: number; forma: Forma; origem?: string }
  | { tipo: "parar" }
  | { tipo: "voltar" }
  | { tipo: "vincular"; token: string };

export interface Passo {
  estado: Estado;
  contexto: Contexto;
  saidas: Saida[];
  acoes: Acao[];
}

export const ROTULO: Record<TipoContribuicao, string> = { dizimo: "Dízimo", oferta: "Oferta", missoes: "Missões" };
export const VALORES_SUGERIDOS = [5000, 10000];  // centavos
export const VALOR_MINIMO = 500;                 // R$ 5,00 — abaixo disso a taxa come a contribuição
export const VALOR_MAXIMO = 5_000_000;           // R$ 50.000,00 — acima, falar com a secretaria

const BOTOES_TIPO: Botao[] = [
  { id: "tipo:dizimo", titulo: "Dízimo" },
  { id: "tipo:oferta", titulo: "Oferta" },
  { id: "tipo:missoes", titulo: "Missões" },
];

const PERGUNTA_TIPO = "O que você quer entregar hoje?";

function texto(t: string): Saida { return { tipo: "texto", texto: t }; }
function botoes(t: string, b: Botao[]): Saida { return { tipo: "botoes", texto: t, botoes: b }; }

function botoesValor(tipo: TipoContribuicao): Saida {
  return botoes(`${ROTULO[tipo]}. Qual valor?`, [
    ...VALORES_SUGERIDOS.map((v) => ({ id: `valor:${v}`, titulo: reais(v) })),
    { id: "valor:outro", titulo: "Outro valor" },
  ]);
}

function botoesForma(c: Contexto): Saida {
  return botoes(`${ROTULO[c.tipo!]} de ${reais(c.valor!)}. Como prefere pagar?`, [
    { id: "forma:pix", titulo: "Pix" },
    { id: "forma:cartao", titulo: "Cartão de crédito" },
  ]);
}

const MENU: Saida = botoes("Quando quiser contribuir de novo, é só tocar abaixo ou escrever *menu*.", [
  { id: "menu:contribuir", titulo: "Contribuir" },
]);

/** Reconhece a escolha por id de botão ou por texto digitado ("pix", "1", "dízimo"). */
function escolha(e: Entrada, opcoes: Record<string, string[]>): string | null {
  if (e.botao) {
    const id = e.botao.split(":")[1];
    if (id && id in opcoes) return id;
  }
  const n = normalizar(e.texto);
  for (const [id, palavras] of Object.entries(opcoes)) {
    if (palavras.some((p) => n === p || n.split(" ").includes(p))) return id;
  }
  return null;
}

/** Depois de 2 respostas que não entendemos no mesmo passo, oferece ajuda. */
function naoEntendi(estado: Estado, ctx: Contexto, pergunta: Saida, dica: string): Passo {
  const tentativas = (ctx.tentativas || 0) + 1;
  const saidas: Saida[] = [texto(dica), pergunta];
  if (tentativas >= 3) saidas.push(texto("Se preferir, escreva *ajuda* que alguém da secretaria fala com você."));
  return { estado, contexto: { ...ctx, tentativas }, saidas, acoes: [] };
}

/** Cadastro completo = tem nome e CPF (o Asaas exige CPF para emitir a cobrança). */
export function cadastroCompleto(c: ContatoBot): boolean {
  return Boolean(c.nome && c.cpf);
}

/** Primeira pergunta do cadastro que ainda falta, ou a escolha do tipo se já está tudo certo. */
function proximoDoCadastro(c: ContatoBot, ctx: Contexto): Passo {
  if (!c.nome) {
    return { estado: "cad_nome", contexto: { ...ctx, tentativas: 0 }, saidas: [texto("Pra começar, qual é o seu nome completo?")], acoes: [] };
  }
  if (!c.cpf) {
    return {
      estado: "cad_cpf", contexto: { ...ctx, tentativas: 0 },
      saidas: [texto(`Obrigado, ${primeiroNome(c.nome)}! Agora o seu CPF (só números). Ele vai no comprovante e é exigido pelo banco para registrar o pagamento.`)],
      acoes: [],
    };
  }
  return { estado: "escolher_tipo", contexto: { ...ctx, tentativas: 0 }, saidas: [botoes(PERGUNTA_TIPO, BOTOES_TIPO)], acoes: [] };
}

/** Comandos que valem em qualquer ponto da conversa. */
function comando(e: Entrada, c: ContatoBot, ctx: Contexto): Passo | null {
  const n = normalizar(e.texto);
  const vinc = e.texto.trim().toUpperCase().match(/^VINCULAR\s+([A-Z0-9]{6})$/);
  if (vinc) return { estado: "menu", contexto: {}, saidas: [], acoes: [{ tipo: "vincular", token: vinc[1] }] };
  if (["parar", "sair", "cancelar mensagens", "stop"].includes(n)) {
    return {
      estado: "menu", contexto: {},
      saidas: [texto("Pronto, não vamos mais te mandar lembretes nem avisos. Se mudar de ideia, escreva *voltar*. Você ainda pode contribuir quando quiser escrevendo *menu*.")],
      acoes: [{ tipo: "parar" }],
    };
  }
  if (n === "voltar" && c.saiu) {
    return { estado: "menu", contexto: {}, saidas: [texto("Que bom ter você de volta! Os lembretes estão ligados de novo."), MENU], acoes: [{ tipo: "voltar" }] };
  }
  if (["menu", "inicio", "comecar", "recomecar"].includes(n)) {
    if (!cadastroCompleto(c)) return proximoDoCadastro(c, {});
    return { estado: "escolher_tipo", contexto: {}, saidas: [botoes(PERGUNTA_TIPO, BOTOES_TIPO)], acoes: [] };
  }
  if (n === "ajuda") {
    return {
      estado: "menu", contexto: {},
      saidas: [texto("Sua mensagem foi encaminhada pra secretaria da igreja, que responde por aqui assim que puder. Para contribuir agora, escreva *menu*.")],
      acoes: [],
    };
  }
  void ctx;
  return null;
}

export function passo(estado: Estado, ctx: Contexto, e: Entrada, c: ContatoBot): Passo {
  const cmd = comando(e, c, ctx);
  if (cmd) return cmd;

  switch (estado) {
    case "inicio": {
      const origem = e.texto.toUpperCase().match(/#([A-Z0-9]{1,6})\b/)?.[1];
      const novoCtx: Contexto = { origem: origem && origem !== "GERAL" ? origem : undefined };
      const nome = primeiroNome(c.nomeApp || c.nome);
      const saidas: Saida[] = [];
      const acoes: Acao[] = [];
      if (!c.aceitou) {
        saidas.push(texto(
          `${nome ? `Olá, ${nome}!` : "Olá!"} Aqui é a Eklésia 🙏 Por este WhatsApp você entrega dízimos e ofertas com Pix ou cartão, e recebe o comprovante na hora.\n\n` +
          "Seus dados (nome, CPF e data de nascimento) ficam só com a igreja e são usados para registrar suas contribuições. Escreva *parar* a qualquer momento para não receber mais mensagens.",
        ));
        acoes.push({ tipo: "salvar", aceite: true, ...(c.nomeApp && !c.nome ? { nome: c.nomeApp } : {}) });
      } else {
        if (nome) saidas.push(texto(`Olá, ${nome}! Que bom te ver por aqui.`));
        if (c.nomeApp && !c.nome) acoes.push({ tipo: "salvar", nome: c.nomeApp });
      }
      const contatoAtual = { ...c, nome: c.nome || c.nomeApp };
      const prox = proximoDoCadastro(contatoAtual, novoCtx);
      return { ...prox, saidas: [...saidas, ...prox.saidas], acoes: [...acoes, ...prox.acoes] };
    }

    case "cad_nome": {
      const nome = e.texto.trim().replace(/\s+/g, " ");
      if (nome.length < 3 || nome.length > 120 || !/\p{L}{2,}/u.test(nome) || /\d/.test(nome)) {
        return naoEntendi(estado, ctx, texto("Qual é o seu nome completo?"), "Não consegui entender o nome.");
      }
      return { ...proximoDoCadastro({ ...c, nome }, ctx), acoes: [{ tipo: "salvar", nome }] };
    }

    case "cad_cpf": {
      const cpf = lerCpf(e.texto);
      if (!cpf) {
        return naoEntendi(estado, ctx, texto("Pode mandar o CPF de novo? Só os 11 números."), "Esse CPF não parece válido.");
      }
      return {
        estado: "cad_nascimento", contexto: { ...ctx, tentativas: 0 },
        saidas: [
          texto(`CPF ${cpfMascarado(cpf)} registrado.`),
          botoes("Por último, sua data de nascimento (ex.: 25/03/1990). A igreja usa para lembrar do seu aniversário.", [{ id: "nasc:pular", titulo: "Prefiro não dizer" }]),
        ],
        acoes: [{ tipo: "salvar", cpf }],
      };
    }

    case "cad_nascimento": {
      const pular = e.botao === "nasc:pular" || ["pular", "prefiro nao dizer", "nao"].includes(normalizar(e.texto));
      const data = pular ? null : lerData(e.texto);
      if (!pular && !data) {
        return naoEntendi(estado, ctx,
          botoes("Qual a sua data de nascimento? (dia/mês/ano)", [{ id: "nasc:pular", titulo: "Prefiro não dizer" }]),
          "Não reconheci essa data.");
      }
      return {
        estado: "escolher_tipo", contexto: { ...ctx, tentativas: 0 },
        saidas: [texto("Cadastro pronto! ✅"), botoes(PERGUNTA_TIPO, BOTOES_TIPO)],
        acoes: [{ tipo: "salvar", nascimento: data }],
      };
    }

    case "escolher_tipo": {
      const t = escolha(e, { dizimo: ["dizimo", "1"], oferta: ["oferta", "ofertas", "2"], missoes: ["missoes", "missao", "3"] }) as TipoContribuicao | null;
      if (!t) return naoEntendi(estado, ctx, botoes(PERGUNTA_TIPO, BOTOES_TIPO), "Escolha uma das opções.");
      return { estado: "escolher_valor", contexto: { ...ctx, tipo: t, tentativas: 0 }, saidas: [botoesValor(t)], acoes: [] };
    }

    case "escolher_valor": {
      if (e.botao?.startsWith("valor:") && e.botao !== "valor:outro") {
        return comValor(Number(e.botao.slice(6)), ctx);
      }
      if (e.botao === "valor:outro" || normalizar(e.texto) === "outro valor" || normalizar(e.texto) === "outro") {
        return { estado: "valor_livre", contexto: { ...ctx, tentativas: 0 }, saidas: [texto("Digite o valor (ex.: 75 ou 150,50).")], acoes: [] };
      }
      const v = lerValor(e.texto);
      if (v !== null) return comValor(v, ctx);
      return naoEntendi(estado, ctx, botoesValor(ctx.tipo || "oferta"), "Escolha um valor ou digite outro.");
    }

    case "valor_livre": {
      const v = lerValor(e.texto);
      if (v === null) return naoEntendi(estado, ctx, texto("Digite só o valor, por exemplo 80 ou 120,50."), "Não entendi o valor.");
      return comValor(v, ctx);
    }

    case "escolher_forma": {
      const f = escolha(e, { pix: ["pix"], cartao: ["cartao", "credito", "cartao de credito"] }) as Forma | null;
      if (!f || !ctx.tipo || !ctx.valor) return naoEntendi(estado, ctx, botoesForma(ctx), "Escolha Pix ou cartão.");
      return {
        estado: "aguardando_pagamento", contexto: { ...ctx, tentativas: 0 },
        saidas: [],  // o motor manda o Pix ou o link do cartão depois de criar a cobrança
        acoes: [{ tipo: "cobrar", contribuicao: ctx.tipo, valor: ctx.valor, forma: f, origem: ctx.origem }],
      };
    }

    case "aguardando_pagamento":
      return {
        estado, contexto: ctx,
        saidas: [botoes("Assim que o pagamento cair, te mando o comprovante aqui. Se quiser começar outra contribuição:", [
          { id: "menu:contribuir", titulo: "Nova contribuição" },
        ])],
        acoes: [],
      };

    case "menu":
    default:
      if (e.botao === "menu:contribuir" || normalizar(e.texto) === "contribuir") {
        if (!cadastroCompleto(c)) return proximoDoCadastro(c, {});
        return { estado: "escolher_tipo", contexto: {}, saidas: [botoes(PERGUNTA_TIPO, BOTOES_TIPO)], acoes: [] };
      }
      // Mensagem nova fora de um fluxo: recomeça como se tivesse acabado de escanear.
      return passo("inicio", {}, e, c);
  }
}

function comValor(v: number, ctx: Contexto): Passo {
  if (v < VALOR_MINIMO) {
    return { estado: "valor_livre", contexto: { ...ctx, tentativas: 0 },
      saidas: [texto(`O valor mínimo por aqui é ${reais(VALOR_MINIMO)}. Digite outro valor.`)], acoes: [] };
  }
  if (v > VALOR_MAXIMO) {
    return { estado: "valor_livre", contexto: { ...ctx, tentativas: 0 },
      saidas: [texto(`Para valores acima de ${reais(VALOR_MAXIMO)}, fale com a secretaria (escreva *ajuda*). Ou digite outro valor.`)], acoes: [] };
  }
  const novo = { ...ctx, valor: v, tentativas: 0 };
  return { estado: "escolher_forma", contexto: novo, saidas: [botoesForma(novo)], acoes: [] };
}

/** Comprovante enviado pelo motor quando o pagamento é confirmado. */
export function comprovante(p: {
  nome: string | null; tipo: TipoContribuicao | "campanha"; valor: number; forma: Forma;
  pagoEm: Date; codigo: string;
}): Saida[] {
  const quando = p.pagoEm.toLocaleString("pt-BR", { timeZone: "America/Fortaleza", dateStyle: "short", timeStyle: "short" });
  const rotulo = p.tipo === "campanha" ? "Campanha" : ROTULO[p.tipo];
  return [
    texto(
      `✅ *Comprovante de contribuição*\n\n` +
      `${rotulo}: *${reais(p.valor)}*\n` +
      `Forma: ${p.forma === "pix" ? "Pix" : "Cartão de crédito"}\n` +
      `Data: ${quando}\n` +
      (p.nome ? `Nome: ${p.nome}\n` : "") +
      `Código: ${p.codigo}\n\n` +
      `Igreja Eklésia — obrigado por semear na obra de Deus. 🙏`,
    ),
    MENU,
  ];
}
