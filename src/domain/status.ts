import {
  MOTIVOS_NAO_REALIZADA,
  STATUS_ACAO,
  type MotivoNaoRealizada,
  type StatusAcao,
} from "./acao";

/**
 * Regras de transição de status.
 *
 * - pendente        → em_deslocamento  ("Estou a caminho")
 * - em_deslocamento → em_execucao      ("Iniciar vistoria")
 * - em_execucao     → concluida        SOMENTE pelo sistema, ao receber o formulário do app
 * - pendente | em_deslocamento | em_execucao → nao_realizada (com motivo)
 */
export type OrigemTransicao = "pagina" | "sistema_formulario";

const TRANSICOES_PAGINA: Record<StatusAcao, readonly StatusAcao[]> = {
  pendente: ["em_deslocamento", "nao_realizada"],
  em_deslocamento: ["em_execucao", "nao_realizada"],
  em_execucao: ["nao_realizada"],
  concluida: [],
  nao_realizada: [],
};

const TRANSICOES_SISTEMA: Record<StatusAcao, readonly StatusAcao[]> = {
  pendente: [],
  em_deslocamento: [],
  em_execucao: ["concluida"],
  concluida: [],
  nao_realizada: [],
};

export const TAMANHO_MAX_MOTIVO_OUTRO = 500;

export type CodigoErroTransicao =
  | "STATUS_DESCONHECIDO"
  | "TRANSICAO_INVALIDA"
  | "CONCLUSAO_SOMENTE_PELO_FORMULARIO"
  | "MOTIVO_OBRIGATORIO"
  | "MOTIVO_INVALIDO"
  | "MOTIVO_OUTRO_OBRIGATORIO"
  | "MOTIVO_OUTRO_MUITO_LONGO";

export type ResultadoTransicao =
  | { ok: true }
  | { ok: false; codigo: CodigoErroTransicao; mensagem: string };

export interface OpcoesTransicao {
  origem?: OrigemTransicao;
  motivo_nao_realizada?: string | null;
  motivo_outro?: string | null;
}

export function ehStatus(valor: unknown): valor is StatusAcao {
  return typeof valor === "string" && (STATUS_ACAO as readonly string[]).includes(valor);
}

export function ehMotivo(valor: unknown): valor is MotivoNaoRealizada {
  return typeof valor === "string" && (MOTIVOS_NAO_REALIZADA as readonly string[]).includes(valor);
}

export function transicoesPermitidas(
  de: StatusAcao,
  origem: OrigemTransicao = "pagina",
): readonly StatusAcao[] {
  return origem === "pagina" ? TRANSICOES_PAGINA[de] : TRANSICOES_SISTEMA[de];
}

export function validarTransicao(
  de: StatusAcao,
  para: unknown,
  opcoes: OpcoesTransicao = {},
): ResultadoTransicao {
  const origem = opcoes.origem ?? "pagina";

  if (!ehStatus(para)) {
    return { ok: false, codigo: "STATUS_DESCONHECIDO", mensagem: "Status desconhecido." };
  }

  if (para === "concluida" && origem === "pagina") {
    return {
      ok: false,
      codigo: "CONCLUSAO_SOMENTE_PELO_FORMULARIO",
      mensagem:
        "A ação é concluída automaticamente quando o Libera Fácil recebe o formulário de vistoria.",
    };
  }

  if (!transicoesPermitidas(de, origem).includes(para)) {
    return {
      ok: false,
      codigo: "TRANSICAO_INVALIDA",
      mensagem: `Não é possível mudar de "${de}" para "${para}".`,
    };
  }

  if (para === "nao_realizada") {
    const motivo = opcoes.motivo_nao_realizada;
    if (motivo == null || motivo === "") {
      return { ok: false, codigo: "MOTIVO_OBRIGATORIO", mensagem: "Informe o motivo." };
    }
    if (!ehMotivo(motivo)) {
      return { ok: false, codigo: "MOTIVO_INVALIDO", mensagem: "Motivo inválido." };
    }
    if (motivo === "outro") {
      const texto = (opcoes.motivo_outro ?? "").trim();
      if (!texto) {
        return {
          ok: false,
          codigo: "MOTIVO_OUTRO_OBRIGATORIO",
          mensagem: "Descreva o motivo.",
        };
      }
      if (texto.length > TAMANHO_MAX_MOTIVO_OUTRO) {
        return {
          ok: false,
          codigo: "MOTIVO_OUTRO_MUITO_LONGO",
          mensagem: `Use no máximo ${TAMANHO_MAX_MOTIVO_OUTRO} caracteres.`,
        };
      }
    }
  }

  return { ok: true };
}

/** Ação principal da tela de detalhe, conforme o status (um único botão primário). */
export type AcaoPrincipal = "estou_a_caminho" | "iniciar_vistoria" | "abrir_formulario" | null;

export function acaoPrincipalPorStatus(status: StatusAcao): AcaoPrincipal {
  switch (status) {
    case "pendente":
      return "estou_a_caminho";
    case "em_deslocamento":
      return "iniciar_vistoria";
    case "em_execucao":
      return "abrir_formulario";
    default:
      return null;
  }
}

export function podeMarcarNaoRealizada(status: StatusAcao): boolean {
  return TRANSICOES_PAGINA[status].includes("nao_realizada");
}
