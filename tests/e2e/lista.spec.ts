import { expect, test } from "@playwright/test";
import { abrirPagina, card, cod, reiniciarDados, semRolagemHorizontal, URL_PAGINA } from "./helpers";

test.beforeEach(async ({ page }) => reiniciarDados(page));

test("lista abre com resumo, aba Pendentes e ordem por prioridade", async ({ page }) => {
  await abrirPagina(page);

  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/^[A-ZÁÉÍÓÚÇ][a-zçáéíóú-]+, \d{1,2} de [a-zç]+$/);
  await expect(page.getByText("Carlos Mendes")).toBeVisible();
  const resumo = page.getByTestId("resumo-dia");
  await expect(resumo).toContainText("Ações8");
  await expect(resumo).toContainText("Concluídas2");
  await expect(resumo).toContainText("Pendentes5");
  await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "2");

  await expect(page.getByRole("tab", { name: "Pendentes (5)" })).toHaveAttribute("aria-selected", "true");
  const codigos = await page.getByTestId("card-acao").evaluateAll((els) => els.map((e) => e.getAttribute("data-codigo")));
  // em deslocamento primeiro; depois alta (atrasada antes de vence hoje), média, baixa
  expect(codigos).toEqual([cod(1250), cod(1238), cod(1245), cod(1252), cod(1259)]);

  await expect(card(page, cod(1238)).getByTestId("selo-prazo")).toContainText("Atrasada");
  await expect(card(page, cod(1245)).getByTestId("selo-prazo")).toHaveText("Vence hoje");
});

test("abas Concluídas e Todas, e ordenação por rota", async ({ page }) => {
  await abrirPagina(page);
  await page.getByRole("tab", { name: "Concluídas (2)" }).click();
  await expect(page.getByTestId("card-acao")).toHaveCount(2);

  await page.getByRole("tab", { name: "Todas (8)" }).click();
  await expect(page.getByTestId("card-acao")).toHaveCount(8);

  await page.getByRole("button", { name: "Rota" }).click();
  await expect(page.getByRole("button", { name: "Rota" })).toHaveAttribute("aria-pressed", "true");
  const paradas = await page.getByTestId("card-acao").evaluateAll((els) =>
    els.map((e) => Number(e.textContent?.match(/^Parada (\d+)/)?.[1])),
  );
  expect(paradas).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
});

test("prioridade e status legíveis sem cor: sempre com texto e ícone", async ({ page }) => {
  await abrirPagina(page);
  await page.getByRole("tab", { name: /Todas/ }).click();
  for (const selo of await page.getByTestId("selo-prioridade").all()) {
    await expect(selo).toHaveText(/Prioridade (Alta|Média|Baixa)/);
    await expect(selo.locator("svg")).toHaveCount(1);
  }
  for (const selo of await page.getByTestId("selo-status").all()) {
    await expect(selo).toHaveText(/Status: (Pendente|A caminho|Em vistoria|Concluída|Não realizada)/);
    await expect(selo.locator("svg")).toHaveCount(1);
  }
});

test("estado vazio para fiscal sem ações no dia", async ({ page }) => {
  await page.route("**/api/fiscal/acoes-do-dia*", async (route) => {
    const resp = await route.fetch();
    const corpo = await resp.json();
    await route.fulfill({ json: { ...corpo, acoes: [], resumo: { total: 0, concluidas: 0, pendentes: 0, nao_realizadas: 0 } } });
  });
  await page.goto(URL_PAGINA);
  await expect(
    page.getByText("Nenhuma ação para hoje. Novas ações aparecem aqui quando forem distribuídas."),
  ).toBeVisible();
});

test("erro de conexão: mensagem e Tentar novamente", async ({ page }) => {
  let falhar = true;
  await page.route("**/api/fiscal/acoes-do-dia*", (route) => (falhar ? route.abort("connectionrefused") : route.continue()));
  await page.goto(URL_PAGINA);
  await expect(page.getByTestId("estado-erro")).toContainText("Não foi possível carregar as ações");
  falhar = false;
  await page.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(page.getByTestId("card-acao")).toHaveCount(5);
});

test("o fiscal só vê as próprias ações", async ({ page }) => {
  await abrirPagina(page, "?fiscal=f-002");
  await expect(page.getByText("Ana Ribeiro")).toBeVisible();
  await expect(page.getByTestId("card-acao")).toHaveCount(1);
  await expect(card(page, cod(1245))).toHaveCount(0);

  // Mesmo chamando a API direto, Ana não altera a ação de Carlos.
  const r = await page.request.post(`/api/fiscal/acoes/${cod(1245)}/status`, {
    headers: { "x-fiscal-id": "f-002" },
    data: { status: "em_deslocamento" },
  });
  expect(r.status()).toBe(404);
});

for (const largura of [360, 390]) {
  test(`sem rolagem horizontal em ${largura}px (lista, detalhe e diálogo)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 800 });
    await abrirPagina(page);
    await page.getByRole("tab", { name: /Todas/ }).click();
    await semRolagemHorizontal(page);
    await card(page, cod(1245)).click();
    await expect(page.getByTestId("detalhe-acao")).toBeVisible();
    await semRolagemHorizontal(page);
    await page.getByRole("button", { name: "Não consegui realizar" }).click();
    await expect(page.getByTestId("dialogo-nao-realizada")).toBeVisible();
    await semRolagemHorizontal(page);
  });
}

test("áreas de toque de pelo menos 44px e corpo com 16px", async ({ page }) => {
  await abrirPagina(page);
  await card(page, cod(1245)).click();
  const alvos = page.locator("button:visible, a:visible");
  for (const el of await alvos.all()) {
    const caixa = await el.boundingBox();
    expect(caixa!.height, await el.innerText()).toBeGreaterThanOrEqual(44);
  }
  const fonte = await page.evaluate(() => getComputedStyle(document.body).fontSize);
  expect(fonte).toBe("16px");
});
