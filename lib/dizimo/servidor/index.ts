// Monta o motor com as peças reais (Supabase, WhatsApp Cloud API, Asaas).

import type { Deps } from "../motor.ts";
import { AsaasApi } from "./asaas.ts";
import { env, faltando } from "./env.ts";
import { RepoSupabase } from "./repo.ts";
import { WhatsCloud } from "./whatsapp.ts";

let cache: (Deps & { repo: RepoSupabase }) | null = null;

/** Null se faltar configuração (a rota responde 503 e loga o que falta). */
export function motorReal(): (Deps & { repo: RepoSupabase }) | null {
  if (faltando().length) return null;
  if (!cache) {
    cache = {
      repo: new RepoSupabase(env.supabaseUrl!, env.supabaseServiceKey!),
      whats: new WhatsCloud({ phoneNumberId: env.waPhoneNumberId!, token: env.waToken!, versao: env.waGraphVersion }),
      gateway: new AsaasApi({ url: env.asaasUrl, chave: env.asaasKey! }),
      log: (msg, extra) => console.error(`[dizimo] ${msg}`, extra ?? ""),
    };
  }
  return cache;
}

/** Só o repositório, para a rota /D (que não precisa do WhatsApp nem do Asaas). */
export function repoReal(): RepoSupabase | null {
  if (!env.supabaseUrl || !env.supabaseServiceKey) return null;
  return motorReal()?.repo ?? new RepoSupabase(env.supabaseUrl, env.supabaseServiceKey);
}

/** wa.me da igreja com o texto já preenchido. */
export function linkWhatsapp(texto: string): string | null {
  if (!env.waNumero) return null;
  return `https://wa.me/${env.waNumero.replace(/\D/g, "")}?text=${encodeURIComponent(texto)}`;
}
