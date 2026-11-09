import type { Acao } from "./acao";

type Local = Pick<Acao, "endereco" | "bairro" | "latitude" | "longitude">;

function temCoordenadas(l: Local): l is Local & { latitude: number; longitude: number } {
  return typeof l.latitude === "number" && typeof l.longitude === "number";
}

function enderecoCompleto(l: Local): string {
  return `${l.endereco}, ${l.bairro}, Manaus - AM`;
}

/** Abre a rota no Google Maps (app, se instalado; senão, navegador). */
export function linkGoogleMaps(l: Local): string {
  const destino = temCoordenadas(l) ? `${l.latitude},${l.longitude}` : enderecoCompleto(l);
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destino)}`;
}

/** Abre a navegação no Waze. */
export function linkWaze(l: Local): string {
  if (temCoordenadas(l)) {
    return `https://waze.com/ul?ll=${encodeURIComponent(`${l.latitude},${l.longitude}`)}&navigate=yes`;
  }
  return `https://waze.com/ul?q=${encodeURIComponent(enderecoCompleto(l))}&navigate=yes`;
}
