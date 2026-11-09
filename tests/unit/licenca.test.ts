// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import {
  filtrarLicencas,
  interpretarBusca,
  situacaoLicenca,
  textoValidade,
  type BuscaInterpretada,
} from "@/domain/licenca";
import { FISCAIS_MOCK } from "@/server/auth";
import { gerarLicencasMock } from "@/server/licencas-mock";
import {
  buscarLicencas,
  ErroLicenca,
  LicencasEmMemoria,
  mascararDocumento,
  obterLicenca,
} from "@/server/licencas-service";
import { GET as GET_BUSCA } from "../../app/api/fiscal/licencas/route";
import { GET as GET_DETALHE } from "../../app/api/fiscal/licencas/[numero]/route";

const HOJE = "2026-11-10";
const carlos = FISCAIS_MOCK["f-001"];

describe("situação da licença", () => {
  const ativa = (validade: string | null) => ({ status_cadastro: "ativa" as const, validade });
  it("válida, vence em breve (≤ 30 dias) e vencida pela validade", () => {
    expect(situacaoLicenca(ativa("2027-01-01"), HOJE)).toBe("valida");
    expect(situacaoLicenca(ativa("2026-12-10"), HOJE)).toBe("vence_em_breve");
    expect(situacaoLicenca(ativa("2026-12-11"), HOJE)).toBe("valida");
    expect(situacaoLicenca(ativa(HOJE), HOJE)).toBe("vence_em_breve");
    expect(situacaoLicenca(ativa("2026-11-09"), HOJE)).toBe("vencida");
    expect(situacaoLicenca(ativa(null), HOJE)).toBe("vencida");
  });
  it("status do cadastro prevalece sobre a validade", () => {
    expect(situacaoLicenca({ status_cadastro: "suspensa", validade: "2030-01-01" }, HOJE)).toBe("suspensa");
    expect(situacaoLicenca({ status_cadastro: "cancelada", validade: "2030-01-01" }, HOJE)).toBe("cancelada");
    expect(situacaoLicenca({ status_cadastro: "em_analise", validade: null }, HOJE)).toBe("em_analise");
  });
  it("texto da validade", () => {
    const base = { status_cadastro: "ativa" as const, motivo_status: null, historico: [] };
    expect(textoValidade({ ...base, validade: "2027-03-15" }, HOJE)).toBe("Válida até 15/03/2027.");
    expect(textoValidade({ ...base, validade: "2026-11-28" }, HOJE)).toBe("Vence em 18 dias (28/11/2026).");
    expect(textoValidade({ ...base, validade: HOJE }, HOJE)).toBe("Vence hoje (10/11/2026).");
    expect(textoValidade({ ...base, validade: "2026-10-03" }, HOJE)).toBe("Venceu em 03/10/2026 (há 38 dias).");
  });
});

describe("interpretarBusca", () => {
  it("reconhece o tipo pelo formato", () => {
    expect(interpretarBusca("ALV-2026-00412")).toEqual({ tipo: "alvara", valor: "ALV-2026-00412" });
    expect(interpretarBusca(" alv-2026 ")).toEqual({ tipo: "alvara", valor: "ALV-2026" });
    expect(interpretarBusca("2026.000.4587")).toEqual({ tipo: "processo", valor: "2026.000.4587" });
    expect(interpretarBusca("20260004587")).toEqual({ tipo: "processo", valor: "20260004587" });
    expect(interpretarBusca("Rua  Pará")).toEqual({ tipo: "endereco", valor: "rua para" });
  });
  it("recusa termos curtos", () => {
    expect(interpretarBusca("Ru")).toBeNull();
    expect(interpretarBusca("   ")).toBeNull();
  });
});

describe("filtrarLicencas", () => {
  const lista = gerarLicencasMock(HOJE);
  const busca = (t: string) => interpretarBusca(t) as BuscaInterpretada;
  it("busca por endereço ignora acentos e exige todas as palavras", () => {
    expect(filtrarLicencas(lista, busca("rua para adrianopolis")).map((l) => l.endereco)).toEqual([
      "Rua Pará, 150",
      "Rua Pará, 300",
    ]);
    expect(filtrarLicencas(lista, busca("centro")).map((l) => l.bairro)).toEqual(["Centro", "Centro"]);
  });
  it("busca por processo aceita só dígitos", () => {
    expect(filtrarLicencas(lista, busca("20260004587"))).toHaveLength(1);
  });
  it("busca por alvará aceita prefixo e coloca o exato primeiro", () => {
    const r = filtrarLicencas(lista, busca("ALV-2026-00"));
    expect(r.length).toBeGreaterThan(1);
    expect(filtrarLicencas(lista, busca("ALV-2026-00412"))[0].numero_alvara).toBe("ALV-2026-00412");
  });
});

