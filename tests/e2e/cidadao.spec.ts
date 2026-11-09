import { expect, test, type Page } from "@playwright/test";
import { ANO, reiniciarDados, semRolagemHorizontal } from "./helpers";

const LISTA = "/cidadao/meus-processos";
const p = (n: string) => `${ANO}.000.${n}`;

test.beforeEach(async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await reiniciarDados(page);
});

const card = (page: Page, protocolo: string) => page.locator(`[data-testid="card-processo"][data-protocolo="${protocolo}"]`);

async function alvosDeToque(page: Page, escopo: string) {
  for (const el of await page.locator(`${escopo} button:visible, ${escopo} a:visible`).all()) {
    const caixa = (await el.boundingBox())!;
    expect(caixa.height, await el.innerText()).toBeGreaterThanOrEqual(44);
  }
}

/* ------------------------------------------------------------------ Lista */

test("lista: abas, aguardando você em destaque e papel do usuário", async ({ page }) => {
  await page.goto(LISTA);
  await expect(page.getByRole("heading", { name: "Meus processos" })).toBeVisible();
  await expect(page.getByText("Olá, Maria.")).toBeVisible();

  await expect(page.getByRole("tab", { name: "Em andamento (4)" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tab", { name: "Concluídos (1)" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Todos (5)" })).toBeVisible();

  const cards = page.getByTestId("card-processo");
  await expect(cards).toHaveCount(4);
  // "Aguardando você" primeiro.
  await expect(cards.nth(0).getByTestId("indicador-com-quem")).toHaveText(/Aguardando você/);
  await expect(cards.nth(1).getByTestId("indicador-com-quem")).toHaveText(/Aguardando você/);

  const pend = card(page, p("2874"));
  await expect(pend.getByTestId("selo-status-processo")).toHaveText("Situação: Pendente: aguardando você");
  await expect(pend.getByTestId("indicador-com-quem")).toHaveAttribute("data-com-quem", "requerente");
  await expect(pend.getByTestId("indicador-com-quem")).toContainText("Responda à pendência até");

  const analise = card(page, p("3120"));
  await expect(analise.getByTestId("indicador-com-quem")).toHaveText("Com o IMPLURB há 12 dias");
  await expect(analise.getByTestId("meu-papel")).toHaveText("Você é o proprietário");
  await expect(analise).toContainText("Rua Teresina, 250 · Adrianópolis");
  await expect(analise).toContainText(/Atualizado em \d{2}\/\d{2}\/\d{4} às \d{2}:\d{2}/);

  await page.getByRole("tab", { name: "Concluídos (1)" }).click();
  await expect(cards).toHaveCount(1);
  await expect(cards.first().getByTestId("selo-status-processo")).toHaveText("Situação: Alvará emitido");
  await expect(cards.first().getByTestId("indicador-com-quem")).toHaveCount(0);
});

test("lista vazia e isolamento entre cidadãos", async ({ page }) => {
  await page.goto(`${LISTA}?cidadao=c-005`);
  await expect(page.getByTestId("estado-vazio")).toHaveText(
    "Você ainda não tem processos. Para abrir um pedido, use o botão Licenciamento.",
  );

  // O despachante vê o processo de Maria em que atua, mas não os outros dela.
  await page.goto(`${LISTA}?cidadao=c-002`);
  await page.getByRole("tab", { name: /Todos/ }).click();
  await expect(page.getByTestId("card-processo")).toHaveCount(2);
  await expect(card(page, p("4012")).getByTestId("meu-papel")).toHaveText("Você é o despachante");
  await expect(card(page, p("3120"))).toHaveCount(0);

  // Maria abrindo, pela URL, o processo de outra pessoa.
  await page.goto(`${LISTA}/${p("4388")}`);
  await expect(page.getByTestId("estado-erro")).toContainText("Não encontramos este processo entre os seus.");
});

test("lista: skeleton ao carregar e erro de conexão com Tentar novamente", async ({ page }) => {
  let falhar = true;
  await page.route("**/api/cidadao/processos*", async (rota) => {
    await new Promise((r) => setTimeout(r, 400));
    if (falhar) await rota.abort("failed");
    else await rota.continue();
  });
  await page.goto(LISTA);
  await expect(page.getByTestId("card-processo-skeleton").first()).toBeVisible();
  await expect(page.getByTestId("estado-erro")).toContainText("Não foi possível carregar seus processos");
  falhar = false;
  await page.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(page.getByTestId("card-processo")).toHaveCount(4);
});

/* ---------------------------------------------------------------- Detalhe */

