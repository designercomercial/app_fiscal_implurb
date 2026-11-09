import { defineConfig, devices } from "@playwright/test";

/**
 * Testes de tela contra o build de PRODUÇÃO (medição de desempenho realista),
 * em pasta e porta próprias para não interferir no `npm run dev`.
 */
const PORTA = 3100;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1, // os dados mock ficam em memória no servidor: os testes rodam em série
  retries: 0,
  reporter: [["list"]],
  timeout: 30_000,
  use: {
    baseURL: `http://localhost:${PORTA}`,
    ...devices["Pixel 7"],
    viewport: { width: 390, height: 844 },
    locale: "pt-BR",
    timezoneId: "America/Manaus",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium-mobile", use: { browserName: "chromium" } }],
  webServer: {
    command: `npm run build && npx next start -p ${PORTA}`,
    url: `http://localhost:${PORTA}/fiscal/acoes-do-dia`,
    timeout: 240_000,
    reuseExistingServer: !process.env.CI,
    env: { NEXT_DIST_DIR: ".next-e2e", LF_HABILITAR_SIMULADOR: "1" },
  },
});
