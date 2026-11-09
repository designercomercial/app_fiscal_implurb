import type { Acao, MotivoNaoRealizada, StatusAcao } from "@/domain/acao";
import type { OrigemTransicao } from "@/domain/status";

/** Ação como guardada no back-end. Campos internos nunca vão para a página. */
export interface AcaoInterna extends Acao {
  fiscal_id: string;
  /** Dia em que a ação está programada para o fiscal (AAAA-MM-DD). */
  data_programada: string;
}

/** Trilha de auditoria: toda mudança de status registra data, hora e usuário. */
export interface RegistroAuditoria {
  codigo_acao: string;
  de: StatusAcao;
  para: StatusAcao;
  motivo_nao_realizada?: MotivoNaoRealizada | null;
  motivo_outro?: string | null;
  usuario_id: string;
  origem: OrigemTransicao;
  /** ISO 8601 */
  em: string;
}

export function paraAcaoPublica(a: AcaoInterna): Acao {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { fiscal_id, data_programada, ...publica } = a;
  return publica;
}
