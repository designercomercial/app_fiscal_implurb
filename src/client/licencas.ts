import type { Licenca, RespostaBuscaLicencas } from "@/domain/licenca";
import { parametrosRepassados, requisitar } from "./api";

export function buscarLicencas(termo: string): Promise<RespostaBuscaLicencas> {
  const p = parametrosRepassados();
  p.set("q", termo);
  return requisitar<RespostaBuscaLicencas>(`/api/fiscal/licencas?${p.toString()}`);
}

export async function obterLicenca(numero: string): Promise<Licenca> {
  const qs = parametrosRepassados().toString();
  const r = await requisitar<{ licenca: Licenca }>(
    `/api/fiscal/licencas/${encodeURIComponent(numero)}${qs ? `?${qs}` : ""}`,
  );
  return r.licenca;
}

/* ------------------------------------------------------------------
 * Consultas recentes: guardadas no aparelho para uso sem internet.
 * Toda leitura/escrita é protegida (webviews podem bloquear o armazenamento).
 * ------------------------------------------------------------------ */

const CHAVE = "lf:licencas-recentes:v1";
export const MAX_RECENTES = 15;

export interface LicencaSalva {
  licenca: Licenca;
  /** ms desde epoch: quando os dados vieram do servidor */
  salvoEm: number;
}

export function lerRecentes(): LicencaSalva[] {
  try {
    const bruto = window.localStorage.getItem(CHAVE);
    const lista = bruto ? (JSON.parse(bruto) as LicencaSalva[]) : [];
    return Array.isArray(lista) ? lista.filter((x) => x?.licenca?.numero_processo) : [];
  } catch {
    return [];
  }
}

export function salvarRecente(licenca: Licenca, salvoEm = Date.now()): LicencaSalva[] {
  const lista = [
    { licenca, salvoEm },
    ...lerRecentes().filter((x) => x.licenca.numero_processo !== licenca.numero_processo),
  ].slice(0, MAX_RECENTES);
  try {
    window.localStorage.setItem(CHAVE, JSON.stringify(lista));
  } catch {
    /* sem armazenamento: segue sem histórico */
  }
  return lista;
}
