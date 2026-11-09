import { getFiscalAtual } from "@/server/auth";
import { json, naoAutenticado } from "@/server/http";
import { buscarLicencas, ErroLicenca, getLicencasRepositorio } from "@/server/licencas-service";

export const dynamic = "force-dynamic";

/** GET /api/fiscal/licencas?q=termo → alvará, processo ou endereço (máx. 20 resultados) */
export async function GET(request: Request) {
  const fiscal = await getFiscalAtual(request);
  if (!fiscal) return naoAutenticado();
  const q = new URL(request.url).searchParams.get("q") ?? "";
  try {
    return json(await buscarLicencas({ repo: getLicencasRepositorio() }, fiscal, q));
  } catch (e) {
    if (e instanceof ErroLicenca) return json({ erro: { codigo: e.codigo, mensagem: e.message } }, e.httpStatus);
    console.error(e);
    return json({ erro: { codigo: "ERRO_INTERNO", mensagem: "Erro inesperado. Tente novamente." } }, 500);
  }
}
