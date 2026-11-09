import { beforeEach, describe, expect, it, vi } from "vitest";
import { RepositorioEmMemoria } from "@/server/acoes-repo";
import { alterarStatus, concluirPorFormulario, ErroServico, listarAcoesDoDia } from "@/server/acoes-service";
import { FISCAIS_MOCK } from "@/server/auth";
import { gerarAcoesMock } from "@/server/mock-data";
import { HOJE } from "./fixtures";

const carlos = FISCAIS_MOCK["f-001"];
const ana = FISCAIS_MOCK["f-002"];
const agora = () => new Date("2026-11-10T12:00:00Z");

let repo: RepositorioEmMemoria;
let reagendar: ReturnType<typeof vi.fn<() => Promise<void>>>;
const deps = () => ({ repo, agora, reagendar });

beforeEach(() => {
  repo = new RepositorioEmMemoria(gerarAcoesMock(HOJE));
  reagendar = vi.fn(async () => {});
});

async function erroDe(p: Promise<unknown>): Promise<ErroServico> {
  try {
    await p;
  } catch (e) {
    if (e instanceof ErroServico) return e;
    throw e;
  }
  throw new Error("esperava erro");
}

describe("listarAcoesDoDia", () => {
  it("devolve só as ações do fiscal logado, sem campos internos", async () => {
    const r = await listarAcoesDoDia(deps(), carlos, HOJE);
    expect(r.acoes).toHaveLength(8);
    expect(r.fiscal).toEqual({ nome: "Carlos Mendes", zona: carlos.zona });
    expect(r.acoes.some((a) => a.codigo === "ACAO-2026-001301")).toBe(false);
    for (const a of r.acoes) {
      expect(a).not.toHaveProperty("fiscal_id");
      expect(a).not.toHaveProperty("data_programada");
    }
    const deAna = await listarAcoesDoDia(deps(), ana, HOJE);
    expect(deAna.acoes.map((a) => a.codigo)).toEqual(["ACAO-2026-001301"]);
  });

  it("os dados mock cobrem os casos pedidos", async () => {
    const { acoes, resumo } = await listarAcoesDoDia(deps(), carlos, HOJE);
    expect(new Set(acoes.map((a) => a.bairro)).size).toBe(8);
    expect(acoes.filter((a) => a.prazo < HOJE && a.status === "pendente")).toHaveLength(1);
    expect(acoes.filter((a) => a.orientacao_chefia)).toHaveLength(1);
    expect(resumo).toEqual({ total: 8, concluidas: 2, pendentes: 5, nao_realizadas: 1 });
  });

  it("outra data não traz as ações de hoje", async () => {
    expect((await listarAcoesDoDia(deps(), carlos, "2026-11-11")).acoes).toHaveLength(0);
  });
});

describe("alterarStatus", () => {
  it("segue pendente → em_deslocamento → em_execucao e registra a auditoria", async () => {
    const a1 = await alterarStatus(deps(), carlos, "ACAO-2026-001245", { status: "em_deslocamento" });
    expect(a1.status).toBe("em_deslocamento");
    expect(a1.atualizado_em).toBe("2026-11-10T08:00:00-04:00");
    const a2 = await alterarStatus(deps(), carlos, "ACAO-2026-001245", { status: "em_execucao" });
    expect(a2.status).toBe("em_execucao");

    expect(await repo.listarAuditoria("ACAO-2026-001245")).toEqual([
      expect.objectContaining({
        de: "pendente",
        para: "em_deslocamento",
        usuario_id: "f-001",
        origem: "pagina",
        em: "2026-11-10T08:00:00-04:00",
      }),
      expect.objectContaining({ de: "em_deslocamento", para: "em_execucao", usuario_id: "f-001" }),
    ]);
  });

  it("não deixa um fiscal alterar a ação de outro (404, sem revelar que existe)", async () => {
    const e = await erroDe(alterarStatus(deps(), ana, "ACAO-2026-001245", { status: "em_deslocamento" }));
    expect(e.httpStatus).toBe(404);
    expect(e.codigo).toBe("ACAO_NAO_ENCONTRADA");
    expect(e.acaoAtual).toBeUndefined();
    expect((await repo.buscar("ACAO-2026-001245"))?.status).toBe("pendente");
  });

  it("transição inválida retorna 409", async () => {
    const e = await erroDe(alterarStatus(deps(), carlos, "ACAO-2026-001245", { status: "em_execucao" }));
    expect(e.httpStatus).toBe(409);
    expect(e.codigo).toBe("TRANSICAO_INVALIDA");
  });

  it("a página não pode concluir a ação", async () => {
    await alterarStatus(deps(), carlos, "ACAO-2026-001250", { status: "em_execucao" });
    const e = await erroDe(alterarStatus(deps(), carlos, "ACAO-2026-001250", { status: "concluida" }));
    expect(e.httpStatus).toBe(409);
    expect(e.codigo).toBe("CONCLUSAO_SOMENTE_PELO_FORMULARIO");
  });

  it("não realizada exige motivo e aciona o reagendamento", async () => {
    const e = await erroDe(alterarStatus(deps(), carlos, "ACAO-2026-001245", { status: "nao_realizada" }));
    expect(e.httpStatus).toBe(400);
    expect(e.codigo).toBe("MOTIVO_OBRIGATORIO");
    expect(reagendar).not.toHaveBeenCalled();

    const a = await alterarStatus(deps(), carlos, "ACAO-2026-001245", {
      status: "nao_realizada",
      motivo_nao_realizada: "outro",
      motivo_outro: "  Cão bravo no portão  ",
    });
    expect(a).toMatchObject({
      status: "nao_realizada",
      motivo_nao_realizada: "outro",
      motivo_outro: "Cão bravo no portão",
    });
    expect(reagendar).toHaveBeenCalledTimes(1);
    expect((await repo.listarAuditoria(a.codigo))[0]).toMatchObject({
      motivo_nao_realizada: "outro",
      motivo_outro: "Cão bravo no portão",
    });
  });

  it("recusa com 409 quando o status mudou desde que a página carregou", async () => {
    const e = await erroDe(
      alterarStatus(deps(), carlos, "ACAO-2026-001250", {
        status: "nao_realizada",
        motivo_nao_realizada: "acesso_negado",
        status_anterior: "pendente",
      }),
    );
    expect(e.httpStatus).toBe(409);
    expect(e.codigo).toBe("CONFLITO_STATUS");
    expect(e.acaoAtual?.status).toBe("em_deslocamento");
  });

  it("valida o corpo e o código", async () => {
    expect((await erroDe(alterarStatus(deps(), carlos, "ACAO-2026-001245", null))).httpStatus).toBe(400);
    expect(
      (await erroDe(alterarStatus(deps(), carlos, "nao-e-codigo", { status: "em_deslocamento" }))).httpStatus,
    ).toBe(404);
  });
});

describe("concluirPorFormulario", () => {
  it("conclui a ação em execução quando o formulário chega e registra o sistema como usuário", async () => {
    await alterarStatus(deps(), carlos, "ACAO-2026-001250", { status: "em_execucao" });
    const a = await concluirPorFormulario(deps(), "ACAO-2026-001250");
    expect(a.status).toBe("concluida");
    expect((await repo.listarAuditoria("ACAO-2026-001250")).at(-1)).toMatchObject({
      para: "concluida",
      usuario_id: "integracao-sasi",
      origem: "sistema_formulario",
    });
  });
  it("não conclui ação que não está em execução", async () => {
    expect((await erroDe(concluirPorFormulario(deps(), "ACAO-2026-001245"))).httpStatus).toBe(409);
  });
});
