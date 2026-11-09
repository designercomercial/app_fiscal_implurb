import { expect, type Page } from "@playwright/test";

export const URL_PAGINA = "/fiscal/acoes-do-dia";

/** Volta os dados mock ao estado inicial antes de cada teste. */
export async function reiniciarDados(page: Page) {
  const r = await page.request.post("/api/dev/reiniciar");
  expect(r.ok()).toBe(true);
}

export async function abrirPagina(page: Page, query = "") {
  await page.goto(`${URL_PAGINA}${query}`);
  await expect(page.getByTestId("card-acao").first()).toBeVisible();
}

export function card(page: Page, codigo: string) {
  return page.locator(`[data-testid="card-acao"][data-codigo="${codigo}"]`);
}

export async function semRolagemHorizontal(page: Page) {
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(scrollWidth, "a página não deve rolar na horizontal").toBeLessThanOrEqual(innerWidth);
}

export const ANO = new Date().getFullYear();
export const cod = (n: number) => `ACAO-${ANO}-${String(n).padStart(6, "0")}`;
