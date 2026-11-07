// Repo do motor sobre o Supabase, com a chave service role (ignora RLS).
// Só roda no servidor: as rotas /api/whatsapp, /api/asaas e /D.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Contexto, Estado, Forma, TipoContribuicao } from "../bot.ts";
import type { Contato, Contribuicao, Conversa, Repo, StatusEvento } from "../motor.ts";

type Linha = Record<string, unknown>;

function contatoDe(l: Linha): Contato {
  return {
    id: l.id as string,
    telefone: l.telefone as string,
    profileId: (l.profile_id as string) ?? null,
    nome: (l.nome as string) ?? null,
    cpf: (l.cpf as string) ?? null,
    nascimento: (l.nascimento as string) ?? null,
    asaasClienteId: (l.asaas_cliente_id as string) ?? null,
    aceitouEm: (l.aceitou_em as string) ?? null,
    saiuEm: (l.saiu_em as string) ?? null,
  };
}

function falhou(e: { message: string } | null, onde: string): void {
  if (e) throw new Error(`${onde}: ${e.message}`);
}

export class RepoSupabase implements Repo {
  private db: SupabaseClient;
  constructor(url: string, chaveServico: string) {
    this.db = createClient(url, chaveServico, { auth: { persistSession: false, autoRefreshToken: false } });
  }

  /** Para a rota /D: conta o scan e devolve o texto pré-preenchido. */
  async registrarScan(codigo: string): Promise<string> {
    const { data, error } = await this.db.rpc("registrar_scan", { p_codigo: codigo });
    falhou(error, "registrar_scan");
    return data as string;
  }

