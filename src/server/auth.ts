/**
 * Autenticação do fiscal.
 *
 * >>> PONTO DE TROCA <<<
 * A forma de autenticação ainda está [A DEFINIR: token na URL enviado pelo SASI,
 * sessão do Libera Fácil ou SSO]. Todo o resto do código depende só de
 * `getFiscalAtual(request)`. Para trocar, substitua a implementação `autenticarMock`
 * por uma que valide o token/sessão e devolva o fiscal (ou `null` se inválido).
 *
 * Mock atual (somente desenvolvimento):
 *  - sem nada na requisição → fiscal padrão (f-001);
 *  - header `x-fiscal-id`, cookie `lf_fiscal` ou query `?fiscal=` escolhem outro fiscal;
 *  - id desconhecido → não autenticado (401).
 */

export interface FiscalAtual {
  id: string;
  nome: string;
  zona: string;
}

export const FISCAIS_MOCK: Record<string, FiscalAtual> = {
  "f-001": { id: "f-001", nome: "Carlos Mendes", zona: "Zonas Centro-Sul e Oeste" },
  "f-002": { id: "f-002", nome: "Ana Ribeiro", zona: "Zona Leste" },
};

export const FISCAL_PADRAO_MOCK = "f-001";

function lerCookie(header: string | null, nome: string): string | null {
  if (!header) return null;
  for (const parte of header.split(";")) {
    const [k, ...v] = parte.trim().split("=");
    if (k === nome) return decodeURIComponent(v.join("="));
  }
  return null;
}

async function autenticarMock(request: Request): Promise<FiscalAtual | null> {
  const url = new URL(request.url);
  const id =
    request.headers.get("x-fiscal-id") ??
    lerCookie(request.headers.get("cookie"), "lf_fiscal") ??
    url.searchParams.get("fiscal") ??
    FISCAL_PADRAO_MOCK;
  return FISCAIS_MOCK[id] ?? null;
}

export async function getFiscalAtual(request: Request): Promise<FiscalAtual | null> {
  return autenticarMock(request);
}
