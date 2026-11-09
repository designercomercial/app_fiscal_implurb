import { expect, test } from "@playwright/test";
import { ANO, abrirPagina, card, cod, reiniciarDados, semRolagemHorizontal } from "./helpers";

const URL_LICENCA = "/fiscal/consultar-licenca";

test.beforeEach(async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await reiniciarDados(page);
});

async function buscar(page: import("@playwright/test").Page, termo: string) {
  await page.getByLabel("Alvará, processo ou endereço").fill(termo);
  await page.getByRole("button", { name: "Buscar" }).click();
}

test("busca por endereço sem acento lista as licenças com a situação", async ({ page }) => {
  await page.goto(URL_LICENCA);
  await buscar(page, "rua para adrianopolis");
  const cards = page.getByTestId("card-licenca");
  await expect(cards).toHaveCount(2);
  await expect(cards.nth(0).getByTestId("selo-situacao")).toHaveText("Situação: Válida");
  await expect(cards.nth(1).getByTestId("selo-situacao")).toHaveText("Situação: Em análise");
  await expect(cards.nth(1)).toContainText("Sem alvará");
});

test("número de alvará exato abre o detalhe; copiar e mapa", async ({ page }) => {
  await page.goto(URL_LICENCA);
  await buscar(page, `alv-${ANO}-00951`);
  const detalhe = page.getByRole("dialog", { name: "Ampliação residencial" });
  await expect(detalhe.getByTestId("situacao-licenca")).toContainText("Licença suspensa");
  await expect(detalhe.getByTestId("situacao-licenca")).toContainText("recuo frontal");
  await expect(detalhe).toContainText("***.458.963-**");
  await expect(detalhe).not.toContainText("71245896300");
  await expect(detalhe.getByTestId("historico-licenca").locator("li").first()).toContainText("Alvará suspenso");
  await expect(detalhe.getByRole("link", { name: "Abrir no mapa" })).toHaveAttribute("href", /google\.com\/maps/);

  await detalhe.getByRole("button", { name: "Copiar número do alvará" }).click();
  await expect(page.getByTestId("aviso")).toHaveText("Número do alvará copiado.");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(`ALV-${ANO}-00951`);
});

test("situações vencida, vence em breve e em análise", async ({ page }) => {
  await page.goto(URL_LICENCA);
  await buscar(page, `ALV-${ANO - 2}-01187`);
  await expect(page.getByTestId("situacao-licenca")).toContainText(/Licença vencida.*Venceu em \d{2}\/\d{2}\/\d{4} \(há 38 dias\)/);
  await page.getByRole("button", { name: "Fechar" }).click();

  await buscar(page, `ALV-${ANO - 1}-03321`);
  await expect(page.getByTestId("situacao-licenca")).toContainText(/Licença vence em breve.*Vence em 18 dias/);
  await page.getByRole("button", { name: "Fechar" }).click();

  await buscar(page, `${ANO}.000.4587`);
  await expect(page.getByTestId("situacao-licenca")).toContainText("Ainda não há alvará emitido");
  await expect(page.getByRole("button", { name: "Copiar número do processo" })).toBeVisible();
});

test("nenhum resultado e busca curta", async ({ page }) => {
  await page.goto(URL_LICENCA);
  await buscar(page, "ab");
  // (o Next também injeta um role="alert" próprio: o anunciador de rotas)
  await expect(page.getByText("Digite pelo menos 3 caracteres.")).toHaveAttribute("role", "alert");
  await expect(page.getByLabel("Alvará, processo ou endereço")).toHaveAttribute("aria-invalid", "true");
  await buscar(page, "Rua que não existe");
  await expect(page.getByTestId("busca-vazia")).toContainText("Nenhuma licença encontrada");
});

test("da Ações do dia para a licença da obra", async ({ page }) => {
  await abrirPagina(page);
  await card(page, cod(1250)).click();
  await page.getByTestId("link-consultar-licenca").click();
  await expect(page).toHaveURL(new RegExp(`/fiscal/consultar-licenca\\?licenca=ALV-${ANO - 1}-03321`));
  await expect(page.getByRole("dialog", { name: "Construção residencial" })).toBeVisible();
  await expect(page.getByTestId("situacao-licenca")).toContainText("vence em breve");
});

test("consultas recentes e uso sem internet", async ({ page, context }) => {
  await page.goto(`${URL_LICENCA}?licenca=ALV-${ANO}-00412`);
  await expect(page.getByTestId("situacao-licenca")).toContainText("Licença válida");
  await page.getByRole("button", { name: "Fechar" }).click();
  await expect(page.getByRole("heading", { name: "Consultas recentes" })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`${URL_LICENCA}$`));

  await context.setOffline(true);
  await expect(page.getByTestId("aviso-offline-licenca")).toBeVisible();
  await buscar(page, "Rio Içá");
  await expect(page.getByText("1 licença encontrada no aparelho")).toBeVisible();
  await page.getByTestId("card-licenca").click();
  await expect(page.getByTestId("aviso-dados-salvos")).toContainText(/Você está sem internet\. Exibindo dados de \d{2}:\d{2}\./);
});

for (const largura of [360, 390]) {
  test(`consulta sem rolagem horizontal em ${largura}px`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 800 });
    await page.goto(URL_LICENCA);
    await buscar(page, "Centro");
    await expect(page.getByTestId("card-licenca")).toHaveCount(2);
    await semRolagemHorizontal(page);
    await page.getByTestId("card-licenca").first().click();
    await expect(page.getByTestId("situacao-licenca")).toBeVisible();
    await semRolagemHorizontal(page);
    for (const el of await page.locator("[data-testid=detalhe-licenca] button:visible, [data-testid=detalhe-licenca] a:visible").all()) {
      expect((await el.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
  });
}
