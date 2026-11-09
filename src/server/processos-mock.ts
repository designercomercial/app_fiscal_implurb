import { somarDias } from "@/domain/datas";
import type { EventoHistorico, Guia, Papel, Pendencia, StatusProcesso, TipoProcesso } from "@/domain/processo";

/**
 * Dados mock de processos em Manaus. Datas relativas a "hoje", para que os indicadores
 * ("Com o IMPLURB há 12 dias", prazos e validades) façam sentido em qualquer dia.
 *
 * Maria (c-001) tem 5 processos:
 *  1. em análise técnica;
 *  2. com pendência aberta;
 *  3. aguardando pagamento;
 *  4. com alvará emitido;
 *  5. aberto pelo despachante José (c-002), com Maria como proprietária.
 * Os demais são de outro cidadão (Raimundo, c-004) e servem para testar o isolamento
 * e os resultados da validação (vencido, cancelado e suspenso).
 */

export interface ParticipanteInterno {
  /** null: pessoa sem conta no app (aparece na lista, mas não acessa). */
  cidadao_id: string | null;
  nome: string;
  papel: Papel;
  /** CPF/CNPJ completo: nunca sai do servidor. */
  documento: string;
}

export interface DocumentoInterno {
  tipo: string;
  numero: string;
  emitido_em: string;
  validade: string | null;
  codigo_validacao: string;
  situacao_cadastro: "ativo" | "cancelado" | "suspenso";
}

export interface ProcessoInterno {
  protocolo: string;
  tipo: TipoProcesso;
  endereco_obra: string;
  bairro_obra: string;
  status: StatusProcesso;
  setor_atual: string;
  prazo_etapa_dias: number;
  aberto_por_id: string;
  participantes: ParticipanteInterno[];
  historico: EventoHistorico[];
  pendencias: Pendencia[];
  guias: Guia[];
  documentos: DocumentoInterno[];
}

const MARIA: ParticipanteInterno = { cidadao_id: "c-001", nome: "Maria das Graças Souza", papel: "proprietario", documento: "52398714620" };
const JOSE: ParticipanteInterno = { cidadao_id: "c-002", nome: "José Carlos Ferreira", papel: "despachante", documento: "70145236988" };
const ANA: ParticipanteInterno = { cidadao_id: "c-003", nome: "Ana Paula Moraes", papel: "responsavel_tecnico", documento: "41523698710" };
const RAIMUNDO: ParticipanteInterno = { cidadao_id: "c-004", nome: "Raimundo Nonato Lima", papel: "proprietario", documento: "63258741955" };

