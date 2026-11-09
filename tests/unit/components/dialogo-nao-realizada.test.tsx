import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DialogoNaoRealizada } from "@/components/DialogoNaoRealizada";
import { acaoFake } from "../fixtures";

function renderDialogo(aoConfirmar = vi.fn(async () => {})) {
  const aoCancelar = vi.fn();
  render(<DialogoNaoRealizada acao={acaoFake()} offline={false} aoCancelar={aoCancelar} aoConfirmar={aoConfirmar} />);
  return { aoConfirmar, aoCancelar };
}

describe("DialogoNaoRealizada", () => {
  it("lista os cinco motivos", () => {
    renderDialogo();
    expect(screen.getByRole("dialog", { name: "Não consegui realizar" })).toBeInTheDocument();
    for (const m of ["Acesso negado", "Obra fechada", "Endereço não localizado", "Situação de risco", "Outro motivo"]) {
      expect(screen.getByRole("radio", { name: m })).toBeInTheDocument();
    }
  });

  it("exige motivo antes de continuar", async () => {
    const { aoConfirmar } = renderDialogo();
    await userEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Escolha um motivo.");
    expect(aoConfirmar).not.toHaveBeenCalled();
  });

  it("exige confirmação: escolher o motivo não registra nada sozinho", async () => {
    const { aoConfirmar } = renderDialogo();
    await userEvent.click(screen.getByRole("radio", { name: "Obra fechada" }));
    await userEvent.click(screen.getByRole("button", { name: "Continuar" }));

    const confirma = screen.getByRole("alertdialog", { name: "Confirmar ação não realizada?" });
    expect(confirma).toHaveTextContent("“Obra fechada”");
    expect(confirma).toHaveTextContent("volta para a fila do dia seguinte");
    expect(aoConfirmar).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(aoConfirmar).toHaveBeenCalledWith(expect.objectContaining({ codigo: "ACAO-2026-001245" }), "obra_fechada", undefined);
  });

  it("'Outro motivo' exige descrição", async () => {
    const { aoConfirmar } = renderDialogo();
    await userEvent.click(screen.getByRole("radio", { name: "Outro motivo" }));
    await userEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Descreva o motivo.");

    await userEvent.type(screen.getByLabelText("Descreva o motivo"), "Cão bravo no portão");
    await userEvent.click(screen.getByRole("button", { name: "Continuar" }));
    await userEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(aoConfirmar).toHaveBeenCalledWith(expect.anything(), "outro", "Cão bravo no portão");
  });

  it("Voltar retorna à escolha do motivo sem registrar", async () => {
    const { aoConfirmar } = renderDialogo();
    await userEvent.click(screen.getByRole("radio", { name: "Acesso negado" }));
    await userEvent.click(screen.getByRole("button", { name: "Continuar" }));
    await userEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect(screen.getByRole("radio", { name: "Acesso negado" })).toBeChecked();
    expect(aoConfirmar).not.toHaveBeenCalled();
  });

  it("Cancelar fecha sem registrar", async () => {
    const { aoConfirmar, aoCancelar } = renderDialogo();
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(aoCancelar).toHaveBeenCalled();
    expect(aoConfirmar).not.toHaveBeenCalled();
  });

  it("mostra o erro do servidor e permite tentar de novo", async () => {
    const aoConfirmar = vi.fn().mockRejectedValueOnce(new Error("Sem conexão.")).mockResolvedValueOnce(undefined);
    renderDialogo(aoConfirmar);
    await userEvent.click(screen.getByRole("radio", { name: "Situação de risco" }));
    await userEvent.click(screen.getByRole("button", { name: "Continuar" }));
    await userEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Sem conexão.");
    await userEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(aoConfirmar).toHaveBeenCalledTimes(2);
  });
});
