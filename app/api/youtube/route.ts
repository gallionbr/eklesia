// Vídeos do canal da Eklésia no YouTube (sem chave de API): feed RSS público do canal
// + checagem de transmissão ao vivo. Fica em cache por alguns minutos.

import { NextResponse } from "next/server";

export const revalidate = 600;

const HANDLE = process.env.YOUTUBE_HANDLE || "eklesiainternational";
const CABECALHOS = { "Accept-Language": "pt-BR,pt;q=0.9", "User-Agent": "Mozilla/5.0 (compatible; EklesiaApp/1.0)" };

export interface Video {
  id: string; titulo: string; publicado: string; capa: string; descricao: string; views: number;
  tipo: "culto" | "mensagem" | "missoes" | "louvor" | "outro";
}

const ENTIDADES: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'" };
const texto = (s = "") => s.replace(/&(amp|lt|gt|quot|#39);/g, (m) => ENTIDADES[m] || m).trim();
const tag = (xml: string, nome: string) => xml.match(new RegExp(`<${nome}[^>]*>([\\s\\S]*?)</${nome}>`))?.[1] || "";

function tipoDo(titulo: string, descricao: string): Video["tipo"] {
  const sem = (x: string) => x.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const t = sem(titulo), d = sem(descricao);
  if (/miss(ao|oes|ionari)/.test(t)) return "missoes";
  if (/ao vivo|culto|live/.test(t) || (/restream/.test(d) && !/ - /.test(titulo))) return "culto";
  if (/louvor|musica|clipe|worship|cover|cantata|ministerio de louvor/.test(t)) return "louvor";
  if (/ - |prega|ministra|palavra|mensagem|estudo|serie|congresso|conferencia|devocional/.test(t)) return "mensagem";
  return "outro";
}

async function idDoCanal(): Promise<string> {
  if (process.env.YOUTUBE_CHANNEL_ID) return process.env.YOUTUBE_CHANNEL_ID;
  for (const url of [`https://www.youtube.com/@${HANDLE}`, `https://www.youtube.com/${HANDLE}`]) {
    const r = await fetch(url, { headers: CABECALHOS, next: { revalidate: 86400 } }).catch(() => null);
    const html = r?.ok ? await r.text() : "";
    const id = html.match(/"externalId":"(UC[\w-]{22})"/)?.[1] || html.match(/youtube\.com\/channel\/(UC[\w-]{22})/)?.[1];
    if (id) return id;
  }
  throw new Error("Canal do YouTube não encontrado.");
}

async function aoVivo(canal: string): Promise<string | null> {
  const r = await fetch(`https://www.youtube.com/channel/${canal}/live`, { headers: CABECALHOS, next: { revalidate: 120 } }).catch(() => null);
  const html = r?.ok ? await r.text() : "";
  if (!/"isLiveNow":true/.test(html)) return null;
  return html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/watch\?v=([\w-]{11})"/)?.[1] || null;
}

export async function GET() {
  try {
    const canal = await idDoCanal();
    const [feed, live] = await Promise.all([
      fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${canal}`, { headers: CABECALHOS, next: { revalidate: 600 } }).then((r) => r.text()),
      aoVivo(canal),
    ]);
    const videos: Video[] = feed.split("<entry>").slice(1).map((e) => {
      const titulo = texto(tag(e, "title"));
      const descricao = texto(tag(e, "media:description"));
      return {
        id: tag(e, "yt:videoId"),
        titulo,
        publicado: tag(e, "published"),
        capa: e.match(/<media:thumbnail url="([^"]+)"/)?.[1] || "",
        descricao: descricao.slice(0, 400),
        views: Number(e.match(/<media:statistics views="(\d+)"/)?.[1] || 0),
        tipo: tipoDo(titulo, descricao),
      };
    }).filter((v) => v.id);
    return NextResponse.json({ canal, url: `https://www.youtube.com/@${HANDLE}`, aoVivo: live, videos });
  } catch (e) {
    return NextResponse.json({ erro: (e as Error).message, videos: [] }, { status: 502 });
  }
}
