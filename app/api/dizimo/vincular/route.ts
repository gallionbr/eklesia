// Gera um código de 6 letras para ligar o WhatsApp do membro à conta do app.
// O app abre wa.me/<igreja>?text=VINCULAR AB12CD; o bot recebe e faz a ligação.

import { randomInt } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/dizimo/servidor/env";
import { linkWhatsapp } from "@/lib/dizimo/servidor";

export const dynamic = "force-dynamic";

const LETRAS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sem 0/O e 1/I, que confundem

export async function POST(req: Request) {
  if (!env.supabaseUrl || !env.supabaseServiceKey || !env.waNumero) {
    return NextResponse.json({ erro: "WhatsApp da igreja ainda não configurado." }, { status: 503 });
  }
  const jwt = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!jwt) return NextResponse.json({ erro: "Entre no app primeiro." }, { status: 401 });

  const db = createClient(env.supabaseUrl, env.supabaseServiceKey, { auth: { persistSession: false } });
  const { data: u, error } = await db.auth.getUser(jwt);
  if (error || !u.user) return NextResponse.json({ erro: "Sessão expirada. Entre de novo." }, { status: 401 });

  // Uma pessoa não precisa de mais de um código válido ao mesmo tempo.
  await db.from("vinculos_wa").delete().eq("profile_id", u.user.id).is("usado_em", null);

  for (let tentativa = 0; tentativa < 5; tentativa++) {
    const token = Array.from({ length: 6 }, () => LETRAS[randomInt(LETRAS.length)]).join("");
    const { error: e } = await db.from("vinculos_wa").insert({ token, profile_id: u.user.id });
    if (!e) return NextResponse.json({ token, url: linkWhatsapp(`VINCULAR ${token}`) });
    if (e.code !== "23505") break;
  }
  return NextResponse.json({ erro: "Não foi possível gerar o código. Tente de novo." }, { status: 500 });
}
