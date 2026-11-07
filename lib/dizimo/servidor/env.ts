// Variáveis de ambiente do módulo de dízimo. Só no servidor: nunca importe em "use client".

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
  asaasWebhookToken: ler("ASAAS_WEBHOOK_TOKEN"),    // 32+ caracteres, o mesmo do webhook no Asaas
  asaasUrl: ler("ASAAS_API_URL") || "https://api-sandbox.asaas.com/v3",
};

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
