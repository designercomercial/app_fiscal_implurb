import { reiniciarRepositorioMock } from "@/server/acoes-repo";
import { json } from "@/server/http";

export const dynamic = "force-dynamic";

/** SOMENTE DESENVOLVIMENTO/TESTES: volta os dados mock ao estado inicial. */
export async function POST() {
  if (process.env.NODE_ENV === "production" && process.env.LF_HABILITAR_SIMULADOR !== "1") {
    return json({ erro: { codigo: "NAO_DISPONIVEL", mensagem: "Indisponível." } }, 404);
  }
  reiniciarRepositorioMock();
  return json({ ok: true });
}
