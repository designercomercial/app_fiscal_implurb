import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AcoesDoDiaApp } from "@/components/AcoesDoDiaApp";
import { calcularResumo, type Acao, type RespostaAcoesDoDia } from "@/domain/acao";
import { horaManaus } from "@/domain/datas";
import { acaoFake, HOJE } from "../fixtures";

function resposta(acoes: Acao[]): RespostaAcoesDoDia {
  return {
    fiscal: { nome: "Carlos Mendes", zona: "Zonas Centro-Sul e Oeste" },
    data: HOJE,
    resumo: calcularResumo(acoes),
    acoes,
    gerado_em: `${HOJE}T08:00:00-04:00`,
  };
}

function okJson(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
}

const fetchMock = vi.fn();

beforeEach(() => {
  window.localStorage.clear();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const LISTA = [
  acaoFake({ codigo: "ACAO-2026-000001", prioridade: "baixa" }),
  acaoFake({ codigo: "ACAO-2026-000002", prioridade: "alta", orientacao_chefia: null }),
  acaoFake({ codigo: "ACAO-2026-000003", status: "concluida" }),
];

describe("página Ações do dia", () => {
  it("mostra skeleton (não spinner) enquanto carrega", () => {
    fetchMock.mockReturnValue(new Promise(() => {}));
    render(<AcoesDoDiaApp />);
    expect(screen.getAllByTestId("card-skeleton")).toHaveLength(4);
    expect(screen.getByText("Carregando ações do dia")).toHaveAttribute("role", "status");
    expect(document.querySelector(".animate-spin")).toBeNull();
  });

  it("mostra cabeçalho, resumo e a aba Pendentes por padrão, em ordem de prioridade", async () => {
    fetchMock.mockReturnValue(okJson(resposta(LISTA)));
    render(<AcoesDoDiaApp />);
    expect(await screen.findByRole("heading", { name: "Terça-feira, 10 de novembro" })).toBeInTheDocument();
    expect(screen.getByText("Carlos Mendes")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1");
    expect(screen.getByRole("tab", { name: "Pendentes (2)" })).toHaveAttribute("aria-selected", "true");

    const cards = await screen.findAllByTestId("card-acao");
    expect(cards.map((c) => c.getAttribute("data-codigo"))).toEqual(["ACAO-2026-000002", "ACAO-2026-000001"]);

    await userEvent.click(screen.getByRole("tab", { name: "Concluídas (1)" }));
    expect(screen.getAllByTestId("card-acao")).toHaveLength(1);
    await userEvent.click(screen.getByRole("tab", { name: "Todas (3)" }));
    expect(screen.getAllByTestId("card-acao")).toHaveLength(3);
  });

  it("lista vazia mostra a mensagem combinada", async () => {
    fetchMock.mockReturnValue(okJson(resposta([])));
    render(<AcoesDoDiaApp />);
    expect(
      await screen.findByText("Nenhuma ação para hoje. Novas ações aparecem aqui quando forem distribuídas."),
    ).toBeInTheDocument();
  });

  it("erro de conexão sem lista salva: mensagem + Tentar novamente", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch")).mockReturnValueOnce(okJson(resposta(LISTA)));
    render(<AcoesDoDiaApp />);
    const erro = await screen.findByTestId("estado-erro");
    expect(erro).toHaveTextContent("Não foi possível carregar as ações");
    await userEvent.click(within(erro).getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findAllByTestId("card-acao")).toHaveLength(2);
  });

  it("sem internet: mostra a última lista salva com o aviso de horário", async () => {
    const salvoEm = Date.now() - 60_000;
    window.localStorage.setItem(
      "lf:acoes-do-dia:v1",
      JSON.stringify({ resposta: resposta(LISTA), salvoEm, chaveFiscal: "padrao" }),
    );
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<AcoesDoDiaApp />);
    expect(await screen.findByTestId("aviso-conexao")).toHaveTextContent(
      `Você está sem internet. Exibindo dados de ${horaManaus(salvoEm)}.`,
    );
    expect(screen.getAllByTestId("card-acao")).toHaveLength(2);
  });

  it("'Estou a caminho' envia a mudança e atualiza o status", async () => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        const corpo = JSON.parse(String(init.body));
        expect(corpo).toEqual({ status: "em_deslocamento", status_anterior: "pendente" });
        return okJson({ acao: { ...LISTA[1], status: "em_deslocamento" } });
      }
      return okJson(resposta(LISTA));
    });
    render(<AcoesDoDiaApp />);
    await userEvent.click((await screen.findAllByTestId("card-acao"))[0]);
    await userEvent.click(screen.getByRole("button", { name: "Estou a caminho" }));
    expect(await screen.findByRole("button", { name: "Iniciar vistoria" })).toBeInTheDocument();
    expect(screen.getByTestId("aviso")).toHaveTextContent("Status atualizado: a caminho.");
  });

  it("'Iniciar vistoria' sem link SASI definido copia o código e mostra a orientação", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    const emDeslocamento = { ...LISTA[1], status: "em_deslocamento" as const };
    fetchMock.mockImplementation((_url: string, init?: RequestInit) =>
      init?.method === "POST"
        ? okJson({ acao: { ...emDeslocamento, status: "em_execucao" } })
        : okJson(resposta([emDeslocamento])),
    );
    render(<AcoesDoDiaApp />);
    await userEvent.click(await screen.findByTestId("card-acao"));
    await userEvent.click(screen.getByRole("button", { name: "Iniciar vistoria" }));
    expect(await screen.findByTestId("mensagem-formulario")).toHaveTextContent(
      "Código copiado. Abra o canal Vistoria de Obra e cole no primeiro campo.",
    );
    expect(writeText).toHaveBeenCalledWith("ACAO-2026-000002");
  });

  it("erro do servidor desfaz a mudança otimista e explica", async () => {
    fetchMock.mockImplementation((_url: string, init?: RequestInit) =>
      init?.method === "POST"
        ? okJson({ erro: { codigo: "TRANSICAO_INVALIDA", mensagem: "Não é possível mudar." } }, 409)
        : okJson(resposta(LISTA)),
    );
    render(<AcoesDoDiaApp />);
    await userEvent.click((await screen.findAllByTestId("card-acao"))[0]);
    await userEvent.click(screen.getByRole("button", { name: "Estou a caminho" }));
    expect(await screen.findByTestId("erro-detalhe")).toHaveTextContent("Não é possível mudar.");
    expect(screen.getByRole("button", { name: "Estou a caminho" })).toBeInTheDocument();
  });
});
