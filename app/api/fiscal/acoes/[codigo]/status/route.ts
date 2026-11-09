import { getRepositorio } from "@/server/acoes-repo";
import { alterarStatus } from "@/server/acoes-service";
import { getFiscalAtual } from "@/server/auth";
import { json, naoAutenticado, respostaDeErro } from "@/server/http";

export const dynamic = "force-dynamic";

/** POST /api/fiscal/acoes/{codigo}/status  body: { status, motivo_nao_realizada?, motivo_outro?, status_anterior? } */
export async function POST(request: Request, ctx: { params: Promise<{ codigo: string }> }) {
  const fiscal = await getFiscalAtual(request);
  if (!fiscal) return naoAutenticado();

  const { codigo } = await ctx.params;
  let corpo: unknown;
  try {
    corpo = await request.json();
  } catch {
    return json({ erro: { codigo: "CORPO_INVALIDO", mensagem: "Envie um JSON válido." } }, 400);
  }

  try {
    const acao = await alterarStatus({ repo: getRepositorio() }, fiscal, codigo, corpo);
    return json({ acao });
  } catch (e) {
    return respostaDeErro(e);
  }
}
