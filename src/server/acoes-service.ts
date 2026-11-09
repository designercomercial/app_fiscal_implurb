import {
  calcularResumo,
  CODIGO_ACAO_REGEX,
  type Acao,
  type RespostaAcoesDoDia,
  type StatusAcao,
} from "@/domain/acao";
import { agoraIsoManaus } from "@/domain/datas";
import { ehStatus, validarTransicao, type CodigoErroTransicao } from "@/domain/status";
import type { AcoesRepositorio } from "./acoes-repo";
import type { FiscalAtual } from "./auth";
import { reagendarParaDiaSeguinte, type ReagendadorNaoRealizada } from "./fila";
import { paraAcaoPublica, type AcaoInterna } from "./tipos";

export type CodigoErroServico =
  | CodigoErroTransicao
  | "CORPO_INVALIDO"
  | "ACAO_NAO_ENCONTRADA"
  | "CONFLITO_STATUS";

export class ErroServico extends Error {
  constructor(
    public readonly httpStatus: number,
    public readonly codigo: CodigoErroServico,
    mensagem: string,
    public readonly acaoAtual?: Acao,
  ) {
    super(mensagem);
  }
}

const HTTP_POR_ERRO_TRANSICAO: Record<CodigoErroTransicao, number> = {
  STATUS_DESCONHECIDO: 400,
  MOTIVO_OBRIGATORIO: 400,
  MOTIVO_INVALIDO: 400,
  MOTIVO_OUTRO_OBRIGATORIO: 400,
  MOTIVO_OUTRO_MUITO_LONGO: 400,
  TRANSICAO_INVALIDA: 409,
  CONCLUSAO_SOMENTE_PELO_FORMULARIO: 409,
};

export interface DependenciasServico {
  repo: AcoesRepositorio;
  agora?: () => Date;
  reagendar?: ReagendadorNaoRealizada;
}

export async function listarAcoesDoDia(
  deps: DependenciasServico,
  fiscal: FiscalAtual,
  data: string,
): Promise<RespostaAcoesDoDia> {
  // O filtro pelo fiscal é feito AQUI, no back-end: a página nunca recebe ações de outros.
  const acoes = (await deps.repo.listarPorFiscalEData(fiscal.id, data)).map(paraAcaoPublica);
  return {
    fiscal: { nome: fiscal.nome, zona: fiscal.zona },
    data,
    resumo: calcularResumo(acoes),
    acoes,
    gerado_em: agoraIsoManaus(deps.agora?.() ?? new Date()),
  };
}

export async function alterarStatus(
  deps: DependenciasServico,
  fiscal: FiscalAtual,
  codigo: string,
  corpo: unknown,
): Promise<Acao> {
  if (!CODIGO_ACAO_REGEX.test(codigo)) {
    throw new ErroServico(404, "ACAO_NAO_ENCONTRADA", "Ação não encontrada.");
  }
  if (typeof corpo !== "object" || corpo === null || Array.isArray(corpo)) {
    throw new ErroServico(400, "CORPO_INVALIDO", "Corpo da requisição inválido.");
  }
  const { status, motivo_nao_realizada, motivo_outro, status_anterior } = corpo as Record<
    string,
    unknown
  >;
  if (motivo_outro != null && typeof motivo_outro !== "string") {
    throw new ErroServico(400, "CORPO_INVALIDO", "motivo_outro deve ser texto.");
  }

  const acao = await deps.repo.buscar(codigo);
  // Ação de outro fiscal responde igual a inexistente: não revela que ela existe.
  if (!acao || acao.fiscal_id !== fiscal.id) {
    throw new ErroServico(404, "ACAO_NAO_ENCONTRADA", "Ação não encontrada.");
  }

  if (status_anterior !== undefined && ehStatus(status_anterior) && status_anterior !== acao.status) {
    throw new ErroServico(
      409,
      "CONFLITO_STATUS",
      "O status desta ação mudou desde a última atualização.",
      paraAcaoPublica(acao),
    );
  }

  const r = validarTransicao(acao.status, status, {
    origem: "pagina",
    motivo_nao_realizada: motivo_nao_realizada as string | undefined,
    motivo_outro: motivo_outro as string | undefined,
  });
  if (!r.ok) {
    throw new ErroServico(HTTP_POR_ERRO_TRANSICAO[r.codigo], r.codigo, r.mensagem, paraAcaoPublica(acao));
  }

  return aplicarTransicao(deps, acao, status as StatusAcao, fiscal.id, "pagina", {
    motivo_nao_realizada: status === "nao_realizada" ? (motivo_nao_realizada as Acao["motivo_nao_realizada"]) : null,
    motivo_outro:
      status === "nao_realizada" && motivo_nao_realizada === "outro"
        ? (motivo_outro as string).trim()
        : null,
  });
}

/**
 * Chamado pela integração quando o Libera Fácil recebe o formulário do App do Fiscal
 * com o mesmo codigo_acao. É o ÚNICO caminho para "concluida".
 */
export async function concluirPorFormulario(
  deps: DependenciasServico,
  codigo: string,
  usuarioSistema = "integracao-sasi",
): Promise<Acao> {
  const acao = await deps.repo.buscar(codigo);
  if (!acao) throw new ErroServico(404, "ACAO_NAO_ENCONTRADA", "Ação não encontrada.");
  const r = validarTransicao(acao.status, "concluida", { origem: "sistema_formulario" });
  if (!r.ok) throw new ErroServico(HTTP_POR_ERRO_TRANSICAO[r.codigo], r.codigo, r.mensagem);
  return aplicarTransicao(deps, acao, "concluida", usuarioSistema, "sistema_formulario", {});
}

async function aplicarTransicao(
  deps: DependenciasServico,
  acao: AcaoInterna,
  para: StatusAcao,
  usuarioId: string,
  origem: "pagina" | "sistema_formulario",
  extras: Pick<Acao, "motivo_nao_realizada" | "motivo_outro">,
): Promise<Acao> {
  const agora = agoraIsoManaus(deps.agora?.() ?? new Date());
  const de = acao.status;
  const atualizada = {
    ...acao,
    status: para,
    motivo_nao_realizada: extras.motivo_nao_realizada ?? null,
    motivo_outro: extras.motivo_outro ?? null,
    atualizado_em: agora,
  };
  await deps.repo.salvar(atualizada);
  await deps.repo.registrarAuditoria({
    codigo_acao: acao.codigo,
    de,
    para,
    motivo_nao_realizada: atualizada.motivo_nao_realizada,
    motivo_outro: atualizada.motivo_outro,
    usuario_id: usuarioId,
    origem,
    em: agora,
  });
  if (para === "nao_realizada") {
    await (deps.reagendar ?? reagendarParaDiaSeguinte)(atualizada);
  }
  return paraAcaoPublica(atualizada);
}
