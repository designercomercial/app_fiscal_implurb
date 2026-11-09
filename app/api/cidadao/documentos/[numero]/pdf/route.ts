import { dataHoraManaus } from "@/domain/datas";
import { formatarCodigoValidacao } from "@/domain/processo";
import { getCidadaoAtual } from "@/server/auth-cidadao";
import { cidadaoNaoAutenticado, respostaErroProcesso } from "@/server/http-cidadao";
import { gerarPdfTexto } from "@/server/pdf-documento";
import { getProcessosRepositorio, obterDocumentoDoParticipante } from "@/server/processos-service";

export const dynamic = "force-dynamic";

/** Endereço público do Libera Fácil impresso no documento (QR Code). Ver README. */
function urlBase(request: Request): string {
  return (process.env.NEXT_PUBLIC_LIBERA_FACIL_URL || new URL(request.url).origin).replace(/\/$/, "");
}

const dataBr = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");

/** GET /api/cidadao/documentos/{numero}/pdf → PDF do documento, só para participantes */
export async function GET(request: Request, ctx: { params: Promise<{ numero: string }> }) {
  const cidadao = await getCidadaoAtual(request);
  if (!cidadao) return cidadaoNaoAutenticado();
  const { numero } = await ctx.params;
  try {
    const { documento: d, processo: p, responsavel } = await obterDocumentoDoParticipante(
      { repo: getProcessosRepositorio() },
      cidadao,
      decodeURIComponent(numero),
    );
    const pdf = gerarPdfTexto([
      { texto: "IMPLURB - Instituto Municipal de Planejamento Urbano de Manaus", tamanho: 10 },
      { texto: d.tipo, tamanho: 20, espaco: 40 },
      { texto: `Número: ${d.numero}`, espaco: 32 },
      { texto: `Processo: ${p.protocolo}` },
      { texto: `Endereço da obra: ${p.endereco_obra}, ${p.bairro_obra}, Manaus/AM` },
      { texto: `Responsável técnico: ${responsavel}` },
      { texto: `Emitido em: ${dataHoraManaus(d.emitido_em)}` },
      { texto: `Validade: ${d.validade ? dataBr(d.validade) : "sem prazo de validade"}` },
      { texto: `Código de validação: ${formatarCodigoValidacao(d.codigo_validacao)}`, espaco: 32 },
      { texto: `Confira a autenticidade em ${urlBase(request)}/validar?codigo=${d.codigo_validacao}` },
      { texto: "DOCUMENTO DE DEMONSTRAÇÃO - sem valor legal.", tamanho: 9, espaco: 40 },
    ]);
    return new Response(pdf as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${d.numero}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return respostaErroProcesso(e);
  }
}
