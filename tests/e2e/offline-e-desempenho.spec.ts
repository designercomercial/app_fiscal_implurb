import { expect, test } from "@playwright/test";
import { abrirPagina, cod, reiniciarDados, URL_PAGINA } from "./helpers";

test.beforeEach(async ({ page }) => reiniciarDados(page));

const AVISO_OFFLINE = /^Você está sem internet\. Exibindo dados de \d{2}:\d{2}\./;

test("offline com a página aberta: mantém a lista e avisa o horário", async ({ page, context }) => {
  await abrirPagina(page);
  await context.setOffline(true);
  await expect(page.getByTestId("aviso-conexao")).toContainText(AVISO_OFFLINE);
  await page.getByRole("button", { name: "Atualizar lista" }).click();
  await expect(page.getByTestId("card-acao")).toHaveCount(5);

  // Mudança de status fica bloqueada sem internet
  await page.getByTestId("card-acao").first().click();
  await expect(page.getByText("Sem internet. Conecte-se para mudar o status.")).toBeVisible();

  await context.setOffline(false);
  await expect(page.getByTestId("aviso-conexao")).toHaveCount(0);
});

test("offline ao reabrir a página: exibe a última lista salva", async ({ page, context }) => {
  await abrirPagina(page);
  // espera o service worker controlar a página
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect(page.getByTestId("card-acao").first()).toBeVisible();
  expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByTestId("aviso-conexao")).toContainText(AVISO_OFFLINE);
  await expect(page.getByTestId("card-acao")).toHaveCount(5);
});

test("abre em até 2 s com 30 ações em 4G simulado", async ({ page, context }) => {
  // 30 ações: as 8 do mock + 22 geradas
  await page.route("**/api/fiscal/acoes-do-dia*", async (route) => {
    const corpo = await (await route.fetch()).json();
    const base = corpo.acoes[0];
    const extras = Array.from({ length: 22 }, (_, i) => ({
      ...base,
      codigo: cod(2000 + i),
      status: "pendente",
      ordem_rota: 9 + i,
    }));
    const acoes = [...corpo.acoes, ...extras];
    await route.fulfill({ json: { ...corpo, acoes, resumo: { ...corpo.resumo, total: 30, pendentes: 27 } } });
  });

  // Perfil "4G lento" do Lighthouse: 150 ms RTT, 1,6 Mbps de download, 750 kbps de upload
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 150,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
  });
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });

  const inicio = Date.now();
  await page.goto(URL_PAGINA);
  await page.getByRole("tab", { name: /Todas/ }).click();
  await expect(page.getByTestId("card-acao")).toHaveCount(30);
  const tempo = Date.now() - inicio;
  console.log(`Lista com 30 ações em 4G simulado: ${tempo} ms`);
  expect(tempo).toBeLessThan(2000);
});
