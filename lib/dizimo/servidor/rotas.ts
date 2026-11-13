// Peças comuns das rotas que falam com o Asaas em nome do app (só servidor).

import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env.ts";

export function dbServico(): SupabaseClient | null {
  if (!env.supabaseUrl || !env.supabaseServiceKey) return null;
  return createClient(env.supabaseUrl, env.supabaseServiceKey, { auth: { persistSession: false } });
}

export { chamarAsaas } from "./asaas-api.ts";

export interface Usuario { id: string; email: string; papel: string; nome: string }

/** Lê o usuário logado pelo token do Supabase. `exigir` restringe por papel. */
export async function usuarioDaRequisicao(req: Request, exigir?: "admin" | "financeiro"): Promise<{ u: Usuario; db: SupabaseClient } | NextResponse> {
  const db = dbServico();
  if (!db) return NextResponse.json({ erro: "Falta SUPABASE_SERVICE_ROLE_KEY na Vercel." }, { status: 503 });
  const jwt = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!jwt) return NextResponse.json({ erro: "Entre no app primeiro." }, { status: 401 });
  const { data } = await db.auth.getUser(jwt);
  if (!data.user) return NextResponse.json({ erro: "Sessão expirada. Entre de novo." }, { status: 401 });
  const { data: p } = await db.from("profiles").select("papel, nome").eq("id", data.user.id).maybeSingle();
  const perfil = (p as { papel?: string; nome?: string } | null) || {};
  if (exigir === "admin" && perfil.papel !== "admin") return NextResponse.json({ erro: "Só administradores." }, { status: 403 });
  if (exigir === "financeiro" && !["admin", "tesoureiro"].includes(perfil.papel || "")) {
    return NextResponse.json({ erro: "Só administradores e tesoureiros." }, { status: 403 });
  }
  return { u: { id: data.user.id, email: data.user.email || "", papel: perfil.papel || "membro", nome: perfil.nome || "" }, db };
}

export const SITE = "https://eklesia.international";
