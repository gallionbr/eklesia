// Variáveis de ambiente do módulo de dízimo. Só no servidor: nunca importe em "use client".

import { createHmac } from "node:crypto";

function ler(nome: string): string | undefined {
  const v = process.env[nome];
  return v && v.trim() ? v.trim() : undefined;
}

export const env = {
  supabaseUrl: ler("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseServiceKey: ler("SUPABASE_SERVICE_ROLE_KEY"),

  // WhatsApp Business Platform (Cloud API da Meta)
  waNumero: ler("WA_NUMERO"),                       // número da igreja, só dígitos com DDI: 5585...
  waPhoneNumberId: ler("WA_PHONE_NUMBER_ID"),
  waToken: ler("WA_ACCESS_TOKEN"),                  // token permanente de usuário do sistema
  waAppSecret: ler("WA_APP_SECRET"),                // assina os webhooks (X-Hub-Signature-256)
  waVerifyToken: ler("WA_VERIFY_TOKEN"),            // você inventa; o mesmo vai no painel da Meta
  waGraphVersion: ler("WA_GRAPH_VERSION") || "v23.0",

  // Asaas
  asaasKey: ler("ASAAS_API_KEY"),
  // 32+ caracteres, o mesmo do webhook no Asaas. Sem a variável, deriva da service role
  // (estável e secreto), e o Painel → Dízimo → Asaas registra o webhook com ele.
  asaasWebhookToken: ler("ASAAS_WEBHOOK_TOKEN") || tokenDerivado(ler("SUPABASE_SERVICE_ROLE_KEY"), "asaas-webhook"),
  asaasUrl: ler("ASAAS_API_URL") || "https://api-sandbox.asaas.com/v3",
};

/** Segredo estável derivado de outro segredo (HMAC), sem sequências que o Asaas recusa. */
export function tokenDerivado(base: string | undefined, uso: string): string | undefined {
  if (!base) return undefined;
  for (let i = 0; i < 100; i++) {
    const t = createHmac("sha256", base).update(`eklesia:${uso}:${i}`).digest("base64url");
    if (!/(.)\1\1/.test(t) && !temSequencia(t)) return t;
  }
  return undefined;
}

function temSequencia(t: string): boolean {
  for (let i = 0; i + 2 < t.length; i++) {
    const [a, b, c] = [t.charCodeAt(i), t.charCodeAt(i + 1), t.charCodeAt(i + 2)];
    if ((b - a === 1 && c - b === 1) || (a - b === 1 && b - c === 1)) return true;
  }
  return false;
}

/** Lista o que falta para o módulo funcionar (vazio = tudo pronto). */
export function faltando(): string[] {
  const obrig: [string, string | undefined][] = [
    ["NEXT_PUBLIC_SUPABASE_URL", env.supabaseUrl],
    ["SUPABASE_SERVICE_ROLE_KEY", env.supabaseServiceKey],
    ["WA_NUMERO", env.waNumero],
    ["WA_PHONE_NUMBER_ID", env.waPhoneNumberId],
    ["WA_ACCESS_TOKEN", env.waToken],
    ["WA_APP_SECRET", env.waAppSecret],
    ["WA_VERIFY_TOKEN", env.waVerifyToken],
    ["ASAAS_API_KEY", env.asaasKey],
    ["ASAAS_WEBHOOK_TOKEN", env.asaasWebhookToken],
  ];
  return obrig.filter(([, v]) => !v).map(([k]) => k);
}
