import { ehDataIso, hojeManaus } from "@/domain/datas";
import { getRepositorio } from "@/server/acoes-repo";
import { listarAcoesDoDia } from "@/server/acoes-service";
import { getFiscalAtual } from "@/server/auth";
import { json, naoAutenticado, respostaDeErro } from "@/server/http";

export const dynamic = "force-dynamic";

/** GET /api/fiscal/acoes-do-dia?data=AAAA-MM-DD → ações do fiscal logado + resumo */
export async function GET(request: Request) {
  const fiscal = await getFiscalAtual(request);
  if (!fiscal) return naoAutenticado();

  const data = new URL(request.url).searchParams.get("data") ?? hojeManaus();
  if (!ehDataIso(data)) {
    return json({ erro: { codigo: "DATA_INVALIDA", mensagem: "Use a data no formato AAAA-MM-DD." } }, 400);
  }

  try {
    return json(await listarAcoesDoDia({ repo: getRepositorio() }, fiscal, data));
  } catch (e) {
    return respostaDeErro(e);
  }
}
