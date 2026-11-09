// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import { GET } from "../../app/api/fiscal/acoes-do-dia/route";
import { POST } from "../../app/api/fiscal/acoes/[codigo]/status/route";
import { reiniciarRepositorioMock } from "@/server/acoes-repo";
import type { RespostaAcoesDoDia } from "@/domain/acao";

/** Testes de back-end pelas rotas HTTP: o isolamento entre fiscais é garantido no servidor. */
const BASE = "http://localhost/api/fiscal";

function get(headers: Record<string, string> = {}, qs = "") {
  return GET(new Request(`${BASE}/acoes-do-dia${qs}`, { headers }));
}

function post(codigo: string, body: unknown, headers: Record<string, string> = {}) {
  return POST(
    new Request(`${BASE}/acoes/${codigo}/status`, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
    { params: Promise.resolve({ codigo }) },
  );
}

beforeEach(() => reiniciarRepositorioMock());

describe("GET /api/fiscal/acoes-do-dia", () => {
  it("lista só as ações do fiscal autenticado", async () => {
    const r1 = (await (await get({ "x-fiscal-id": "f-001" })).json()) as RespostaAcoesDoDia;
    const r2 = (await (await get({ "x-fiscal-id": "f-002" })).json()) as RespostaAcoesDoDia;
    const deCarlos = new Set(r1.acoes.map((a) => a.codigo));
    expect(r1.acoes).toHaveLength(8);
    expect(r2.acoes).toHaveLength(1);
    expect(r2.acoes.every((a) => !deCarlos.has(a.codigo))).toBe(true);
    expect(JSON.stringify(r1)).not.toContain("fiscal_id");
  });

  it("401 sem fiscal válido", async () => {
    expect((await get({ "x-fiscal-id": "intruso" })).status).toBe(401);
  });

  it("400 com data inválida", async () => {
    expect((await get({}, "?data=10-11-2026")).status).toBe(400);
  });

  it("não deixa a resposta ser guardada em cache HTTP", async () => {
    expect((await get()).headers.get("cache-control")).toBe("no-store");
  });
});

describe("POST /api/fiscal/acoes/{codigo}/status", () => {
  it("200 em transição válida", async () => {
    const r = await post("ACAO-2026-001245", { status: "em_deslocamento" });
    expect(r.status).toBe(200);
    expect((await r.json()).acao.status).toBe("em_deslocamento");
  });

  it("404 ao tentar alterar ação de outro fiscal, sem alterar nada", async () => {
    const r = await post("ACAO-2026-001245", { status: "em_deslocamento" }, { "x-fiscal-id": "f-002" });
    expect(r.status).toBe(404);
    const lista = (await (await get({ "x-fiscal-id": "f-001" })).json()) as RespostaAcoesDoDia;
    expect(lista.acoes.find((a) => a.codigo === "ACAO-2026-001245")?.status).toBe("pendente");
  });

  it("409 em transição inválida e na tentativa de concluir pela página", async () => {
    expect((await post("ACAO-2026-001245", { status: "em_execucao" })).status).toBe(409);
    const r = await post("ACAO-2026-001250", { status: "concluida" });
    expect(r.status).toBe(409);
    expect((await r.json()).erro.codigo).toBe("CONCLUSAO_SOMENTE_PELO_FORMULARIO");
  });

  it("400 sem motivo e com JSON inválido", async () => {
    expect((await post("ACAO-2026-001245", { status: "nao_realizada" })).status).toBe(400);
    expect((await post("ACAO-2026-001245", "{isto nao e json")).status).toBe(400);
  });

  it("401 sem fiscal válido", async () => {
    expect((await post("ACAO-2026-001245", { status: "em_deslocamento" }, { "x-fiscal-id": "x" })).status).toBe(401);
  });
});
