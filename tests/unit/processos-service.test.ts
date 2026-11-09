// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import { CIDADAOS_MOCK } from "@/server/auth-cidadao";
import { CaptchaMock } from "@/server/captcha";
import { LIMITE_CONSULTA, LimitadorConsultas, reiniciarLimites } from "@/server/limite-consultas";
import { gerarProcessosMock } from "@/server/processos-mock";
import {
  consultarPublico,
  ErroProcesso,
  listarMeusProcessos,
  obterDocumentoDoParticipante,
  obterMeuProcesso,
  ProcessosEmMemoria,
  reiniciarProcessosMock,
  validarDocumento,
} from "@/server/processos-service";
import { GET as GET_LISTA } from "../../app/api/cidadao/processos/route";
import { GET as GET_DETALHE } from "../../app/api/cidadao/processos/[protocolo]/route";
import { GET as GET_PDF } from "../../app/api/cidadao/documentos/[numero]/pdf/route";
import { GET as GET_CONSULTA } from "../../app/api/publico/consulta/[protocolo]/route";
import { GET as GET_VALIDAR } from "../../app/api/publico/validar/[codigo]/route";

const HOJE = "2026-11-10";
const cid = (id: string) => ({ id, nome: CIDADAOS_MOCK[id].nome });
const MARIA = cid("c-001");
const JOSE = cid("c-002");
const ANA = cid("c-003");
const RAIMUNDO = cid("c-004");
const LUCIA = cid("c-005");

let deps: { repo: ProcessosEmMemoria; hoje: () => string };
beforeEach(() => {
  deps = { repo: new ProcessosEmMemoria(gerarProcessosMock(HOJE)), hoje: () => HOJE };
});

const protocolos = async (c: { id: string; nome: string }) =>
  (await listarMeusProcessos(deps, c)).processos.map((p) => p.protocolo).sort();

describe("controle de acesso (critério 1)", () => {
  it("cada cidadão vê só os processos em que é participante", async () => {
    expect(await protocolos(MARIA)).toEqual(["2026.000.0731", "2026.000.1955", "2026.000.2874", "2026.000.3120", "2026.000.4012"]);
    expect(await protocolos(JOSE)).toEqual(["2026.000.4012", "2026.000.4388"]);
    expect(await protocolos(ANA)).toEqual(["2026.000.0731", "2026.000.1955", "2026.000.3120"]);
    expect(await protocolos(RAIMUNDO)).toHaveLength(4);
    expect(await protocolos(LUCIA)).toEqual([]);
  });

  it("detalhe de processo de outra pessoa responde 404, igual a protocolo inexistente", async () => {
    for (const [c, p] of [
      [MARIA, "2026.000.4388"],
      [JOSE, "2026.000.3120"],
      [LUCIA, "2026.000.3120"],
      [MARIA, "2026.000.9999"],
    ] as const) {
      const e = await obterMeuProcesso(deps, c, p).catch((x) => x);
      expect(e, `${c.nome} → ${p}`).toBeInstanceOf(ErroProcesso);
      expect(e.httpStatus).toBe(404);
      expect(e.message).toBe("Não encontramos este processo entre os seus.");
    }
  });

  it("PDF do documento só para participantes", async () => {
    await expect(obterDocumentoDoParticipante(deps, MARIA, "ALV-2026-00731")).resolves.toBeTruthy();
    await expect(obterDocumentoDoParticipante(deps, ANA, "alv-2026-00731")).resolves.toBeTruthy();
    await expect(obterDocumentoDoParticipante(deps, JOSE, "ALV-2026-00731")).rejects.toMatchObject({ httpStatus: 404 });
  });

  it("papel do usuário no processo", async () => {
    const lista = (await listarMeusProcessos(deps, ANA)).processos;
    expect(new Set(lista.map((p) => p.meu_papel))).toEqual(new Set(["responsavel_tecnico"]));
    expect((await obterMeuProcesso(deps, JOSE, "2026.000.4012")).meu_papel).toBe("despachante");
  });
});

describe("proprietário vê o processo aberto por despachante (critério 4)", () => {
  it("lista o despachante em quem tem acesso e mostra quem deu entrada", async () => {
    const p = await obterMeuProcesso(deps, MARIA, "20260004012");
    expect(p.meu_papel).toBe("proprietario");
    expect(p.aberto_por).toEqual({ nome: "José Carlos Ferreira", papel: "despachante" });
    expect(p.participantes).toContainEqual({
      nome: "José Carlos Ferreira",
      papel: "despachante",
      documento_mascarado: "***.452.369-**",
      voce: false,
    });
    expect(p.participantes.find((x) => x.voce)?.nome).toBe("Maria das Graças Souza");
    expect(JSON.stringify(p)).not.toMatch(/70145236988|52398714620/);
  });
});

