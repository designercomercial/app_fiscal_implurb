/**
 * Canais do App do Cidadão (SASI) abertos a partir do Meus Processos.
 *
 * >>> PONTO DE TROCA <<<
 * O formato do link que abre um canal com o protocolo pré-preenchido está [A DEFINIR COM A SASI].
 * Configure NEXT_PUBLIC_SASI_CIDADAO_LINK_TEMPLATE (ex.: "sasi://canal/{canal_id}?protocolo={protocolo}";
 * aceita {canal_id}, {canal} e {protocolo}) ou altere `montarLinkCanal`. Sem template, a página
 * copia o protocolo e explica onde colar. Os `id` abaixo são provisórios.
 */

export type CanalCidadao = "responder_pendencia" | "emitir_guia" | "denunciar_cobranca";

export interface DadosCanal {
  id: string;
  nome: string;
  /** Botão do app onde o canal fica, quando conhecido. */
  grupo: string | null;
}

export const CANAIS_CIDADAO: Record<CanalCidadao, DadosCanal> = {
  responder_pendencia: { id: "responder-pendencia", nome: "Responder Pendência", grupo: "Licenciamento" },
  emitir_guia: { id: "emitir-guia-de-taxas", nome: "Emitir Guia de Taxas", grupo: null },
  denunciar_cobranca: { id: "denunciar-cobranca-indevida", nome: "Denunciar Cobrança Indevida", grupo: null },
};

export const TEMPLATE_LINK_CANAL_CIDADAO: string = process.env.NEXT_PUBLIC_SASI_CIDADAO_LINK_TEMPLATE ?? "";

/** Link que abre o canal com o protocolo; null enquanto o formato não estiver definido. */
export function montarLinkCanal(
  canal: CanalCidadao,
  protocolo: string,
  template: string = TEMPLATE_LINK_CANAL_CIDADAO,
): string | null {
  if (!template.trim()) return null;
  const c = CANAIS_CIDADAO[canal];
  return template
    .replaceAll("{canal_id}", encodeURIComponent(c.id))
    .replaceAll("{canal}", encodeURIComponent(c.nome))
    .replaceAll("{protocolo}", encodeURIComponent(protocolo));
}

function ondeFica(canal: CanalCidadao): string {
  const c = CANAIS_CIDADAO[canal];
  return c.grupo ? `${c.nome}, em ${c.grupo},` : c.nome;
}

/** Ex.: "Protocolo copiado. Abra o canal Responder Pendência, em Licenciamento, e cole no primeiro campo." */
export function mensagemProtocoloCopiado(canal: CanalCidadao): string {
  return `Protocolo copiado. Abra o canal ${ondeFica(canal)} e cole no primeiro campo.`;
}

export function mensagemCopiaManualCanal(canal: CanalCidadao, protocolo: string): string {
  return `Abra o canal ${ondeFica(canal)} e digite o protocolo ${protocolo} no primeiro campo.`;
}
