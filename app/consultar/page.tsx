import type { Metadata } from "next";
import { ConsultaProtocoloApp } from "@/components/cidadao/ConsultaProtocoloApp";

export const metadata: Metadata = { title: "Consultar por protocolo · Libera Fácil" };

/** Canal URL "Consultar por Protocolo" do App do Cidadão (SASI). Pública. */
export default function ConsultarPage() {
  return <ConsultaProtocoloApp />;
}
