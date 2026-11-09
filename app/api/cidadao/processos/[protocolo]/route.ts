import { getCidadaoAtual } from "@/server/auth-cidadao";
import { json } from "@/server/http";
import { cidadaoNaoAutenticado, respostaErroProcesso } from "@/server/http-cidadao";
import { getProcessosRepositorio, obterMeuProcesso } from "@/server/processos-service";

export const dynamic = "force-dynamic";

/** GET /api/cidadao/processos/{protocolo} → detalhe, só para participantes (outros: 404) */
export async function GET(request: Request, ctx: { params: Promise<{ protocolo: string }> }) {
  const cidadao = await getCidadaoAtual(request);
  if (!cidadao) return cidadaoNaoAutenticado();
  const { protocolo } = await ctx.params;
  try {
    const processo = await obterMeuProcesso({ repo: getProcessosRepositorio() }, cidadao, decodeURIComponent(protocolo));
    return json({ processo });
  } catch (e) {
    return respostaErroProcesso(e);
  }
}