export function gerarProcessosMock(hoje: string): ProcessoInterno[] {
  const ano = Number(hoje.slice(0, 4));
  const em = (dias: number, hora: string) => `${somarDias(hoje, dias)}T${hora}:00-04:00`;
  const ev = (status: StatusProcesso, dias: number, hora: string, descricao_publica: string): EventoHistorico => ({
    status,
    data_hora: em(dias, hora),
    descricao_publica,
  });

  return [
    {
      protocolo: `${ano}.000.3120`,
      tipo: "alvara_construcao",
      endereco_obra: "Rua Teresina, 250",
      bairro_obra: "Adrianópolis",
      status: "em_analise_tecnica",
      setor_atual: "Análise de projetos",
      prazo_etapa_dias: 30,
      aberto_por_id: "c-001",
      participantes: [MARIA, ANA],
      historico: [
        ev("recebido", -20, "09:12", "Pedido recebido pelo app."),
        ev("em_triagem", -18, "10:40", "Documentos conferidos pela equipe de atendimento."),
        ev("em_analise_tecnica", -12, "14:05", "Projeto encaminhado para análise técnica."),
      ],
      pendencias: [],
      guias: [{ descricao: "Taxa de análise de projeto", valor: 312.4, vencimento: somarDias(hoje, -15), situacao: "paga" }],
      documentos: [],
    },
    {
      protocolo: `${ano}.000.2874`,
      tipo: "alvara_reforma",
      endereco_obra: "Rua Rio Içá, 89",
      bairro_obra: "Parque 10 de Novembro",
      status: "pendente_documentacao",
      setor_atual: "Análise de projetos",
      prazo_etapa_dias: 30,
      aberto_por_id: "c-001",
      participantes: [MARIA, { cidadao_id: null, nome: "Pedro Henrique Lima", papel: "responsavel_tecnico", documento: "32165498700" }],
      historico: [
        ev("recebido", -40, "08:30", "Pedido recebido pelo app."),
        ev("em_triagem", -38, "11:00", "Documentos conferidos pela equipe de atendimento."),
        ev("em_analise_tecnica", -30, "09:45", "Projeto encaminhado para análise técnica."),
        ev("pendente_documentacao", -3, "16:20", "A análise encontrou um documento faltando. Veja a pendência."),
      ],
      pendencias: [
        {
          id: "PEN-2874-2",
          texto:
            "Apresentar a ART (Anotação de Responsabilidade Técnica) de execução da reforma, assinada pelo responsável técnico e pelo proprietário, com o comprovante de pagamento ao CREA-AM.",
          emitida_em: em(-3, "16:20"),
          prazo_resposta: somarDias(hoje, 27),
          situacao: "aberta",
        },
        {
          id: "PEN-2874-1",
          texto: "Enviar a planta de situação com as medidas do lote.",
          emitida_em: em(-36, "10:00"),
          prazo_resposta: somarDias(hoje, -6),
          situacao: "atendida",
        },
      ],
      guias: [{ descricao: "Taxa de análise de projeto", valor: 198.75, vencimento: somarDias(hoje, -35), situacao: "paga" }],
      documentos: [],
    },
    {
      protocolo: `${ano}.000.1955`,
      tipo: "habite_se",
      endereco_obra: "Rua Salvador, 410",
      bairro_obra: "Adrianópolis",
      status: "aguardando_pagamento",
      setor_atual: "Arrecadação",
      prazo_etapa_dias: 10,
      aberto_por_id: "c-001",
      participantes: [MARIA, ANA],
      historico: [
        ev("recebido", -35, "09:00", "Pedido recebido pelo app."),
        ev("em_triagem", -33, "13:30", "Documentos conferidos pela equipe de atendimento."),
        ev("em_analise_tecnica", -25, "10:15", "Documentação da obra concluída em análise."),
        ev("em_aprovacao", -9, "15:00", "Análise concluída. Encaminhado para aprovação."),
        ev("aguardando_pagamento", -2, "11:10", "Guia da taxa de Habite-se emitida. Pague para seguir para a vistoria."),
      ],
      pendencias: [],
      guias: [
        { descricao: "Taxa de Habite-se", valor: 1248.36, vencimento: somarDias(hoje, 8), situacao: "em_aberto" },
        { descricao: "Taxa de expediente", valor: 42.5, vencimento: somarDias(hoje, -30), situacao: "paga" },
      ],
      documentos: [],
    },
    {
      protocolo: `${ano}.000.0731`,
      tipo: "alvara_ampliacao",
      endereco_obra: "Rua Recife, 1520",
      bairro_obra: "Parque 10 de Novembro",
      status: "documento_emitido",
      setor_atual: "Concluído",
      prazo_etapa_dias: 0,
      aberto_por_id: "c-001",
      participantes: [MARIA, ANA],
      historico: [
        ev("recebido", -95, "08:50", "Pedido recebido pelo app."),
        ev("em_triagem", -93, "10:20", "Documentos conferidos pela equipe de atendimento."),
        ev("em_analise_tecnica", -85, "09:30", "Projeto encaminhado para análise técnica."),
        ev("em_aprovacao", -60, "14:40", "Análise concluída. Encaminhado para aprovação."),
        ev("aguardando_pagamento", -55, "09:05", "Guia da taxa de licença emitida."),
        ev("deferido", -50, "16:00", "Pedido aprovado."),
        ev("documento_emitido", -49, "10:30", "Alvará emitido. Baixe o PDF nesta página."),
      ],
      pendencias: [],
      guias: [{ descricao: "Taxa de licença para construir", valor: 864.9, vencimento: somarDias(hoje, -52), situacao: "paga" }],
      documentos: [
        {
          tipo: "Alvará de ampliação",
          numero: `ALV-${ano}-00731`,
          emitido_em: em(-49, "10:30"),
          validade: somarDias(hoje, 681),
          codigo_validacao: "LF7KQ3M9XA2P",
          situacao_cadastro: "ativo",
        },
      ],
    },
    {
      protocolo: `${ano}.000.4012`,
      tipo: "alvara_reforma_ampliacao",
      endereco_obra: "Av. Constantino Nery, 3300",
      bairro_obra: "Chapada",
      status: "em_aprovacao",
      setor_atual: "Diretoria de licenciamento",
      prazo_etapa_dias: 15,
      aberto_por_id: "c-002",
      participantes: [
        MARIA,
        JOSE,
        { cidadao_id: null, nome: "Carlos Eduardo Nunes", papel: "responsavel_tecnico", documento: "96385274100" },
      ],
      historico: [
        ev("recebido", -28, "10:05", "Pedido recebido pelo app. Entrada feita pelo despachante José Carlos Ferreira."),
        ev("em_triagem", -26, "09:40", "Documentos conferidos pela equipe de atendimento."),
        ev("em_analise_tecnica", -20, "11:25", "Projeto encaminhado para análise técnica."),
        ev("em_aprovacao", -4, "15:50", "Análise concluída sem pendências. Encaminhado para aprovação."),
      ],
      pendencias: [],
      guias: [{ descricao: "Taxa de análise de projeto", valor: 455.0, vencimento: somarDias(hoje, -25), situacao: "paga" }],
      documentos: [],
    },

    /* ---------- Processos de outro cidadão (Raimundo): Maria não pode ver ---------- */
    {
      protocolo: `${ano}.000.4388`,
      tipo: "alvara_construcao",
      endereco_obra: "Av. Grande Circular, 2100",
      bairro_obra: "São José Operário",
      status: "recebido",
      setor_atual: "Atendimento",
      prazo_etapa_dias: 5,
      aberto_por_id: "c-002",
      participantes: [RAIMUNDO, JOSE],
      historico: [ev("recebido", -1, "17:10", "Pedido recebido pelo app. Entrada feita pelo despachante José Carlos Ferreira.")],
      pendencias: [],
      guias: [],
      documentos: [],
    },
    {
      protocolo: `${ano - 2}.000.1187`,
      tipo: "alvara_reforma",
      endereco_obra: "Rua Ajuricaba, 77",
      bairro_obra: "Cachoeirinha",
      status: "documento_emitido",
      setor_atual: "Concluído",
      prazo_etapa_dias: 0,
      aberto_por_id: "c-004",
      participantes: [RAIMUNDO, { cidadao_id: null, nome: "Francisco Alves Pereira", papel: "responsavel_tecnico", documento: "14725836900" }],
      historico: [
        ev("recebido", -760, "09:00", "Pedido recebido pelo app."),
        ev("deferido", -735, "15:00", "Pedido aprovado."),
        ev("documento_emitido", -734, "10:00", "Alvará emitido."),
      ],
      pendencias: [],
      guias: [{ descricao: "Taxa de licença para reformar", valor: 380.0, vencimento: somarDias(hoje, -740), situacao: "paga" }],
      documentos: [
        {
          tipo: "Alvará de reforma",
          numero: `ALV-${ano - 2}-01187`,
          emitido_em: em(-734, "10:00"),
          validade: somarDias(hoje, -38),
          codigo_validacao: "LF3MPX8RTD4K",
          situacao_cadastro: "ativo",
        },
      ],
    },
    {
      protocolo: `${ano - 1}.000.0558`,
      tipo: "alvara_construcao",
      endereco_obra: "Rua Jonathas Pedrosa, 640",
      bairro_obra: "Praça 14 de Janeiro",
      status: "documento_emitido",
      setor_atual: "Concluído",
      prazo_etapa_dias: 0,
      aberto_por_id: "c-004",
      participantes: [RAIMUNDO, { cidadao_id: null, nome: "Francisco Alves Pereira", papel: "responsavel_tecnico", documento: "14725836900" }],
      historico: [
        ev("recebido", -400, "09:00", "Pedido recebido pelo app."),
        ev("deferido", -370, "15:00", "Pedido aprovado."),
        ev("documento_emitido", -369, "10:00", "Alvará emitido."),
      ],
      pendencias: [],
      guias: [],
      documentos: [
        {
          tipo: "Alvará de construção",
          numero: `ALV-${ano - 1}-00558`,
          emitido_em: em(-369, "10:00"),
          validade: somarDias(hoje, 360),
          codigo_validacao: "LF9ZQW2HNB6C",
          situacao_cadastro: "cancelado",
        },
      ],
    },
    {
      protocolo: `${ano}.000.0612`,
      tipo: "licenca_publicidade",
      endereco_obra: "Av. Torquato Tapajós, 5400",
      bairro_obra: "Flores",
      status: "documento_emitido",
      setor_atual: "Concluído",
      prazo_etapa_dias: 0,
      aberto_por_id: "c-004",
      participantes: [RAIMUNDO],
      historico: [
        ev("recebido", -150, "09:00", "Pedido recebido pelo app."),
        ev("deferido", -130, "15:00", "Pedido aprovado."),
        ev("documento_emitido", -129, "10:00", "Licença emitida."),
      ],
      pendencias: [],
      guias: [],
      documentos: [
        {
          tipo: "Licença de publicidade",
          numero: `LIC-${ano}-00612`,
          emitido_em: em(-129, "10:00"),
          validade: somarDias(hoje, 236),
          codigo_validacao: "LF5TVA7JKE3R",
          situacao_cadastro: "suspenso",
        },
      ],
    },
  ];
}
