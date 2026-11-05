import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";

// Ícones PNG do app gerados a partir de public/logo.svg (no build).
const TAMANHOS: Record<string, { lado: number; margem: number }> = {
  "192.png": { lado: 192, margem: 0.1 },
  "512.png": { lado: 512, margem: 0.1 },
  "maskable-512.png": { lado: 512, margem: 0.24 },
  "apple-180.png": { lado: 180, margem: 0.1 },
  "favicon-64.png": { lado: 64, margem: 0.04 },
};

export const dynamic = "force-static";
export function generateStaticParams() {
  return Object.keys(TAMANHOS).map((tam) => ({ tam }));
}

export async function GET(_req: Request, ctx: { params: Promise<{ tam: string }> }) {
  const { tam } = await ctx.params;
  const t = TAMANHOS[tam];
  if (!t) return new Response("Não encontrado", { status: 404 });
  const svg = await readFile(path.join(process.cwd(), "public", "logo.svg"), "utf8");
  const src = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  const altura = Math.round(t.lado * (1 - 2 * t.margem));
  const largura = Math.round(altura * (496 / 800));
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: tam.startsWith("favicon") ? "transparent" : "#faf6ec" }}>
        <img src={src} width={largura} height={altura} alt="" />
      </div>
    ),
    { width: t.lado, height: t.lado }
  );
}
