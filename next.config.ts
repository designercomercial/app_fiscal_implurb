import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // O indicador flutuante do Next cobre o conteúdo na tela de 390 px.
  devIndicators: false,
  // Os testes de tela usam um build separado para não interferir no `npm run dev`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  async headers() {
    return [
      {
        // O service worker precisa ser revalidado sempre para receber atualizações.
        source: "/sw.js",
        headers: [{ key: "Cache-Control", value: "no-cache" }],
      },
    ];
  },
};

export default nextConfig;
