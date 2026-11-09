import { getCidadaoAtual } from "@/server/auth-cidadao";
import { json } from "@/server/http";
import { cidadaoNaoAutenticado, respostaErroProcesso } from "@/server/http-cidadao";
import { getProcessosRepositorio, listarMeusProcessos } from "@/server/processos-service";

export const dynamic = "force-dynamic";

/** GET /api/cidadao/processos → processos em que o cidadão logado é participante */
export async function GET(request: Request) {
  const cidadao = await getCidadaoAtual(request);
  if (!cidadao) return cidadaoNaoAutenticado();
  try {
    return json(await listarMeusProcessos({ repo: getProcessosRepositorio() }, cidadao));
  } catch (e) {
    return respostaErroProcesso(e);
  }
}
