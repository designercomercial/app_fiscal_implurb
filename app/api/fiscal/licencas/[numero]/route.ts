import { getFiscalAtual } from "@/server/auth";
import { json, naoAutenticado } from "@/server/http";
import { ErroLicenca, getLicencasRepositorio, obterLicenca } from "@/server/licencas-service";

export const dynamic = "force-dynamic";

/** GET /api/fiscal/licencas/{numero} → detalhe por número de alvará ou de processo */
export async function GET(request: Request, ctx: { params: Promise<{ numero: string }> }) {
  const fiscal = await getFiscalAtual(request);
  if (!fiscal) return naoAutenticado();
  const { numero } = await ctx.params;
  try {
    return json({ licenca: await obterLicenca({ repo: getLicencasRepositorio() }, fiscal, decodeURIComponent(numero)) });
  } catch (e) {
    if (e instanceof ErroLicenca) return json({ erro: { codigo: e.codigo, mensagem: e.message } }, e.httpStatus);
    console.error(e);
    return json({ erro: { codigo: "ERRO_INTERNO", mensagem: "Erro inesperado. Tente novamente." } }, 500);
  }
}
