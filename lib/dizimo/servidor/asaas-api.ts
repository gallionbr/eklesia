// Chamada à API do Asaas, sem dependências do Next (usada também nos testes).
import { env } from "./env.ts";

/** Chama a API do Asaas com a chave da igreja. Erro vira Error com a mensagem do Asaas. */
export async function chamarAsaas<T>(metodo: "GET" | "POST" | "PUT" | "DELETE", caminho: string, corpo?: unknown): Promise<T> {
  if (!env.asaasKey) throw new Error("Falta ASAAS_API_KEY na Vercel.");
  const r = await fetch(`${env.asaasUrl}${caminho}`, {
    method: metodo,
    headers: { access_token: env.asaasKey, "Content-Type": "application/json", "User-Agent": "eklesia-app" },
    body: corpo ? JSON.stringify(corpo) : undefined,
    cache: "no-store",
  });
  const j = (await r.json().catch(() => ({}))) as T & { errors?: { description?: string; code?: string }[] };
  if (!r.ok) throw new Error(j.errors?.map((e) => e.description || e.code).join(" ") || `Asaas respondeu ${r.status}`);
  return j;
}

