import type { Acao, TipoAcao } from "./acao";

/**
 * Integração com o App do Fiscal (SASI): abrir o canal de formulário certo
 * com o código da ação pré-preenchido.
 *
 * >>> PONTO DE TROCA <<<
 * O formato do link ainda está [A DEFINIR COM A SASI]. Quando estiver definido, configure
 * NEXT_PUBLIC_SASI_FORM_LINK_TEMPLATE (ex.: "sasi://canal/{canal_id}?codigo_acao={codigo}")
 * ou altere `montarLinkFormulario` abaixo. Enquanto o template for vazio, a página usa o
 * fallback: copia o código e orienta o fiscal a colar no primeiro campo do canal.
 */

export interface CanalSasi {
  /** Identificador provisório do canal no SASI (confirmar com a SASI). */
  id: string;
  /** Nome do canal como aparece no App do Fiscal. */
  nome: string;
}

export const CANAL_POR_TIPO: Record<TipoAcao, CanalSasi> = {
  vistoria_obra: { id: "vistoria-de-obra", nome: "Vistoria de Obra" },
  vistoria_habite_se: { id: "vistoria-de-habite-se", nome: "Vistoria de Habite-se" },
  atendimento_denuncia: { id: "atendimento-a-denuncia", nome: "Atendimento a Denúncia" },
  verificacao_regularizacao: {
    id: "verificacao-de-regularizacao",
    nome: "Verificação de Regularização",
  },
  vistoria_publicidade: { id: "vistoria-de-publicidade", nome: "Vistoria de Publicidade" },
};

export const TEMPLATE_LINK_FORMULARIO: string =
  process.env.NEXT_PUBLIC_SASI_FORM_LINK_TEMPLATE ?? "";

/**
 * Monta o link que abre o formulário no App do Fiscal.
 * Retorna `null` enquanto o formato não estiver definido (a página usa o fallback).
 */
export function montarLinkFormulario(
  acao: Pick<Acao, "codigo" | "tipo">,
  template: string = TEMPLATE_LINK_FORMULARIO,
): string | null {
  if (!template.trim()) return null;
  const canal = CANAL_POR_TIPO[acao.tipo];
  return template
    .replaceAll("{canal_id}", encodeURIComponent(canal.id))
    .replaceAll("{canal}", encodeURIComponent(canal.nome))
    .replaceAll("{codigo}", encodeURIComponent(acao.codigo));
}

export function mensagemCodigoCopiado(acao: Pick<Acao, "tipo">): string {
  return `Código copiado. Abra o canal ${CANAL_POR_TIPO[acao.tipo].nome} e cole no primeiro campo.`;
}

export function mensagemCopiaManual(acao: Pick<Acao, "tipo" | "codigo">): string {
  return `Não foi possível copiar. Abra o canal ${CANAL_POR_TIPO[acao.tipo].nome} e digite o código ${acao.codigo} no primeiro campo.`;
}
