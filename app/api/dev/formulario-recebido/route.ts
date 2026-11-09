import { getRepositorio } from "@/server/acoes-repo";
import { concluirPorFormulario } from "@/server/acoes-service";
import { json, respostaDeErro } from "@/server/http";

export const dynamic = "force-dynamic";

/**
 * SOMENTE DESENVOLVIMENTO. Simula o Libera Fácil recebendo o formulário de vistoria do
 * App do Fiscal (SASI) com o codigo_acao, o que conclui a ação.
 * Body: { "codigo_acao": "ACAO-2026-001245" }
 * Em produção, isso será feito pela integração real com o SASI.
 */
export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production" && process.env.LF_HABILITAR_SIMULADOR !== "1") {
    return json({ erro: { codigo: "NAO_DISPONIVEL", mensagem: "Indisponível." } }, 404);
  }
  try {
    const { codigo_acao } = (await request.json()) as { codigo_acao?: string };
    const acao = await concluirPorFormulario({ repo: getRepositorio() }, String(codigo_acao ?? ""));
    return json({ acao });
  } catch (e) {
    return respostaDeErro(e);
  }
}
