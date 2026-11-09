import { expect, test } from "@playwright/test";
import { abrirPagina, card, cod, reiniciarDados } from "./helpers";

test.beforeEach(async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await reiniciarDados(page);
});

test("detalhe mostra os campos e a orientação da chefia em destaque", async ({ page }) => {
  await abrirPagina(page);
  await card(page, cod(1245)).click();
  const detalhe = page.getByRole("dialog", { name: "Vistoria de obra" });
  await expect(detalhe).toBeVisible();
  await expect(detalhe.getByTestId("orientacao-chefia")).toContainText("Denúncia de calçada obstruída");
  for (const t of ["Rua Pará, 300", "Ao lado da farmácia", "Maria Oliveira Santos", "Denúncia", "Vistoria de Obra"]) {
    await expect(detalhe).toContainText(t);
  }
  await expect(detalhe.getByRole("link", { name: "Abrir no mapa" })).toHaveAttribute("href", /google\.com\/maps\/dir/);
  await expect(detalhe.getByRole("link", { name: "Abrir no Waze" })).toHaveAttribute("href", /waze\.com\/ul/);

  await page.keyboard.press("Escape");
  await expect(detalhe).toBeHidden();
  await expect(card(page, cod(1245))).toBeFocused();
});

test("fluxo completo: a caminho → iniciar vistoria → formulário recebido → concluída", async ({ page }) => {
  await abrirPagina(page);
  await card(page, cod(1245)).click();
  const detalhe = page.getByTestId("detalhe-acao");

  // Um botão principal por status
  await expect(detalhe.getByRole("button", { name: "Iniciar vistoria" })).toHaveCount(0);
  await detalhe.getByRole("button", { name: "Estou a caminho" }).click();
  await expect(detalhe.getByTestId("selo-status")).toContainText("A caminho");
  await expect(detalhe.getByRole("button", { name: "Estou a caminho" })).toHaveCount(0);

  await detalhe.getByRole("button", { name: "Iniciar vistoria" }).click();
  await expect(detalhe.getByTestId("mensagem-formulario")).toContainText(
    "Código copiado. Abra o canal Vistoria de Obra e cole no primeiro campo.",
  );
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(cod(1245));
  await expect(detalhe.getByTestId("selo-status")).toContainText("Em vistoria");

  // A página NÃO conclui: a API recusa.
  const recusa = await page.request.post(`/api/fiscal/acoes/${cod(1245)}/status`, { data: { status: "concluida" } });
  expect(recusa.status()).toBe(409);

  // O Libera Fácil recebe o formulário do app → concluída. A página só exibe.
  const r = await page.request.post("/api/dev/formulario-recebido", { data: { codigo_acao: cod(1245) } });
  expect(r.ok()).toBe(true);
  await page.getByRole("button", { name: "Fechar" }).click();
  await page.getByRole("button", { name: "Atualizar lista" }).click();
  await page.getByRole("tab", { name: /Concluídas/ }).click();
  await expect(card(page, cod(1245)).getByTestId("selo-status")).toContainText("Concluída");
  await expect(page.getByTestId("resumo-dia")).toContainText("Concluídas3");
});

test("'Não consegui realizar' exige motivo e confirmação", async ({ page }) => {
  await abrirPagina(page);
  await card(page, cod(1252)).click();
  await page.getByRole("button", { name: "Não consegui realizar" }).click();

  const dialogo = page.getByTestId("dialogo-nao-realizada");
  await expect(dialogo).toBeVisible();
  // O detalhe fecha: nunca um modal sobre outro.
  await expect(page.getByTestId("detalhe-acao")).toHaveCount(0);

  await dialogo.getByRole("button", { name: "Continuar" }).click();
  await expect(dialogo.getByRole("alert")).toHaveText("Escolha um motivo.");

  await dialogo.getByRole("radio", { name: "Outro motivo" }).check();
  await dialogo.getByRole("button", { name: "Continuar" }).click();
  await expect(dialogo.getByRole("alert")).toHaveText("Descreva o motivo.");
  await dialogo.getByLabel("Descreva o motivo").fill("Proprietário pediu reagendamento");
  await dialogo.getByRole("button", { name: "Continuar" }).click();

  const confirma = page.getByRole("alertdialog", { name: "Confirmar ação não realizada?" });
  await expect(confirma).toContainText("Outro motivo");
  await expect(confirma).toContainText("volta para a fila do dia seguinte");
  await confirma.getByRole("button", { name: "Confirmar" }).click();

  await expect(page.getByTestId("aviso")).toHaveText("Ação registrada como não realizada.");
  await expect(card(page, cod(1252))).toHaveCount(0); // sai de Pendentes
  await page.getByRole("tab", { name: /Todas/ }).click();
  await expect(card(page, cod(1252)).getByTestId("selo-status")).toContainText("Não realizada");
});

test("cancelar o diálogo volta ao detalhe sem registrar", async ({ page }) => {
  await abrirPagina(page);
  await card(page, cod(1259)).click();
  await page.getByRole("button", { name: "Não consegui realizar" }).click();
  await page.getByRole("radio", { name: "Acesso negado" }).check();
  await page.getByRole("button", { name: "Cancelar" }).click();
  await expect(page.getByTestId("detalhe-acao")).toBeVisible();
  await expect(page.getByTestId("detalhe-acao").getByTestId("selo-status")).toContainText("Pendente");
});
