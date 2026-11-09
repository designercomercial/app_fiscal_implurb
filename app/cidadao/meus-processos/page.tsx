import type { Metadata } from "next";
import { MeusProcessosApp } from "@/components/cidadao/MeusProcessosApp";

export const metadata: Metadata = { title: "Meus processos · Libera Fácil" };

/** Canal URL "Acompanhar Meus Processos" do App do Cidadão (SASI). Requer login. */
export default function MeusProcessosPage() {
  return <MeusProcessosApp />;
}
