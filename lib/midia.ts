import { sb } from "./supabase";
import type { Contagem, Midia, PerfilPublico } from "./types";

const BUCKET = "midia";
const LIMITE_VIDEO = 50 * 1024 * 1024;

/** Reduz uma foto para no máximo `lado` px no maior lado e devolve JPEG. */
export async function reduzirImagem(file: File, lado = 1440): Promise<{ blob: Blob; w: number; h: number }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error("Não foi possível abrir esta foto."));
      i.src = url;
    });
    const escala = Math.min(1, lado / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * escala);
    const h = Math.round(img.naturalHeight * escala);
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    c.getContext("2d")!.drawImage(img, 0, 0, w, h);
    const blob = await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Falha ao preparar a foto."))), "image/jpeg", 0.85));
    return { blob, w, h };
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function dimensoesVideo(file: File): Promise<{ w: number; h: number }> {
  const url = URL.createObjectURL(file);
  try {
    return await new Promise((res) => {
      const v = document.createElement("video");
      v.preload = "metadata";
      v.onloadedmetadata = () => res({ w: v.videoWidth, h: v.videoHeight });
      v.onerror = () => res({ w: 1080, h: 1350 });
      v.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Envia foto (reduzida) ou vídeo para o Storage e devolve a mídia pronta para salvar. */
export async function enviarMidia(file: File, pasta: string): Promise<Midia> {
  const ehVideo = file.type.startsWith("video/");
  let corpo: Blob, w: number, h: number, ext: string, tipoConteudo: string;
  if (ehVideo) {
    if (file.size > LIMITE_VIDEO) throw new Error("Vídeo muito grande (máximo 50 MB). Grave um trecho menor.");
    ({ w, h } = await dimensoesVideo(file));
    corpo = file;
    ext = file.type === "video/quicktime" ? "mov" : file.type === "video/webm" ? "webm" : "mp4";
    tipoConteudo = file.type || "video/mp4";
  } else {
    ({ blob: corpo, w, h } = await reduzirImagem(file, pasta.startsWith("avatars") ? 480 : 1440));
    ext = "jpg";
    tipoConteudo = "image/jpeg";
  }
  const caminho = `${pasta}/${crypto.randomUUID()}.${ext}`;
  const { error } = await sb().storage.from(BUCKET).upload(caminho, corpo, { contentType: tipoConteudo, cacheControl: "31536000" });
  if (error) throw error;
  const { data } = sb().storage.from(BUCKET).getPublicUrl(caminho);
  return { url: data.publicUrl, tipo: ehVideo ? "video" : "imagem", w, h };
}

/** Apaga do Storage os arquivos destas URLs públicas (ignora falhas). */
export async function apagarArquivos(urls: (string | null | undefined)[]) {
  const marca = `/object/public/${BUCKET}/`;
  const caminhos = urls.filter(Boolean).map((u) => decodeURIComponent(u!.split(marca)[1] || "")).filter(Boolean);
  if (caminhos.length) await sb().storage.from(BUCKET).remove(caminhos).catch(() => {});
}

/** Busca nome e foto de vários perfis de uma vez. */
export async function perfisPublicos(ids: string[]): Promise<Record<string, PerfilPublico>> {
  const unicos = [...new Set(ids.filter(Boolean))];
  if (!unicos.length) return {};
  const { data } = await sb().rpc("perfis_publicos", { ids: unicos });
  return Object.fromEntries(((data as PerfilPublico[]) || []).map((p) => [p.id, p]));
}

export async function contagensPosts(ids: string[]): Promise<Record<string, Contagem>> {
  if (!ids.length) return {};
  const { data } = await sb().rpc("contagens_posts", { ids });
  return Object.fromEntries(((data as Contagem[]) || []).map((c) => [c.post_id, { ...c, amens: Number(c.amens), comentarios: Number(c.comentarios) }]));
}

/** Proporção de exibição no feed, entre 4:5 (retrato) e 1.91:1 (paisagem), como no Instagram. */
export function proporcao(m?: Midia) {
  if (!m?.w || !m?.h) return 1;
  return Math.min(1.91, Math.max(0.8, m.w / m.h));
}

export function plural(n: number, um: string, varios: string) {
  return `${n.toLocaleString("pt-BR")} ${n === 1 ? um : varios}`;
}