describe("indicador por processo (critério 3)", () => {
  it("dias com o IMPLURB e aguardando você", async () => {
    const lista = Object.fromEntries((await listarMeusProcessos(deps, MARIA)).processos.map((p) => [p.protocolo, p]));
    expect(lista["2026.000.3120"]).toMatchObject({ com_quem_esta: "orgao", dias_na_etapa: 12 });
    expect(lista["2026.000.2874"]).toMatchObject({ com_quem_esta: "requerente", prazo_acao_cidadao: "2026-12-07" });
    expect(lista["2026.000.1955"]).toMatchObject({ com_quem_esta: "requerente", prazo_acao_cidadao: "2026-11-18" });
    expect(lista["2026.000.0731"]).toMatchObject({ com_quem_esta: null, status: "documento_emitido" });
    expect(lista["2026.000.4012"]).toMatchObject({ com_quem_esta: "orgao", dias_na_etapa: 4 });
  });
});

describe("consulta pública sem dados pessoais (critério 2)", () => {
  it("devolve só os campos mínimos", async () => {
    const c = await consultarPublico(deps, "2026.000.2874");
    expect(Object.keys(c).sort()).toEqual([
      "atualizado_em",
      "bairro_obra",
      "protocolo",
      "status",
      "tem_guia_em_aberto",
      "tem_pendencia_aberta",
      "tipo",
    ]);
    expect(c).toMatchObject({ bairro_obra: "Parque 10 de Novembro", tem_pendencia_aberta: true, tem_guia_em_aberto: false });
    expect((await consultarPublico(deps, "2026.000.1955")).tem_guia_em_aberto).toBe(true);
  });

  it("nenhuma consulta expõe nome, CPF/CNPJ, endereço completo ou valores", async () => {
    const todos = await deps.repo.listarTodos();
    for (const p of todos) {
      const json = JSON.stringify(await consultarPublico(deps, p.protocolo));
      for (const pessoa of p.participantes) {
        expect(json).not.toContain(pessoa.nome);
        expect(json).not.toContain(pessoa.documento);
        expect(json).not.toContain(pessoa.documento.slice(3, 9));
      }
      expect(json).not.toContain(p.endereco_obra);
      for (const g of p.guias) {
        expect(json).not.toContain(String(g.valor));
        expect(json).not.toContain(g.valor.toFixed(2).replace(".", ","));
      }
      expect(json).not.toMatch(/R\$/);
      expect(json).not.toMatch(/"[^"]*(valor|nome|documento|endereco|participantes)[^"]*"\s*:/i);
    }
  });

  it("protocolo inexistente e inválido", async () => {
    await expect(consultarPublico(deps, "2026.000.9999")).rejects.toMatchObject({
      httpStatus: 404,
      message: "Não encontramos este protocolo. Confira o número e tente de novo.",
    });
    await expect(consultarPublico(deps, "123")).rejects.toMatchObject({ httpStatus: 400 });
  });
});

describe("validação do documento (critério 5)", () => {
  it("os quatro resultados", async () => {
    const valido = await validarDocumento(deps, "lf-7kq3-m9xa-2p");
    expect(valido).toEqual({
      resultado: "valido",
      documento: {
        tipo: "Alvará de ampliação",
        numero: "ALV-2026-00731",
        emitido_em: "2026-09-22T10:30:00-04:00",
        validade: "2028-09-21",
        bairro_obra: "Parque 10 de Novembro",
        responsavel_tecnico: "Ana Paula Moraes",
      },
    });
    const vencido = await validarDocumento(deps, "LF3MPX8RTD4K");
    expect(vencido).toMatchObject({ resultado: "vencido", documento: { validade: "2026-10-03", numero: "ALV-2024-01187" } });
    expect(await validarDocumento(deps, "LF9ZQW2HNB6C")).toEqual({ resultado: "cancelado_ou_suspenso", situacao: "cancelado" });
    expect(await validarDocumento(deps, "LF5TVA7JKE3R")).toEqual({ resultado: "cancelado_ou_suspenso", situacao: "suspenso" });
    expect(await validarDocumento(deps, "LF0000000000")).toEqual({ resultado: "nao_encontrado" });
  });

  it("cancelado ou suspenso não traz nenhum dado do documento", async () => {
    const json = JSON.stringify(await validarDocumento(deps, "LF9ZQW2HNB6C"));
    expect(json).not.toMatch(/ALV-|Praça|Francisco|emitido|validade/);
  });
});

