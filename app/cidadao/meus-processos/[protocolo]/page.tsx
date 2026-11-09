import type { Metadata } from "next";
import { DetalheProcessoApp } from "@/components/cidadao/DetalheProcessoApp";

export const metadata: Metadata = { title: "Processo · Libera Fácil" };

/** Detalhe de um processo do cidadão. O acesso é validado na API (só participantes). */
export default async function DetalheProcessoPage({ params }: { params: Promise<{ protocolo: string }> }) {
  const { protocolo } = await params;
  return <DetalheProcessoApp protocolo={decodeURIComponent(protocolo)} />;
}