test("detalhe com pendência: linha do tempo, responder copiando o protocolo e aviso fixo", async ({ page }) => {
  await page.goto(LISTA);
  await card(page, p("2874")).click();
  await expect(page).toHaveURL(new RegExp(`${LISTA}/${p("2874").replaceAll(".", "\\.")}$`));
  const detalhe = page.getByTestId("detalhe-processo");
  await expect(detalhe.getByRole("heading", { level: 1 })).toHaveText("Alvará de reforma");
  await expect(detalhe.getByTestId("setor-atual")).toHaveText("Análise de projetos");

  const etapas = page.getByTestId("etapa");
  await expect(page.locator('[data-testid="etapa"][data-situacao="concluida"]')).toHaveCount(3);
  await expect(page.locator('[data-testid="etapa"][data-situacao="atual"]')).toContainText("Pendente: aguardando você");
  await expect(etapas.last()).toContainText("Alvará emitido");
  await expect(etapas.last()).toHaveAttribute("data-situacao", "futura");

  const pendencia = page.getByTestId("pendencia-aberta");
  await expect(pendencia).toContainText("Apresentar a ART");
  await expect(pendencia).toContainText(/Responda até\s*\d{2}\/\d{2}\/\d{4} \(faltam 27 dias\)/);

  const responder = page.getByRole("button", { name: "Responder pendência" });
  await responder.click();
  await expect(page.getByTestId("aviso")).toHaveText(
    "Protocolo copiado. Abra o canal Responder Pendência, em Licenciamento, e cole no primeiro campo.",
  );
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(p("2874"));

  await expect(page.getByTestId("aviso-cobranca")).toHaveText(
    "O IMPLURB só cobra taxas por guia oficial, que aparece neste app. Nenhuma pendência é cobrada fora daqui.",
  );
  await alvosDeToque(page, "[data-testid=detalhe-processo]");
});

test("detalhe aberto por despachante: proprietária vê quem tem acesso", async ({ page }) => {
  await page.goto(`${LISTA}/${p("4012")}`);
  const acesso = page.getByTestId("secao-acesso");
  await expect(acesso.getByTestId("participante")).toHaveCount(3);
  await expect(acesso).toContainText("Maria das Graças Souza (você)");
  await expect(acesso).toContainText("José Carlos Ferreira");
  await expect(acesso).toContainText("Despachante · ***.452.369-**");
  await expect(page.getByTestId("aberto-por")).toHaveText("Pedido feito por José Carlos Ferreira (despachante).");
  await expect(acesso).toContainText(
    "Só estas pessoas podem acompanhar este processo. Se você não reconhece alguém, use o canal Denunciar Cobrança Indevida.",
  );
  await expect(page.getByTestId("sem-pendencias")).toBeVisible();
  await expect(page.getByTestId("indicador-com-quem")).toHaveText("Com o IMPLURB há 4 dias");
});

test("detalhe: guias e documento emitido em PDF", async ({ page }) => {
  await page.goto(`${LISTA}/${p("1955")}`);
  const taxas = page.getByTestId("secao-taxas");
  await expect(taxas.getByTestId("guia")).toHaveCount(2);
  await expect(taxas.getByTestId("guia").first()).toContainText("R$ 1.248,36");
  await expect(taxas.getByTestId("guia").first()).toContainText("Em aberto");
  await taxas.getByRole("button", { name: "Ver guias" }).click();
  await expect(page.getByTestId("aviso")).toHaveText("Protocolo copiado. Abra o canal Emitir Guia de Taxas e cole no primeiro campo.");

  await page.goto(`${LISTA}/${p("0731")}`);
  const doc = page.getByTestId("documento-emitido");
  await expect(doc).toContainText(`ALV-${ANO}-00731`);
  await expect(doc).toContainText("LF-7KQ3-M9XA-2P");
  const download = page.waitForEvent("download");
  await doc.getByRole("link", { name: "Baixar PDF" }).click();
  expect((await download).suggestedFilename()).toBe(`ALV-${ANO}-00731.pdf`);
});

/* --------------------------------------------------------------- Consulta */

async function consultar(page: Page, protocolo: string) {
  await page.getByLabel("Número do protocolo").fill(protocolo);
  await page.getByRole("button", { name: "Consultar" }).click();
}

test("consulta pública: dados mínimos, sem dados pessoais", async ({ page }) => {
  await page.goto("/consultar");
  await expect(page.getByText("Use esta consulta para conferir o andamento informado por terceiros.")).toBeVisible();
  await consultar(page, `${ANO}0002874`);
  const r = page.getByTestId("resultado-consulta");
  await expect(r).toContainText(p("2874"));
  await expect(r).toContainText("Alvará de reforma");
  await expect(r).toContainText("Parque 10 de Novembro");
  await expect(r.getByTestId("selo-status-processo")).toHaveText("Situação: Pendente: aguardando você");
  await expect(r.getByTestId("tem-pendencia")).toHaveText("Sim");
  await expect(r.getByTestId("tem-guia")).toHaveText("Não");
  const texto = await page.locator("body").innerText();
  for (const proibido of ["Rio Içá", "Maria", "Pedro Henrique", "***.", "R$"]) expect(texto).not.toContain(proibido);
  await expect(page).toHaveURL(new RegExp(`protocolo=${p("2874").replaceAll(".", "\\.")}`));

  await consultar(page, `${ANO}.000.9999`);
  await expect(page.getByTestId("consulta-nao-encontrada")).toHaveText("Não encontramos este protocolo. Confira o número e tente de novo.");

  await consultar(page, "123");
  await expect(page.getByText("Digite os 11 números do protocolo, como 2026.000.4587.")).toBeVisible();
});

