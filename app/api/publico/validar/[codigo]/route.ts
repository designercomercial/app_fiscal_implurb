import { json } from "@/server/http";
import { protegerRotaPublica, respostaErroProcesso } from "@/server/http-cidadao";
import { getProcessosRepositorio, validarDocumento } from "@/server/processos-service";

export const dynamic = "force-dynamic";

/** GET /api/publico/validar/{codigo} → valido | vencido | cancelado_ou_suspenso | nao_encontrado (pública) */
export async function GET(request: Request, ctx: { params: Promise<{ codigo: string }> }) {
  const bloqueio = await protegerRotaPublica(request, "validacao");
  if (bloqueio) return bloqueio;
  const { codigo } = await ctx.params;
  try {
    return json(await validarDocumento({ repo: getProcessosRepositorio() }, decodeURIComponent(codigo)));
  } catch (e) {
    return respostaErroProcesso(e);
  }
}
