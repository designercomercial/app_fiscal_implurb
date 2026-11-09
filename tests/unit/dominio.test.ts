import { describe, expect, it } from "vitest";
import { calcularResumo } from "@/domain/acao";
import { dataPorExtenso, ehDataIso, hojeManaus, somarDias } from "@/domain/datas";
import { filtrarPorAba, ordenar } from "@/domain/lista";
import { situacaoPrazo, situacaoPrazoDaAcao } from "@/domain/prazo";
import { CANAL_POR_TIPO, mensagemCodigoCopiado, montarLinkFormulario } from "@/domain/formulario-sasi";
import { linkGoogleMaps, linkWaze } from "@/domain/mapas";
import { acaoFake, HOJE } from "./fixtures";

describe("datas", () => {
  it("escreve a data por extenso em sentence case", () => {
    expect(dataPorExtenso("2026-11-10")).toBe("Terça-feira, 10 de novembro");
    expect(dataPorExtenso("2026-11-09")).toBe("Segunda-feira, 9 de novembro");
  });
  it("usa o fuso de Manaus para 'hoje'", () => {
    // 02:30 UTC do dia 11 ainda é dia 10 em Manaus (UTC-4)
    expect(hojeManaus(new Date("2026-11-11T02:30:00Z"))).toBe("2026-11-10");
  });
  it("valida datas AAAA-MM-DD", () => {
    expect(ehDataIso("2026-11-10")).toBe(true);
    expect(ehDataIso("2026-02-30")).toBe(false);
    expect(ehDataIso("10/11/2026")).toBe(false);
    expect(somarDias("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("prazo", () => {
  it("classifica atrasada, vence hoje e no prazo", () => {
    expect(situacaoPrazo("2026-11-08", HOJE)).toBe("atrasada");
    expect(situacaoPrazo(HOJE, HOJE)).toBe("vence_hoje");
    expect(situacaoPrazo("2026-11-12", HOJE)).toBe("no_prazo");
  });
  it("não alerta prazo de ação encerrada", () => {
    expect(situacaoPrazoDaAcao({ prazo: "2026-11-01", status: "concluida" }, HOJE)).toBe("no_prazo");
  });
});

describe("resumo, filtros e ordenação", () => {
  const lista = [
    acaoFake({ codigo: "ACAO-2026-000001", prioridade: "baixa", ordem_rota: 1 }),
    acaoFake({ codigo: "ACAO-2026-000002", prioridade: "alta", prazo: "2026-11-12", ordem_rota: 4 }),
    acaoFake({ codigo: "ACAO-2026-000003", prioridade: "alta", prazo: "2026-11-08", ordem_rota: 3 }),
    acaoFake({ codigo: "ACAO-2026-000004", prioridade: "media", status: "em_deslocamento", ordem_rota: 2 }),
    acaoFake({ codigo: "ACAO-2026-000005", status: "concluida", ordem_rota: 5 }),
    acaoFake({ codigo: "ACAO-2026-000006", status: "nao_realizada", ordem_rota: 6 }),
  ];
  const fim = (codigos: { codigo: string }[]) => codigos.map((a) => a.codigo.slice(-1));

  it("calcula o resumo do dia", () => {
    expect(calcularResumo(lista)).toEqual({ total: 6, concluidas: 1, pendentes: 4, nao_realizadas: 1 });
  });

  it("filtra por aba", () => {
    expect(fim(filtrarPorAba(lista, "pendentes"))).toEqual(["1", "2", "3", "4"]);
    expect(fim(filtrarPorAba(lista, "concluidas"))).toEqual(["5"]);
    expect(filtrarPorAba(lista, "todas")).toHaveLength(6);
  });

  it("ordena por prioridade: em andamento, prioridade, atraso, prazo", () => {
    expect(fim(ordenar(filtrarPorAba(lista, "pendentes"), "prioridade", HOJE))).toEqual(["4", "3", "2", "1"]);
  });

  it("ordena por rota", () => {
    expect(ordenar(lista, "rota", HOJE).map((a) => a.ordem_rota)).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

describe("link do formulário SASI", () => {
  it("retorna null enquanto o formato não estiver definido (usa o fallback)", () => {
    expect(montarLinkFormulario(acaoFake(), "")).toBeNull();
  });
  it("monta o link a partir do template", () => {
    const link = montarLinkFormulario(
      acaoFake({ tipo: "vistoria_habite_se" }),
      "sasi://canal/{canal_id}?codigo_acao={codigo}",
    );
    expect(link).toBe("sasi://canal/vistoria-de-habite-se?codigo_acao=ACAO-2026-001245");
  });
  it("mapeia cada tipo para o canal certo", () => {
    expect(CANAL_POR_TIPO.vistoria_obra.nome).toBe("Vistoria de Obra");
    expect(CANAL_POR_TIPO.vistoria_habite_se.nome).toBe("Vistoria de Habite-se");
    expect(CANAL_POR_TIPO.atendimento_denuncia.nome).toBe("Atendimento a Denúncia");
    expect(CANAL_POR_TIPO.verificacao_regularizacao.nome).toBe("Verificação de Regularização");
    expect(CANAL_POR_TIPO.vistoria_publicidade.nome).toBe("Vistoria de Publicidade");
  });
  it("a mensagem do fallback cita o canal", () => {
    expect(mensagemCodigoCopiado(acaoFake())).toBe(
      "Código copiado. Abra o canal Vistoria de Obra e cole no primeiro campo.",
    );
  });
});

describe("links de mapa", () => {
  it("usa coordenadas quando existem", () => {
    expect(linkGoogleMaps(acaoFake())).toContain("destination=-3.1019%2C-60.0131");
    expect(linkWaze(acaoFake())).toContain("ll=-3.1019%2C-60.0131");
  });
  it("usa o endereço quando não há coordenadas", () => {
    const l = linkGoogleMaps(acaoFake({ latitude: null, longitude: null }));
    expect(decodeURIComponent(l)).toContain("Rua Pará, 300, Adrianópolis, Manaus - AM");
  });
});
