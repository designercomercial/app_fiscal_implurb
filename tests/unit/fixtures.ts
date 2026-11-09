import type { Acao } from "@/domain/acao";

export const HOJE = "2026-11-10";

export function acaoFake(parcial: Partial<Acao> = {}): Acao {
  return {
    codigo: "ACAO-2026-001245",
    tipo: "vistoria_obra",
    origem: "denuncia",
    prioridade: "alta",
    prazo: HOJE,
    status: "pendente",
    endereco: "Rua Pará, 300",
    bairro: "Adrianópolis",
    ponto_referencia: "Ao lado da farmácia",
    latitude: -3.1019,
    longitude: -60.0131,
    numero_processo: "2026.000.4587",
    numero_alvara: null,
    nome_proprietario: "Maria Oliveira Santos",
    orientacao_chefia: "Denúncia de calçada obstruída. Verificar tapume.",
    ordem_rota: 1,
    atualizado_em: "2026-11-10T07:40:00-04:00",
    ...parcial,
  };
}
