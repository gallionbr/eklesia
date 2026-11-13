// Capítulo da Bíblia (Almeida, domínio público) buscado pelo servidor, com cache longo na CDN.
// O celular não chama o bible-api.com direto (bloqueios, limite de acessos, falhas de rede).
import { NextResponse } from "next/server";
import { LIVROS } from "@/lib/biblia";

export const dynamic = "force-dynamic";

type Verso = { verse: number; text: string };
const limpar = (v: Verso[]) => v.map((x) => ({ verse: Number(x.verse), text: String(x.text).replace(/\s+/g, " ").trim() }));

/** getBible (Almeida, domínio público): /v2/almeida/<nº do livro>/<capítulo>.json */
async function getBible(n: number, cap: number, debug: string[]) {
  const r = await fetch(`https://api.getbible.net/v2/almeida/${n}/${cap}.json`, { next: { revalidate: 2592000 } }).catch((e) => { debug.push("getbible " + e.message); return null; });
  debug.push(`getbible ${r?.status}`);
  if (!r?.ok) return null;
  const j = (await r.json()) as { verses?: Verso[] };
  return j.verses?.length ? limpar(j.verses) : null;
}

async function buscar(api: string, cap: number) {
  const url = `https://bible-api.com/${encodeURIComponent(`${api} ${cap}`)}?translation=almeida`;
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    const r = await fetch(url, { headers: { "User-Agent": "EklesiaApp/1.0 (https://eklesia.international)" }, next: { revalidate: 2592000 } }).catch(() => null);
    if (r?.ok) {
      const j = (await r.json()) as { verses?: { verse: number; text: string }[] };
      if (j.verses?.length) return j.verses.map((v) => ({ verse: v.verse, text: v.text.replace(/\s+/g, " ").trim() }));
    }
    await new Promise((ok) => setTimeout(ok, 400 * (tentativa + 1)));
  }
  return null;
}

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const livro = LIVROS[Number(q.get("l"))];
  const cap = Number(q.get("c"));
  if (!livro || !Number.isInteger(cap) || cap < 1 || cap > livro.caps) return NextResponse.json({ erro: "Referência inválida." }, { status: 400 });
  const debug: string[] = [];
  const versos = (await getBible(LIVROS.indexOf(livro) + 1, cap, debug)) || (await buscar(livro.api, cap));
  if (q.has("debug")) return NextResponse.json({ debug, n: versos?.length, primeiro: versos?.[0] });
  if (!versos) return NextResponse.json({ erro: "Não foi possível carregar o capítulo agora. Tente de novo em instantes." }, { status: 502 });
  return NextResponse.json({ versos }, { headers: { "Cache-Control": "public, s-maxage=2592000, stale-while-revalidate=31536000" } });
}