describe("mascararDocumento (LGPD)", () => {
  it("mascara CPF e CNPJ", () => {
    expect(mascararDocumento("52398714620")).toBe("***.987.146-**");
    expect(mascararDocumento("12.345.678/0001-90")).toBe("**.345.678/0001-**");
    expect(mascararDocumento("123")).toBe("Não informado");
  });
});

describe("serviço de licenças", () => {
  let repo: LicencasEmMemoria;
  const deps = () => ({ repo, agora: () => new Date("2026-11-10T14:00:00Z") });
  beforeEach(() => {
    repo = new LicencasEmMemoria(gerarLicencasMock(HOJE));
  });

  it("busca devolve resumos, sem documento do proprietário, e registra a consulta", async () => {
    const r = await buscarLicencas(deps(), carlos, "Adrianópolis");
    expect(r.tipo_busca).toBe("endereco");
    expect(r.resultados).toHaveLength(2);
    expect(JSON.stringify(r)).not.toMatch(/documento|84512367091/);
    expect(await repo.listarConsultas()).toEqual([
      { usuario_id: "f-001", tipo: "busca", termo: "Adrianópolis", em: "2026-11-10T10:00:00-04:00" },
    ]);
  });

  it("busca curta é recusada", async () => {
    await expect(buscarLicencas(deps(), carlos, "ab")).rejects.toMatchObject({ httpStatus: 400, codigo: "BUSCA_CURTA" });
  });

  it("detalhe por alvará ou por processo, com documento mascarado", async () => {
    const porAlvara = await obterLicenca(deps(), carlos, "alv-2026-00412");
    expect(porAlvara.numero_processo).toBe("2026.000.1876");
    expect(porAlvara.proprietario.documento_mascarado).toBe("***.987.146-**");
    expect(JSON.stringify(porAlvara)).not.toContain("52398714620");

    const emAnalise = await obterLicenca(deps(), carlos, "2026.000.4587");
    expect(emAnalise.numero_alvara).toBeNull();
    expect((await repo.listarConsultas()).map((c) => c.tipo)).toEqual(["detalhe", "detalhe"]);
  });

  it("404 para número inexistente ou malformado", async () => {
    for (const n of ["ALV-2026-99999", "qualquer coisa"]) {
      const e = await obterLicenca(deps(), carlos, n).catch((x) => x);
      expect(e).toBeInstanceOf(ErroLicenca);
      expect(e.httpStatus).toBe(404);
    }
  });
});

describe("rotas /api/fiscal/licencas", () => {
  const req = (url: string, headers: Record<string, string> = {}) => new Request(`http://localhost${url}`, { headers });

  it("busca: 200, 400 e 401", async () => {
    expect((await GET_BUSCA(req("/api/fiscal/licencas?q=Centro"))).status).toBe(200);
    expect((await GET_BUSCA(req("/api/fiscal/licencas?q=a"))).status).toBe(400);
    expect((await GET_BUSCA(req("/api/fiscal/licencas?q=Centro", { "x-fiscal-id": "intruso" }))).status).toBe(401);
  });

  it("detalhe: 200, 404 e 401", async () => {
    const ano = new Date().getFullYear();
    const ok = await GET_DETALHE(req("/x"), { params: Promise.resolve({ numero: `ALV-${ano}-00412` }) });
    expect(ok.status).toBe(200);
    expect((await ok.json()).licenca.proprietario.documento_mascarado).toMatch(/^\*\*\*\./);
    expect((await GET_DETALHE(req("/x"), { params: Promise.resolve({ numero: "ALV-1999-00001" }) })).status).toBe(404);
    expect(
      (await GET_DETALHE(req("/x", { "x-fiscal-id": "x" }), { params: Promise.resolve({ numero: `ALV-${ano}-00412` }) })).status,
    ).toBe(401);
  });
});
