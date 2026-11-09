/**
 * Autenticação do cidadão (App do Cidadão → Acompanhar Meus Processos).
 *
 * >>> PONTO DE TROCA <<<
 * A forma de login está [A DEFINIR: token enviado pelo SASI, sessão do Libera Fácil ou gov.br].
 * Todo o resto do código depende só de `getCidadaoAtual(request)`. Troque `autenticarMock`
 * por uma implementação que valide o token/sessão e devolva o cidadão (ou `null` → 401).
 * O vínculo com os processos é pelo `id` (no real, provavelmente o CPF/CNPJ validado).
 *
 * Mock (somente desenvolvimento):
 *  - sem nada na requisição → c-001 (Maria, proprietária);
 *  - header `x-cidadao-id`, cookie `lf_cidadao` ou query `?cidadao=` escolhem outro;
 *  - id desconhecido → não autenticado (401).
 */

export interface CidadaoAtual {
  id: string;
  nome: string;
}

export const CIDADAOS_MOCK: Record<string, CidadaoAtual & { documento: string }> = {
  "c-001": { id: "c-001", nome: "Maria das Graças Souza", documento: "52398714620" },
  "c-002": { id: "c-002", nome: "José Carlos Ferreira", documento: "70145236988" },
  "c-003": { id: "c-003", nome: "Ana Paula Moraes", documento: "41523698710" },
  "c-004": { id: "c-004", nome: "Raimundo Nonato Lima", documento: "63258741955" },
  "c-005": { id: "c-005", nome: "Lúcia Andrade", documento: "85214796301" },
};

export const CIDADAO_PADRAO_MOCK = "c-001";

function lerCookie(header: string | null, nome: string): string | null {
  if (!header) return null;
  for (const parte of header.split(";")) {
    const [k, ...v] = parte.trim().split("=");
    if (k === nome) return decodeURIComponent(v.join("="));
  }
  return null;
}

async function autenticarMock(request: Request): Promise<CidadaoAtual | null> {
  const url = new URL(request.url);
  const id =
    request.headers.get("x-cidadao-id") ??
    lerCookie(request.headers.get("cookie"), "lf_cidadao") ??
    url.searchParams.get("cidadao") ??
    CIDADAO_PADRAO_MOCK;
  const c = CIDADAOS_MOCK[id];
  return c ? { id: c.id, nome: c.nome } : null;
}

export async function getCidadaoAtual(request: Request): Promise<CidadaoAtual | null> {
  return autenticarMock(request);
}
