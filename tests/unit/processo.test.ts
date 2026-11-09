// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  codigoDoQr,
  comQuemEsta,
  filtrarPorAba,
  formatarCodigoValidacao,
  montarLinhaDoTempo,
  normalizarProtocolo,
  ordenarProcessos,
  rotuloStatus,
  textoIndicador,
  textoPrazo,
  tomStatus,
  type StatusProcesso,
  type TipoProcesso,
} from "@/domain/processo";
import { mensagemProtocoloCopiado, montarLinkCanal } from "@/domain/canais-cidadao";

const TODOS_STATUS: StatusProcesso[] = [
  "recebido",
  "em_triagem",
  "em_analise_tecnica",
  "pendente_documentacao",
  "em_aprovacao",
  "aguardando_pagamento",
  "vistoria_agendada",
  "deferido",
  "indeferido",
  "documento_emitido",
  "arquivado",
];

describe("mapeamento de status para o cidadão", () => {
  it("texto de cada status", () => {
    const t = (s: StatusProcesso, tipo: TipoProcesso = "alvara_construcao") => rotuloStatus(s, tipo);
    expect(TODOS_STATUS.map((s) => t(s))).toEqual([
      "Recebido",
      "Em triagem",
      "Em análise técnica",
      "Pendente: aguardando você",
      "Em aprovação",
      "Aguardando pagamento",
      "Vistoria agendada",
      "Aprovado",
      "Não aprovado",
      "Alvará emitido",
      "Arquivado",
    ]);
  });

  it("documento emitido depende do tipo", () => {
    expect(rotuloStatus("documento_emitido", "alvara_demolicao")).toBe("Alvará emitido");
    expect(rotuloStatus("documento_emitido", "habite_se")).toBe("Habite-se emitido");
    expect(rotuloStatus("documento_emitido", "licenca_publicidade")).toBe("Licença emitida");
  });

  it("tom do selo segue o conjunto de status", () => {
    expect(tomStatus("pendente_documentacao")).toBe("warning");
    expect(tomStatus("aguardando_pagamento")).toBe("warning");
    expect(tomStatus("deferido")).toBe("success");
    expect(tomStatus("documento_emitido")).toBe("success");
    expect(tomStatus("indeferido")).toBe("danger");
    for (const s of ["recebido", "em_triagem", "em_analise_tecnica", "em_aprovacao", "vistoria_agendada"] as const) {
      expect(tomStatus(s)).toBe("info");
    }
  });
});

describe("indicador com quem está (critério 3)", () => {
  it("cada status tem o indicador certo", () => {
    const esperado: Record<StatusProcesso, "orgao" | "requerente" | null> = {
      recebido: "orgao",
      em_triagem: "orgao",
      em_analise_tecnica: "orgao",
      pendente_documentacao: "requerente",
      em_aprovacao: "orgao",
      aguardando_pagamento: "requerente",
      vistoria_agendada: "orgao",
      deferido: "orgao",
      indeferido: null,
      documento_emitido: null,
      arquivado: null,
    };
    for (const s of TODOS_STATUS) expect(comQuemEsta(s), s).toBe(esperado[s]);
  });

  it("textos", () => {
    expect(textoIndicador({ com_quem_esta: "orgao", dias_na_etapa: 12 })).toBe("Com o IMPLURB há 12 dias");
    expect(textoIndicador({ com_quem_esta: "orgao", dias_na_etapa: 1 })).toBe("Com o IMPLURB há 1 dia");
    expect(textoIndicador({ com_quem_esta: "orgao", dias_na_etapa: 0 })).toBe("Com o IMPLURB desde hoje");
    expect(textoIndicador({ com_quem_esta: "requerente", dias_na_etapa: 3 })).toBe("Aguardando você");
    expect(textoIndicador({ com_quem_esta: null, dias_na_etapa: 3 })).toBeNull();
  });
});

describe("abas e ordem", () => {
  const lista = TODOS_STATUS.map((status, i) => ({
    status,
    com_quem_esta: comQuemEsta(status),
    atualizado_em: `2026-11-${String(i + 1).padStart(2, "0")}T10:00:00-04:00`,
  }));
  it("concluídos = emitido, não aprovado e arquivado", () => {
    expect(filtrarPorAba(lista, "concluidos").map((p) => p.status)).toEqual(["indeferido", "documento_emitido", "arquivado"]);
    expect(filtrarPorAba(lista, "andamento")).toHaveLength(8);
    expect(filtrarPorAba(lista, "todos")).toHaveLength(11);
  });
  it("aguardando você primeiro, depois o mais recente", () => {
    expect(ordenarProcessos(lista).slice(0, 3).map((p) => p.status)).toEqual([
      "aguardando_pagamento",
      "pendente_documentacao",
      "arquivado",
    ]);
  });
});