describe("limite de consultas e captcha", () => {
  it("5 sem captcha, depois exige captcha; acertar libera mais 5; teto por hora", () => {
    const l = new LimitadorConsultas(LIMITE_CONSULTA);
    const t0 = 1_000_000;
    for (let i = 0; i < 5; i++) expect(l.verificar("ip", t0 + i, false)).toEqual({ permitido: true });
    expect(l.verificar("ip", t0 + 5, false)).toEqual({ permitido: false, motivo: "captcha" });
    expect(l.verificar("outro-ip", t0 + 5, false)).toEqual({ permitido: true });
    expect(l.verificar("ip", t0 + 6, true)).toEqual({ permitido: true });
    for (let i = 0; i < 4; i++) expect(l.verificar("ip", t0 + 7 + i, false).permitido).toBe(true);
    expect(l.verificar("ip", t0 + 20, false)).toEqual({ permitido: false, motivo: "captcha" });
    // Passados 10 minutos, volta a liberar sem captcha.
    expect(l.verificar("ip", t0 + 10 * 60_000 + 20, false).permitido).toBe(true);
    // Teto: 30 por hora, mesmo com captcha.
    let ultima;
    for (let i = 0; i < 40; i++) ultima = l.verificar("ip", t0 + 11 * 60_000 + i, true);
    expect(ultima).toMatchObject({ permitido: false, motivo: "limite" });
  });

  it("captcha mock: resposta certa uma vez só", async () => {
    const c = new CaptchaMock();
    const d = await c.gerarDesafio();
    expect(d.pergunta).toMatch(/^Quanto é \d \+ \d\?$/);
    const resposta = c.respostaDe(d.id)!;
    expect(await c.verificar(`${d.id}:${resposta}`)).toBe(true);
    expect(await c.verificar(`${d.id}:${resposta}`)).toBe(false);
    const d2 = await c.gerarDesafio();
    expect(await c.verificar(`${d2.id}:999`)).toBe(false);
  });
});

describe("rotas", () => {
  const ano = new Date().getFullYear();
  const req = (url: string, headers: Record<string, string> = {}) => new Request(`http://localhost${url}`, { headers });
  const params = <T,>(v: T) => ({ params: Promise.resolve(v) });
  beforeEach(() => {
    reiniciarProcessosMock();
    reiniciarLimites();
  });

  it("com login: 200, 401 e 404 para processo de outra pessoa", async () => {
    expect((await GET_LISTA(req("/api/cidadao/processos"))).status).toBe(200);
    expect((await GET_LISTA(req("/api/cidadao/processos", { "x-cidadao-id": "intruso" }))).status).toBe(401);
    expect((await GET_DETALHE(req("/x"), params({ protocolo: `${ano}.000.3120` }))).status).toBe(200);
    expect((await GET_DETALHE(req("/x"), params({ protocolo: `${ano}.000.4388` }))).status).toBe(404);
    expect((await GET_DETALHE(req("/x?cidadao=c-002"), params({ protocolo: `${ano}.000.4388` }))).status).toBe(200);
  });

  it("PDF: participante baixa, outra pessoa não", async () => {
    const ok = await GET_PDF(req("/x"), params({ numero: `ALV-${ano}-00731` }));
    expect(ok.status).toBe(200);
    expect(ok.headers.get("content-type")).toBe("application/pdf");
    expect(new TextDecoder().decode((await ok.arrayBuffer()).slice(0, 8))).toBe("%PDF-1.4");
    expect((await GET_PDF(req("/x?cidadao=c-002"), params({ numero: `ALV-${ano}-00731` }))).status).toBe(404);
  });

  it("consulta pública: captcha depois de 5 consultas do mesmo IP", async () => {
    const h = { "x-forwarded-for": "200.1.2.3" };
    for (let i = 0; i < 5; i++) {
      expect((await GET_CONSULTA(req("/x", h), params({ protocolo: `${ano}.000.2874` }))).status).toBe(200);
    }
    const barrada = await GET_CONSULTA(req("/x", h), params({ protocolo: `${ano}.000.2874` }));
    expect(barrada.status).toBe(429);
    const corpo = await barrada.json();
    expect(corpo.erro.codigo).toBe("CAPTCHA_OBRIGATORIO");
    const [a, b] = corpo.captcha.pergunta.match(/\d+/g).map(Number);
    const comCaptcha = await GET_CONSULTA(
      req("/x", { ...h, "x-captcha-token": `${corpo.captcha.id}:${a + b}` }),
      params({ protocolo: `${ano}.000.2874` }),
    );
    expect(comCaptcha.status).toBe(200);
    expect((await GET_CONSULTA(req("/x", { "x-forwarded-for": "200.9.9.9" }), params({ protocolo: `${ano}.000.0000` }))).status).toBe(404);
  });

  it("validação pública", async () => {
    const r = await GET_VALIDAR(req("/x"), params({ codigo: "LF-7KQ3-M9XA-2P" }));
    expect((await r.json()).resultado).toBe("valido");
  });
});
