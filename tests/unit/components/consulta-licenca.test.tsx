import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConsultaLicencaApp } from "@/components/licenca/ConsultaLicencaApp";
import { hojeManaus, somarDias } from "@/domain/datas";
import { paraResumo, type Licenca } from "@/domain/licenca";

const hoje = hojeManaus();

function licenca(parcial: Partial<Licenca> = {}): Licenca {
  return {
    numero_alvara: "ALV-2026-00412",
    numero_processo: "2026.000.1876",
    tipo_obra: "reforma",
    uso: "residencial",
    status_cadastro: "ativa",
    endereco: "Rua Rio Içá, 89",
    bairro: "Parque 10 de Novembro",
    latitude: -3.08,
    longitude: -60.01,
    data_emissao: somarDias(hoje, -100),
    validade: somarDias(hoje, 200),
    area_aprovada_m2: 186.4,
    pavimentos: 2,
    condicionantes: ["Manter tapume com altura mínima de 2,20 m"],
    proprietario: { nome: "Pedro Henrique Lima", documento_mascarado: "***.987.146-**" },
    responsavel_tecnico: { nome: "Ana Paula Moraes", conselho: "CREA", registro: "041523-D/AM", art_rrt: "ART AM20260012345" },
    historico: [{ data: somarDias(hoje, -100), evento: "Alvará emitido" }],
    atualizado_em: `${hoje}T07:00:00-04:00`,
    ...parcial,
  };
}

const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));

const fetchMock = vi.fn();
beforeEach(() => {
  window.localStorage.clear();
  window.history.replaceState(null, "", "/fiscal/consultar-licenca");
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function buscar(termo: string) {
  await userEvent.type(screen.getByLabelText("Alvará, processo ou endereço"), termo);
  await userEvent.click(screen.getByRole("button", { name: "Buscar" }));
}

describe("Consultar licença de obra", () => {
  it("exige pelo menos 3 caracteres", async () => {
    render(<ConsultaLicencaApp />);
    await buscar("Ru");
    expect(screen.getByRole("alert")).toHaveTextContent("Digite pelo menos 3 caracteres.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("indica o tipo de busca enquanto digita", async () => {
    render(<ConsultaLicencaApp />);
    await userEvent.type(screen.getByLabelText("Alvará, processo ou endereço"), "ALV-2026");
    expect(screen.getByText("Buscar por número de alvará.")).toBeInTheDocument();
  });

  it("busca por endereço lista as licenças com situação em texto e ícone", async () => {
    const a = licenca();
    const b = licenca({ numero_alvara: "ALV-2026-00951", numero_processo: "2026.000.2231", status_cadastro: "suspensa" });
    fetchMock.mockReturnValue(json({ termo: "Rua", tipo_busca: "endereco", resultados: [paraResumo(a), paraResumo(b)], truncado: false }));
    render(<ConsultaLicencaApp />);
    await buscar("Rua");
    const cards = await screen.findAllByTestId("card-licenca");
    expect(cards).toHaveLength(2);
    expect(within(cards[0]).getByTestId("selo-situacao")).toHaveTextContent("Situação: Válida");
    expect(within(cards[1]).getByTestId("selo-situacao")).toHaveTextContent("Situação: Suspensa");
    expect(screen.getByText("2 licenças encontradas")).toBeInTheDocument();
  });

  it("número exato abre direto o detalhe", async () => {
    const l = licenca();
    fetchMock.mockImplementation((url: string) =>
      url.includes("/licencas/")
        ? json({ licenca: l })
        : json({ termo: "ALV-2026-00412", tipo_busca: "alvara", resultados: [paraResumo(l)], truncado: false }),
    );
    render(<ConsultaLicencaApp />);
    await buscar("ALV-2026-00412");
    const detalhe = await screen.findByRole("dialog", { name: "Reforma residencial" });
    expect(await within(detalhe).findByTestId("situacao-licenca")).toHaveTextContent("Licença válida");
    expect(detalhe).toHaveTextContent("***.987.146-**");
    expect(detalhe).toHaveTextContent("CREA 041523-D/AM");
    expect(detalhe).toHaveTextContent("Manter tapume");
    expect(window.location.search).toBe("?licenca=ALV-2026-00412");
  });

  it("nenhum resultado explica o que fazer", async () => {
    fetchMock.mockReturnValue(json({ termo: "Rua Inexistente", tipo_busca: "endereco", resultados: [], truncado: false }));
    render(<ConsultaLicencaApp />);
    await buscar("Rua Inexistente");
    expect(await screen.findByTestId("busca-vazia")).toHaveTextContent("Nenhuma licença encontrada para “Rua Inexistente”.");
  });

  it("erro de conexão: mensagem e Tentar novamente", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch")).mockReturnValueOnce(
      json({ termo: "Rua", tipo_busca: "endereco", resultados: [paraResumo(licenca())], truncado: false }),
    );
    render(<ConsultaLicencaApp />);
    await buscar("Rua");
    const erro = await screen.findByTestId("erro-busca");
    await userEvent.click(within(erro).getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findAllByTestId("card-licenca")).toHaveLength(1);
  });

  it("abre pelo link ?licenca= vindo da página Ações do dia e guarda nas consultas recentes", async () => {
    window.history.replaceState(null, "", "/fiscal/consultar-licenca?licenca=ALV-2026-00412");
    fetchMock.mockReturnValue(json({ licenca: licenca() }));
    render(<ConsultaLicencaApp />);
    expect(await screen.findByTestId("situacao-licenca")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Fechar" }));
    expect(screen.getByRole("heading", { name: "Consultas recentes" })).toBeInTheDocument();
    expect(screen.getByTestId("card-licenca")).toHaveTextContent("Consultada às");
  });

  it("sem internet: busca nas licenças salvas e mostra o horário dos dados", async () => {
    window.localStorage.setItem(
      "lf:licencas-recentes:v1",
      JSON.stringify([{ licenca: licenca(), salvoEm: Date.now() - 60_000 }]),
    );
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    render(<ConsultaLicencaApp />);
    expect(await screen.findByTestId("aviso-offline-licenca")).toBeInTheDocument();
    await buscar("Rio Içá");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText("1 licença encontrada no aparelho")).toBeInTheDocument();
    await userEvent.click(screen.getByTestId("card-licenca"));
    expect(await screen.findByTestId("aviso-dados-salvos")).toHaveTextContent(/Você está sem internet\. Exibindo dados de \d{2}:\d{2}\./);
  });

  it("copiar número do alvará", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    window.history.replaceState(null, "", "/fiscal/consultar-licenca?licenca=ALV-2026-00412");
    fetchMock.mockReturnValue(json({ licenca: licenca() }));
    render(<ConsultaLicencaApp />);
    await userEvent.click(await screen.findByRole("button", { name: "Copiar número do alvará" }));
    expect(writeText).toHaveBeenCalledWith("ALV-2026-00412");
    expect(await screen.findByTestId("aviso")).toHaveTextContent("Número do alvará copiado.");
  });
});