describe("linha do tempo", () => {
  const h = (status: StatusProcesso, dia: string) => ({ status, data_hora: `2026-${dia}T10:00:00-04:00`, descricao_publica: status });

  it("concluídas com data, atual e próximas previstas", () => {
    const etapas = montarLinhaDoTempo({
      tipo: "alvara_construcao",
      status: "em_analise_tecnica",
      historico: [h("em_triagem", "10-03"), h("recebido", "10-01"), h("em_analise_tecnica", "10-10")],
    });
    expect(etapas.map((e) => [e.status, e.situacao])).toEqual([
      ["recebido", "concluida"],
      ["em_triagem", "concluida"],
      ["em_analise_tecnica", "atual"],
      ["em_aprovacao", "futura"],
      ["aguardando_pagamento", "futura"],
      ["deferido", "futura"],
      ["documento_emitido", "futura"],
    ]);
    expect(etapas[0].data_hora).toBe("2026-10-01T10:00:00-04:00");
    expect(etapas[3].data_hora).toBeNull();
  });

  it("com pendência, a etapa interrompida volta nas próximas", () => {
    const etapas = montarLinhaDoTempo({
      tipo: "alvara_reforma",
      status: "pendente_documentacao",
      historico: [h("recebido", "10-01"), h("em_analise_tecnica", "10-05"), h("pendente_documentacao", "10-20")],
    });
    expect(etapas.filter((e) => e.situacao === "futura").map((e) => e.status)[0]).toBe("em_analise_tecnica");
    expect(etapas.find((e) => e.situacao === "atual")?.rotulo).toBe("Pendente: aguardando você");
  });

  it("Habite-se tem vistoria; processo concluído não tem próximas", () => {
    const hab = montarLinhaDoTempo({ tipo: "habite_se", status: "aguardando_pagamento", historico: [h("aguardando_pagamento", "10-01")] });
    expect(hab.map((e) => e.status)).toContain("vistoria_agendada");
    const fim = montarLinhaDoTempo({ tipo: "habite_se", status: "documento_emitido", historico: [h("documento_emitido", "10-01")] });
    expect(fim.every((e) => e.situacao === "concluida")).toBe(true);
    expect(fim[0].rotulo).toBe("Habite-se emitido");
  });
});

describe("protocolo, código e prazos", () => {
  it("normaliza protocolo", () => {
    expect(normalizarProtocolo("2026.000.4587")).toBe("2026.000.4587");
    expect(normalizarProtocolo(" 20260004587 ")).toBe("2026.000.4587");
    expect(normalizarProtocolo("2026.000.458")).toBeNull();
  });
  it("código de validação e QR Code", () => {
    expect(formatarCodigoValidacao("lf7kq3m9xa2p")).toBe("LF-7KQ3-M9XA-2P");
    expect(codigoDoQr("https://liberafacil.exemplo/validar?codigo=LF-7KQ3-M9XA-2P")).toBe("LF7KQ3M9XA2P");
    expect(codigoDoQr("LF-7KQ3-M9XA-2P")).toBe("LF7KQ3M9XA2P");
    expect(codigoDoQr("https://outro.site/")).toBeNull();
  });
  it("texto do prazo", () => {
    expect(textoPrazo("2026-12-07", "2026-11-10")).toBe("faltam 27 dias");
    expect(textoPrazo("2026-11-10", "2026-11-10")).toBe("vence hoje");
    expect(textoPrazo("2026-11-07", "2026-11-10")).toBe("venceu há 3 dias");
  });
});

describe("canais do App do Cidadão", () => {
  it("sem template: copia o protocolo e explica onde colar", () => {
    expect(montarLinkCanal("responder_pendencia", "2026.000.2874", "")).toBeNull();
    expect(mensagemProtocoloCopiado("responder_pendencia")).toBe(
      "Protocolo copiado. Abra o canal Responder Pendência, em Licenciamento, e cole no primeiro campo.",
    );
  });
  it("com template: monta o link", () => {
    expect(montarLinkCanal("emitir_guia", "2026.000.1955", "sasi://canal/{canal_id}?protocolo={protocolo}")).toBe(
      "sasi://canal/emitir-guia-de-taxas?protocolo=2026.000.1955",
    );
  });
});
