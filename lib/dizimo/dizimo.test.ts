import { test } from "node:test";
import assert from "node:assert/strict";
import { cpfMascarado, lerCpf, lerData, lerValor, reais } from "./texto.ts";
import { passo } from "./bot.ts";
import { receberMensagem, receberPagamento, type Deps } from "./motor.ts";
import { GatewayMemoria, RepoMemoria, WhatsMemoria } from "./memoria.ts";

// ── texto
test("reais formata centavos", () => {
  assert.equal(reais(5000), "R$ 50,00");
  assert.equal(reais(123456789), "R$ 1.234.567,89");
  assert.equal(reais(5), "R$ 0,05");
});

test("lerValor entende os jeitos comuns de digitar", () => {
  assert.equal(lerValor("50"), 5000);
  assert.equal(lerValor("R$ 50,00"), 5000);
  assert.equal(lerValor("150,5"), 15050);
  assert.equal(lerValor("1.234,56"), 123456);
  assert.equal(lerValor("1.000"), 100000);
  assert.equal(lerValor("50.5"), 5050);
  assert.equal(lerValor("100 reais"), 10000);
  assert.equal(lerValor("cem"), null);
  assert.equal(lerValor("0"), null);
  assert.equal(lerValor("-10"), null);
});

test("lerCpf valida dígitos verificadores", () => {
  assert.equal(lerCpf("529.982.247-25"), "52998224725");
  assert.equal(lerCpf("52998224724"), null);
  assert.equal(lerCpf("111.111.111-11"), null);
  assert.equal(lerCpf("123"), null);
  assert.equal(cpfMascarado("52998224725"), "529.***.***-25");
});

test("lerData aceita dd/mm/aaaa e recusa data impossível ou futura", () => {
  const hoje = new Date("2026-11-07T12:00:00Z");
  assert.equal(lerData("25/03/1990", hoje), "1990-03-25");
  assert.equal(lerData("5/3/90", hoje), "1990-03-05");
  assert.equal(lerData("05-03-2010", hoje), "2010-03-05");
  assert.equal(lerData("31/02/1990", hoje), null);
  assert.equal(lerData("01/01/2030", hoje), null);
  assert.equal(lerData("ontem", hoje), null);
});

// ── bot (função pura)
const novo = { nome: null, cpf: null, nascimento: null, aceitou: false, saiu: false, nomeApp: null };

test("primeiro contato pelo QR do LED: aviso de privacidade, guarda a origem e pede o nome", () => {
  const p = passo("inicio", {}, { texto: "Quero contribuir #LED" }, novo);
  assert.equal(p.estado, "cad_nome");
  assert.equal(p.contexto.origem, "LED");
  assert.match(p.saidas[0].texto, /parar/);
  assert.deepEqual(p.acoes, [{ tipo: "salvar", aceite: true }]);
});

test("membro do app já vinculado pula o nome e é chamado pelo primeiro nome", () => {
  const p = passo("inicio", {}, { texto: "Quero contribuir #GERAL" }, { ...novo, nomeApp: "GUILHERME TAVARES" });
  assert.equal(p.contexto.origem, undefined);
  assert.equal(p.estado, "cad_cpf");
  assert.match(p.saidas[0].texto, /^Olá, Guilherme!/);
  assert.deepEqual(p.acoes[0], { tipo: "salvar", aceite: true, nome: "GUILHERME TAVARES" });
});

test("valor abaixo do mínimo pede outro valor", () => {
  const p = passo("valor_livre", { tipo: "oferta" }, { texto: "2" }, novo);
  assert.equal(p.estado, "valor_livre");
  assert.match(p.saidas[0].texto, /mínimo/);
});

test("três respostas sem sentido oferecem ajuda humana", () => {
  let ctx = {};
  let ultima;
  for (let i = 0; i < 3; i++) {
    ultima = passo("escolher_tipo", ctx, { texto: "hein?" }, { ...novo, nome: "Ana", cpf: "52998224725", aceitou: true });
    ctx = ultima.contexto;
  }
  assert.match(ultima!.saidas.at(-1)!.texto, /ajuda/);
});

test("PARAR vale em qualquer passo", () => {
  const p = passo("cad_cpf", {}, { texto: "Parar" }, novo);
  assert.deepEqual(p.acoes, [{ tipo: "parar" }]);
});

// ── ponta a ponta: QR → WhatsApp → Pix → comprovante
function montar() {
  const repo = new RepoMemoria();
  const whats = new WhatsMemoria();
  const gateway = new GatewayMemoria();
  const d: Deps = { repo, whats, gateway };
  let n = 0;
  const diz = (texto: string, botao?: string, waId = "5585999990001") =>
    receberMensagem(d, { waId, waMessageId: `wamid.in.${++n}`, texto, botao, tipo: botao ? "interactive" : "text" });
  return { repo, whats, gateway, d, diz };
}

