import { describe, expect, it } from "vitest";
import { STATUS_ACAO, type StatusAcao } from "@/domain/acao";
import { acaoPrincipalPorStatus, podeMarcarNaoRealizada, validarTransicao } from "@/domain/status";

describe("validarTransicao (página)", () => {
  it.each<[StatusAcao, StatusAcao]>([
    ["pendente", "em_deslocamento"],
    ["em_deslocamento", "em_execucao"],
  ])("permite %s → %s", (de, para) => {
    expect(validarTransicao(de, para)).toEqual({ ok: true });
  });

  it.each<StatusAcao>(["pendente", "em_deslocamento", "em_execucao"])(
    "permite %s → nao_realizada com motivo",
    (de) => {
      expect(validarTransicao(de, "nao_realizada", { motivo_nao_realizada: "acesso_negado" })).toEqual({ ok: true });
    },
  );

  it.each<[StatusAcao, StatusAcao]>([
    ["pendente", "em_execucao"],
    ["pendente", "pendente"],
    ["em_deslocamento", "pendente"],
    ["em_execucao", "em_deslocamento"],
    ["concluida", "pendente"],
    ["concluida", "nao_realizada"],
    ["nao_realizada", "pendente"],
    ["nao_realizada", "em_deslocamento"],
  ])("recusa %s → %s", (de, para) => {
    const r = validarTransicao(de, para, { motivo_nao_realizada: "outro", motivo_outro: "x" });
    expect(r).toMatchObject({ ok: false, codigo: "TRANSICAO_INVALIDA" });
  });

  it("nunca permite que a página conclua a ação", () => {
    for (const de of STATUS_ACAO) {
      expect(validarTransicao(de, "concluida")).toMatchObject({
        ok: false,
        codigo: "CONCLUSAO_SOMENTE_PELO_FORMULARIO",
      });
    }
  });

  it("recusa status desconhecido", () => {
    expect(validarTransicao("pendente", "aprovada")).toMatchObject({ ok: false, codigo: "STATUS_DESCONHECIDO" });
  });
});

describe("validarTransicao (sistema: formulário recebido)", () => {
  it("conclui somente a partir de em_execucao", () => {
    expect(validarTransicao("em_execucao", "concluida", { origem: "sistema_formulario" })).toEqual({ ok: true });
    for (const de of ["pendente", "em_deslocamento", "concluida", "nao_realizada"] as const) {
      expect(validarTransicao(de, "concluida", { origem: "sistema_formulario" }).ok).toBe(false);
    }
  });
});

describe("motivo de não realizada", () => {
  it("exige motivo", () => {
    expect(validarTransicao("pendente", "nao_realizada")).toMatchObject({ ok: false, codigo: "MOTIVO_OBRIGATORIO" });
  });
  it("recusa motivo fora da lista", () => {
    expect(validarTransicao("pendente", "nao_realizada", { motivo_nao_realizada: "chuva" })).toMatchObject({
      ok: false,
      codigo: "MOTIVO_INVALIDO",
    });
  });
  it("exige texto quando o motivo é 'outro'", () => {
    expect(
      validarTransicao("pendente", "nao_realizada", { motivo_nao_realizada: "outro", motivo_outro: "   " }),
    ).toMatchObject({ ok: false, codigo: "MOTIVO_OUTRO_OBRIGATORIO" });
    expect(
      validarTransicao("pendente", "nao_realizada", {
        motivo_nao_realizada: "outro",
        motivo_outro: "Cão bravo no portão",
      }),
    ).toEqual({ ok: true });
  });
  it("limita o texto livre a 500 caracteres", () => {
    expect(
      validarTransicao("pendente", "nao_realizada", { motivo_nao_realizada: "outro", motivo_outro: "a".repeat(501) }),
    ).toMatchObject({ ok: false, codigo: "MOTIVO_OUTRO_MUITO_LONGO" });
  });
});

describe("botão principal por status", () => {
  it("mostra um único botão principal conforme o status", () => {
    expect(acaoPrincipalPorStatus("pendente")).toBe("estou_a_caminho");
    expect(acaoPrincipalPorStatus("em_deslocamento")).toBe("iniciar_vistoria");
    expect(acaoPrincipalPorStatus("em_execucao")).toBe("abrir_formulario");
    expect(acaoPrincipalPorStatus("concluida")).toBeNull();
    expect(acaoPrincipalPorStatus("nao_realizada")).toBeNull();
  });
  it("'Não consegui realizar' só existe em status em aberto", () => {
    expect(podeMarcarNaoRealizada("pendente")).toBe(true);
    expect(podeMarcarNaoRealizada("em_deslocamento")).toBe(true);
    expect(podeMarcarNaoRealizada("em_execucao")).toBe(true);
    expect(podeMarcarNaoRealizada("concluida")).toBe(false);
    expect(podeMarcarNaoRealizada("nao_realizada")).toBe(false);
  });
});
