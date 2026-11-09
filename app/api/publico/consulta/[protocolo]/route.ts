import { json } from "@/server/http";
import { protegerRotaPublica, respostaErroProcesso } from "@/server/http-cidadao";
import { consultarPublico, getProcessosRepositorio } from "@/server/processos-service";

export const dynamic = "force-dynamic";

/** GET /api/publico/consulta/{protocolo} → dados mínimos, sem dados pessoais (pública) */
export async function GET(request: Request, ctx: { params: Promise<{ protocolo: string }> }) {
  const bloqueio = await protegerRotaPublica(request, "consulta");
  if (bloqueio) return bloqueio;
  const { protocolo } = await ctx.params;
  try {
    return json({ consulta: await consultarPublico({ repo: getProcessosRepositorio() }, decodeURIComponent(protocolo)) });
  } catch (e) {
    return respostaErroProcesso(e);
  }
}