test("visitante: escaneia o LED, se cadastra, paga dízimo no Pix e recebe o comprovante", async () => {
  const { repo, whats, gateway, d, diz } = montar();
  const tel = "+5585999990001";

  await diz("Quero contribuir #LED");
  await diz("Maria das Graças Silva");
  await diz("529.982.247-25");
  await diz("25/03/1990");
  await diz("Dízimo", "tipo:dizimo");
  await diz("R$ 100,00", "valor:10000");
  await diz("Pix", "forma:pix");

  // cobrança criada no Asaas com cliente novo e valor certo
  assert.equal(gateway.clientes[0].cpf, "52998224725");
  assert.equal(gateway.cobrancas[0].valor, 10000);
  const [contrib] = [...repo.contribuicoes.values()];
  assert.equal(contrib.origem, "LED");
  assert.equal(contrib.asaasCobrancaId, "pay_1");
  assert.equal(whats.ultima(tel)!.texto, gateway.cobrancas[0].pixCopiaCola, "última mensagem é só o copia-e-cola");

  // Asaas avisa que caiu — duas vezes (webhook repetido)
  const ev = { eventoId: "evt_1", evento: "PAYMENT_RECEIVED", cobrancaId: "pay_1", valor: 10000, liquido: 9901, pagoEm: "2026-11-07T13:00:00Z" };
  assert.equal(await receberPagamento(d, ev), "ok");
  assert.equal(await receberPagamento(d, ev), "duplicado");

  const pago = repo.contribuicoes.get(contrib.id)!;
  assert.equal(pago.status, "paga");
  assert.equal(pago.taxa, 99);
  assert.ok(pago.reciboEnviadoEm);
  const comprovantes = whats.textos(tel).filter((t) => t.includes("Comprovante"));
  assert.equal(comprovantes.length, 1, "um comprovante só");
  assert.match(comprovantes[0], /Dízimo: \*R\$ 100,00\*/);
  assert.match(comprovantes[0], /Maria das Graças Silva/);
  assert.equal((await repo.obterConversa([...repo.contatos.keys()][0])).estado, "menu");
});

test("membro do app (telefone com 9) é reconhecido mesmo quando o WhatsApp manda sem o 9", async () => {
  const { repo, whats, diz } = montar();
  repo.perfis.set("perfil-1", { nome: "Guilherme Tavares", telefone: "(85) 99999-0001" });
  await diz("Quero contribuir #APP", undefined, "558599990001");
  const [contato] = [...repo.contatos.values()];
  assert.equal(contato.profileId, "perfil-1");
  assert.equal(contato.nome, "Guilherme Tavares");
  assert.match(whats.textos("+558599990001")[0], /Olá, Guilherme!/);
});

test("mensagem repetida pela Meta não roda o bot duas vezes", async () => {
  const { d, whats } = montar();
  const m = { waId: "5585999990001", waMessageId: "wamid.X", texto: "oi", tipo: "text" };
  assert.equal(await receberMensagem(d, m), "ok");
  const enviadas = whats.enviadas.length;
  assert.equal(await receberMensagem(d, m), "duplicada");
  assert.equal(whats.enviadas.length, enviadas);
});

test("cartão manda link de pagamento (nada de número de cartão no chat)", async () => {
  const { whats, gateway, diz } = montar();
  for (const [t, b] of [["oi"], ["Ana Souza"], ["52998224725"], ["pular"], ["Oferta", "tipo:oferta"], ["Outro valor", "valor:outro"], ["75,50"], ["Cartão", "forma:cartao"]] as [string, string?][]) {
    await diz(t, b);
  }
  assert.equal(gateway.cobrancas[0].valor, 7550);
  const s = whats.ultima("+5585999990001")!;
  assert.equal(s.tipo, "link");
  assert.equal(s.tipo === "link" && s.url, gateway.cobrancas[0].link);
});

test("Asaas fora do ar: avisa, marca a contribuição como falha e deixa tentar de novo", async () => {
  const { repo, whats, gateway, diz } = montar();
  for (const [t, b] of [["oi"], ["Ana Souza"], ["52998224725"], ["pular"], ["Oferta", "tipo:oferta"], ["R$ 50,00", "valor:5000"]] as [string, string?][]) await diz(t, b);
  gateway.falhar = true;
  await diz("Pix", "forma:pix");
  assert.equal([...repo.contribuicoes.values()][0].status, "falhou");
  assert.match(whats.ultima("+5585999990001")!.texto, /Não consegui gerar/);

  gateway.falhar = false;
  await diz("Pix", "forma:pix");
  assert.equal(gateway.cobrancas.length, 1);
  assert.equal(gateway.cobrancas[0].valor, 5000, "manteve tipo e valor escolhidos");
});

test("comprovante recusado pela Meta (janela fechada) fica pendente, não marcado como enviado", async () => {
  const { repo, whats, d, diz } = montar();
  for (const [t, b] of [["oi"], ["Ana Souza"], ["52998224725"], ["pular"], ["Oferta", "tipo:oferta"], ["R$ 50,00", "valor:5000"], ["Pix", "forma:pix"]] as [string, string?][]) await diz(t, b);
  whats.falhar = true;
  await receberPagamento(d, { eventoId: "evt_9", evento: "PAYMENT_RECEIVED", cobrancaId: "pay_1" });
  const c = [...repo.contribuicoes.values()][0];
  assert.equal(c.status, "paga");
  assert.equal(c.reciboEnviadoEm, null);
});

test("vincular o WhatsApp à conta do app com o código gerado no app", async () => {
  const { repo, whats, diz } = montar();
  repo.perfis.set("perfil-7", { nome: "Pedro Lima", telefone: "" });
  repo.vinculos.set("AB12CD", { profileId: "perfil-7", expira: Date.now() + 60_000, usado: false });
  await diz("VINCULAR AB12CD");
  assert.equal([...repo.contatos.values()][0].profileId, "perfil-7");
  assert.match(whats.ultima("+5585999990001")!.texto, /Pronto, Pedro!/);
  await diz("VINCULAR AB12CD", undefined, "5585988887777");
  assert.match(whats.ultima("+5585988887777")!.texto, /não vale mais/);
});

test("evento de cobrança que não é do bot é ignorado sem erro", async () => {
  const { d } = montar();
  assert.equal(await receberPagamento(d, { eventoId: "evt_x", evento: "PAYMENT_RECEIVED", cobrancaId: "pay_999" }), "ignorado");
  assert.equal(await receberPagamento(d, { eventoId: "evt_y", evento: "PAYMENT_CREATED", cobrancaId: "pay_1" }), "ignorado");
});
