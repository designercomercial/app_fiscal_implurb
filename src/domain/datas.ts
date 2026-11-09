/** Datas no fuso de Manaus (America/Manaus, UTC-4, sem horário de verão). */
export const FUSO_MANAUS = "America/Manaus";

const DATA_ISO_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function ehDataIso(valor: unknown): valor is string {
  if (typeof valor !== "string" || !DATA_ISO_REGEX.test(valor)) return false;
  const d = new Date(`${valor}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === valor;
}

/** Data de hoje (AAAA-MM-DD) em Manaus. */
export function hojeManaus(agora: Date = new Date()): string {
  // en-CA formata como AAAA-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO_MANAUS,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(agora);
}

export function somarDias(dataIso: string, dias: number): string {
  const d = new Date(`${dataIso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** "Segunda-feira, 10 de novembro" */
export function dataPorExtenso(dataIso: string): string {
  const d = new Date(`${dataIso}T12:00:00Z`);
  const texto = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(d);
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** "10/11" */
export function dataCurta(dataIso: string): string {
  const [, m, d] = dataIso.split("-");
  return `${d}/${m}`;
}

/** "07:40", no fuso de Manaus */
export function horaManaus(iso: string | number | Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: FUSO_MANAUS,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** "10/11 às 07:40", no fuso de Manaus */
export function dataHoraManaus(iso: string | number | Date): string {
  const d = new Date(iso);
  const data = new Intl.DateTimeFormat("pt-BR", {
    timeZone: FUSO_MANAUS,
    day: "2-digit",
    month: "2-digit",
  }).format(d);
  return `${data} às ${horaManaus(d)}`;
}

/** ISO 8601 com o deslocamento de Manaus (-04:00). */
export function agoraIsoManaus(agora: Date = new Date()): string {
  const local = new Date(agora.getTime() - 4 * 60 * 60 * 1000);
  return `${local.toISOString().slice(0, 19)}-04:00`;
}