test("consulta pública: captcha depois de 5 consultas", async ({ page }) => {
  await page.goto("/consultar");
  for (let i = 0; i < 5; i++) {
    await consultar(page, p("1955"));
    await expect(page.getByTestId("resultado-consulta")).toBeVisible();
  }
  await consultar(page, p("1955"));
  const captcha = page.getByTestId("captcha");
  await expect(captcha).toContainText("Confirme que você não é um robô");
  const pergunta = await captcha.locator("label").innerText();
  const [a, b] = pergunta.match(/\d+/g)!.map(Number);
  await captcha.getByLabel(pergunta).fill(String(a + b));
  await captcha.getByRole("button", { name: "Confirmar" }).click();
  await expect(page.getByTestId("resultado-consulta").getByTestId("tem-guia")).toHaveText("Sim");
});

/* --------------------------------------------------------------- Validação */

test("validar: os quatro resultados", async ({ page }) => {
  await page.goto("/validar?codigo=LF7KQ3M9XA2P");
  const r = page.getByTestId("resultado-validacao");
  await expect(r).toHaveAttribute("data-resultado", "valido");
  await expect(r).toContainText("Documento válido");
  for (const t of [`ALV-${ANO}-00731`, "Alvará de ampliação", "Parque 10 de Novembro", "Ana Paula Moraes", "Emitido em", "até "]) {
    await expect(r).toContainText(t);
  }
  await expect(page.getByLabel("Código de validação")).toHaveValue("LF-7KQ3-M9XA-2P");

  const validar = async (codigo: string) => {
    await page.getByLabel("Código de validação").fill(codigo);
    await page.getByRole("button", { name: "Validar" }).click();
  };

  await validar("lf-3mpx-8rtd-4k");
  await expect(r).toHaveAttribute("data-resultado", "vencido");
  await expect(r).toContainText(/Este documento venceu em \d{2}\/\d{2}\/\d{4}\./);
  await expect(r).toContainText(`ALV-${ANO - 2}-01187`);

  await validar("LF-9ZQW-2HNB-6C");
  await expect(r).toHaveAttribute("data-resultado", "cancelado_ou_suspenso");
  await expect(r).toContainText("Documento cancelado");
  await expect(r).not.toContainText("ALV-");

  await validar("LF-5TVA-7JKE-3R");
  await expect(r).toContainText("Documento suspenso");

  await validar("LF-0000-0000-00");
  await expect(r).toHaveAttribute("data-resultado", "nao_encontrado");
  await expect(r).toContainText("Este código não corresponde a nenhum documento emitido pelo IMPLURB.");
});

/* ------------------------------------------------------- Layout e temas */

for (const largura of [360, 390]) {
  test(`sem rolagem horizontal em ${largura}px, nas quatro telas`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 800 });
    await page.goto(LISTA);
    await expect(page.getByTestId("card-processo").first()).toBeVisible();
    await semRolagemHorizontal(page);
    await alvosDeToque(page, "main");

    await page.goto(`${LISTA}/${p("4012")}`);
    await expect(page.getByTestId("secao-acesso")).toBeVisible();
    await semRolagemHorizontal(page);

    await page.goto(`/consultar?protocolo=${p("1955")}`);
    await expect(page.getByTestId("resultado-consulta")).toBeVisible();
    await semRolagemHorizontal(page);

    await page.goto("/validar?codigo=LF3MPX8RTD4K");
    await expect(page.getByTestId("resultado-validacao")).toBeVisible();
    await semRolagemHorizontal(page);
  });
}

test("tema escuro e corpo com 16 px", async ({ page }) => {
  await page.goto(`${LISTA}/${p("2874")}?tema=dark`);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByTestId("pendencia-aberta")).toBeVisible();
  const tamanho = await page.getByTestId("pendencia-aberta").locator("p").first().evaluate((el) => getComputedStyle(el).fontSize);
  expect(parseFloat(tamanho)).toBeGreaterThanOrEqual(16);
  // O ?tema= segue ao voltar para a lista.
  await page.getByRole("link", { name: "Meus processos" }).click();
  await expect(page).toHaveURL(/tema=dark/);
});
