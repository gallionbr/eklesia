import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const configurado = Boolean(url && key);

let client: SupabaseClient | null = null;

export function sb(): SupabaseClient {
  if (!configurado) throw new Error("Supabase não configurado");
  if (!client) client = createClient(url!, key!, { auth: { persistSession: true, autoRefreshToken: true } });
  return client;
}

/** Mensagem amigável a partir de um erro do Supabase. */
export function msgErro(e: unknown): string {
  const m = (e as { message?: string })?.message || String(e);
  if (/Invalid login/i.test(m)) return "E-mail ou senha incorretos.";
  if (/already registered/i.test(m)) return "Este e-mail já tem cadastro. Tente entrar.";
  if (/Email not confirmed/i.test(m)) return "Confirme seu e-mail pelo link que enviamos.";
  if (/Password should be/i.test(m)) return "A senha precisa ter pelo menos 6 caracteres.";
  if (/esgotadas|encerradas|Somente/i.test(m)) return m.replace(/^.*?: /, "");
  return m;
}
