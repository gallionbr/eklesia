// Painel → Dízimo → Asaas. Só administradores.
// GET:  mostra a conta conectada, o Wallet ID e se o webhook do app está ativo.
// POST: cria (ou corrige) o webhook do Asaas apontando para /api/asaas/webhook,
//       com o token que o app confere. Ninguém precisa copiar segredo nenhum.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/dizimo/servidor/env";

export const dynamic = "force-dynamic";

const URL_WEBHOOK = "https://eklesia.international/api/asaas/webhook";
const NOME_WEBHOOK = "App Eklésia — pagamentos";
const EVENTOS = [
  "PAYMENT_CREATED", "PAYMENT_CONFIRMED", "PAYMENT_RECEIVED", "PAYMENT_OVERDUE",
  "PAYMENT_DELETED", "PAYMENT_REFUNDED", "PAYMENT_CHARGEBACK_REQUESTED",
];

interface WebhookAsaas { id: string; name?: string; url: string; enabled: boolean; interrupted: boolean; events?: string[] }

async function asaas<T>(metodo: "GET" | "POST" | "PUT", caminho: string, corpo?: unknown): Promise<T> {
  const r = await fetch(`${env.asaasUrl}${caminho}`, {
    method: metodo,
    headers: { access_token: env.asaasKey!, "Content-Type": "application/json", "User-Agent": "eklesia-app" },
    body: corpo ? JSON.stringify(corpo) : undefined,
    cache: "no-store",
  });
  const j = (await r.json().catch(() => ({}))) as T & { errors?: { description?: string; code?: string }[] };
  if (!r.ok) throw new Error(j.errors?.[0]?.description || j.errors?.[0]?.code || `Asaas respondeu ${r.status}`);
  return j;
}

/** Confere que quem chama é admin. Devolve o e-mail dele (o Asaas avisa problemas no webhook por e-mail). */
async function admin(req: Request): Promise<{ email: string } | NextResponse> {
  if (!env.supabaseUrl || !env.supabaseServiceKey) {
    return NextResponse.json({ erro: "Falta SUPABASE_SERVICE_ROLE_KEY na Vercel." }, { status: 503 });
  }
  const jwt = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!jwt) return NextResponse.json({ erro: "Entre no app primeiro." }, { status: 401 });
  const db = createClient(env.supabaseUrl, env.supabaseServiceKey, { auth: { persistSession: false } });
  const { data: u } = await db.auth.getUser(jwt);
  if (!u.user) return NextResponse.json({ erro: "Sessão expirada. Entre de novo." }, { status: 401 });
  const { data: p } = await db.from("profiles").select("papel").eq("id", u.user.id).maybeSingle();
  if ((p as { papel?: string } | null)?.papel !== "admin") return NextResponse.json({ erro: "Só administradores." }, { status: 403 });
  if (!env.asaasKey) return NextResponse.json({ erro: "Falta ASAAS_API_KEY na Vercel." }, { status: 503 });
  return { email: u.user.email || "" };
}

async function estado() {
  const [conta, carteiras, hooks] = await Promise.all([
    asaas<{ name?: string; companyName?: string; cpfCnpj?: string }>("GET", "/myAccount/commercialInfo").catch(() => null),
    asaas<{ data?: { id: string }[] }>("GET", "/wallets").catch(() => null),
    asaas<{ data?: WebhookAsaas[] }>("GET", "/webhooks"),
  ]);
  const nosso = hooks.data?.find((w) => w.url === URL_WEBHOOK) || null;
  const doc = conta?.cpfCnpj?.replace(/\D/g, "") || "";
  return {
    conta: conta ? { nome: conta.companyName || conta.name || "", documentoFinal: doc.slice(-4) } : null,
    walletId: carteiras?.data?.[0]?.id || null,
    producao: !env.asaasUrl.includes("sandbox"),
    webhook: nosso ? { ativo: nosso.enabled && !nosso.interrupted, interrompido: nosso.interrupted } : null,
  };
}

export async function GET(req: Request) {
  const a = await admin(req);
  if (a instanceof NextResponse) return a;
  try {
    return NextResponse.json(await estado());
  } catch (e) {
    return NextResponse.json({ erro: (e as Error).message }, { status: 502 });
  }
}

export async function POST(req: Request) {
  const a = await admin(req);
  if (a instanceof NextResponse) return a;
  if (!env.asaasWebhookToken) return NextResponse.json({ erro: "Não foi possível gerar o token do webhook." }, { status: 500 });
  try {
    const hooks = await asaas<{ data?: WebhookAsaas[] }>("GET", "/webhooks");
    const nosso = hooks.data?.find((w) => w.url === URL_WEBHOOK);
    const corpo = {
      name: NOME_WEBHOOK, url: URL_WEBHOOK, email: a.email || undefined,
      enabled: true, interrupted: false, apiVersion: 3, sendType: "SEQUENTIALLY",
      authToken: env.asaasWebhookToken, events: EVENTOS,
    };
    if (nosso) await asaas("PUT", `/webhooks/${nosso.id}`, corpo);
    else await asaas("POST", "/webhooks", corpo);
    return NextResponse.json(await estado());
  } catch (e) {
    return NextResponse.json({ erro: (e as Error).message }, { status: 502 });
  }
}
