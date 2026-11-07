import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  // QR Codes do dízimo: HTTPS://EKLESIA.INTERNATIONAL/D/LED → rota app/qr (conta o scan e
  // abre o WhatsApp da igreja). Maiúsculas deixam o QR menor; minúsculas também funcionam.
  async rewrites() {
    return [
      { source: "/D", destination: "/qr" },
      { source: "/D/:codigo", destination: "/qr/:codigo" },
      { source: "/d", destination: "/qr" },
      { source: "/d/:codigo", destination: "/qr/:codigo" },
    ];
  },
};

export default config;
