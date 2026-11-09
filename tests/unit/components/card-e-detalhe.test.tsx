import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CardAcao } from "@/components/CardAcao";
import { DetalheAcao, type MensagemFormulario } from "@/components/DetalheAcao";
import type { Acao } from "@/domain/acao";
import { acaoFake, HOJE } from "../fixtures";

describe("CardAcao", () => {
  it("mostra prioridade e status com texto (não só cor), tipo, código, endereço e prazo", () => {
    render(<CardAcao acao={acaoFake()} hoje={HOJE} aoAbrir={() => {}} />);
    const card = screen.getByTestId("card-acao");
    expect(within(card).getByTestId("selo-prioridade")).toHaveTextContent("Prioridade Alta");
    expect(within(card).getByTestId("selo-status")).toHaveTextContent("Status: Pendente");
    expect(card).toHaveTextContent("Vistoria de obra");
    expect(card).toHaveTextContent("ACAO-2026-001245");
    expect(card).toHaveTextContent("Rua Pará, 300");
    expect(card).toHaveTextContent("Adrianópolis");
    expect(within(card).getByTestId("selo-prazo")).toHaveTextContent("Vence hoje");
    // cada selo tem um ícone
    expect(within(card).getByTestId("selo-prioridade").querySelector("svg")).not.toBeNull();
  });

  it("destaca ação atrasada", () => {
    render(<CardAcao acao={acaoFake({ prazo: "2026-11-08" })} hoje={HOJE} aoAbrir={() => {}} />);
    expect(screen.getByTestId("selo-prazo")).toHaveTextContent("Atrasada · prazo 08/11");
  });

  it("toque no card abre o detalhe", async () => {
    const aoAbrir = vi.fn();
    render(<CardAcao acao={acaoFake()} hoje={HOJE} aoAbrir={aoAbrir} />);
    await userEvent.click(screen.getByTestId("card-acao"));
    expect(aoAbrir).toHaveBeenCalledWith("ACAO-2026-001245");
  });

  it("no modo rota, mostra o número da parada", () => {
    render(<CardAcao acao={acaoFake({ ordem_rota: 3 })} hoje={HOJE} mostrarOrdemRota aoAbrir={() => {}} />);
    expect(screen.getByTestId("card-acao")).toHaveTextContent(/^Parada 3/);
  });
});

function renderDetalhe(acao: Acao, extras: Partial<Parameters<typeof DetalheAcao>[0]> = {}) {
  const props = {
    acao,
    hoje: HOJE,
    offline: false,
    operacao: null,
    mensagemFormulario: null as MensagemFormulario | null,
    erro: null,
    aoFechar: vi.fn(),
    aoEstouACaminho: vi.fn(),
    aoIniciarVistoria: vi.fn(),
    aoAbrirFormulario: vi.fn(),
    aoNaoRealizada: vi.fn(),
    ...extras,
  };
  render(<DetalheAcao {...props} />);
  return props;
}

describe("DetalheAcao", () => {
  it("mostra todos os campos e a orientação da chefia em destaque", () => {
    renderDetalhe(acaoFake());
    const dialogo = screen.getByRole("dialog", { name: "Vistoria de obra" });
    expect(within(dialogo).getByTestId("orientacao-chefia")).toHaveTextContent(
      "Orientação da chefiaDenúncia de calçada obstruída. Verificar tapume.",
    );
    for (const texto of [
      "Rua Pará, 300",
      "Ao lado da farmácia",
      "Denúncia",
      "Maria Oliveira Santos",
      "2026.000.4587",
      "Vistoria de Obra",
      "1ª parada",
    ]) {
      expect(dialogo).toHaveTextContent(texto);
    }
  });

  it("pendente: único botão principal é 'Estou a caminho'", async () => {
    const p = renderDetalhe(acaoFake());
    expect(screen.queryByRole("button", { name: "Iniciar vistoria" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Estou a caminho" }));
    expect(p.aoEstouACaminho).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Não consegui realizar" })).toBeEnabled();
  });

  it("em deslocamento: único botão principal é 'Iniciar vistoria'", async () => {
    const p = renderDetalhe(acaoFake({ status: "em_deslocamento" }));
    expect(screen.queryByRole("button", { name: "Estou a caminho" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Iniciar vistoria" }));
    expect(p.aoIniciarVistoria).toHaveBeenCalled();
  });

  it("links de mapa para Google Maps e Waze", () => {
    renderDetalhe(acaoFake());
    expect(screen.getByRole("link", { name: "Abrir no mapa" })).toHaveAttribute(
      "href",
      expect.stringContaining("google.com/maps/dir"),
    );
    expect(screen.getByRole("link", { name: "Abrir no Waze" })).toHaveAttribute(
      "href",
      expect.stringContaining("waze.com/ul"),
    );
  });

  it("concluída: sem botões de status", () => {
    renderDetalhe(acaoFake({ status: "concluida" }));
    for (const nome of ["Estou a caminho", "Iniciar vistoria", "Não consegui realizar"]) {
      expect(screen.queryByRole("button", { name: nome })).toBeNull();
    }
    expect(screen.getByText("Ação concluída")).toBeInTheDocument();
  });

  it("sem internet: desabilita mudanças de status e avisa", () => {
    renderDetalhe(acaoFake(), { offline: true });
    expect(screen.getByRole("button", { name: "Estou a caminho" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Não consegui realizar" })).toBeDisabled();
    expect(screen.getByText("Sem internet. Conecte-se para mudar o status.")).toBeInTheDocument();
  });

  it("mostra a mensagem do fallback do formulário com o código", () => {
    renderDetalhe(acaoFake({ status: "em_execucao" }), {
      mensagemFormulario: {
        codigo: "ACAO-2026-001245",
        copiado: true,
        texto: "Código copiado. Abra o canal Vistoria de Obra e cole no primeiro campo.",
      },
    });
    expect(screen.getByTestId("mensagem-formulario")).toHaveTextContent(
      "Código copiado. Abra o canal Vistoria de Obra e cole no primeiro campo.",
    );
    expect(screen.getByRole("button", { name: "Abrir formulário" })).toBeInTheDocument();
  });

  it("Esc e o botão Fechar fecham o detalhe", async () => {
    const p = renderDetalhe(acaoFake());
    await userEvent.keyboard("{Escape}");
    await userEvent.click(screen.getByRole("button", { name: "Fechar" }));
    expect(p.aoFechar).toHaveBeenCalledTimes(2);
  });
});