  async obterContato(telefone: string, origem?: string): Promise<Contato> {
    const { data: achado, error } = await this.db.from("contatos_wa").select("*").eq("telefone", telefone).maybeSingle();
    falhou(error, "contatos_wa.select");
    if (achado) return contatoDe(achado);

    const [{ data: perfil }, { data: org }] = await Promise.all([
      this.db.rpc("perfil_por_telefone", { p_digitos: telefone }),
      origem ? this.db.from("qr_origens").select("id").eq("codigo", origem).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    // Um perfil já pode estar ligado a outro número: aí não liga de novo.
    let profileId = (perfil as string | null) ?? null;
    if (profileId) {
      const { count } = await this.db.from("contatos_wa").select("id", { count: "exact", head: true }).eq("profile_id", profileId);
      if (count) profileId = null;
    }
    const { data: novo, error: e2 } = await this.db.from("contatos_wa")
      .upsert({ telefone, profile_id: profileId, origem_id: (org as { id: string } | null)?.id ?? null }, { onConflict: "telefone", ignoreDuplicates: false })
      .select("*").single();
    falhou(e2, "contatos_wa.insert");
    return contatoDe(novo!);
  }

  async contatoPorId(id: string) {
    const { data, error } = await this.db.from("contatos_wa").select("*").eq("id", id).maybeSingle();
    falhou(error, "contatos_wa.byId");
    return data ? contatoDe(data) : null;
  }

  async atualizarContato(id: string, p: Partial<Contato>) {
    const col: Linha = {};
    if ("nome" in p) col.nome = p.nome;
    if ("cpf" in p) col.cpf = p.cpf;
    if ("nascimento" in p) col.nascimento = p.nascimento;
    if ("asaasClienteId" in p) col.asaas_cliente_id = p.asaasClienteId;
    if ("aceitouEm" in p) col.aceitou_em = p.aceitouEm;
    if ("saiuEm" in p) col.saiu_em = p.saiuEm;
    if ("profileId" in p) col.profile_id = p.profileId;
    if (!Object.keys(col).length) return;
    const { error } = await this.db.from("contatos_wa").update(col).eq("id", id);
    falhou(error, "contatos_wa.update");
  }

  async nomePerfil(profileId: string) {
    const { data } = await this.db.from("profiles").select("nome").eq("id", profileId).maybeSingle();
    const nome = (data as { nome?: string } | null)?.nome?.trim();
    return nome || null;
  }

  async registrarMensagem(m: { contatoId: string; direcao: "entrada" | "saida"; waMessageId: string | null; tipo: string; corpo: string; status: string; erro?: string }) {
    const { error } = await this.db.from("mensagens_wa").insert({
      contato_id: m.contatoId, direcao: m.direcao, wa_message_id: m.waMessageId,
      tipo: m.tipo, corpo: m.corpo.slice(0, 4096), status: m.status, erro: m.erro ?? null,
    });
    if (error?.code === "23505") return false;  // wa_message_id repetido
    falhou(error, "mensagens_wa.insert");
    if (m.direcao === "entrada") {
      await this.db.from("conversas_wa").upsert({ contato_id: m.contatoId, ultima_entrada_em: new Date().toISOString() }, { onConflict: "contato_id", ignoreDuplicates: false });
    }
    return true;
  }

  async atualizarStatusMensagem(waMessageId: string, status: string, erro?: string) {
    await this.db.from("mensagens_wa").update({ status, ...(erro ? { erro } : {}) }).eq("wa_message_id", waMessageId);
  }

  async obterConversa(contatoId: string): Promise<Conversa> {
    const { data, error } = await this.db.from("conversas_wa").select("estado, contexto, versao").eq("contato_id", contatoId).maybeSingle();
    falhou(error, "conversas_wa.select");
    if (!data) return { estado: "inicio", contexto: {}, versao: 0 };
    return { estado: data.estado as Estado, contexto: (data.contexto as Contexto) || {}, versao: data.versao as number };
  }

  async salvarConversa(contatoId: string, c: { estado: Estado; contexto: Contexto }, versaoLida: number) {
    const { data, error } = await this.db.from("conversas_wa")
      .update({ estado: c.estado, contexto: c.contexto, versao: versaoLida + 1 })
      .eq("contato_id", contatoId).eq("versao", versaoLida).select("contato_id");
    falhou(error, "conversas_wa.update");
    return (data?.length ?? 0) === 1;
  }

  async forcarConversa(contatoId: string, c: { estado: Estado; contexto?: Contexto }) {
    const atual = await this.obterConversa(contatoId);
    const { error } = await this.db.from("conversas_wa").upsert({
      contato_id: contatoId, estado: c.estado, contexto: c.contexto ?? atual.contexto, versao: atual.versao + 1,
    }, { onConflict: "contato_id" });
    falhou(error, "conversas_wa.forcar");
  }

  async usarVinculo(token: string) {
    const { data, error } = await this.db.from("vinculos_wa")
      .update({ usado_em: new Date().toISOString() })
      .eq("token", token).is("usado_em", null).gt("expira_em", new Date().toISOString())
      .select("profile_id").maybeSingle();
    falhou(error, "vinculos_wa.update");
    return (data as { profile_id?: string } | null)?.profile_id ?? null;
  }

  async criarContribuicao(c: { contatoId: string; tipo: TipoContribuicao; valor: number; forma: Forma; origem?: string }) {
    let origemId: string | null = null;
    if (c.origem) {
      const { data } = await this.db.from("qr_origens").select("id").eq("codigo", c.origem).maybeSingle();
      origemId = (data as { id: string } | null)?.id ?? null;
    }
    const { data, error } = await this.db.from("contribuicoes").insert({
      contato_id: c.contatoId, tipo: c.tipo, valor_centavos: c.valor, forma: c.forma, origem_id: origemId,
    }).select("id").single();
    falhou(error, "contribuicoes.insert");
    return (data as { id: string }).id;
  }

  async completarContribuicao(id: string, p: { asaasCobrancaId: string; pixCopiaCola?: string; link?: string; venceEm?: string }) {
    const { error } = await this.db.from("contribuicoes").update({
      asaas_cobranca_id: p.asaasCobrancaId, pix_copia_cola: p.pixCopiaCola ?? null,
      link_pagamento: p.link ?? null, vence_em: p.venceEm ?? null,
    }).eq("id", id);
    falhou(error, "contribuicoes.completar");
  }

  async falharContribuicao(id: string) {
    const { error } = await this.db.from("contribuicoes").update({ status: "falhou" }).eq("id", id);
    falhou(error, "contribuicoes.falhar");
  }

  async contribuicaoPorCobranca(asaasCobrancaId: string): Promise<Contribuicao | null> {
    const { data, error } = await this.db.from("contribuicoes")
      .select("id, contato_id, tipo, valor_centavos, forma, status, asaas_cobranca_id, recibo_enviado_em")
      .eq("asaas_cobranca_id", asaasCobrancaId).maybeSingle();
    falhou(error, "contribuicoes.byCobranca");
    if (!data) return null;
    return {
      id: data.id, contatoId: data.contato_id, tipo: data.tipo, valor: data.valor_centavos, forma: data.forma,
      status: data.status, asaasCobrancaId: data.asaas_cobranca_id, reciboEnviadoEm: data.recibo_enviado_em,
    };
  }

  async atualizarContribuicao(id: string, p: { status?: Contribuicao["status"]; pagaEm?: string; taxa?: number; reciboEnviadoEm?: string }) {
    const col: Linha = {};
    if (p.status) col.status = p.status;
    if (p.pagaEm) col.paga_em = p.pagaEm;
    if (p.taxa !== undefined) col.taxa_centavos = p.taxa;
    if (p.reciboEnviadoEm) col.recibo_enviado_em = p.reciboEnviadoEm;
    const { error } = await this.db.from("contribuicoes").update(col).eq("id", id);
    falhou(error, "contribuicoes.update");
  }

  async iniciarEvento(provedor: "whatsapp" | "asaas", eventoId: string): Promise<StatusEvento> {
    const { error } = await this.db.from("webhook_eventos").insert({ provedor, evento_id: eventoId });
    if (!error) return "novo";
    if (error.code !== "23505") falhou(error, "webhook_eventos.insert");
    const { data } = await this.db.from("webhook_eventos").select("processado_em").eq("provedor", provedor).eq("evento_id", eventoId).maybeSingle();
    return (data as { processado_em?: string | null } | null)?.processado_em ? "feito" : "pendente";
  }

  async concluirEvento(provedor: "whatsapp" | "asaas", eventoId: string, erro?: string) {
    await this.db.from("webhook_eventos").update({ processado_em: new Date().toISOString(), erro: erro ?? null })
      .eq("provedor", provedor).eq("evento_id", eventoId);
  }
}
